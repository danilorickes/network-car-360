import { ConfidenceScoreBreakdown, ConfidenceTier } from '@/types/diagnostic'

/**
 * ConfidenceEngine: Cálculo estritamente determinístico e reproduzível da confiança diagnóstica.
 * REGRA FUNDAMENTAL:
 * - O percentual NÃO pode ser aleatório nem gerado por LLM.
 * - Mesma entrada = mesmo resultado exato (Determinismo matemático).
 * - Sem falsa precisão: número sempre acompanhado de tier (BAIXA / MODERADA / ALTA / MUITO_ALTA)
 *   e do detalhamento transparente "Por que X%".
 *
 * Fórmula matemática base:
 * Score = Base + (DTC_Weight) + (Anomaly_Weight) + (Correlation_Weight) + (Symptom_Match_Weight)
 *         - (Contradictory_Penalty) - (Missing_Pid_Penalty)
 * Clamped entre 10% e 95% (ou 98% para normal confirmado sem falha).
 */
export class ConfidenceEngine {
  static calculateConfidence(params: {
    hasCompatibleDtc: boolean
    dtcWeightBase?: number
    temporalAnomaliesCount: number
    anomaliesWeightPerUnit?: number
    multiSignalCorrelationsCount: number
    correlationsWeightPerUnit?: number
    symptomReportMatched: boolean
    symptomMatchWeight?: number
    contradictoryEvidencesCount: number
    contradictoryPenaltyPerUnit?: number
    missingCriticalPidsCount: number
    missingPidPenaltyPerUnit?: number
    isBaselineNormalCase?: boolean
  }): ConfidenceScoreBreakdown {
    const {
      hasCompatibleDtc,
      dtcWeightBase = 25,
      temporalAnomaliesCount,
      anomaliesWeightPerUnit = 15,
      multiSignalCorrelationsCount,
      correlationsWeightPerUnit = 15,
      symptomReportMatched,
      symptomMatchWeight = 15,
      contradictoryEvidencesCount,
      contradictoryPenaltyPerUnit = 20,
      missingCriticalPidsCount,
      missingPidPenaltyPerUnit = 12,
      isBaselineNormalCase = false,
    } = params

    // Caso de conformidade normal (sem falha)
    if (isBaselineNormalCase) {
      const penalty = missingCriticalPidsCount * 5
      const finalScore = Math.max(80, 96 - penalty)
      return {
        finalScore,
        tier: 'MUITO_ALTA',
        dtcWeight: 0,
        temporalAnomalyWeight: 0,
        multiSignalCorrelationWeight: 0,
        symptomReportMatchWeight: 0,
        contradictoryEvidencePenalty: 0,
        missingPidPenalty: penalty,
        explanation:
          'Confiabilidade muito alta: todos os parâmetros operando rigorosamente dentro dos padrões nominais, sem anomalias temporais ou códigos de falha.',
      }
    }

    // 1. Pesos positivos explícitos
    const dtcWeight = hasCompatibleDtc ? dtcWeightBase : 0
    const temporalAnomalyWeight = Math.min(30, temporalAnomaliesCount * anomaliesWeightPerUnit)
    const multiSignalCorrelationWeight = Math.min(
      30,
      multiSignalCorrelationsCount * correlationsWeightPerUnit,
    )
    const symptomReportMatch = symptomReportMatched ? symptomMatchWeight : 0

    // 2. Penalidades objetivas
    const contradictoryPenalty = contradictoryEvidencesCount * contradictoryPenaltyPerUnit
    const missingPidPenalty = missingCriticalPidsCount * missingPidPenaltyPerUnit

    // 3. Base mínima para hipóteses com alguma evidência
    let rawScore =
      15 +
      dtcWeight +
      temporalAnomalyWeight +
      multiSignalCorrelationWeight +
      symptomReportMatch -
      contradictoryPenalty -
      missingPidPenalty

    // 4. Clamping e classificação em Tiers
    const finalScore = Math.max(10, Math.min(94, Math.round(rawScore)))

    let tier: ConfidenceTier = 'BAIXA'
    if (finalScore >= 85) {
      tier = 'MUITO_ALTA'
    } else if (finalScore >= 70) {
      tier = 'ALTA'
    } else if (finalScore >= 45) {
      tier = 'MODERADA'
    } else {
      tier = 'BAIXA'
    }

    // Explicação detalhada dos pesos
    const parts: string[] = []
    if (hasCompatibleDtc) parts.push(`DTC compatível ativo no barramento (+${dtcWeight}%)`)
    if (temporalAnomalyWeight > 0)
      parts.push(
        `${temporalAnomaliesCount} anomalia(s) temporal(is) observada(s) (+${temporalAnomalyWeight}%)`,
      )
    if (multiSignalCorrelationWeight > 0)
      parts.push(
        `${multiSignalCorrelationsCount} correlação(ões) entre múltiplos sinais (+${multiSignalCorrelationWeight}%)`,
      )
    if (symptomReportMatched)
      parts.push(`Sintoma relatado alinhado ao padrão técnico (+${symptomReportMatch}%)`)
    if (contradictoryPenalty > 0)
      parts.push(
        `${contradictoryEvidencesCount} evidência(s) contrária(s) detectada(s) (-${contradictoryPenalty}%)`,
      )
    if (missingPidPenalty > 0)
      parts.push(
        `${missingCriticalPidsCount} sensor(es) crítico(s) não suportado(s) pela ECU (-${missingPidPenalty}%)`,
      )

    const explanation =
      parts.length > 0
        ? `Cálculo: Base 15% + ${parts.join(' + ')} = ${finalScore}% (${tier}).`
        : `Confiança base de ${finalScore}% (${tier}) calculada com dados limitados. Recomendado teste cruzado.`

    return {
      finalScore,
      tier,
      dtcWeight,
      temporalAnomalyWeight,
      multiSignalCorrelationWeight,
      symptomReportMatchWeight: symptomReportMatch,
      contradictoryEvidencePenalty: contradictoryPenalty,
      missingPidPenalty,
      explanation,
    }
  }
}
