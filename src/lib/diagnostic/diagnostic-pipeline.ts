import { BlackBoxPackage, RawSampleModel } from '@/types/obd'
import { Diagnostic360Report, DiagnosticSeverity } from '@/types/diagnostic'
import { BaselineEngine } from './baseline-engine'
import { AnomalyEngine } from './anomaly-engine'
import { CorrelationEngine } from './correlation-engine'
import { HypothesisEngine } from './hypothesis-engine'

/**
 * Diagnostic360Pipeline: Orquestrador ponta a ponta do pipeline obrigatório:
 * RAW → DERIVED/EVIDENCE → ANOMALY → CORRELATION → HYPOTHESIS → CONFIDENCE → CONFIRMATION TEST
 *
 * Características centrais:
 * - 100% determinístico e client-side (Zero dependência primária de LLM).
 * - Totalmente auditável (rastreabilidade de cada passo, evidência favorável/contrária e regra acionada).
 * - Imutabilidade dos dados de entrada preservada.
 * - Segurança diagnóstica (INFORMATIVO / ATENÇÃO / CRÍTICO).
 */
export class Diagnostic360Pipeline {
  static readonly ENGINE_VERSION = 'OS-ME001-E3-v3.0.0-DETERMINISTIC'

  static executeAnalysis(params: {
    blackBox: BlackBoxPackage
    allSessionSamples: readonly RawSampleModel[]
  }): Diagnostic360Report {
    const { blackBox, allSessionSamples } = params
    const startMono = performance.now()

    // 1. RAW → DERIVED/EVIDENCE (Linha de Base Dinâmica da própria sessão)
    const baseline = BaselineEngine.computeDynamicBaseline({
      sessionId: blackBox.session_id,
      samples: allSessionSamples,
      eventOffsetMs: blackBox.mono_offset_ms,
      windowPreMs: blackBox.window_pre_ms,
      windowPostMs: blackBox.window_post_ms,
    })

    // 2. DERIVED/EVIDENCE → ANOMALY (Identificação de anomalias com comparação ao baseline)
    const anomalies = AnomalyEngine.detectAnomalies({
      blackBox,
      baseline,
    })

    // 3. ANOMALY → CORRELATION (Relações temporais entre sinais)
    const correlations = CorrelationEngine.correlateSignals({
      blackBox,
      anomalies,
    })

    // 4. CORRELATION → HYPOTHESIS & CONFIDENCE (Síntese das hipóteses e cálculo matemático com pesos)
    const hypotheses = HypothesisEngine.generateHypotheses({
      blackBox,
      baseline,
      anomalies,
      correlations,
    })

    // 5. Determinação da severidade geral e protocolos
    let overallSeverity: DiagnosticSeverity = 'INFORMATIVO'
    let criticalWarning: string | undefined = undefined

    for (const anom of anomalies) {
      if (anom.severity === 'CRITICO') {
        overallSeverity = 'CRITICO'
        criticalWarning = `Condição crítica detectada: ${anom.title}. Recomenda-se interromper ou limitar o teste dinâmico.`
        break
      } else if (anom.severity === 'ATENCAO' && overallSeverity === 'INFORMATIVO') {
        overallSeverity = 'ATENCAO'
      }
    }

    const recommendedProtocols = hypotheses.map((h) => h.confirmationProtocol)
    const hasDtc = blackBox.dtcs_context.length > 0
    const noDtcSignificance = !hasDtc
      ? 'A ausência de códigos armazenados (DTC) descarta falhas elétricas já reconhecidas pela ECU e reforça hipóteses de anomalia intermitente, mecânica pura ou em fase inicial.'
      : undefined

    // 6. Registro de Auditoria / Explicabilidade
    const rulesTriggered = hypotheses.map((h) => h.ruleTriggered)
    const checksumInput = `${blackBox.event_id}_${blackBox.mono_offset_ms}_${anomalies.length}_${hypotheses.length}`

    return {
      reportId: `diag360_${blackBox.event_id}`,
      sessionId: blackBox.session_id,
      eventId: blackBox.event_id,
      symptomType: blackBox.event_type,
      symptomDescription: blackBox.description,
      timestampUtc: blackBox.timestamp_utc,
      vehicle: blackBox.vehicle,
      dtcsContext: blackBox.dtcs_context,
      hasDtc,
      noDtcSignificance,
      safetyOverall: overallSeverity,
      criticalWarning,
      baseline,
      anomalies,
      correlations,
      hypotheses,
      recommendedProtocols,
      auditLog: {
        engineVersion: this.ENGINE_VERSION,
        executedAtUtc: new Date().toISOString(),
        totalRulesEvaluated: 6,
        rulesTriggered,
        inputSampleCount: allSessionSamples.length,
        pidsEvaluated: baseline.pidsEvaluated,
        missingPids: ['0x2F', '0x33'],
        deterministicChecksum: checksumInput,
      },
    }
  }
}
