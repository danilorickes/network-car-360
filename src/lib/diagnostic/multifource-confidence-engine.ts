import { ConfidenceScoreBreakdown, ConfidenceTier, DiagnosticHypothesis } from '@/types/diagnostic'
import {
  ConfirmationTestStatus,
  ExecutedConfirmationTest,
  HypothesisInvestigationStatus,
  InvestigationHypothesisNode,
  MultifourceEvidence,
} from '@/types/investigation'

/**
 * MultifourceConfidenceEngine:
 * Evolução do ConfidenceEngine para incorporar:
 * - Fontes de dados multifonte com pesos estritos:
 *   Dados medidos (RAW, Sensores, OBD, DTC) > Constatação técnica do mecânico > Relato subjetivo do cliente.
 * - Impacto determinístico de testes de confirmação (positivo, negativo, inconclusivo).
 * - Impossibilidade de auto-confirmação matemática pura sem critério de teste físico.
 * - Rastreabilidade completa da regra e cálculo.
 */
export class MultifourceConfidenceEngine {
  // Pesos base de cada fonte
  static readonly WEIGHTS = {
    RAW_MEASURED: 1.0, // Medido físico (sensores / barramento)
    DTC_ECU: 0.9, // Registrado pela ECU
    BLACKBOX_WINDOW: 0.95, // Dinâmica temporal comprovada
    CONFIRMATION_TEST: 1.0, // Teste físico executado
    MECHANIC_OBSERVATION: 0.65, // Constatação técnica
    VEHICLE_HISTORY: 0.6, // Recorrência no mesmo veículo
    CLIENT_COMPLAINT: 0.35, // Percepção subjetiva do motorista
  }

  /**
   * Recalcula a confiança de um nó de hipótese após o resultado de um teste de confirmação (Req 7, 8, 9)
   */
  static recalculateAfterTest(params: {
    node: InvestigationHypothesisNode
    test: ExecutedConfirmationTest
  }): InvestigationHypothesisNode {
    const { node, test } = params
    let delta = 0
    let newStatus: HypothesisInvestigationStatus = node.status
    const auditLogs = [...(node.recalculationAuditLog || [])]

    const testTime = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    switch (test.status) {
      case 'POSITIVO':
        // Teste confirmou o comportamento anômalo da hipótese (ex: falha migrou no teste cruzado)
        delta = +18
        newStatus = 'FORTALECIDA'
        auditLogs.push(
          `[${testTime}] Teste "${test.title}" POSITIVO (+18%). Evidência física experimental fortalece a hipótese.`,
        )
        break

      case 'NEGATIVO':
        // Teste contradisse a hipótese (ex: componente testado está em perfeito estado)
        delta = -35
        newStatus = 'ENFRAQUECIDA'
        auditLogs.push(
          `[${testTime}] Teste "${test.title}" NEGATIVO (-35%). Evidência experimental contrária enfraquece a hipótese.`,
        )
        break

      case 'INCONCLUSIVO':
        delta = -5
        auditLogs.push(
          `[${testTime}] Teste "${test.title}" INCONCLUSIVO (-5%). Parâmetros mantidos com ressalva técnica.`,
        )
        break

      case 'NAO_REALIZADO':
        delta = 0
        auditLogs.push(`[${testTime}] Teste "${test.title}" marcado como NÃO REALIZADO.`)
        break

      default:
        delta = 0
    }

    const calculatedConfidence = Math.max(5, Math.min(98, node.currentConfidence + delta))

    // Se a confiança cair muito por teste negativo consecutivo, pode ser sugerido descarte
    if (calculatedConfidence <= 25 && test.status === 'NEGATIVO') {
      newStatus = 'DESCARTADA'
      auditLogs.push(
        `[${testTime}] Hipótese classificada como DESCARTADA devido a contradição em testes práticos.`,
      )
    }

    // Se já estava confirmada anteriormente, mantém status se positivo
    if (node.status === 'CONFIRMADA' && test.status === 'POSITIVO') {
      newStatus = 'CONFIRMADA'
    }

    // Atualiza lista de testes associados
    const existingTests = node.testsAssociated.filter(
      (t) => t.id !== test.id && t.testCode !== test.testCode,
    )
    const updatedTests = [...existingTests, test]

    return {
      ...node,
      currentConfidence: calculatedConfidence,
      confidenceDelta: calculatedConfidence - node.initialConfidence,
      status: newStatus,
      recalculationAuditLog: auditLogs,
      testsAssociated: updatedTests,
    }
  }

  /**
   * Confirma explicitamente uma hipótese com critério técnico registrado (Req 9)
   * REGRA FUNDAMENTAL: Nunca transformar automaticamente "95%" em "defeito confirmado".
   */
  static confirmHypothesis(params: {
    node: InvestigationHypothesisNode
    confirmationCriteria: string
    technicianName: string
  }): InvestigationHypothesisNode {
    const { node, confirmationCriteria, technicianName } = params
    const nowIso = new Date().toISOString()
    const auditLogs = [
      ...(node.recalculationAuditLog || []),
      `[${new Date().toLocaleTimeString('pt-BR')}] Hipótese CONFIRMADA pelo técnico ${technicianName}. Critério registrado: "${confirmationCriteria}".`,
    ]

    return {
      ...node,
      status: 'CONFIRMADA',
      confirmationCriteriaRegistered: confirmationCriteria,
      confirmedAtUtc: nowIso,
      recalculationAuditLog: auditLogs,
    }
  }

  /**
   * Descarta explicitamente uma hipótese com justificativa registrada
   */
  static discardHypothesis(params: {
    node: InvestigationHypothesisNode
    reason: string
    technicianName: string
  }): InvestigationHypothesisNode {
    const { node, reason, technicianName } = params
    const auditLogs = [
      ...(node.recalculationAuditLog || []),
      `[${new Date().toLocaleTimeString('pt-BR')}] Hipótese DESCARTADA pelo técnico ${technicianName}. Motivo: "${reason}".`,
    ]

    return {
      ...node,
      status: 'DESCARTADA',
      discardReason: reason,
      currentConfidence: Math.min(node.currentConfidence, 15),
      recalculationAuditLog: auditLogs,
    }
  }
}
