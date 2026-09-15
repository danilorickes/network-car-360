import { VehicleModel, DtcModel, SessionModel, RawSampleModel } from './obd'
import {
  DiagnosticHypothesis,
  DiagnosticAnomaly,
  DiagnosticCorrelation,
  DynamicSessionBaseline,
  ConfidenceTier,
} from './diagnostic'

// Status da Ordem de Diagnóstico 360
export type InvestigationStatus =
  | 'ABERTA'
  | 'EM_INVESTIGACAO'
  | 'TESTES_PENDENTES'
  | 'REPARO_PENDENTE'
  | 'VALIDACAO_POS_REPARO'
  | 'CONCLUIDA'
  | 'FECHADA'

// Status de teste de confirmação (Req 8)
export type ConfirmationTestStatus =
  | 'PENDENTE'
  | 'EM_EXECUCAO'
  | 'POSITIVO'
  | 'NEGATIVO'
  | 'INCONCLUSIVO'
  | 'NAO_REALIZADO'

// Status da hipótese na árvore (Req 7, 9)
export type HypothesisInvestigationStatus =
  | 'EM_ANALISE'
  | 'FORTALECIDA'
  | 'ENFRAQUECIDA'
  | 'DESCARTADA'
  | 'CONFIRMADA'

// 1. Queixa Estruturada do Cliente (Req 2)
export interface ClientComplaint {
  description: string
  whenOccurs: 'SEMPRE' | 'INTERMITENTE' | 'OCASIONAL' | 'CONDICIONADO'
  engineState: 'FRIO' | 'QUENTE' | 'QUALQUER'
  movementState: 'PARADO' | 'EM_MOVIMENTO' | 'QUALQUER'
  accelerationState:
    | 'ACELERANDO'
    | 'DESACELERANDO'
    | 'VELOCIDADE_CONSTANTE'
    | 'MARCHA_LENTA'
    | 'QUALQUER'
  approximateSpeedKmH?: number
  frequency: 'CONTINUA' | 'MUITAS_VEZES_DIA' | 'ALGUMAS_VEZES_SEMANA' | 'RARO'
  symptomsSelected: {
    checkEngineLight: boolean
    noise: boolean
    vibration: boolean
    powerLoss: boolean
    highFuelConsumption: boolean
    hardStart: boolean
    engineStall: boolean
    otherSymptoms?: string
  }
  registeredAtUtc: string
}

// 2. Avaliação Inicial do Mecânico (Req 3)
export interface MechanicEvaluation {
  freeNotes: string
  roughIdle: boolean
  misfireUnderLoad: boolean
  noiseAbnormal: boolean
  unusualSmell: boolean
  vibrationFelt: boolean
  hardStarting: boolean
  powerLossObserved: boolean
  normalBehaviorObserved: boolean
  technicianName: string
  registeredAtUtc: string
  updatedAtUtc?: string
}

// 3. Comparação com Histórico do Mesmo Veículo (Req 5)
export interface VehicleHistoryComparison {
  vehicleId: string
  plate: string
  previousSessionsCount: number
  hasPreviousMisfireP0301: boolean
  previousStftAvg?: number
  currentStftAvg?: number
  stftComparisonNote?: string
  previousVoltageAvg?: number
  currentVoltageAvg?: number
  voltageComparisonNote?: string
  anomalyFirstOccurrence: boolean
  dtcRecurrenceNotes: string[]
  historicalStabilityScore: number // 0-100
  comparisonSummary: string
}

// 4. Fonte de Evidência Multifonte com Pesos Distintos (Req 6)
export type EvidenceSourceType =
  | 'RAW_TELEMETRY' // Medido físico (peso máximo)
  | 'DTC_ECU' // Medido/Registrado ECU (peso alto)
  | 'BLACKBOX_EVENT' // Medido dinâmico janela temporal
  | 'MECHANIC_OBSERVATION' // Constatação técnica (peso intermediário)
  | 'CLIENT_COMPLAINT' // Percepção subjetiva (peso informativo)
  | 'VEHICLE_HISTORY' // Histórico prévio mesmo veículo
  | 'CONFIRMATION_TEST' // Teste físico executado (fator decisivo)

export interface MultifourceEvidence {
  id: string
  sourceType: EvidenceSourceType
  weightMultiplier: number // ex: 1.0 (medido), 0.7 (técnico), 0.35 (subjetivo cliente)
  title: string
  detail: string
  isFavorable: boolean
  isContradictory: boolean
  rawRefId?: string
}

// 5. Teste de Confirmação Executado (Req 8)
export interface ExecutedConfirmationTest {
  id: string
  testCode: string
  title: string
  targetHypothesisId: string
  targetComponent: string
  status: ConfirmationTestStatus
  responsible: string
  measuredValue?: string
  measuredUnit?: string
  observation?: string
  executedAtUtc: string
  attachmentMeta?: {
    hasAttachment: boolean
    fileName?: string
    fileUrl?: string
    description?: string
  }
}

// 6. Nó da Árvore de Investigação (Req 7, 9)
export interface InvestigationHypothesisNode {
  hypothesis: DiagnosticHypothesis
  status: HypothesisInvestigationStatus
  initialConfidence: number
  currentConfidence: number
  confidenceDelta: number
  recalculationAuditLog: string[]
  testsAssociated: ExecutedConfirmationTest[]
  confirmationCriteriaRegistered?: string
  confirmedAtUtc?: string
  discardReason?: string
}

// 7. Intervenção Mecânica / Reparo (Req 9, 10)
export interface RepairIntervention {
  id: string
  title: string
  description: string // ex: "Bobina do cilindro 1 substituída"
  replacedParts: {
    partName: string
    partNumber?: string
    replacedQuantity: number
  }[]
  responsibleTechnician: string
  serviceDateUtc: string
  notes?: string
}

// 8. Validação Pós-Reparo (Antes vs Depois) (Req 10)
export interface PostRepairValidation {
  retestSessionId: string
  retestSessionUid: string
  executedAtUtc: string
  outcome: 'FALHA_NAO_REPRODUZIDA' | 'FALHA_PERMANECE' | 'RESULTADO_INCONCLUSIVO'
  beforeDtcList: string[]
  afterDtcList: string[]
  beforeSymptomObserved: string
  afterSymptomObserved: string
  parameterComparison: {
    parameter: string
    beforeValue: string
    afterValue: string
    normalized: boolean
  }[]
  technicianVerdict: string
}

// 9. Linha do Tempo Auditável do Prontuário Técnico (Req 11)
export interface TimelineEntry {
  id: string
  timestampUtc: string
  category:
    | 'QUEIXA'
    | 'AVALIACAO_INICIAL'
    | 'SESSAO_OBD'
    | 'SINTOMA_DETECTADO'
    | 'MOTOR_DIAGNOSTICO'
    | 'TESTE_CONFIRMACAO'
    | 'CONFIRMACAO_DEFEITO'
    | 'INTERVENCAO_REPARO'
    | 'RETESTE_VALIDACAO'
    | 'CONCLUSAO'
  title: string
  description: string
  actor: string
  badgeText?: string
  severity?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ALERT'
}

// 10. Ordem de Diagnóstico 360 Completa (Req 1)
export interface DiagnosticInvestigationModel {
  id: string
  investigation_number: string // ex: "OD-2026-0001"
  vehicle: string // ID PocketBase do veículo
  vehicle_plate: string
  vehicle_model?: string
  odometer_km?: number
  status: InvestigationStatus
  client_complaint: ClientComplaint
  mechanic_evaluation: MechanicEvaluation
  initial_session?: string
  retest_session?: string
  hypotheses_tree: InvestigationHypothesisNode[]
  tests_log: ExecutedConfirmationTest[]
  intervention?: RepairIntervention
  post_repair_validation?: PostRepairValidation
  timeline: TimelineEntry[]
  final_conclusion?: string
  created?: string
  updated?: string
}
