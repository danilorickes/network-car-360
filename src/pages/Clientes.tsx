import React, { useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  Search,
  Phone,
  Mail,
  MapPin,
  Car,
  FileText,
  CheckCircle,
  XCircle,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { clientService } from '@/services/commercial'
import { vehicleService } from '@/services/vehicles'
import { ClientModel } from '@/types/commercial'
import { VehicleModel } from '@/types/obd'
import { useAuth } from '@/contexts/AuthContext'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowRight, ExternalLink, Zap } from 'lucide-react'

export default function Clientes() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { setSelectedVehicle, refreshVehicles } = useTelemetry()
  const [clients, setClients] = useState<ClientModel[]>([])
  const [vehicles, setVehicles] = useState<VehicleModel[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<ClientModel | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Modal rápido de Adicionar Veículo para o Cliente
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false)
  const [targetClientForVehicle, setTargetClientForVehicle] = useState<ClientModel | null>(null)
  const [savingVehicle, setSavingVehicle] = useState(false)

  // Form states - Cliente
  const [formName, setFormName] = useState('')
  const [formDoc, setFormDoc] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formWhatsapp, setFormWhatsapp] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Form states - Novo Veículo vinculado ao Cliente
  const [vFormPlate, setVFormPlate] = useState('')
  const [vFormMake, setVFormMake] = useState('')
  const [vFormModel, setVFormModel] = useState('')
  const [vFormVersion, setVFormVersion] = useState('')
  const [vFormYear, setVFormYear] = useState('')
  const [vFormEngine, setVFormEngine] = useState('')
  const [vFormFuel, setVFormFuel] = useState('Flex')
  const [vFormOdometer, setVFormOdometer] = useState<number | ''>('')
  const [vFormVin, setVFormVin] = useState('')
  const [vFormNotes, setVFormNotes] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [cls, vecs] = await Promise.all([clientService.getAll(), vehicleService.getAll()])
      setClients(cls)
      setVehicles(vecs)
    } catch {
      toast.error('Erro ao carregar clientes do banco.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const q = searchQuery.trim()
    try {
      if (!q) {
        await loadData()
        return
      }

      // Busca abrangente: por nome, telefone, documento do cliente OU placa do veículo vinculado
      const [allCls, allVecs] = await Promise.all([clientService.getAll(), vehicleService.getAll()])
      const qLower = q.toLowerCase()
      const qUpper = q.toUpperCase()

      // Encontra placas que casam com a busca
      const matchingVehicles = allVecs.filter(
        (v) =>
          v.plate.toUpperCase().includes(qUpper) ||
          (v.make && v.make.toLowerCase().includes(qLower)) ||
          (v.model && v.model.toLowerCase().includes(qLower)),
      )
      const matchingClientIdsFromVehicles = new Set(
        matchingVehicles.map((v: any) => v.client).filter(Boolean),
      )

      const filtered = allCls.filter((c) => {
        const matchesClientData =
          c.name.toLowerCase().includes(qLower) ||
          (c.phone && c.phone.includes(q)) ||
          (c.whatsapp && c.whatsapp.includes(q)) ||
          (c.document && c.document.includes(q))
        const matchesVehicle = matchingClientIdsFromVehicles.has(c.id)
        return matchesClientData || matchesVehicle
      })

      setClients(filtered)
      setVehicles(allVecs)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim() || !formPhone.trim()) {
      toast.error('Nome e telefone são campos obrigatórios.')
      return
    }

    // Prevenção de duplicidade por pequenas diferenças de escrita (Requisito 2)
    const existing = clients.find(
      (c) =>
        c.phone.replace(/\D/g, '') === formPhone.replace(/\D/g, '') ||
        (formDoc && c.document && c.document.replace(/\D/g, '') === formDoc.replace(/\D/g, '')),
    )
    if (existing) {
      toast.warning(
        `Atenção: Cliente já cadastrado com este telefone/documento (${existing.name}).`,
      )
    }

    try {
      await clientService.create({
        workshop_id: (user as any)?.workshop_id,
        name: formName.trim(),
        document: formDoc.trim(),
        phone: formPhone.trim(),
        whatsapp: formWhatsapp.trim() || formPhone.trim(),
        email: formEmail.trim(),
        address: formAddress.trim(),
        notes: formNotes.trim(),
        active: true,
      })
      toast.success('Cliente cadastrado com sucesso!')
      setIsDialogOpen(false)
      // Limpa formulário
      setFormName('')
      setFormDoc('')
      setFormPhone('')
      setFormWhatsapp('')
      setFormEmail('')
      setFormAddress('')
      setFormNotes('')
      loadData()
    } catch {
      toast.error('Falha ao cadastrar cliente no backend.')
    }
  }

  // Filtragem de veículos pertencentes ao cliente selecionado
  const getClientVehicles = (clientId: string) => {
    return vehicles.filter((v: any) => v.client === clientId)
  }

  // Abertura do modal de cadastro de veículo para cliente específico
  const openAddVehicleModal = (client: ClientModel, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setTargetClientForVehicle(client)
    // Limpa form de veículo
    setVFormPlate('')
    setVFormMake('')
    setVFormModel('')
    setVFormVersion('')
    setVFormYear('')
    setVFormEngine('')
    setVFormFuel('Flex')
    setVFormOdometer('')
    setVFormVin('')
    setVFormNotes('')
    setIsVehicleDialogOpen(true)
  }

  // Salvar veículo vinculado ao cliente selecionado
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!vFormPlate.trim() || !vFormMake.trim() || !vFormModel.trim()) {
      toast.error('Placa, Fabricante e Modelo são obrigatórios.')
      return
    }
    if (!targetClientForVehicle?.id) {
      toast.error('Nenhum cliente associado selecionado.')
      return
    }

    setSavingVehicle(true)
    const resolvedWorkshopId =
      (user as any)?.workshop_id || targetClientForVehicle.workshop_id || ''
    try {
      const createdVehicle = await vehicleService.create({
        workshop_id: resolvedWorkshopId,
        plate: vFormPlate.trim().toUpperCase(),
        make: vFormMake.trim(),
        model: vFormModel.trim(),
        version: vFormVersion.trim(),
        year_model: vFormYear.trim(),
        engine: vFormEngine.trim(),
        fuel: vFormFuel.trim(),
        odometer_km: typeof vFormOdometer === 'number' ? vFormOdometer : 0,
        vin: vFormVin.trim().toUpperCase(),
        notes: vFormNotes.trim(),
        client: targetClientForVehicle.id,
      } as any)

      toast.success(
        `Veículo ${createdVehicle.plate} cadastrado com sucesso e vinculado a ${targetClientForVehicle.name}!`,
      )
      setIsVehicleDialogOpen(false)
      await Promise.all([loadData(), refreshVehicles()])

      // Mantém cliente selecionado
      setSelectedClient(targetClientForVehicle)
    } catch (err: any) {
      // Log técnico de diagnóstico sem expor detalhes sensíveis na UI
      console.error(
        `[DIAG_VEHICLE_PAGE_CLIENTES] authenticated_user_id=${user?.id || 'none'}, resolved_workshop_id=${resolvedWorkshopId || 'none'}, customer_id=${targetClientForVehicle.id}`,
        err,
      )
      toast.error(err?.message || 'Erro ao cadastrar veículo no backend.')
    } finally {
      setSavingVehicle(false)
    }
  }

  // Fluxo de ação: ABRIR VEÍCULO NO PAINEL E CONECTAR OBD
  const handleOpenVehicleAndConnectOBD = (veh: VehicleModel, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedVehicle(veh)
    toast.info(`Veículo ${veh.plate} (${veh.make} ${veh.model}) selecionado para diagnóstico OBD.`)
    navigate('/')
  }

  // Abertura da timeline completa em /veiculos
  const handleOpenVehicleDetails = (veh: VehicleModel, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedVehicle(veh)
    navigate('/veiculos')
  }

  return (
    <div className="space-y-6">
      {/* Header com Ação */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-[#FFB300]" />
            Clientes da Oficina
          </h1>
          <p className="text-sm text-[#9AA7B4]">
            Gestão cadastral, histórico de múltiplos veículos e conformidade LGPD.
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold">
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Cadastrar Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              <div>
                <Label className="text-[#9AA7B4]">Nome Completo *</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Danilo Rickes"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[#9AA7B4]">Telefone Principal *</Label>
                  <Input
                    className="bg-[#1A232E] border-[#263340] text-white"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    required
                  />
                </div>
                <div>
                  <Label className="text-[#9AA7B4]">WhatsApp</Label>
                  <Input
                    className="bg-[#1A232E] border-[#263340] text-white"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="(11) 98765-4321"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[#9AA7B4]">CPF / CNPJ (Opcional)</Label>
                  <Input
                    className="bg-[#1A232E] border-[#263340] text-white"
                    value={formDoc}
                    onChange={(e) => setFormDoc(e.target.value)}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label className="text-[#9AA7B4]">E-mail</Label>
                  <Input
                    className="bg-[#1A232E] border-[#263340] text-white"
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="cliente@email.com"
                  />
                </div>
              </div>

              <div>
                <Label className="text-[#9AA7B4]">Endereço</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Rua, Número, Bairro, Cidade"
                />
              </div>

              <div>
                <Label className="text-[#9AA7B4]">Observações Cadastrais</Label>
                <Textarea
                  className="bg-[#1A232E] border-[#263340] text-white"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas internas..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="border-[#263340] text-gray-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold"
                >
                  Salvar Cliente
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Barra de Pesquisa */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#9AA7B4]" />
          <Input
            className="pl-9 bg-[#131A22] border-[#263340] text-white text-xs"
            placeholder="Buscar por nome, telefone ou CPF..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary" className="bg-[#1A232E] text-white text-xs">
          Buscar
        </Button>
      </form>

      {/* Grid de Clientes e Detalhes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Clientes */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-[#9AA7B4] font-mono text-xs">
              Carregando clientes...
            </div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center text-[#9AA7B4] bg-[#131A22] border border-[#263340] rounded-lg">
              Nenhum cliente encontrado.
            </div>
          ) : (
            clients.map((c) => {
              const cVehicles = getClientVehicles(c.id)
              const isSelected = selectedClient?.id === c.id

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#1A232E] border-[#FFB300]'
                      : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm hover:text-[#FFB300] transition-colors">
                          {c.name}
                        </span>
                        {c.active ? (
                          <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[10px]">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge className="bg-red-950 text-red-400 border-red-800 text-[10px]">
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-[#9AA7B4] mt-1 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#FFB300]" /> {c.phone}
                        </span>
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-[#FFB300]" /> {c.email}
                          </span>
                        )}
                        {c.document && <span>Doc: {c.document}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => openAddVehicleModal(c, e)}
                        className="h-8 border-[#263340] bg-[#0B0F14] text-[#FFB300] hover:bg-[#FFB300] hover:text-black text-xs font-semibold"
                        title="Adicionar Veículo a este cliente"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Adicionar Veículo
                      </Button>

                      <div className="flex items-center gap-1 text-xs text-white font-mono bg-[#0B0F14] px-2.5 py-1 rounded border border-[#263340]">
                        <Car className="w-3.5 h-3.5 text-[#FFB300]" />
                        <span>{cVehicles.length} veículo(s)</span>
                      </div>
                    </div>
                  </div>

                  {cVehicles.length > 0 ? (
                    <div className="mt-3 pt-2.5 border-t border-[#263340]/60 space-y-1.5">
                      <div className="text-[10px] text-[#9AA7B4] uppercase font-bold tracking-wider">
                        Veículos Vinculados — clique para diagnosticar:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cVehicles.map((v) => (
                          <div
                            key={v.id}
                            onClick={(e) => handleOpenVehicleAndConnectOBD(v, e)}
                            className="group/vec inline-flex items-center gap-2 text-xs bg-[#0B0F14] hover:bg-[#1A232E] border border-[#263340] hover:border-[#FFB300] text-gray-200 px-2.5 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                            title="Selecionar veículo e conectar OBD"
                          >
                            <span className="font-mono font-bold text-[#FFB300] bg-[#131A22] px-1.5 py-0.5 rounded border border-[#263340]">
                              {v.plate}
                            </span>
                            <span className="font-semibold text-white">
                              {v.make} {v.model}
                            </span>
                            {v.engine && (
                              <span className="text-[11px] text-[#9AA7B4]">({v.engine})</span>
                            )}
                            <span className="text-emerald-400 group-hover/vec:translate-x-0.5 transition-transform flex items-center gap-0.5 text-[11px] font-bold ml-1">
                              <Zap className="w-3 h-3 text-[#FFB300]" />
                              Conectar OBD
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-2 border-t border-[#263340]/40 flex items-center justify-between text-xs text-gray-500">
                      <span>Nenhum veículo cadastrado para este cliente.</span>
                      <button
                        type="button"
                        onClick={(e) => openAddVehicleModal(c, e)}
                        className="text-[#FFB300] hover:underline text-[11px] font-medium"
                      >
                        + Cadastrar o primeiro veículo
                      </button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Painel Lateral de Detalhes do Cliente Selecionado */}
        <div>
          {selectedClient ? (
            <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7] sticky top-20">
              <CardHeader className="pb-3 border-b border-[#263340]">
                <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                  <span>Prontuário do Cliente</span>
                  <Badge variant="outline" className="text-xs border-[#FFB300] text-[#FFB300]">
                    1 Cliente → N Veículos
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div>
                  <div className="text-[#9AA7B4]">Nome</div>
                  <div className="font-semibold text-white text-sm">{selectedClient.name}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[#9AA7B4]">Telefone</div>
                    <div className="text-white font-mono">{selectedClient.phone}</div>
                  </div>
                  <div>
                    <div className="text-[#9AA7B4]">WhatsApp</div>
                    <div className="text-white font-mono">{selectedClient.whatsapp || '-'}</div>
                  </div>
                </div>

                <div>
                  <div className="text-[#9AA7B4]">Documento</div>
                  <div className="text-white font-mono">
                    {selectedClient.document || 'Não informado'}
                  </div>
                </div>

                <div>
                  <div className="text-[#9AA7B4]">Endereço</div>
                  <div className="text-white">{selectedClient.address || 'Não cadastrado'}</div>
                </div>

                {selectedClient.notes && (
                  <div>
                    <div className="text-[#9AA7B4]">Observações</div>
                    <div className="text-gray-300 italic bg-[#0B0F14] p-2 rounded border border-[#263340]">
                      "{selectedClient.notes}"
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-[#263340]">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <Car className="w-4 h-4 text-[#FFB300]" /> Veículos Vinculados (
                      {getClientVehicles(selectedClient.id).length})
                    </div>
                    <Button
                      size="sm"
                      onClick={() => openAddVehicleModal(selectedClient)}
                      className="h-7 bg-[#FFB300] hover:bg-[#e09e00] text-black font-bold text-[11px] px-2.5"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {getClientVehicles(selectedClient.id).map((v) => (
                      <div
                        key={v.id}
                        className="bg-[#1A232E] p-3 rounded border border-[#263340] hover:border-[#FFB300]/80 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white font-mono bg-[#0B0F14] px-1.5 py-0.5 rounded border border-[#263340] text-xs text-[#FFB300]">
                              {v.plate}
                            </span>
                            <span className="text-white text-xs font-semibold ml-2">
                              {v.make} {v.model}
                            </span>
                          </div>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {v.odometer_km?.toLocaleString('pt-BR') || '--'} km
                          </span>
                        </div>

                        <div className="text-[11px] text-[#9AA7B4] flex flex-wrap gap-2">
                          <span>Versão: {v.version || 'Padrão'}</span>
                          <span>•</span>
                          <span>Ano: {v.year_model || 'N/D'}</span>
                          <span>•</span>
                          <span>Motor: {v.engine || 'Genérico'}</span>
                        </div>

                        <div className="pt-2 border-t border-[#263340] flex items-center justify-between gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenVehicleDetails(v)}
                            className="h-7 text-xs text-[#9AA7B4] hover:text-white px-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ficha Técnica
                          </Button>

                          <Button
                            size="sm"
                            onClick={() => handleOpenVehicleAndConnectOBD(v)}
                            className="h-7 bg-[#2ECC71] hover:bg-[#27ae60] text-black font-bold text-xs px-2.5"
                          >
                            <Zap className="w-3.5 h-3.5 mr-1" /> Conectar OBD
                          </Button>
                        </div>
                      </div>
                    ))}
                    {getClientVehicles(selectedClient.id).length === 0 && (
                      <div className="p-4 bg-[#0B0F14] border border-[#263340] rounded text-center space-y-2">
                        <p className="text-gray-400 text-xs">
                          Nenhum veículo vinculado a este cliente.
                        </p>
                        <Button
                          size="sm"
                          onClick={() => openAddVehicleModal(selectedClient)}
                          className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold text-xs"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Cadastrar Veículo Agora
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-[#131A22] border border-[#263340] p-6 rounded-lg text-center text-xs text-[#9AA7B4]">
              Selecione um cliente para visualizar o prontuário completo e veículos vinculados.
            </div>
          )}
        </div>
      </div>

      {/* Modal Dedicado: ADICIONAR VEÍCULO AO CLIENTE */}
      <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
        <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-[#FFB300]" />
              <span>Adicionar Veículo para {targetClientForVehicle?.name}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveVehicle} className="space-y-4 text-xs pt-1">
            <div className="bg-[#1A232E] p-2.5 rounded border border-[#263340] text-xs">
              <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                Cliente / Proprietário:
              </span>
              <span className="text-white font-semibold">
                {targetClientForVehicle?.name} — {targetClientForVehicle?.phone}
              </span>
              <p className="text-[11px] text-emerald-400 mt-0.5">
                O veículo herdará o contexto da oficina autenticada de forma transparente e segura.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Placa *</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white uppercase font-mono font-bold"
                  value={vFormPlate}
                  onChange={(e) => setVFormPlate(e.target.value.toUpperCase())}
                  placeholder="Ex: BRA2E20"
                  required
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Fabricante / Marca *</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white"
                  value={vFormMake}
                  onChange={(e) => setVFormMake(e.target.value)}
                  placeholder="Ex: Ford"
                  required
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Modelo *</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white"
                  value={vFormModel}
                  onChange={(e) => setVFormModel(e.target.value)}
                  placeholder="Ex: EcoSport"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Versão / Acabamento</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white"
                  value={vFormVersion}
                  onChange={(e) => setVFormVersion(e.target.value)}
                  placeholder="Ex: Freestyle 1.5 AT"
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Ano / Modelo</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white"
                  value={vFormYear}
                  onChange={(e) => setVFormYear(e.target.value)}
                  placeholder="Ex: 2020/2020"
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Motorização</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white"
                  value={vFormEngine}
                  onChange={(e) => setVFormEngine(e.target.value)}
                  placeholder="Ex: 1.5 Dragon 3C"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Combustível</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white"
                  value={vFormFuel}
                  onChange={(e) => setVFormFuel(e.target.value)}
                  placeholder="Flex, Gasolina, etc."
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Quilometragem (km)</Label>
                <Input
                  type="number"
                  className="bg-[#0B0F14] border-[#263340] text-white font-mono"
                  value={vFormOdometer}
                  onChange={(e) => setVFormOdometer(e.target.value ? parseInt(e.target.value) : '')}
                  placeholder="Ex: 48500"
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Chassi / VIN (Opcional)</Label>
                <Input
                  className="bg-[#0B0F14] border-[#263340] text-white font-mono uppercase"
                  value={vFormVin}
                  onChange={(e) => setVFormVin(e.target.value.toUpperCase())}
                  placeholder="17 dígitos..."
                />
              </div>
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Observações do Veículo</Label>
              <Textarea
                className="bg-[#0B0F14] border-[#263340] text-white"
                value={vFormNotes}
                onChange={(e) => setVFormNotes(e.target.value)}
                rows={2}
                placeholder="Ex: Sintoma de trepidação em baixa, histórico de revisões..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#263340]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVehicleDialogOpen(false)}
                className="border-[#263340] text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingVehicle}
                className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold"
              >
                {savingVehicle ? 'Salvando...' : 'Salvar Veículo & Vincular'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
