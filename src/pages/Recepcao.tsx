import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LogIn,
  Car,
  User,
  Clock,
  Gauge,
  ClipboardList,
  AlertTriangle,
  Play,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { clientService, receptionService, workOrderService } from '@/services/commercial'
import { vehicleService } from '@/services/vehicles'
import { investigationService } from '@/services/investigations'
import { ClientModel, EntryReason, VehicleReceptionModel } from '@/types/commercial'
import { VehicleModel } from '@/types/obd'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export default function Recepcao() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientModel[]>([])
  const [vehicles, setVehicles] = useState<VehicleModel[]>([])
  const [recentReceptions, setRecentReceptions] = useState<VehicleReceptionModel[]>([])
  const [loading, setLoading] = useState(true)

  // Form states
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [odometerKm, setOdometerKm] = useState<number | ''>('')
  const [entryReason, setEntryReason] = useState<EntryReason>('diagnostico')
  const [notes, setNotes] = useState('')
  const [autoOpenDiag, setAutoOpenDiag] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [cls, vecs, recs] = await Promise.all([
        clientService.getAll(),
        vehicleService.getAll(),
        receptionService.getAll(),
      ])
      setClients(cls)
      setVehicles(vecs)
      setRecentReceptions(recs)
    } catch {
      toast.error('Erro ao carregar dados de recepção.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Quando seleciona cliente, filtra veículos ou vice-versa
  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const clientVehicles = vehicles.filter((v: any) => v.client === clientId)
    if (clientVehicles.length === 1) {
      setSelectedVehicleId(clientVehicles[0].id || '')
      if (clientVehicles[0].odometer_km) {
        setOdometerKm(clientVehicles[0].odometer_km)
      }
    }
  }

  const handleVehicleChange = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId)
    const veh = vehicles.find((v) => v.id === vehicleId)
    if (veh) {
      if ((veh as any).client) {
        setSelectedClientId((veh as any).client)
      }
      if (veh.odometer_km) {
        setOdometerKm(veh.odometer_km)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClientId || !selectedVehicleId || odometerKm === '') {
      toast.error('Selecione cliente, veículo e informe a quilometragem.')
      return
    }

    const veh = vehicles.find((v) => v.id === selectedVehicleId)
    if (!veh) return

    try {
      // 1. Cria a entrada rápida na oficina
      const reception = await receptionService.create({
        workshop_id: (user as any)?.workshop_id || 'wsnetmatriz0001',
        client: selectedClientId,
        vehicle: selectedVehicleId,
        vehicle_plate: veh.plate,
        odometer_km: Number(odometerKm),
        entry_reason: entryReason,
        notes,
        responsible: user?.name || user?.email || 'Recepção Network Car',
        entry_date: new Date().toISOString(),
        status: 'ABERTO',
      })

      // Atualiza quilometragem cadastral do veículo
      await vehicleService.update(veh.id!, {
        odometer_km: Number(odometerKm),
      })

      // 2. Criação automática de OS Comercial preliminar vinculada (Requisito 4 & 5)
      const newWorkOrder = await workOrderService.create(
        {
          workshop_id: (user as any)?.workshop_id || 'wsnetmatriz0001',
          client: selectedClientId,
          vehicle: selectedVehicleId,
          vehicle_plate: veh.plate,
          reception: reception.id,
          odometer_km: Number(odometerKm),
          status: entryReason === 'diagnostico' ? 'AGUARDANDO_DIAGNOSTICO' : 'RASCUNHO',
          approval_status: 'PENDENTE',
          items: [],
          budget_notes: `Atendimento aberto via recepção (${entryReason}). Queixa: ${notes || 'Sem observações adicionais.'}`,
        },
        {
          id: user?.id,
          name: user?.name || user?.email || 'Recepção',
          role: (user as any)?.role || 'RECEPCAO',
        },
      )

      // 3. Se for diagnóstico e marcado para abrir imediatamente (Requisito 4)
      if (entryReason === 'diagnostico' && autoOpenDiag) {
        const diagInv = await investigationService.create({
          vehicle: veh.id,
          vehicle_plate: veh.plate,
          vehicle_model: `${veh.make} ${veh.model}`,
          odometer_km: Number(odometerKm),
          status: 'ABERTA',
          client_complaint: {
            description: notes || 'Queixa relatada na recepção para diagnóstico',
            whenOccurs: 'CONDICIONADO',
            engineState: 'QUENTE',
            movementState: 'EM_MOVIMENTO',
            accelerationState: 'ACELERANDO',
            frequency: 'MUITAS_VEZES_DIA',
            symptomsSelected: {
              checkEngineLight: true,
              noise: false,
              vibration: true,
              powerLoss: true,
              highFuelConsumption: false,
              hardStart: false,
              engineStall: false,
            },
            registeredAtUtc: new Date().toISOString(),
          },
        })

        // Vincula a investigação à OS
        await workOrderService.updateBudget(
          newWorkOrder.id,
          [],
          newWorkOrder.budget_notes || '',
          {
            id: user?.id,
            name: user?.name || 'Recepção',
            role: (user as any)?.role,
          },
          {
            ...newWorkOrder,
            diagnostic_investigation: diagInv.id,
          },
        )

        toast.success(
          `Atendimento ${reception.reception_number} criado com OS ${newWorkOrder.order_number}! Redirecionando para o Diagnóstico 360...`,
        )
        navigate('/replay')
        return
      }

      toast.success(
        `Atendimento ${reception.reception_number} registrado com sucesso e OS ${newWorkOrder.order_number} gerada!`,
      )
      loadData()
      setNotes('')
    } catch (err: any) {
      toast.error('Falha ao registrar entrada: ' + (err?.message || 'erro desconhecido.'))
    }
  }

  const clientVehicles = selectedClientId
    ? vehicles.filter((v: any) => v.client === selectedClientId)
    : vehicles

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <LogIn className="w-7 h-7 text-[#FFB300]" />
          Recepção de Veículos — Entrada Rápida
        </h1>
        <p className="text-sm text-[#9AA7B4]">
          Fluxo ágil de check-in: Cliente → Veículo → Quilometragem → Motivo → Abertura de
          Diagnóstico ou OS Comercial.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulário de Recepção */}
        <div className="lg:col-span-2">
          <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
            <CardHeader className="pb-4 border-b border-[#263340]">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#FFB300]" />
                Formulário de Entrada de Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Seleção de Cliente */}
                  <div>
                    <Label className="text-[#9AA7B4] flex items-center gap-1.5 mb-1.5">
                      <User className="w-3.5 h-3.5 text-[#FFB300]" />
                      Proprietário / Cliente *
                    </Label>
                    <Select value={selectedClientId} onValueChange={handleClientChange}>
                      <SelectTrigger className="bg-[#1A232E] border-[#263340] text-white">
                        <SelectValue placeholder="Selecione o cliente..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A232E] border-[#263340] text-white">
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seleção de Veículo */}
                  <div>
                    <Label className="text-[#9AA7B4] flex items-center gap-1.5 mb-1.5">
                      <Car className="w-3.5 h-3.5 text-[#FFB300]" />
                      Veículo da Oficina *
                    </Label>
                    <Select value={selectedVehicleId} onValueChange={handleVehicleChange}>
                      <SelectTrigger className="bg-[#1A232E] border-[#263340] text-white">
                        <SelectValue placeholder="Selecione o veículo pela placa..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A232E] border-[#263340] text-white">
                        {clientVehicles.map((v) => (
                          <SelectItem key={v.id} value={v.id!}>
                            {v.plate} — {v.make} {v.model} ({v.year_model || 'N/A'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Quilometragem Atual */}
                  <div>
                    <Label className="text-[#9AA7B4] flex items-center gap-1.5 mb-1.5">
                      <Gauge className="w-3.5 h-3.5 text-[#FFB300]" />
                      Quilometragem Atual (km) *
                    </Label>
                    <Input
                      type="number"
                      className="bg-[#1A232E] border-[#263340] text-white font-mono"
                      value={odometerKm}
                      onChange={(e) =>
                        setOdometerKm(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder="Ex: 48500"
                      required
                    />
                  </div>

                  {/* Motivo da Entrada */}
                  <div>
                    <Label className="text-[#9AA7B4] flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#FFB300]" />
                      Motivo Principal da Entrada *
                    </Label>
                    <Select
                      value={entryReason}
                      onValueChange={(val: EntryReason) => setEntryReason(val)}
                    >
                      <SelectTrigger className="bg-[#1A232E] border-[#263340] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A232E] border-[#263340] text-white">
                        <SelectItem value="diagnostico">
                          Diagnóstico Avançado (Falha/Trepidação/Luz Injeção)
                        </SelectItem>
                        <SelectItem value="manutencao">Manutenção Preventiva</SelectItem>
                        <SelectItem value="revisao">Revisão Programada</SelectItem>
                        <SelectItem value="reparo">Reparo Específico Pré-determinado</SelectItem>
                        <SelectItem value="retorno">Retorno / Garantia</SelectItem>
                        <SelectItem value="outros">Outros Atendimentos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Queixa / Observações */}
                <div>
                  <Label className="text-[#9AA7B4] mb-1.5 block">
                    Observações / Relato do Cliente sobre a Entrada
                  </Label>
                  <Textarea
                    className="bg-[#1A232E] border-[#263340] text-white"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Ex: Cliente relata trepidação ao engatar a 2ª marcha e luz de injeção acesa intermitente..."
                  />
                </div>

                {entryReason === 'diagnostico' && (
                  <div className="bg-[#1A232E] p-3 rounded-lg border border-[#FFB300]/30 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-white block">
                        Vincular e Iniciar Ordem de Diagnóstico 360 Imediatamente
                      </span>
                      <span className="text-[#9AA7B4] text-[11px]">
                        Cria a sessão de investigação mantendo a rastreabilidade independente da OS.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      id="autoDiag"
                      checked={autoOpenDiag}
                      onChange={(e) => setAutoOpenDiag(e.target.checked)}
                      className="w-4 h-4 accent-[#FFB300] cursor-pointer"
                    />
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <Button
                    type="submit"
                    className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold text-xs px-6 py-2 h-auto"
                  >
                    <Play className="w-4 h-4 mr-1.5" />
                    Abrir Atendimento & Gerar OS
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Entradas Recentes */}
        <div>
          <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
            <CardHeader className="pb-3 border-b border-[#263340]">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#FFB300]" />
                Últimas Entradas Registradas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 text-xs">
              {recentReceptions.length === 0 ? (
                <div className="text-center py-6 text-[#9AA7B4]">Nenhuma entrada recente.</div>
              ) : (
                recentReceptions.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="bg-[#1A232E] p-3 rounded-lg border border-[#263340] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#FFB300]">
                        {r.reception_number}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-gray-600 text-gray-300"
                      >
                        {r.entry_reason.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="font-mono text-white text-xs">
                      Placa: {r.vehicle_plate} • {r.odometer_km?.toLocaleString('pt-BR')} km
                    </div>
                    <div className="text-[11px] text-[#9AA7B4] flex items-center justify-between">
                      <span>Resp: {r.responsible}</span>
                      <span>{new Date(r.entry_date).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
