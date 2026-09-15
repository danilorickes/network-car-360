import pb from '@/lib/pocketbase/client'
import {
  ClientModel,
  VehicleReceptionModel,
  ServiceCatalogModel,
  PartsCatalogModel,
  WorkOrderModel,
  WorkOrderAuditModel,
  WorkOrderItem,
} from '@/types/commercial'

// Obtém o workshop_id do usuário autenticado no authStore
export function getAuthenticatedWorkshopId(): string {
  const authRecord = pb.authStore.record
  if (authRecord && (authRecord as any).workshop_id) {
    return (authRecord as any).workshop_id
  }
  return ''
}

// -------------------------------------------------------------
// CLIENTES (Requisito 2 & 3)
// -------------------------------------------------------------
export const clientService = {
  async getAll(workshopId?: string): Promise<ClientModel[]> {
    const wsId = workshopId || getAuthenticatedWorkshopId()
    const filter = wsId ? `workshop_id = "${wsId}"` : undefined
    try {
      return await pb.collection('clients').getFullList<ClientModel>({
        filter,
        sort: 'name',
      })
    } catch (e) {
      console.warn('Erro ao listar clientes:', e)
      return []
    }
  },

  async getById(id: string): Promise<ClientModel | null> {
    try {
      return await pb.collection('clients').getOne<ClientModel>(id)
    } catch {
      return null
    }
  },

  async search(query: string, workshopId?: string): Promise<ClientModel[]> {
    const q = query.trim()
    const wsId = workshopId || getAuthenticatedWorkshopId()
    if (!q) return this.getAll(wsId)
    const filter = wsId
      ? `workshop_id = "${wsId}" && (name ~ "${q}" || phone ~ "${q}" || document ~ "${q}")`
      : `(name ~ "${q}" || phone ~ "${q}" || document ~ "${q}")`
    try {
      return await pb.collection('clients').getFullList<ClientModel>({
        filter,
        sort: 'name',
      })
    } catch {
      return []
    }
  },

  async create(data: Omit<ClientModel, 'id' | 'created' | 'updated'>): Promise<ClientModel> {
    const wsId = data.workshop_id || getAuthenticatedWorkshopId()
    return await pb.collection('clients').create<ClientModel>({
      ...data,
      workshop_id: wsId,
    })
  },

  async update(id: string, data: Partial<ClientModel>): Promise<ClientModel> {
    return await pb.collection('clients').update<ClientModel>(id, data)
  },
}

// -------------------------------------------------------------
// CATÁLOGO DE SERVIÇOS (Requisito 7)
// -------------------------------------------------------------
export const serviceCatalogService = {
  async getAll(workshopId?: string): Promise<ServiceCatalogModel[]> {
    const wsId = workshopId || getAuthenticatedWorkshopId()
    const filter = wsId ? `workshop_id = "${wsId}"` : undefined
    try {
      return await pb.collection('service_catalog').getFullList<ServiceCatalogModel>({
        filter,
        sort: 'description',
      })
    } catch {
      return []
    }
  },

  async create(
    data: Omit<ServiceCatalogModel, 'id' | 'created' | 'updated'>,
  ): Promise<ServiceCatalogModel> {
    const wsId = data.workshop_id || getAuthenticatedWorkshopId()
    return await pb.collection('service_catalog').create<ServiceCatalogModel>({
      ...data,
      workshop_id: wsId,
    })
  },

  async update(id: string, data: Partial<ServiceCatalogModel>): Promise<ServiceCatalogModel> {
    return await pb.collection('service_catalog').update<ServiceCatalogModel>(id, data)
  },
}

// -------------------------------------------------------------
// CATÁLOGO DE PEÇAS (Requisito 8)
// -------------------------------------------------------------
export const partsCatalogService = {
  async getAll(workshopId?: string): Promise<PartsCatalogModel[]> {
    const wsId = workshopId || getAuthenticatedWorkshopId()
    const filter = wsId ? `workshop_id = "${wsId}"` : undefined
    try {
      return await pb.collection('parts_catalog').getFullList<PartsCatalogModel>({
        filter,
        sort: 'description',
      })
    } catch {
      return []
    }
  },

  async create(
    data: Omit<PartsCatalogModel, 'id' | 'created' | 'updated'>,
  ): Promise<PartsCatalogModel> {
    const wsId = data.workshop_id || getAuthenticatedWorkshopId()
    return await pb.collection('parts_catalog').create<PartsCatalogModel>({
      ...data,
      workshop_id: wsId,
    })
  },

  async update(id: string, data: Partial<PartsCatalogModel>): Promise<PartsCatalogModel> {
    return await pb.collection('parts_catalog').update<PartsCatalogModel>(id, data)
  },
}

// -------------------------------------------------------------
// RECEPÇÃO / ENTRADA RÁPIDA (Requisito 4)
// -------------------------------------------------------------
export const receptionService = {
  async getAll(workshopId?: string): Promise<VehicleReceptionModel[]> {
    const wsId = workshopId || getAuthenticatedWorkshopId()
    const filter = wsId ? `workshop_id = "${wsId}"` : undefined
    try {
      return await pb.collection('vehicle_receptions').getFullList<VehicleReceptionModel>({
        filter,
        sort: '-entry_date',
        expand: 'client,vehicle',
      })
    } catch {
      return []
    }
  },

  async getById(id: string): Promise<VehicleReceptionModel | null> {
    try {
      return await pb.collection('vehicle_receptions').getOne<VehicleReceptionModel>(id, {
        expand: 'client,vehicle',
      })
    } catch {
      return null
    }
  },

  async create(
    data: Omit<VehicleReceptionModel, 'id' | 'reception_number' | 'created' | 'updated'>,
  ): Promise<VehicleReceptionModel> {
    const wsId = data.workshop_id || getAuthenticatedWorkshopId()
    const filter = wsId ? `workshop_id = "${wsId}"` : undefined
    const total = await pb.collection('vehicle_receptions').getList(1, 1, { filter })
    const recNumber = `REC-${new Date().getFullYear()}-${String(total.totalItems + 1).padStart(4, '0')}`

    return await pb.collection('vehicle_receptions').create<VehicleReceptionModel>({
      ...data,
      reception_number: recNumber,
      workshop_id: wsId,
      status: data.status || 'ABERTO',
    })
  },
}

// -------------------------------------------------------------
// ORDEM DE SERVIÇO COMERCIAL (Requisitos 5, 6, 9, 10, 11, 18, 19, 20)
// -------------------------------------------------------------
export const workOrderService = {
  async getAll(workshopId?: string): Promise<WorkOrderModel[]> {
    const wsId = workshopId || getAuthenticatedWorkshopId()
    const filter = wsId ? `workshop_id = "${wsId}"` : undefined
    try {
      return await pb.collection('work_orders').getFullList<WorkOrderModel>({
        filter,
        sort: '-sequential_num',
        expand: 'client,vehicle,diagnostic_investigation,reception',
      })
    } catch (e) {
      console.warn('Erro ao listar OS:', e)
      return []
    }
  },

  async getById(id: string): Promise<WorkOrderModel | null> {
    try {
      return await pb.collection('work_orders').getOne<WorkOrderModel>(id, {
        expand: 'client,vehicle,diagnostic_investigation,reception',
      })
    } catch {
      return null
    }
  },

  async getByVehiclePlate(plate: string, workshopId?: string): Promise<WorkOrderModel[]> {
    const wsId = workshopId || getAuthenticatedWorkshopId()
    const filter = wsId
      ? `workshop_id = "${wsId}" && vehicle_plate = "${plate.trim().toUpperCase()}"`
      : `vehicle_plate = "${plate.trim().toUpperCase()}"`
    try {
      return await pb.collection('work_orders').getFullList<WorkOrderModel>({
        filter,
        sort: '-sequential_num',
        expand: 'client,vehicle',
      })
    } catch {
      return []
    }
  },

  // Criação da OS com cálculo determinístico e numeração sequencial
  async create(
    data: Partial<WorkOrderModel> & { client: string; vehicle: string; vehicle_plate: string },
    actorInfo: { id?: string; name: string; role?: string },
  ): Promise<WorkOrderModel> {
    const workshopId = data.workshop_id || getAuthenticatedWorkshopId()

    const { servicesSubtotal, partsSubtotal, approvedTotal, generalTotal } = calculateTotals(
      data.items || [],
    )

    const payload: any = {
      workshop_id: workshopId,
      client: data.client,
      vehicle: data.vehicle,
      reception: data.reception || null,
      diagnostic_investigation: data.diagnostic_investigation || null,
      vehicle_plate: data.vehicle_plate.toUpperCase(),
      odometer_km: data.odometer_km || 0,
      status: data.status || 'RASCUNHO',
      approval_status: data.approval_status || 'PENDENTE',
      confirmed_diagnosis: data.confirmed_diagnosis || '',
      budget_version: 1,
      items: data.items || [],
      services_subtotal: servicesSubtotal,
      parts_subtotal: partsSubtotal,
      discount_total: data.discount_total || 0,
      approved_total: approvedTotal,
      general_total: generalTotal,
      budget_notes: data.budget_notes || '',
      budget_validity_days: data.budget_validity_days || 10,
      budget_history: [],
    }

    // Se fornecido explicitamente (ex: em teste unitário mockado), repassa
    if (data.order_number) payload.order_number = data.order_number
    if (data.sequential_num) payload.sequential_num = data.sequential_num

    const created = await pb.collection('work_orders').create<WorkOrderModel>(payload)

    // Auditoria obrigatória (Requisito 18)
    await auditService.logEvent({
      workshop_id: workshopId,
      work_order: created.id,
      order_number: created.order_number,
      event_type: 'CRIACAO_OS',
      actor_id: actorInfo.id,
      actor_name: actorInfo.name,
      actor_role: actorInfo.role,
      details: `Abertura da ${created.order_number} para placa ${created.vehicle_plate}`,
      timestamp_utc: new Date().toISOString(),
    })

    return created
  },

  // Atualização com regra de versionamento após aprovação (Requisito 19)
  async updateBudget(
    id: string,
    newItems: WorkOrderItem[],
    notes: string,
    actorInfo: { id?: string; name: string; role?: string },
    currentOrder: WorkOrderModel,
  ): Promise<WorkOrderModel> {
    const { servicesSubtotal, partsSubtotal, approvedTotal, generalTotal } =
      calculateTotals(newItems)

    const wasAlreadyApproved =
      currentOrder.approval_status === 'APROVADO' ||
      currentOrder.approval_status === 'APROVADO_PARCIALMENTE'

    let newVersion = currentOrder.budget_version || 1
    let newApprovalStatus = currentOrder.approval_status
    let newStatus = currentOrder.status
    const budgetHistory = [...(currentOrder.budget_history || [])]

    // Se já estava aprovado e sofreu modificação de itens ou valores: versionar e exigir nova aprovação
    if (wasAlreadyApproved) {
      newVersion += 1
      newApprovalStatus = 'PENDENTE'
      newStatus = 'AGUARDANDO_APROVACAO'

      budgetHistory.push({
        version: currentOrder.budget_version,
        invalidatedAt: new Date().toISOString(),
        previousApprovalStatus: currentOrder.approval_status,
        previousSubtotalParts: currentOrder.parts_subtotal,
        previousSubtotalServices: currentOrder.services_subtotal,
        reason: 'Alteração posterior de itens/preços. Aprovação anterior invalidada.',
        itemsSnapshot: currentOrder.items,
      })

      await auditService.logEvent({
        workshop_id: currentOrder.workshop_id,
        work_order: currentOrder.id,
        order_number: currentOrder.order_number,
        event_type: 'ALTERACAO_ORCAMENTO_POS_APROVACAO',
        actor_id: actorInfo.id,
        actor_name: actorInfo.name,
        actor_role: actorInfo.role,
        details: `Orçamento alterado da v${currentOrder.budget_version} para v${newVersion}. Status de aprovação resetado para PENDENTE.`,
        diff_data: {
          previousApprovedTotal: currentOrder.approved_total,
          newGeneralTotal: generalTotal,
        },
        timestamp_utc: new Date().toISOString(),
      })
    }

    const payload: Partial<WorkOrderModel> = {
      items: newItems,
      services_subtotal: servicesSubtotal,
      parts_subtotal: partsSubtotal,
      approved_total: approvedTotal,
      general_total: generalTotal,
      budget_notes: notes,
      budget_version: newVersion,
      approval_status: newApprovalStatus,
      status: newStatus,
      budget_history: budgetHistory,
    }

    const updated = await pb.collection('work_orders').update<WorkOrderModel>(id, payload)
    return updated
  },

  // Registrar Aprovação do Cliente (Requisito 10)
  async registerApproval(
    id: string,
    approvalType: 'APROVADO' | 'APROVADO_PARCIALMENTE' | 'RECUSADO',
    channel: 'PRESENCIAL' | 'TELEFONE' | 'WHATSAPP' | 'EMAIL' | 'OUTRO',
    customerNotes: string,
    actorInfo: { id?: string; name: string; role?: string },
    currentOrder: WorkOrderModel,
  ): Promise<WorkOrderModel> {
    // Recalcula total apenas dos itens aprovados
    const { approvedTotal } = calculateTotals(currentOrder.items)

    const nextStatus =
      approvalType === 'RECUSADO'
        ? 'CANCELADA'
        : currentOrder.status === 'RASCUNHO' || currentOrder.status === 'AGUARDANDO_APROVACAO'
          ? 'APROVADA'
          : currentOrder.status

    const approvalDetails = {
      approvedAtUtc: new Date().toISOString(),
      responsibleUserId: actorInfo.id || '',
      responsibleUserName: actorInfo.name,
      channel,
      customerNotes,
      totalApprovedValue: approvedTotal,
    }

    const payload: Partial<WorkOrderModel> = {
      approval_status: approvalType,
      status: nextStatus,
      approved_total: approvedTotal,
      approval_details: approvalDetails,
    }

    const updated = await pb.collection('work_orders').update<WorkOrderModel>(id, payload)

    await auditService.logEvent({
      workshop_id: currentOrder.workshop_id,
      work_order: currentOrder.id,
      order_number: currentOrder.order_number,
      event_type: approvalType === 'RECUSADO' ? 'RECUSA_ORCAMENTO' : 'APROVACAO_ORCAMENTO',
      actor_id: actorInfo.id,
      actor_name: actorInfo.name,
      actor_role: actorInfo.role,
      details: `Aprovação registrada: ${approvalType} via canal ${channel}. Total aprovado: R$ ${approvedTotal.toFixed(2)}`,
      timestamp_utc: new Date().toISOString(),
    })

    return updated
  },

  // Atualizar Execução de Serviço pelo Mecânico (Requisito 11)
  async updateItemExecution(
    id: string,
    itemId: string,
    executionStatus: 'NAO_INICIADO' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'NAO_REALIZADO',
    technicianName: string,
    notes: string,
    currentOrder: WorkOrderModel,
  ): Promise<WorkOrderModel> {
    const items = [...currentOrder.items]
    const itemIndex = items.findIndex((it) => it.id === itemId)
    if (itemIndex === -1) throw new Error('Item não encontrado na OS.')

    const targetItem = items[itemIndex]

    // REGRA 11 OBRIGATÓRIA: NÃO permitir que serviço RECUSADO seja marcado como executado!
    if (targetItem.itemApproval === 'RECUSADO' && executionStatus === 'CONCLUIDO') {
      throw new Error(
        'Regra de Negócio: Não é permitido executar item que foi RECUSADO pelo cliente sem prévia aprovação!',
      )
    }

    items[itemIndex] = {
      ...targetItem,
      executionStatus,
      technicianResponsible: technicianName,
      executionNotes: notes,
      executedAt:
        executionStatus === 'CONCLUIDO' ? new Date().toISOString() : targetItem.executedAt,
    }

    // Se todos os itens aprovados estiverem concluídos, sugere AGUARDANDO_VALIDACAO ou CONCLUIDA
    const approvedItems = items.filter((it) => it.itemApproval === 'APROVADO')
    const allApprovedDone = approvedItems.every((it) => it.executionStatus === 'CONCLUIDO')

    let nextOrderStatus = currentOrder.status
    if (executionStatus === 'EM_EXECUCAO' && currentOrder.status === 'APROVADA') {
      nextOrderStatus = 'EM_EXECUCAO'
    } else if (allApprovedDone && currentOrder.status === 'EM_EXECUCAO') {
      nextOrderStatus = currentOrder.diagnostic_investigation ? 'AGUARDANDO_VALIDACAO' : 'CONCLUIDA'
    }

    const payload: Partial<WorkOrderModel> = {
      items,
      status: nextOrderStatus,
    }

    const updated = await pb.collection('work_orders').update<WorkOrderModel>(id, payload)

    await auditService.logEvent({
      workshop_id: currentOrder.workshop_id,
      work_order: currentOrder.id,
      order_number: currentOrder.order_number,
      event_type: 'EXECUCAO_SERVICO',
      actor_name: technicianName,
      details: `Item "${targetItem.description}" alterado para ${executionStatus} por ${technicianName}`,
      timestamp_utc: new Date().toISOString(),
    })

    return updated
  },

  // Registrar Validação Pós-Reparo vinculada à OS (Requisito 12)
  async registerPostRepairValidation(
    id: string,
    validationData: {
      investigationId?: string
      outcome: 'FALHA_NAO_REPRODUZIDA' | 'FALHA_PERMANECE' | 'RESULTADO_INCONCLUSIVO'
      beforeDtcList: string[]
      afterDtcList: string[]
      verdict: string
    },
    technicianName: string,
    currentOrder: WorkOrderModel,
  ): Promise<WorkOrderModel> {
    const postRepairResult = {
      ...validationData,
      validatedAtUtc: new Date().toISOString(),
    }

    const nextStatus =
      validationData.outcome === 'FALHA_NAO_REPRODUZIDA' ? 'CONCLUIDA' : 'EM_EXECUCAO'

    const updated = await pb.collection('work_orders').update<WorkOrderModel>(id, {
      post_repair_result: postRepairResult,
      status: nextStatus,
    })

    await auditService.logEvent({
      workshop_id: currentOrder.workshop_id,
      work_order: currentOrder.id,
      order_number: currentOrder.order_number,
      event_type: 'VALIDACAO_POS_REPARO',
      actor_name: technicianName,
      details: `Validação pós-reparo concluída com veredito: ${validationData.outcome}. Veredito técnico: ${validationData.verdict}`,
      timestamp_utc: new Date().toISOString(),
    })

    return updated
  },

  // Entrega do Veículo ao Cliente (Requisito 4 & 5)
  async deliverVehicle(
    id: string,
    deliveryData: {
      customerDeliveredTo: string
      odometerAtDeliveryKm: number
      responsible: string
      notes?: string
    },
    currentOrder: WorkOrderModel,
  ): Promise<WorkOrderModel> {
    const deliveryDetails = {
      ...deliveryData,
      deliveredAtUtc: new Date().toISOString(),
    }

    const updated = await pb.collection('work_orders').update<WorkOrderModel>(id, {
      status: 'ENTREGUE',
      delivery_details: deliveryDetails,
    })

    await auditService.logEvent({
      workshop_id: currentOrder.workshop_id,
      work_order: currentOrder.id,
      order_number: currentOrder.order_number,
      event_type: 'ENTREGA_VEICULO',
      actor_name: deliveryData.responsible,
      details: `Veículo entregue a ${deliveryData.customerDeliveredTo} com odômetro ${deliveryData.odometerAtDeliveryKm} km.`,
      timestamp_utc: new Date().toISOString(),
    })

    return updated
  },
}

// -------------------------------------------------------------
// SERVIÇO DE AUDITORIA (Requisito 18)
// -------------------------------------------------------------
export const auditService = {
  async logEvent(
    data: Omit<WorkOrderAuditModel, 'id' | 'created' | 'updated'>,
  ): Promise<WorkOrderAuditModel | null> {
    try {
      return await pb.collection('work_order_audits').create<WorkOrderAuditModel>(data)
    } catch (e) {
      console.warn('Erro ao registrar log de auditoria no backend:', e)
      return null
    }
  },

  async getByWorkOrderId(workOrderId: string): Promise<WorkOrderAuditModel[]> {
    try {
      return await pb.collection('work_order_audits').getFullList<WorkOrderAuditModel>({
        filter: `work_order = "${workOrderId}"`,
        sort: '-timestamp_utc',
      })
    } catch {
      return []
    }
  },
}

// -------------------------------------------------------------
// FUNÇÕES AUXILIARES DE CÁLCULO DETERMINÍSTICO (Requisito 9 & 10)
// -------------------------------------------------------------
export function calculateTotals(items: WorkOrderItem[]) {
  let servicesSubtotal = 0
  let partsSubtotal = 0
  let approvedTotal = 0
  let generalTotal = 0

  for (const item of items) {
    const itemTotal = Math.max(0, item.quantity * item.unitPrice - (item.discount || 0))
    if (item.type === 'SERVICO') {
      servicesSubtotal += itemTotal
    } else {
      partsSubtotal += itemTotal
    }
    generalTotal += itemTotal

    if (item.itemApproval === 'APROVADO') {
      approvedTotal += itemTotal
    }
  }

  return {
    servicesSubtotal: Math.round(servicesSubtotal * 100) / 100,
    partsSubtotal: Math.round(partsSubtotal * 100) / 100,
    approvedTotal: Math.round(approvedTotal * 100) / 100,
    generalTotal: Math.round(generalTotal * 100) / 100,
  }
}
