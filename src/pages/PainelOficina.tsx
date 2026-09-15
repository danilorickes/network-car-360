import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Car,
  Clock,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  FileText,
  Search,
  ExternalLink,
  AlertTriangle,
  PlayCircle,
  Package,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { workOrderService, clientService } from '@/services/commercial'
import { investigationService } from '@/services/investigations'
import { vehicleService } from '@/services/vehicles'
import { WorkOrderModel, WorkOrderStatus } from '@/types/commercial'
import { DiagnosticInvestigationModel } from '@/types/investigation'
import { toast } from 'sonner'

export default function PainelOficina() {
  const navigate = useNavigate()
  const [workOrders, setWorkOrders] = useState<WorkOrderModel[]>([])
  const [investigations, setInvestigations] = useState<DiagnosticInvestigationModel[]>([])
  const [loading, setLoading] = useState(true)

  // Pesquisa Global (Requisito 15)
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchResult, setSearchResult] = useState<{
    orders: WorkOrderModel[]
    vehicles: any[]
    clients: any[]
    investigations: DiagnosticInvestigationModel[]
  } | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [orders, invs] = await Promise.all([
        workOrderService.getAll(),
        investigationService.getAll(),
      ])
      setWorkOrders(orders)
      setInvestigations(invs)
    } catch {
      toast.error('Erro ao carregar dados do painel.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Pesquisa Global: Placa, Cliente, Telefone, OS, OD-360 (Requisito 15)
  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = globalSearch.trim().toLowerCase()
    if (!q) {
      setSearchResult(null)
      return
    }

    try {
      const [cls, vecs] = await Promise.all([clientService.search(q), vehicleService.getAll()])

      const matchedVehicles = vecs.filter(
        (v) =>
          v.plate.toLowerCase().includes(q) ||
          v.model.toLowerCase().includes(q) ||
          v.make.toLowerCase().includes(q),
      )

      const matchedOrders = workOrders.filter(
        (o) =>
          o.order_number.toLowerCase().includes(q) || o.vehicle_plate.toLowerCase().includes(q),
      )

      const matchedInvs = investigations.filter(
        (i) =>
          i.investigation_number.toLowerCase().includes(q) ||
          i.vehicle_plate.toLowerCase().includes(q),
      )

      setSearchResult({
        orders: matchedOrders,
        vehicles: matchedVehicles,
        clients: cls,
        investigations: matchedInvs,
      })
    } catch {
      toast.error('Erro ao realizar busca global.')
    }
  }

  // Contagens do Dashboard Operacional (Requisito 14)
  const stats = {
    totalInShop: workOrders.filter((o) => o.status !== 'ENTREGUE' && o.status !== 'CANCELADA')
      .length,
    diagInProgress: investigations.filter(
      (i) => i.status === 'ABERTA' || i.status === 'EM_INVESTIGACAO',
    ).length,
    waitingApproval: workOrders.filter((o) => o.status === 'AGUARDANDO_APROVACAO').length,
    inExecution: workOrders.filter((o) => o.status === 'EM_EXECUCAO').length,
    waitingParts: workOrders.filter((o) => o.status === 'AGUARDANDO_PECA').length,
    waitingValidation: workOrders.filter((o) => o.status === 'AGUARDANDO_VALIDACAO').length,
    readyToDeliver: workOrders.filter((o) => o.status === 'CONCLUIDA').length,
  }

  // Filtragem rápida por estado
  const [statusFilter, setStatusFilter] = useState<string>('TODAS')

  const displayedOrders =
    statusFilter === 'TODAS'
      ? workOrders.filter((o) => o.status !== 'ENTREGUE' && o.status !== 'CANCELADA')
      : workOrders.filter((o) => o.status === statusFilter)

  return (
    <div className="space-y-6">
      {/* Header com Busca Global */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <LayoutDashboard className="w-7 h-7 text-[#FFB300]" />
            Painel Operacional da Oficina
          </h1>
          <p className="text-sm text-[#9AA7B4]">
            Visão consolidada da operação: pátio, diagnósticos ativos, aprovações e entregas.
          </p>
        </div>

        {/* Barra de Pesquisa Global (Requisito 15) */}
        <form onSubmit={handleGlobalSearch} className="flex gap-2 w-full md:w-96">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#FFB300]" />
            <Input
              className="pl-9 bg-[#131A22] border-[#263340] text-white text-xs"
              placeholder="Pesquisa Global: placa, cliente, OS, OD..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" className="bg-[#1A232E] text-white text-xs">
            Buscar
          </Button>
        </form>
      </div>

      {/* Resultados da Pesquisa Global se ativa */}
      {searchResult && (
        <Card className="bg-[#131A22] border-[#FFB300] text-[#F2F5F7]">
          <CardHeader className="pb-2 border-b border-[#263340] flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-[#FFB300] flex items-center gap-2">
              <Search className="w-4 h-4" /> Resultados da Busca Global: "{globalSearch}"
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchResult(null)
                setGlobalSearch('')
              }}
              className="text-xs text-gray-400 hover:text-white"
            >
              Fechar
            </Button>
          </CardHeader>
          <CardContent className="pt-3 text-xs space-y-3">
            {/* Ordens de Serviço */}
            {searchResult.orders.length > 0 && (
              <div>
                <span className="font-semibold text-white block mb-1">
                  Ordens de Serviço ({searchResult.orders.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {searchResult.orders.map((o) => (
                    <Button
                      key={o.id}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/ordens-servico')}
                      className="border-[#263340] text-xs font-mono bg-[#1A232E] hover:border-[#FFB300]"
                    >
                      {o.order_number} ({o.vehicle_plate}) — {o.status}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Veículos */}
            {searchResult.vehicles.length > 0 && (
              <div>
                <span className="font-semibold text-white block mb-1">
                  Veículos Encontrados ({searchResult.vehicles.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {searchResult.vehicles.map((v) => (
                    <Button
                      key={v.id}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/veiculos')}
                      className="border-[#263340] text-xs font-mono bg-[#1A232E] hover:border-[#FFB300]"
                    >
                      {v.plate} — {v.make} {v.model}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Clientes */}
            {searchResult.clients.length > 0 && (
              <div>
                <span className="font-semibold text-white block mb-1">
                  Clientes ({searchResult.clients.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {searchResult.clients.map((c) => (
                    <Button
                      key={c.id}
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/clientes')}
                      className="border-[#263340] text-xs bg-[#1A232E] hover:border-[#FFB300]"
                    >
                      {c.name} ({c.phone})
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {searchResult.orders.length === 0 &&
              searchResult.vehicles.length === 0 &&
              searchResult.clients.length === 0 && (
                <div className="text-gray-400 py-2">
                  Nenhum registro correspondente aos termos digitados.
                </div>
              )}
          </CardContent>
        </Card>
      )}

      {/* Cards de Métricas Operacionais (Requisito 14) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div
          onClick={() => setStatusFilter('TODAS')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'TODAS'
              ? 'bg-[#1A232E] border-[#FFB300]'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between text-[#9AA7B4] text-xs">
            <span>No Pátio</span>
            <Car className="w-4 h-4 text-[#FFB300]" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{stats.totalInShop}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Veículos em atendimento</div>
        </div>

        <div
          onClick={() => navigate('/replay')}
          className="p-3.5 rounded-lg border bg-[#131A22] border-[#263340] hover:border-purple-500 cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between text-[#9AA7B4] text-xs">
            <span>Diagnósticos</span>
            <PlayCircle className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
            {stats.diagInProgress}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Em investigação 360</div>
        </div>

        <div
          onClick={() => setStatusFilter('AGUARDANDO_APROVACAO')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'AGUARDANDO_APROVACAO'
              ? 'bg-[#1A232E] border-amber-400'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between text-[#9AA7B4] text-xs">
            <span>Aguard. Aprovação</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {stats.waitingApproval}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Orçamentos pendentes</div>
        </div>

        <div
          onClick={() => setStatusFilter('EM_EXECUCAO')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'EM_EXECUCAO'
              ? 'bg-[#1A232E] border-blue-400'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between text-[#9AA7B4] text-xs">
            <span>Em Execução</span>
            <Wrench className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-400 mt-1">{stats.inExecution}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Serviços na bancada</div>
        </div>

        <div
          onClick={() => setStatusFilter('AGUARDANDO_VALIDACAO')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'AGUARDANDO_VALIDACAO'
              ? 'bg-[#1A232E] border-emerald-400'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between text-[#9AA7B4] text-xs">
            <span>Pós-Reparo</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {stats.waitingValidation}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Aguardando reteste</div>
        </div>

        <div
          onClick={() => setStatusFilter('CONCLUIDA')}
          className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
            statusFilter === 'CONCLUIDA'
              ? 'bg-[#1A232E] border-teal-400'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between text-[#9AA7B4] text-xs">
            <span>Prontos Entrega</span>
            <CheckCircle2 className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-teal-400 mt-1">
            {stats.readyToDeliver}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">Liberados p/ cliente</div>
        </div>
      </div>

      {/* Lista Operacional dos Veículos em Atendimento (Requisito 14) */}
      <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
        <CardHeader className="pb-3 border-b border-[#263340] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Car className="w-5 h-5 text-[#FFB300]" />
              Fila de Atendimento Operacional ({displayedOrders.length})
            </CardTitle>
            <p className="text-xs text-[#9AA7B4]">
              Clique em qualquer atendimento para gerenciar a OS, aprovação ou execução.
            </p>
          </div>
          {statusFilter !== 'TODAS' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStatusFilter('TODAS')}
              className="text-xs text-[#FFB300]"
            >
              Limpar filtro: {statusFilter}
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-4">
          {displayedOrders.length === 0 ? (
            <div className="text-center py-8 text-[#9AA7B4] text-xs">
              Nenhum veículo nesta etapa operacional.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {displayedOrders.map((o) => (
                <div
                  key={o.id}
                  onClick={() => navigate('/ordens-servico')}
                  className="bg-[#1A232E] p-4 rounded-lg border border-[#263340] hover:border-[#FFB300] transition-all cursor-pointer space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white text-sm">{o.order_number}</span>
                    <Badge
                      className={`text-[10px] ${
                        o.status === 'CONCLUIDA'
                          ? 'bg-teal-950 text-teal-300 border-teal-700'
                          : o.status === 'EM_EXECUCAO'
                            ? 'bg-blue-950 text-blue-300 border-blue-700'
                            : o.status === 'AGUARDANDO_APROVACAO'
                              ? 'bg-amber-950 text-amber-300 border-amber-700'
                              : 'bg-gray-800 text-gray-300 border-gray-700'
                      }`}
                    >
                      {o.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between font-mono text-xs text-[#9AA7B4]">
                    <span className="text-white font-bold bg-[#0B0F14] px-2 py-0.5 rounded border border-[#263340]">
                      {o.vehicle_plate}
                    </span>
                    <span>{o.odometer_km?.toLocaleString('pt-BR')} km</span>
                  </div>

                  {o.confirmed_diagnosis ? (
                    <div className="text-[11px] text-emerald-400 bg-emerald-950/30 p-1.5 rounded border border-emerald-800/40 line-clamp-2">
                      <strong>Diagnóstico:</strong> {o.confirmed_diagnosis}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-400 italic">
                      {o.budget_notes || 'Atendimento comercial padrão'}
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#263340]/60 flex items-center justify-between text-xs">
                    <span className="text-gray-400">{o.items.length} itens</span>
                    <span className="font-mono font-bold text-[#FFB300]">
                      R$ {o.approved_total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
