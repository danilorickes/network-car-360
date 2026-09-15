// Tipos do Módulo Operação da Oficina e OS Comercial (OS-ME001-E5)
import { VehicleModel } from './obd'
import { DiagnosticInvestigationModel } from './investigation'

// Roles de usuário
export type UserRole = 'ADMINISTRADOR' | 'RECEPCAO' | 'MECANICO'

export interface WorkshopModel {
  id: string
  name: string
  code: string
  cnpj?: string
  phone?: string
  address?: string
  active: boolean
  created?: string
  updated?: string
}

export interface ClientModel {
  id: string
  workshop_id: string
  name: string
  document?: string // CPF/CNPJ opcional
  phone: string
  whatsapp?: string
  email?: string
  address?: string
  notes?: string
  active: boolean
  created?: string
  updated?: string
}

// Estados da Ordem de Serviço Comercial
export type WorkOrderStatus =
  | 'RASCUNHO'
  | 'AGUARDANDO_DIAGNOSTICO'
  | 'AGUARDANDO_ORCAMENTO'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADA'
  | 'EM_EXECUCAO'
  | 'AGUARDANDO_PECA'
  | 'AGUARDANDO_VALIDACAO'
  | 'CONCLUIDA'
  | 'ENTREGUE'
  | 'CANCELADA'

// Estados de Aprovação do Cliente
export type BudgetApprovalStatus = 'PENDENTE' | 'APROVADO' | 'APROVADO_PARCIALMENTE' | 'RECUSADO'

export type ApprovalChannel = 'PRESENCIAL' | 'TELEFONE' | 'WHATSAPP' | 'EMAIL' | 'OUTRO'

// Estados de Execução de Item de Serviço
export type ServiceExecutionStatus = 'NAO_INICIADO' | 'EM_EXECUCAO' | 'CONCLUIDO' | 'NAO_REALIZADO'

// Item individual do Orçamento / OS (Serviço ou Peça)
export interface WorkOrderItem {
  id: string
  type: 'SERVICO' | 'PECA'
  catalogId?: string
  code: string
  description: string
  quantity: number
  unitPrice: number
  discount: number
  subtotal: number
  itemApproval: 'APROVADO' | 'RECUSADO' | 'PENDENTE'
  executionStatus: ServiceExecutionStatus
  technicianResponsible?: string
  executionNotes?: string
  executedAt?: string
}

// Detalhes da aprovação registrada
export interface ApprovalDetails {
  approvedAtUtc: string
  responsibleUserId: string
  responsibleUserName: string
  channel: ApprovalChannel
  customerNotes?: string
  totalApprovedValue: number
}

// Versão anterior do orçamento preservada para auditoria
export interface BudgetVersionHistory {
  version: number
  invalidatedAt: string
  previousApprovalStatus: BudgetApprovalStatus
  previousSubtotalParts: number
  previousSubtotalServices: number
  reason: string
  itemsSnapshot: WorkOrderItem[]
}

// Motivos da Entrada do Veículo
export type EntryReason = 'diagnostico' | 'manutencao' | 'revisao' | 'reparo' | 'retorno' | 'outros'

// Entrada rápida do veículo (Recepção)
export interface VehicleReceptionModel {
  id: string
  workshop_id: string
  reception_number: string // ex: "REC-2026-0001"
  client: string // ID do cliente
  client_data?: ClientModel
  vehicle: string // ID do veículo
  vehicle_data?: VehicleModel
  vehicle_plate: string
  odometer_km: number
  entry_reason: EntryReason
  notes?: string
  responsible: string
  entry_date: string
  status: 'ABERTO' | 'EM_ANDAMENTO' | 'ENCERRADO'
  created?: string
  updated?: string
}

// Catálogo de Serviços
export interface ServiceCatalogModel {
  id: string
  workshop_id: string
  code: string
  description: string
  category: string
  default_price: number
  estimated_minutes: number
  notes?: string
  active: boolean
  created?: string
  updated?: string
}

// Catálogo de Peças / Materiais
export interface PartsCatalogModel {
  id: string
  workshop_id: string
  code: string
  description: string
  manufacturer?: string
  reference_code?: string
  cost_price: number
  sale_price: number
  unit: string
  notes?: string
  active: boolean
  created?: string
  updated?: string
}

// Entidade Ordem de Serviço Comercial (work_order)
export interface WorkOrderModel {
  id: string
  workshop_id: string
  order_number: string // OS #000001
  sequential_num: number
  client: string // ID
  client_data?: ClientModel
  vehicle: string // ID
  vehicle_data?: VehicleModel
  reception?: string // ID
  diagnostic_investigation?: string // ID
  diagnostic_data?: DiagnosticInvestigationModel
  vehicle_plate: string
  odometer_km: number
  status: WorkOrderStatus
  approval_status: BudgetApprovalStatus
  confirmed_diagnosis?: string // Apenas laudo confirmado tecnicamente da OD-360
  budget_version: number
  items: WorkOrderItem[]
  services_subtotal: number
  parts_subtotal: number
  discount_total: number
  approved_total: number
  general_total: number
  budget_notes?: string
  budget_validity_days?: number
  approval_details?: ApprovalDetails
  budget_history?: BudgetVersionHistory[]
  post_repair_result?: {
    investigationId?: string
    outcome: 'FALHA_NAO_REPRODUZIDA' | 'FALHA_PERMANECE' | 'RESULTADO_INCONCLUSIVO'
    beforeDtcList: string[]
    afterDtcList: string[]
    verdict: string
    validatedAtUtc: string
  }
  delivery_details?: {
    deliveredAtUtc: string
    responsible: string
    customerDeliveredTo: string
    odometerAtDeliveryKm: number
    notes?: string
  }
  created?: string
  updated?: string
}

// Registro de Auditoria da OS
export interface WorkOrderAuditModel {
  id?: string
  workshop_id: string
  work_order: string
  order_number: string
  event_type: string
  actor_id?: string
  actor_name: string
  actor_role?: string
  details: string
  diff_data?: Record<string, any>
  timestamp_utc: string
  created?: string
  updated?: string
}
