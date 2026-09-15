import React, { useState, useEffect } from 'react'
import { vehicleService, obdCapabilityService } from '@/services/vehicles'
import { clientService, workOrderService } from '@/services/commercial'
import { investigationService } from '@/services/investigations'
import { VehicleModel, ObdCapabilityModel } from '@/types/obd'
import { ClientModel, WorkOrderModel } from '@/types/commercial'
import { DiagnosticInvestigationModel } from '@/types/investigation'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Car,
  Plus,
  Edit2,
  Trash2,
  Cpu,
  CheckCircle2,
  AlertCircle,
  User,
  Clock,
  Wrench,
  FileText,
  Calendar,
  Layers,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

export default function Veiculos() {
  const { toast } = useToast()
  const { vehicles, selectedVehicle, setSelectedVehicle, refreshVehicles } = useTelemetry()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<VehicleModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedCapability, setSelectedCapability] = useState<ObdCapabilityModel | null>(null)

  // Clientes para proprietário (Requisito 3)
  const [clients, setClients] = useState<ClientModel[]>([])
  const [vehicleOrders, setVehicleOrders] = useState<WorkOrderModel[]>([])
  const [vehicleInvestigations, setVehicleInvestigations] = useState<
    DiagnosticInvestigationModel[]
  >([])

  // Formulário
  const [formData, setFormData] = useState({
    plate: '',
    make: '',
    model: '',
    version: '',
    year_model: '',
    engine: '',
    fuel: 'Flex',
    transmission: 'Manual',
    odometer_km: 0,
    vin: '',
    notes: '',
    client: '',
  })

  // Carrega clientes disponíveis
  useEffect(() => {
    clientService.getAll().then((cls) => setClients(cls))
  }, [])

  // Carrega histórico técnico e ordens anteriores do veículo selecionado (Requisito 3 & 13)
  useEffect(() => {
    if (selectedVehicle?.id) {
      obdCapabilityService.getByVehicleId(selectedVehicle.id).then((cap) => {
        setSelectedCapability(cap)
      })

      if (selectedVehicle.plate) {
        workOrderService.getByVehiclePlate(selectedVehicle.plate).then((osList) => {
          setVehicleOrders(osList)
        })

        investigationService.getAll().then((invList) => {
          const filtered = invList.filter(
            (i) =>
              i.vehicle === selectedVehicle.id ||
              i.vehicle_plate.toUpperCase() === selectedVehicle.plate.toUpperCase(),
          )
          setVehicleInvestigations(filtered)
        })
      }
    }
  }, [selectedVehicle])

  const openNewModal = () => {
    setEditingVehicle(null)
    setFormData({
      plate: '',
      make: '',
      model: '',
      version: '',
      year_model: '',
      engine: '',
      fuel: 'Flex',
      transmission: 'Manual',
      odometer_km: 0,
      vin: '',
      notes: '',
      client: '',
    })
    setModalOpen(true)
  }

  const openEditModal = (v: VehicleModel) => {
    setEditingVehicle(v)
    setFormData({
      plate: v.plate,
      make: v.make,
      model: v.model,
      version: v.version || '',
      year_model: v.year_model || '',
      engine: v.engine || '',
      fuel: v.fuel || 'Flex',
      transmission: v.transmission || 'Manual',
      odometer_km: v.odometer_km || 0,
      vin: v.vin || '',
      notes: v.notes || '',
      client: (v as any).client || '',
    })
    setModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.plate || !formData.make || !formData.model) {
      toast({
        title: 'Campos Obrigatórios',
        description: 'Placa, Fabricante e Modelo são obrigatórios.',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      if (editingVehicle?.id) {
        await vehicleService.update(editingVehicle.id, formData)
        toast({ title: 'Veículo Atualizado', description: `Dados de ${formData.plate} salvos.` })
      } else {
        await vehicleService.create(formData)
        toast({
          title: 'Veículo Cadastrado',
          description: `Veículo ${formData.plate} criado com sucesso.`,
        })
      }
      setModalOpen(false)
      await refreshVehicles()
    } catch (err: any) {
      toast({
        title: 'Erro ao Salvar',
        description: err?.message || 'Falha na gravação do perfil veicular.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (v: VehicleModel) => {
    if (!v.id) return
    if (!confirm(`Deseja realmente remover o veículo ${v.plate} — ${v.make} ${v.model}?`)) return
    try {
      await vehicleService.delete(v.id)
      toast({ title: 'Veículo Removido', description: 'Registro apagado com sucesso.' })
      await refreshVehicles()
    } catch (err: any) {
      toast({ title: 'Erro ao Excluir', description: err?.message, variant: 'destructive' })
    }
  }

  // Proprietário do veículo selecionado
  const currentOwner = clients.find((c) => c.id === (selectedVehicle as any)?.client)

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Car className="w-5 h-5 text-[#FFB300]" />
            <span>Cadastro & Timeline Técnica dos Veículos</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Relação 1 Cliente → N Veículos, assinatura OBD-II, histórico unificado e timeline
            técnica sem duplicação.
          </p>
        </div>

        <Button
          onClick={openNewModal}
          className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs shadow"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Veículo
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Veículos */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider">
              Veículos Cadastrados ({vehicles.length})
            </h2>
          </div>

          <div className="space-y-2">
            {vehicles.map((v) => {
              const isSelected = selectedVehicle?.id === v.id
              const owner = clients.find((c) => c.id === (v as any).client)

              return (
                <div
                  key={v.id || v.plate}
                  onClick={() => setSelectedVehicle(v)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#1A232E] border-[#FFB300] ring-1 ring-[#FFB300]'
                      : 'bg-[#131A22] border-[#263340] hover:border-gray-600 hover:bg-[#1A232E]/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm text-white">
                      {v.make} {v.model}
                    </span>
                    <span className="bg-[#0B0F14] text-[#FFB300] font-mono font-bold text-xs px-2 py-0.5 rounded border border-[#263340]">
                      {v.plate}
                    </span>
                  </div>

                  <div className="text-xs text-[#9AA7B4] space-y-0.5">
                    <div>
                      {v.version || 'Versão padrão'} • {v.year_model || 'Ano N/D'}
                    </div>
                    {owner && (
                      <div className="text-emerald-400 font-semibold flex items-center gap-1">
                        <User className="w-3 h-3 text-[#FFB300]" /> Prop: {owner.name}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-[#263340] text-[11px]">
                    <span className="text-emerald-400 flex items-center space-x-1">
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-[#2ECC71]" />
                          <span>Selecionado</span>
                        </>
                      ) : (
                        <span className="text-gray-500">Clique para selecionar</span>
                      )}
                    </span>

                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditModal(v)
                        }}
                        className="h-7 w-7 p-0 text-[#9AA7B4] hover:text-white"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(v)
                        }}
                        className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Detalhes, Proprietário, Assinatura OBD e Timeline Unificada (Requisitos 3 & 13) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedVehicle ? (
            <div className="space-y-6">
              {/* Card 1: Ficha Técnica e Proprietário */}
              <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#263340]">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-white">
                        {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.version}
                      </span>
                      <span className="bg-[#FFB300] text-black font-bold font-mono text-xs px-2 py-0.5 rounded">
                        {selectedVehicle.plate}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[#9AA7B4]">
                      VIN / Chassi: {selectedVehicle.vin || 'Não disponível'}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => openEditModal(selectedVehicle)}
                    className="bg-[#1A232E] hover:bg-[#263340] text-white border border-[#263340] text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                    Editar Perfil
                  </Button>
                </div>

                {/* Proprietário Atual (Requisito 3) */}
                <div className="bg-[#1A232E] p-3 rounded border border-[#263340] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#9AA7B4] uppercase font-bold block">
                      Proprietário Cadastrado:
                    </span>
                    {currentOwner ? (
                      <div className="font-semibold text-white text-xs mt-0.5 flex items-center gap-2">
                        <span>{currentOwner.name}</span>
                        <span className="text-[#9AA7B4] font-normal">({currentOwner.phone})</span>
                        {currentOwner.document && (
                          <span className="text-gray-400 font-mono text-[11px]">
                            • CPF: {currentOwner.document}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs italic">
                        Nenhum proprietário vinculado. Edite o perfil para associar um cliente.
                      </span>
                    )}
                  </div>
                  {currentOwner && (
                    <Badge
                      variant="outline"
                      className="border-[#FFB300] text-[#FFB300] text-[10px]"
                    >
                      Cliente Oficina
                    </Badge>
                  )}
                </div>

                {/* Ficha Técnica */}
                <div>
                  <h3 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
                    Especificações Técnicas do Veículo
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                      <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                        Motorização:
                      </span>
                      <span className="font-semibold text-white">
                        {selectedVehicle.engine || 'Genérico'}
                      </span>
                    </div>
                    <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                      <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                        Combustível:
                      </span>
                      <span className="font-semibold text-white">
                        {selectedVehicle.fuel || 'Flex'}
                      </span>
                    </div>
                    <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                      <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                        Câmbio / Transmissão:
                      </span>
                      <span className="font-semibold text-white">
                        {selectedVehicle.transmission || 'Manual'}
                      </span>
                    </div>
                    <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                      <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                        Ano / Modelo:
                      </span>
                      <span className="font-semibold text-white">
                        {selectedVehicle.year_model || 'N/D'}
                      </span>
                    </div>
                    <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                      <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                        Odômetro Atual:
                      </span>
                      <span className="font-mono text-[#2ECC71]">
                        {selectedVehicle.odometer_km
                          ? `${selectedVehicle.odometer_km.toLocaleString('pt-BR')} km`
                          : 'Não informado'}
                      </span>
                    </div>
                    <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                      <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                        Arquitetura:
                      </span>
                      <span className="text-blue-400 font-semibold">
                        Genérico OBD-II / SAE J1979
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assinatura OBD */}
                <div>
                  <h3 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Cpu className="w-4 h-4 text-[#FFB300]" />
                    <span>Assinatura OBD Registrada</span>
                  </h3>
                  {selectedCapability ? (
                    <div className="bg-[#0B0F14] border border-[#263340] rounded p-4 space-y-2 text-xs">
                      <div className="flex flex-wrap gap-4 text-gray-300">
                        <span>
                          Protocolo: <strong>{selectedCapability.protocol_detected}</strong>
                        </span>
                        <span>
                          Adaptador:{' '}
                          <strong className="text-blue-400">
                            {selectedCapability.adapter_name || selectedCapability.adapter_type}
                          </strong>
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono">
                        PIDs Suportados: {selectedCapability.pids_supported.join(', ')}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] text-xs text-[#9AA7B4]">
                      Nenhuma assinatura OBD gravada ainda.
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: TIMELINE TÉCNICA UNIFICADA DO VEÍCULO (Requisitos 3 & 13) */}
              <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#263340]">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#FFB300]" />
                    Timeline Técnica Unificada & Histórico Completo
                  </h3>
                  <Badge variant="outline" className="border-gray-600 text-gray-300 text-[10px]">
                    Não duplica dados técnicos — referências cruzadas
                  </Badge>
                </div>

                {vehicleOrders.length === 0 && vehicleInvestigations.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#9AA7B4]">
                    Nenhum histórico operacional ou diagnóstico registrado para esta placa.
                  </div>
                ) : (
                  <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-[#263340]">
                    {/* Eventos de Investigação Diagnóstica */}
                    {vehicleInvestigations.map((inv) => (
                      <div key={inv.id} className="relative flex items-start gap-3 pl-8 text-xs">
                        <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-purple-500 ring-4 ring-[#131A22]" />
                        <div className="flex-1 bg-[#1A232E] p-3 rounded-lg border border-[#263340] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-purple-400">
                              {inv.investigation_number}
                            </span>
                            <Badge className="bg-purple-950 text-purple-300 border-purple-800 text-[10px]">
                              DIAGNÓSTICO 360
                            </Badge>
                          </div>
                          <div className="text-white font-medium">
                            Queixa: {inv.client_complaint?.description || 'Investigação técnica'}
                          </div>
                          {inv.status === 'CONCLUIDA' && (
                            <div className="text-[11px] text-emerald-400 font-semibold">
                              Laudo confirmado tecnicamente por testes cruzados.
                            </div>
                          )}
                          <div className="text-[10px] text-gray-500 font-mono">
                            Status: {inv.status} • Odômetro: {inv.odometer_km} km
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Eventos de Ordens de Serviço Comerciais */}
                    {vehicleOrders.map((os) => (
                      <div key={os.id} className="relative flex items-start gap-3 pl-8 text-xs">
                        <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full bg-[#FFB300] ring-4 ring-[#131A22]" />
                        <div className="flex-1 bg-[#1A232E] p-3 rounded-lg border border-[#263340] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-[#FFB300]">
                              {os.order_number}
                            </span>
                            <Badge className="bg-amber-950 text-amber-300 border-amber-800 text-[10px]">
                              {os.status}
                            </Badge>
                          </div>

                          {os.confirmed_diagnosis && (
                            <div className="text-[11px] text-emerald-400 font-semibold bg-[#0B0F14] p-1.5 rounded border border-[#263340]">
                              Diagnóstico Confirmado: {os.confirmed_diagnosis}
                            </div>
                          )}

                          <div className="text-gray-300">
                            Itens do Serviço:{' '}
                            {os.items.map((i) => i.description).join(', ') || 'Nenhum item'}
                          </div>

                          {os.post_repair_result && (
                            <div className="text-[11px] text-purple-300 bg-purple-950/40 p-1.5 rounded border border-purple-800/40">
                              Validação Pós-Reparo: {os.post_repair_result.outcome} (
                              {os.post_repair_result.verdict})
                            </div>
                          )}

                          <div className="text-[10px] text-gray-500 font-mono flex items-center justify-between">
                            <span>Aprovação: {os.approval_status}</span>
                            <span className="font-bold text-[#FFB300]">
                              Total: R$ {os.approved_total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#131A22] border border-[#263340] rounded-lg p-12 text-center text-xs text-[#9AA7B4]">
              Selecione um veículo à esquerda ou cadastre um novo para visualizar o perfil e sua
              capacidade OBD.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Criação / Edição de Veículo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#131A22] border-[#263340] text-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center space-x-2">
              <Car className="w-5 h-5 text-[#FFB300]" />
              <span>{editingVehicle ? 'Editar Perfil do Veículo' : 'Cadastrar Novo Veículo'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs pt-2">
            {/* Seleção de Proprietário (Requisito 3) */}
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Cliente / Proprietário (1 Cliente → N Veículos):
              </label>
              <Select
                value={formData.client}
                onValueChange={(val) => setFormData({ ...formData, client: val })}
              >
                <SelectTrigger className="bg-[#0B0F14] border-[#263340] text-white">
                  <SelectValue placeholder="Selecione o proprietário do veículo..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1A232E] border-[#263340] text-white text-xs">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} — {c.phone} {c.document ? `(CPF: ${c.document})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Placa *:</label>
                <Input
                  required
                  value={formData.plate}
                  onChange={(e) =>
                    setFormData({ ...formData, plate: e.target.value.toUpperCase() })
                  }
                  placeholder="Ex: BRA2E20"
                  className="bg-[#0B0F14] border-[#263340] text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">
                  Fabricante / Marca *:
                </label>
                <Input
                  required
                  value={formData.make}
                  onChange={(e) => setFormData({ ...formData, make: e.target.value })}
                  placeholder="Ex: Ford, Volkswagen, Fiat"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Modelo *:</label>
                <Input
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Ex: EcoSport, T-Cross"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">
                  Versão / Acabamento:
                </label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="Ex: Freestyle 1.5 AT"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Ano / Modelo:</label>
                <Input
                  value={formData.year_model}
                  onChange={(e) => setFormData({ ...formData, year_model: e.target.value })}
                  placeholder="Ex: 2020/2020"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Motorização:</label>
                <Input
                  value={formData.engine}
                  onChange={(e) => setFormData({ ...formData, engine: e.target.value })}
                  placeholder="Ex: 1.5 Dragon 3C / 1.0 TSI"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Combustível:</label>
                <Input
                  value={formData.fuel}
                  onChange={(e) => setFormData({ ...formData, fuel: e.target.value })}
                  placeholder="Ex: Flex, Gasolina, Diesel"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Transmissão:</label>
                <Input
                  value={formData.transmission}
                  onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
                  placeholder="Ex: Automático 6M / Manual"
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">Quilometragem (km):</label>
                <Input
                  type="number"
                  value={formData.odometer_km}
                  onChange={(e) =>
                    setFormData({ ...formData, odometer_km: parseInt(e.target.value) || 0 })
                  }
                  className="bg-[#0B0F14] border-[#263340] text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Chassi / VIN (quando disponível):
              </label>
              <Input
                value={formData.vin}
                onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
                placeholder="Ex: 9BFBJ55E6L8104921"
                className="bg-[#0B0F14] border-[#263340] text-white font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Observações Mecânicas:
              </label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Sintomas relatados pelo cliente, histórico de manutenção..."
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
            </div>

            <DialogFooter className="pt-3 border-t border-[#263340]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#263340] text-[#9AA7B4] hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold"
              >
                {loading ? 'Salvando...' : 'Salvar Veículo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
