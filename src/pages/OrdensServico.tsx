import React, { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  FileDown,
  Wrench,
  Package,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Printer,
  XCircle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  workOrderService,
  serviceCatalogService,
  partsCatalogService,
  clientService,
  auditService,
} from '@/services/commercial'
import { vehicleService } from '@/services/vehicles'
import { generateBudgetPrintHtml, generateWorkOrderPrintHtml } from '@/services/pdf-service'
import {
  WorkOrderModel,
  WorkOrderItem,
  BudgetApprovalStatus,
  WorkOrderStatus,
  ServiceExecutionStatus,
  ServiceCatalogModel,
  PartsCatalogModel,
  WorkOrderAuditModel,
} from '@/types/commercial'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

export default function OrdensServico() {
  const { user } = useAuth()
  const [workOrders, setWorkOrders] = useState<WorkOrderModel[]>([])
  const [selectedOrder, setSelectedOrder] = useState<WorkOrderModel | null>(null)
  const [servicesCatalog, setServicesCatalog] = useState<ServiceCatalogModel[]>([])
  const [partsCatalog, setPartsCatalog] = useState<PartsCatalogModel[]>([])
  const [audits, setAudits] = useState<WorkOrderAuditModel[]>([])
  const [loading, setLoading] = useState(true)
  const [searchPlate, setSearchPlate] = useState('')

  // Modais
  const [addItemModalOpen, setAddItemModalOpen] = useState(false)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [postRepairModalOpen, setPostRepairModalOpen] = useState(false)
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)

  // Item form
  const [itemType, setItemType] = useState<'SERVICO' | 'PECA'>('SERVICO')
  const [itemCatalogId, setItemCatalogId] = useState('')
  const [itemCode, setItemCode] = useState('')
  const [itemDesc, setItemDesc] = useState('')
  const [itemQty, setItemQty] = useState<number>(1)
  const [itemPrice, setItemPrice] = useState<number>(0)
  const [itemDiscount, setItemDiscount] = useState<number>(0)

  // Approval form
  const [approvalType, setApprovalType] = useState<
    'APROVADO' | 'APROVADO_PARCIALMENTE' | 'RECUSADO'
  >('APROVADO')
  const [approvalChannel, setApprovalChannel] = useState<
    'PRESENCIAL' | 'TELEFONE' | 'WHATSAPP' | 'EMAIL' | 'OUTRO'
  >('WHATSAPP')
  const [approvalNotes, setApprovalNotes] = useState('')

  // Post repair form
  const [prOutcome, setPrOutcome] = useState<
    'FALHA_NAO_REPRODUZIDA' | 'FALHA_PERMANECE' | 'RESULTADO_INCONCLUSIVO'
  >('FALHA_NAO_REPRODUZIDA')
  const [prVerdict, setPrVerdict] = useState('')

  // Delivery form
  const [deliveredTo, setDeliveredTo] = useState('')
  const [deliveryKm, setDeliveryKm] = useState<number | ''>('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  const loadData = async () => {
    setLoading(true)
    try {
      const [orders, srvs, prts] = await Promise.all([
        workOrderService.getAll(),
        serviceCatalogService.getAll(),
        partsCatalogService.getAll(),
      ])
      setWorkOrders(orders)
      setServicesCatalog(srvs)
      setPartsCatalog(prts)
      if (orders.length > 0 && !selectedOrder) {
        setSelectedOrder(orders[0])
        loadAudits(orders[0].id)
      } else if (selectedOrder) {
        const refreshed = orders.find((o) => o.id === selectedOrder.id)
        if (refreshed) setSelectedOrder(refreshed)
      }
    } catch {
      toast.error('Erro ao carregar ordens de serviço.')
    } finally {
      setLoading(false)
    }
  }

  const loadAudits = async (orderId: string) => {
    try {
      const logs = await auditService.getByWorkOrderId(orderId)
      setAudits(logs)
    } catch {
      setAudits([])
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSelectOrder = (order: WorkOrderModel) => {
    setSelectedOrder(order)
    loadAudits(order.id)
  }

  // Preenchimento de item ao selecionar do catálogo mestre
  const handleCatalogSelection = (catId: string) => {
    setItemCatalogId(catId)
    if (itemType === 'SERVICO') {
      const s = servicesCatalog.find((x) => x.id === catId)
      if (s) {
        setItemCode(s.code || '')
        setItemDesc(s.description)
        setItemPrice(s.default_price || 0)
      }
    } else {
      const p = partsCatalog.find((x) => x.id === catId)
      if (p) {
        setItemCode(p.code)
        setItemDesc(p.description)
        setItemPrice(p.sale_price || 0)
      }
    }
  }

  // Adicionar item à OS / Orçamento
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder || !itemDesc.trim() || itemPrice <= 0) {
      toast.error('Preencha a descrição e valor unitário válido.')
      return
    }

    const newItem: WorkOrderItem = {
      id: `it_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type: itemType,
      catalogId: itemCatalogId || undefined,
      code: itemCode.trim() || (itemType === 'SERVICO' ? 'SRV-LIVRE' : 'PEC-LIVRE'),
      description: itemDesc.trim(),
      quantity: itemQty,
      unitPrice: itemPrice,
      discount: itemDiscount,
      subtotal: Math.max(0, itemQty * itemPrice - itemDiscount),
      itemApproval: 'PENDENTE',
      executionStatus: 'NAO_INICIADO',
    }

    const updatedItems = [...selectedOrder.items, newItem]

    try {
      const updated = await workOrderService.updateBudget(
        selectedOrder.id,
        updatedItems,
        selectedOrder.budget_notes || '',
        {
          id: user?.id,
          name: user?.name || user?.email || 'Usuário',
          role: (user as any)?.role,
        },
        selectedOrder,
      )

      setSelectedOrder(updated)
      setAddItemModalOpen(false)
      // reset form
      setItemDesc('')
      setItemCode('')
      setItemPrice(0)
      setItemDiscount(0)
      setItemQty(1)
      setItemCatalogId('')

      toast.success(
        updated.budget_version > selectedOrder.budget_version
          ? `Item adicionado! Orçamento alterado após aprovação: avançado para v${updated.budget_version} (aprovação resetada para PENDENTE).`
          : 'Item adicionado ao orçamento com sucesso!',
      )
      loadData()
    } catch (err: any) {
      toast.error('Erro ao adicionar item: ' + err.message)
    }
  }

  // Alternar aprovação individual de item (Requisito 10)
  const handleToggleItemApproval = async (
    itemId: string,
    newStatus: 'APROVADO' | 'RECUSADO' | 'PENDENTE',
  ) => {
    if (!selectedOrder) return

    const updatedItems = selectedOrder.items.map((it) => {
      if (it.id === itemId) {
        return { ...it, itemApproval: newStatus }
      }
      return it
    })

    try {
      const updated = await workOrderService.updateBudget(
        selectedOrder.id,
        updatedItems,
        selectedOrder.budget_notes || '',
        {
          id: user?.id,
          name: user?.name || 'Operador',
          role: (user as any)?.role,
        },
        selectedOrder,
      )
      setSelectedOrder(updated)
      toast.success(`Item marcado como ${newStatus}. Subtotal recalculado.`)
      loadData()
    } catch (err: any) {
      toast.error('Erro ao atualizar item: ' + err.message)
    }
  }

  // Registrar Aprovação Geral do Orçamento
  const handleSaveApproval = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    try {
      const updated = await workOrderService.registerApproval(
        selectedOrder.id,
        approvalType,
        approvalChannel,
        approvalNotes,
        {
          id: user?.id,
          name: user?.name || user?.email || 'Atendente',
          role: (user as any)?.role,
        },
        selectedOrder,
      )
      setSelectedOrder(updated)
      setApprovalModalOpen(false)
      toast.success(`Aprovação registrada com sucesso! OS atualizada para ${updated.status}.`)
      loadData()
    } catch (err: any) {
      toast.error('Erro ao registrar aprovação: ' + err.message)
    }
  }

  // Atualizar status de execução de um serviço pelo mecânico (Requisito 11)
  const handleUpdateExecution = async (itemId: string, executionStatus: ServiceExecutionStatus) => {
    if (!selectedOrder) return

    try {
      const updated = await workOrderService.updateItemExecution(
        selectedOrder.id,
        itemId,
        executionStatus,
        user?.name || user?.email || 'Mecânico Técnico',
        'Execução atualizada no painel de serviços',
        selectedOrder,
      )
      setSelectedOrder(updated)
      toast.success(`Status do serviço atualizado para ${executionStatus}!`)
      loadData()
    } catch (err: any) {
      // Bloqueio obrigatório de item recusado (Regra 11)
      toast.error(err.message || 'Falha ao atualizar execução.')
    }
  }

  // Registrar Validação Pós-Reparo (Requisito 12)
  const handleSavePostRepair = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    try {
      const updated = await workOrderService.registerPostRepairValidation(
        selectedOrder.id,
        {
          investigationId: selectedOrder.diagnostic_investigation,
          outcome: prOutcome,
          beforeDtcList: ['P0301'],
          afterDtcList: prOutcome === 'FALHA_NAO_REPRODUZIDA' ? [] : ['P0301'],
          verdict: prVerdict || 'Reteste executado sob condições normais de rodagem.',
        },
        user?.name || 'Mecânico Técnico',
        selectedOrder,
      )
      setSelectedOrder(updated)
      setPostRepairModalOpen(false)
      toast.success(`Validação pós-reparo concluída (${prOutcome})!`)
      loadData()
    } catch (err: any) {
      toast.error('Falha ao registrar pós-reparo: ' + err.message)
    }
  }

  // Entrega do Veículo (Requisito 4 & 5)
  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder || !deliveredTo.trim() || deliveryKm === '') {
      toast.error('Informe o nome do recebedor e a quilometragem na entrega.')
      return
    }

    try {
      const updated = await workOrderService.deliverVehicle(
        selectedOrder.id,
        {
          customerDeliveredTo: deliveredTo.trim(),
          odometerAtDeliveryKm: Number(deliveryKm),
          responsible: user?.name || 'Recepção',
          notes: deliveryNotes,
        },
        selectedOrder,
      )
      setSelectedOrder(updated)
      setDeliveryModalOpen(false)
      toast.success(`Veículo entregue ao cliente e OS ${updated.order_number} finalizada!`)
      loadData()
    } catch (err: any) {
      toast.error('Falha ao registrar entrega: ' + err.message)
    }
  }

  // Impressão / PDF Orçamento
  const handlePrintBudget = () => {
    if (!selectedOrder) return
    const html = generateBudgetPrintHtml(selectedOrder, {
      workshopName: 'Network Car Matriz — Oficina Modelo',
      workshopCnpj: '12.345.678/0001-90',
      workshopPhone: '(11) 98765-4321',
      workshopAddress: 'Av. Engenheiro Automotivo, 1000 - São Paulo/SP',
      includeDiagnosticSummary: true,
    })
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.print()
    }
  }

  // Impressão / PDF Ordem de Serviço
  const handlePrintWorkOrder = () => {
    if (!selectedOrder) return
    const html = generateWorkOrderPrintHtml(selectedOrder, {
      workshopName: 'Network Car Matriz — Oficina Modelo',
      workshopCnpj: '12.345.678/0001-90',
      workshopPhone: '(11) 98765-4321',
      workshopAddress: 'Av. Engenheiro Automotivo, 1000 - São Paulo/SP',
    })
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.print()
    }
  }

  const filteredOrders = searchPlate.trim()
    ? workOrders.filter((o) =>
        o.vehicle_plate.toLowerCase().includes(searchPlate.toLowerCase().trim()),
      )
    : workOrders

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="w-7 h-7 text-[#FFB300]" />
            Ordens de Serviço & Orçamentos Comerciais
          </h1>
          <p className="text-sm text-[#9AA7B4]">
            Numeração sequencial, controle orçamentário por itens, versionamento pós-aprovação e
            execução de serviços.
          </p>
        </div>

        {/* Botões de Ação para a OS Selecionada */}
        {selectedOrder && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handlePrintBudget}
              variant="outline"
              size="sm"
              className="border-[#263340] text-gray-200 hover:text-white hover:bg-[#1A232E] text-xs"
            >
              <Printer className="w-4 h-4 mr-1 text-[#FFB300]" />
              PDF Orçamento
            </Button>

            <Button
              onClick={handlePrintWorkOrder}
              variant="outline"
              size="sm"
              className="border-[#263340] text-gray-200 hover:text-white hover:bg-[#1A232E] text-xs"
            >
              <Printer className="w-4 h-4 mr-1 text-blue-400" />
              PDF Ordem Serviço
            </Button>
          </div>
        )}
      </div>

      {/* Grid: Lista de OSs à esquerda, Detalhe e Gestão à direita */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Esquerdo: Lista de OSs (4 colunas) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#9AA7B4]" />
              <Input
                className="pl-9 bg-[#131A22] border-[#263340] text-white text-xs"
                placeholder="Filtrar por placa..."
                value={searchPlate}
                onChange={(e) => setSearchPlate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2 max-h-[750px] overflow-y-auto pr-1">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-[#9AA7B4] bg-[#131A22] border border-[#263340] rounded-lg text-xs">
                Nenhuma Ordem de Serviço encontrada.
              </div>
            ) : (
              filteredOrders.map((order) => {
                const isSelected = selectedOrder?.id === order.id
                return (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1A232E] border-[#FFB300]'
                        : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono font-bold text-white text-sm">
                        {order.order_number}
                      </span>
                      <Badge
                        className={`text-[10px] ${
                          order.status === 'CONCLUIDA' || order.status === 'ENTREGUE'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : order.status === 'EM_EXECUCAO'
                              ? 'bg-blue-950 text-blue-400 border-blue-800'
                              : order.status === 'APROVADA'
                                ? 'bg-amber-950 text-amber-400 border-amber-800'
                                : 'bg-gray-800 text-gray-300 border-gray-700'
                        }`}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#9AA7B4]">
                      <span className="font-mono text-white font-semibold">
                        {order.vehicle_plate}
                      </span>
                      <span className="text-gray-400">v{order.budget_version || 1}</span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-[#263340]/60 flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">
                        {order.items.length} itens ({order.approval_status})
                      </span>
                      <span className="font-mono font-bold text-[#FFB300]">
                        R$ {order.approved_total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Painel Direito: Detalhes, Orçamento, Aprovação e Execução (8 colunas) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedOrder ? (
            <>
              {/* Barra Superior da OS Selecionada */}
              <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
                <CardContent className="pt-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263340]">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold font-mono text-white">
                          {selectedOrder.order_number}
                        </h2>
                        <Badge
                          variant="outline"
                          className="font-mono border-[#FFB300] text-[#FFB300] text-xs"
                        >
                          Orçamento v{selectedOrder.budget_version}
                        </Badge>
                        <Badge className="bg-blue-950 text-blue-300 border-blue-800 text-xs">
                          {selectedOrder.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#9AA7B4] mt-1 font-mono">
                        Placa: {selectedOrder.vehicle_plate} • Odômetro Entrada:{' '}
                        {selectedOrder.odometer_km?.toLocaleString('pt-BR')} km
                        {selectedOrder.diagnostic_investigation && (
                          <span className="ml-2 text-emerald-400 font-semibold">
                            (Vinculada a Investigação 360)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Ações de Estado */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setApprovalModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs"
                      >
                        <ShieldCheck className="w-4 h-4 mr-1.5" />
                        Registrar Aprovação
                      </Button>

                      {selectedOrder.diagnostic_investigation && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPostRepairModalOpen(true)}
                          className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700 text-xs"
                        >
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                          Validação Pós-Reparo
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setDeliveryModalOpen(true)}
                        className="bg-blue-900/60 hover:bg-blue-800 text-blue-200 border border-blue-700 text-xs"
                      >
                        <CheckCircle className="w-4 h-4 mr-1.5" />
                        Entregar Veículo
                      </Button>
                    </div>
                  </div>

                  {/* Resumo do Diagnóstico Confirmado (Requisito 6) */}
                  {selectedOrder.confirmed_diagnosis ? (
                    <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-700/60 rounded-lg text-xs">
                      <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle className="w-4 h-4" /> Diagnóstico Confirmado (Laudo Técnico):
                      </span>
                      <p className="text-gray-200 mt-1 font-medium">
                        {selectedOrder.confirmed_diagnosis}
                      </p>
                    </div>
                  ) : selectedOrder.diagnostic_investigation ? (
                    <div className="mt-4 p-3 bg-amber-950/30 border border-amber-700/40 rounded-lg text-xs text-amber-300">
                      Ordem de Diagnóstico 360 vinculada em andamento. Hipóteses permanecem no motor
                      técnico e não são convertidas em laudo sem confirmação.
                    </div>
                  ) : null}

                  {/* Histórico de Versionamento do Orçamento (Requisito 19) */}
                  {selectedOrder.budget_history && selectedOrder.budget_history.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-950/20 border border-yellow-700/40 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-yellow-400">
                        Histórico de Versões do Orçamento (Auditável):
                      </span>
                      {selectedOrder.budget_history.map((h, idx) => (
                        <div key={idx} className="text-gray-300 text-[11px] font-mono">
                          • Versão {h.version} invalidada em{' '}
                          {new Date(h.invalidatedAt).toLocaleString('pt-BR')}: {h.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tabela de Orçamento e Itens (Requisitos 7, 8, 9, 10, 11) */}
              <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
                <CardHeader className="pb-3 border-b border-[#263340] flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-[#FFB300]" />
                      Itens do Orçamento & Execução Técnica
                    </CardTitle>
                    <p className="text-xs text-[#9AA7B4] mt-0.5">
                      Aprovação item a item. Serviços recusados são bloqueados para execução.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setAddItemModalOpen(true)}
                    className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold text-xs"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar Item
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  {selectedOrder.items.length === 0 ? (
                    <div className="text-center py-8 text-[#9AA7B4] text-xs">
                      Nenhum item orçado. Clique em "Adicionar Item" para compor serviços e peças.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-[#263340] text-[#9AA7B4] text-[11px]">
                            <th className="pb-2">Tipo</th>
                            <th className="pb-2">Código / Descrição</th>
                            <th className="pb-2 text-center">Qtd</th>
                            <th className="pb-2 text-right">Unitário</th>
                            <th className="pb-2 text-right">Subtotal</th>
                            <th className="pb-2 text-center">Aprovação Cliente</th>
                            <th className="pb-2 text-center">Execução (Oficina)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#263340]/60">
                          {selectedOrder.items.map((item) => (
                            <tr key={item.id} className="hover:bg-[#1A232E]/50">
                              <td className="py-3 font-mono text-[11px]">
                                {item.type === 'SERVICO' ? (
                                  <Badge
                                    variant="outline"
                                    className="border-blue-700 text-blue-400 text-[10px]"
                                  >
                                    SERVIÇO
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-700 text-amber-400 text-[10px]"
                                  >
                                    PEÇA
                                  </Badge>
                                )}
                              </td>
                              <td className="py-3">
                                <div className="font-semibold text-white">{item.description}</div>
                                <div className="text-[11px] text-gray-500 font-mono">
                                  {item.code}
                                </div>
                              </td>
                              <td className="py-3 text-center font-mono">{item.quantity}</td>
                              <td className="py-3 text-right font-mono text-gray-300">
                                R$ {item.unitPrice.toFixed(2)}
                              </td>
                              <td className="py-3 text-right font-mono font-bold text-white">
                                R$ {item.subtotal.toFixed(2)}
                              </td>

                              {/* Controle Individual de Aprovação (Requisito 10) */}
                              <td className="py-3 text-center">
                                <div className="inline-flex rounded-md shadow-sm border border-[#263340] p-0.5 bg-[#0B0F14]">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleItemApproval(item.id, 'APROVADO')}
                                    className={`px-2 py-0.5 text-[10px] rounded ${
                                      item.itemApproval === 'APROVADO'
                                        ? 'bg-emerald-600 text-white font-bold'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                                  >
                                    Aprovar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleItemApproval(item.id, 'RECUSADO')}
                                    className={`px-2 py-0.5 text-[10px] rounded ${
                                      item.itemApproval === 'RECUSADO'
                                        ? 'bg-red-600 text-white font-bold'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                                  >
                                    Recusar
                                  </button>
                                </div>
                              </td>

                              {/* Execução pelo Mecânico (Requisito 11) */}
                              <td className="py-3 text-center">
                                <Select
                                  value={item.executionStatus}
                                  onValueChange={(val: ServiceExecutionStatus) =>
                                    handleUpdateExecution(item.id, val)
                                  }
                                >
                                  <SelectTrigger className="h-7 text-[11px] bg-[#1A232E] border-[#263340] text-white w-[130px] mx-auto">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-[#1A232E] border-[#263340] text-white text-xs">
                                    <SelectItem value="NAO_INICIADO">Não iniciado</SelectItem>
                                    <SelectItem value="EM_EXECUCAO">Em execução</SelectItem>
                                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                                    <SelectItem value="NAO_REALIZADO">Não realizado</SelectItem>
                                  </SelectContent>
                                </Select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Totais Separados: Peças vs Serviços vs Geral (Requisito 9) */}
                  <div className="mt-6 pt-4 border-t border-[#263340] flex flex-col sm:flex-row items-end justify-between gap-4">
                    <div className="text-xs text-[#9AA7B4]">
                      <div>
                        Status da Autorização:{' '}
                        <strong className="text-white">{selectedOrder.approval_status}</strong>
                      </div>
                      {selectedOrder.approval_details && (
                        <div className="text-[11px] mt-0.5">
                          Aprovado via {selectedOrder.approval_details.channel} por{' '}
                          {selectedOrder.approval_details.responsibleUserName}
                        </div>
                      )}
                    </div>

                    <div className="bg-[#1A232E] p-4 rounded-lg border border-[#263340] w-full sm:w-72 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-gray-300">
                        <span>Mão de Obra / Serviços:</span>
                        <span>R$ {selectedOrder.services_subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-gray-300">
                        <span>Peças e Materiais:</span>
                        <span>R$ {selectedOrder.parts_subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-white font-bold pt-1.5 border-t border-[#263340]">
                        <span>TOTAL GERAL:</span>
                        <span>R$ {selectedOrder.general_total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-400 font-bold pt-1 border-t border-[#263340]/60">
                        <span>TOTAL APROVADO:</span>
                        <span>R$ {selectedOrder.approved_total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Linha do Tempo de Auditoria (Requisito 18) */}
              <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7]">
                <CardHeader className="pb-3 border-b border-[#263340]">
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#FFB300]" />
                    Trilha de Auditoria da OS (Quem + Quando + O que mudou)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {audits.length === 0 ? (
                    <div className="text-xs text-gray-400">Nenhum evento auditado ainda.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {audits.map((a, i) => (
                        <div
                          key={i}
                          className="text-xs p-2.5 bg-[#1A232E] rounded border border-[#263340] flex items-start justify-between"
                        >
                          <div>
                            <div className="font-semibold text-white">{a.details}</div>
                            <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                              Responsável: {a.actor_name} • Evento: {a.event_type}
                            </div>
                          </div>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {new Date(a.timestamp_utc).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="bg-[#131A22] border border-[#263340] p-12 rounded-lg text-center text-[#9AA7B4]">
              Selecione uma Ordem de Serviço na lista ao lado para visualizar os detalhes.
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Adicionar Item ao Orçamento */}
      <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
        <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Adicionar Item ao Orçamento
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4 text-xs">
            <div>
              <Label className="text-[#9AA7B4] mb-1.5 block">Tipo do Item</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={itemType === 'SERVICO' ? 'default' : 'outline'}
                  onClick={() => setItemType('SERVICO')}
                  className={
                    itemType === 'SERVICO'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'border-[#263340] text-gray-300'
                  }
                >
                  <Wrench className="w-3.5 h-3.5 mr-1.5" /> Mão de Obra
                </Button>
                <Button
                  type="button"
                  variant={itemType === 'PECA' ? 'default' : 'outline'}
                  onClick={() => setItemType('PECA')}
                  className={
                    itemType === 'PECA'
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'border-[#263340] text-gray-300'
                  }
                >
                  <Package className="w-3.5 h-3.5 mr-1.5" /> Peça / Material
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-[#9AA7B4] mb-1.5 block">
                Selecionar do Catálogo (Opcional)
              </Label>
              <Select value={itemCatalogId} onValueChange={handleCatalogSelection}>
                <SelectTrigger className="bg-[#1A232E] border-[#263340] text-white">
                  <SelectValue placeholder="Selecione um item pré-cadastrado..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1A232E] border-[#263340] text-white text-xs">
                  {itemType === 'SERVICO'
                    ? servicesCatalog.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.description} — R$ {s.default_price.toFixed(2)}
                        </SelectItem>
                      ))
                    : partsCatalog.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.description} — R$ {p.sale_price.toFixed(2)}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Código</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="Ex: SRV-001"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-[#9AA7B4]">Descrição *</Label>
                <Input
                  className="bg-[#1A232E] border-[#263340] text-white"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                  placeholder="Nome do serviço ou peça"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-[#9AA7B4]">Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Valor Unit. (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(Number(e.target.value))}
                  required
                />
              </div>
              <div>
                <Label className="text-[#9AA7B4]">Desconto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  className="bg-[#1A232E] border-[#263340] text-white font-mono"
                  value={itemDiscount}
                  onChange={(e) => setItemDiscount(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddItemModalOpen(false)}
                className="border-[#263340] text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-[#FFB300] hover:bg-[#e09e00] text-black font-semibold"
              >
                Adicionar ao Orçamento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Registrar Aprovação do Cliente */}
      <Dialog open={approvalModalOpen} onOpenChange={setApprovalModalOpen}>
        <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Registrar Aprovação do Orçamento
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveApproval} className="space-y-4 text-xs">
            <div>
              <Label className="text-[#9AA7B4] mb-1.5 block">Decisão do Cliente</Label>
              <Select value={approvalType} onValueChange={(val: any) => setApprovalType(val)}>
                <SelectTrigger className="bg-[#1A232E] border-[#263340] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A232E] border-[#263340] text-white">
                  <SelectItem value="APROVADO">Aprovado Totalmente</SelectItem>
                  <SelectItem value="APROVADO_PARCIALMENTE">Aprovado Parcialmente</SelectItem>
                  <SelectItem value="RECUSADO">Recusado pelo Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[#9AA7B4] mb-1.5 block">Canal de Autorização</Label>
              <Select value={approvalChannel} onValueChange={(val: any) => setApprovalChannel(val)}>
                <SelectTrigger className="bg-[#1A232E] border-[#263340] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A232E] border-[#263340] text-white">
                  <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                  <SelectItem value="PRESENCIAL">Presencial (Balcão)</SelectItem>
                  <SelectItem value="TELEFONE">Ligação Telefônica</SelectItem>
                  <SelectItem value="EMAIL">E-mail</SelectItem>
                  <SelectItem value="OUTRO">Outro Canal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Observações do Cliente</Label>
              <Textarea
                className="bg-[#1A232E] border-[#263340] text-white"
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="Ex: Cliente autorizou troca da bobina, mas pediu para postergar a limpeza preventiva..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setApprovalModalOpen(false)}
                className="border-[#263340] text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                Confirmar Autorização
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Validação Pós-Reparo */}
      <Dialog open={postRepairModalOpen} onOpenChange={setPostRepairModalOpen}>
        <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Validação Pós-Reparo (Integração E4 ↔ E5)
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSavePostRepair} className="space-y-4 text-xs">
            <div>
              <Label className="text-[#9AA7B4] mb-1.5 block">Resultado Técnico do Reteste</Label>
              <Select value={prOutcome} onValueChange={(val: any) => setPrOutcome(val)}>
                <SelectTrigger className="bg-[#1A232E] border-[#263340] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A232E] border-[#263340] text-white">
                  <SelectItem value="FALHA_NAO_REPRODUZIDA">
                    Falha NÃO Reproduzida (Problema Solucionado)
                  </SelectItem>
                  <SelectItem value="FALHA_PERMANECE">Falha Permanece (Requer Ajuste)</SelectItem>
                  <SelectItem value="RESULTADO_INCONCLUSIVO">Resultado Inconclusivo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Veredito Técnico do Mecânico</Label>
              <Textarea
                className="bg-[#1A232E] border-[#263340] text-white"
                value={prVerdict}
                onChange={(e) => setPrVerdict(e.target.value)}
                placeholder="Ex: Reteste de 20 minutos sob carga plena com ausência de misfire e parâmetros normalizados..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPostRepairModalOpen(false)}
                className="border-[#263340] text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-purple-600 hover:bg-purple-500 text-white font-semibold"
              >
                Gravar Validação Pós-Reparo
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Entrega do Veículo */}
      <Dialog open={deliveryModalOpen} onOpenChange={setDeliveryModalOpen}>
        <DialogContent className="bg-[#131A22] text-[#F2F5F7] border-[#263340] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Entrega do Veículo ao Cliente
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDelivery} className="space-y-4 text-xs">
            <div>
              <Label className="text-[#9AA7B4]">Nome de Quem Retirou o Veículo *</Label>
              <Input
                className="bg-[#1A232E] border-[#263340] text-white"
                value={deliveredTo}
                onChange={(e) => setDeliveredTo(e.target.value)}
                placeholder="Ex: Carlos Alberto Silva"
                required
              />
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Quilometragem na Saída (km) *</Label>
              <Input
                type="number"
                className="bg-[#1A232E] border-[#263340] text-white font-mono"
                value={deliveryKm}
                onChange={(e) => setDeliveryKm(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 48515"
                required
              />
            </div>

            <div>
              <Label className="text-[#9AA7B4]">Observações da Entrega</Label>
              <Textarea
                className="bg-[#1A232E] border-[#263340] text-white"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Veículo entregue limpo, peça substituída apresentada ao cliente..."
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeliveryModalOpen(false)}
                className="border-[#263340] text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                Confirmar Entrega
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
