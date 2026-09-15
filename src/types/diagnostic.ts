import { DtcModel, EventModel, VehicleModel } from './obd'

// Nível de severidade da anomalia / segurança diagnóstica
export type DiagnosticSeverity = 'INFORMATIVO' | 'ATENCAO' | 'CRITICO'

// Faixas de confiança sem falsa precisão
export type ConfidenceTier = 'BAIXA' | 'MODERADA' | 'ALTA' | 'MUITO_ALTA'

// Tipo de anomalia identificada pelo AnomalyEngine
export type AnomalyType =
  | 'RPM_DROP_ABRUPT'
  | 'RPM_UNSTABLE'
  | 'STFT_LTFT_OUT_OF_BOUNDS'
  | 'MAP_TPS_INCOMPATIBLE'
  | 'MAF_REGIME_INCOMPATIBLE'
  | 'VOLTAGE_DROP_OR_UNSTABLE'
  | 'TEMPERATURE_ANOMALOUS'
  | 'TPS_UNRESPONSIVE_RESPONSE'
  | 'COMMUNICATION_LOSS_OR_TIMEOUT'
  | 'PRE_SYMPTOM_DIVERGENCE'

// Estrutura de cada anomalia identificada
export interface DiagnosticAnomaly {
  id: string
  type: AnomalyType
  title: string
  description: string
  pidsInvolved: string[] // ex: ['0x0C', '0x11']
  observedValue: number | string
  baselineComparison: {
    baselineValue?: number | string
    beforeAvg?: number
    eventValue?: number
    afterAvg?: number
    deltaPercent?: number
    unit?: string
    notes?: string
  }
  momentOffsetMs: number // instante relativo em ms na sessão
  relativeToSymptomSec: number // ex: -2.5s, 0.0s, +5.2s
  durationMs: number
  severity: DiagnosticSeverity
  originEvidenceId: string // vínculo com fact_id ou raw sample
}

// Estrutura de correlação entre sinais
export interface DiagnosticCorrelation {
  id: string
  title: string
  description: string
  relatedPids: string[]
  timeWindowMs: { start: number; end: number }
  mechanism: string // ex: "TPS subiu mas RPM e Carga caíram no mesmo intervalo temporal"
  confidenceImpact: number // peso positivo para hipóteses associadas (+15, +20, etc.)
  rawEvidenceIds: string[] // vínculos com IDs de fatos/raw
}

// Item do protocolo de testes de confirmação
export interface ConfirmationStep {
  stepNumber: number
  title: string
  action: string
  toolsNeeded: string[] // ex: "Multímetro", "Manômetro de pressão de combustível", "Osciloscópio"
  targetComponent: string // ex: "Bobina cil 1", "Bico injetor", "Sonda Lambda 1"
  expectedOutcomeNormal: string
  expectedOutcomeFaulty: string
  safetyWarning?: string
  priority: 'ALTA' | 'MEDIA' | 'BAIXA'
}

// Protocolo de confirmação
export interface ConfirmationProtocol {
  protocolId: string
  targetHypothesisId: string
  title: string
  objective: string // Priorizar "testar antes de substituir"
  steps: ConfirmationStep[]
  estimatedDurationMin: number
  destructiveAlert: string // Reafirmação: Proibido comandos destrutivos / mode 04
}

// Detalhamento do cálculo da confiança (Auditabilidade e Explicabilidade)
export interface ConfidenceScoreBreakdown {
  finalScore: number // 0 a 100
  tier: ConfidenceTier
  dtcWeight: number // bônus DTC compatível
  temporalAnomalyWeight: number // bônus anomalia temporal comprovada
  multiSignalCorrelationWeight: number // bônus correlação múltiplos sinais
  symptomReportMatchWeight: number // bônus concordância com relato do sintoma
  contradictoryEvidencePenalty: number // penalidade para evidência contrária
  missingPidPenalty: number // redução por PIDs não suportados/indisponíveis
  explanation: string // Explicação textual transparente de "Por que X%"
}

// Estrutura de Hipótese Diagnóstica
export interface DiagnosticHypothesis {
  id: string
  rank: number
  title: string
  description: string
  affectedSystem:
    | 'SISTEMA_IGNICAO'
    | 'SISTEMA_ALIMENTACAO_COMBUSTIVEL'
    | 'SISTEMA_ADMISSAO_AR'
    | 'SISTEMA_ELETRICO_CARGA'
    | 'GERENCIAMENTO_MOTOR_ECU'
    | 'ARREFECIMENTO'
    | 'TRANSMISSAO_MECANICA'
    | 'COMUNICACAO_OBD'
    | 'NENHUMA_FALHA_DETECTADA'
  possibleCauses: string[]
  favorableEvidences: string[]
  contraryEvidences: string[]
  relatedDtcs: string[]
  relatedAnomalies: string[] // IDs de DiagnosticAnomaly
  relatedCorrelations: string[] // IDs de DiagnosticCorrelation
  missingOrUnavailablePids: string[]
  confidence: number // 0 a 100
  confidenceTier: ConfidenceTier
  confidenceBreakdown: ConfidenceScoreBreakdown
  limitations: string[]
  confirmationProtocol: ConfirmationProtocol
  ruleTriggered: string // Código da regra interna que acionou a hipótese
  safetyLevel: DiagnosticSeverity
  safetyRecommendation?: string
}

// Baseline dinâmico calculado na própria sessão
export interface DynamicSessionBaseline {
  sessionId: string
  pidsEvaluated: string[]
  statsByPid: Record<
    string,
    {
      pid: string
      unit: string
      normalSessionAvg: number
      normalSessionStdDev: number
      minObserved: number
      maxObserved: number
      samplesCount: number
    }
  >
  preSymptomWindowAvg: Record<string, number>
  eventInstantValue: Record<string, number>
  postSymptomWindowAvg: Record<string, number>
}

// Pacote global do Diagnóstico 360 para um sintoma / caixa-preta
export interface Diagnostic360Report {
  reportId: string
  sessionId: string
  eventId: string
  symptomType: string
  symptomDescription?: string
  timestampUtc: string
  vehicle: VehicleModel | { plate: string; make: string; model: string; vin?: string }
  dtcsContext: DtcModel[]
  hasDtc: boolean
  noDtcSignificance?: string
  safetyOverall: DiagnosticSeverity
  criticalWarning?: string

  // Pipeline transparente e auditável
  baseline: DynamicSessionBaseline
  anomalies: DiagnosticAnomaly[]
  correlations: DiagnosticCorrelation[]
  hypotheses: DiagnosticHypothesis[]
  recommendedProtocols: ConfirmationProtocol[]

  // Resumo de auditoria
  auditLog: {
    engineVersion: string
    executedAtUtc: string
    totalRulesEvaluated: number
    rulesTriggered: string[]
    inputSampleCount: number
    pidsEvaluated: string[]
    missingPids: string[]
    deterministicChecksum: string
  }
}
