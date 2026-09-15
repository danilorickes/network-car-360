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
import { toast } from 'sonner'

export default function Clientes() {
  const { user } = useAuth()
  const [clients, setClients] = useState<ClientModel[]>([])
  const [vehicles, setVehicles] = useState<VehicleModel[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedClient, setSelectedClient] = useState<ClientModel | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  // Form states
  const [formName, setFormName] = useState('')
  const [formDoc, setFormDoc] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formWhatsapp, setFormWhatsapp] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formNotes, setFormNotes] = useState('')

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
    try {
      const filtered = await clientService.search(searchQuery)
      setClients(filtered)
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
        workshop_id: (user as any)?.workshop_id || 'wsnetmatriz0001',
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
                        <span className="font-bold text-white text-sm">{c.name}</span>
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

                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-white font-mono bg-[#0B0F14] px-2 py-1 rounded border border-[#263340]">
                        <Car className="w-3.5 h-3.5 text-[#FFB300]" />
                        <span>{cVehicles.length} veículo(s)</span>
                      </div>
                    </div>
                  </div>

                  {cVehicles.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-[#263340]/60 flex flex-wrap gap-2">
                      {cVehicles.map((v) => (
                        <span
                          key={v.id}
                          className="text-[11px] font-mono bg-[#0B0F14] text-gray-300 px-2 py-0.5 rounded border border-[#263340]"
                        >
                          {v.plate} — {v.make} {v.model}
                        </span>
                      ))}
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
                  <div className="font-semibold text-white mb-2 flex items-center gap-1.5">
                    <Car className="w-4 h-4 text-[#FFB300]" /> Veículos Vinculados (
                    {getClientVehicles(selectedClient.id).length})
                  </div>
                  <div className="space-y-2">
                    {getClientVehicles(selectedClient.id).map((v) => (
                      <div
                        key={v.id}
                        className="bg-[#1A232E] p-2.5 rounded border border-[#263340] flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-white font-mono">{v.plate}</div>
                          <div className="text-[#9AA7B4] text-[11px]">
                            {v.make} {v.model} ({v.year_model || 'N/A'})
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-gray-400">
                            {v.odometer_km?.toLocaleString('pt-BR')} km
                          </span>
                        </div>
                      </div>
                    ))}
                    {getClientVehicles(selectedClient.id).length === 0 && (
                      <p className="text-gray-500 text-[11px]">
                        Nenhum veículo vinculado a este cliente.
                      </p>
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
    </div>
  )
}
