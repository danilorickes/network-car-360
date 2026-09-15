import { RawSampleModel } from '@/types/obd'
import { DynamicSessionBaseline } from '@/types/diagnostic'

/**
 * BaselineEngine: Calcula a assinatura normal do veículo na própria sessão:
 * Período normal da sessão → Período imediatamente anterior ao sintoma → Momento do sintoma → Período posterior.
 * Prepara estrutura desacoplada para futuras comparações com sessões anteriores do mesmo veículo.
 */
export class BaselineEngine {
  static computeDynamicBaseline(params: {
    sessionId: string
    samples: readonly RawSampleModel[]
    eventOffsetMs: number
    windowPreMs?: number
    windowPostMs?: number
  }): DynamicSessionBaseline {
    const { sessionId, samples, eventOffsetMs, windowPreMs = 30000, windowPostMs = 30000 } = params

    const preWindowStart = Math.max(0, eventOffsetMs - windowPreMs)
    const postWindowEnd = eventOffsetMs + windowPostMs

    // Amostras fora da janela do sintoma representam a linha de base geral da sessão
    const normalSamples: RawSampleModel[] = []
    const preSymptomSamples: RawSampleModel[] = []
    const eventInstantSamples: RawSampleModel[] = []
    const postSymptomSamples: RawSampleModel[] = []

    for (const s of samples) {
      if (s.decoded_value === undefined || isNaN(s.decoded_value)) continue

      const offset = s.ts_mono_offset_ms
      if (Math.abs(offset - eventOffsetMs) <= 300) {
        eventInstantSamples.push(s)
      } else if (offset >= preWindowStart && offset < eventOffsetMs) {
        preSymptomSamples.push(s)
      } else if (offset > eventOffsetMs && offset <= postWindowEnd) {
        postSymptomSamples.push(s)
      } else {
        normalSamples.push(s)
      }
    }

    // Se a sessão for muito curta ou quase toda na janela do sintoma, mescla com as amostras pré-sintoma
    const baselinePool =
      normalSamples.length > 10
        ? normalSamples
        : preSymptomSamples.length > 5
          ? preSymptomSamples
          : samples

    // Agrupa valores por PID
    const poolByPid: Record<string, number[]> = {}
    const preByPid: Record<string, number[]> = {}
    const postByPid: Record<string, number[]> = {}
    const eventByPid: Record<string, number> = {}

    for (const s of baselinePool) {
      if (s.decoded_value === undefined) continue
      if (!poolByPid[s.pid]) poolByPid[s.pid] = []
      poolByPid[s.pid].push(s.decoded_value)
    }

    for (const s of preSymptomSamples) {
      if (s.decoded_value === undefined) continue
      if (!preByPid[s.pid]) preByPid[s.pid] = []
      preByPid[s.pid].push(s.decoded_value)
    }

    for (const s of postSymptomSamples) {
      if (s.decoded_value === undefined) continue
      if (!postByPid[s.pid]) postByPid[s.pid] = []
      postByPid[s.pid].push(s.decoded_value)
    }

    for (const s of eventInstantSamples) {
      if (s.decoded_value !== undefined) {
        eventByPid[s.pid] = s.decoded_value
      }
    }

    const evaluatedPids = Object.keys(poolByPid)
    const statsByPid: DynamicSessionBaseline['statsByPid'] = {}
    const preSymptomWindowAvg: Record<string, number> = {}
    const postSymptomWindowAvg: Record<string, number> = {}

    for (const pid of evaluatedPids) {
      const vals = poolByPid[pid] || []
      const count = vals.length
      if (count === 0) continue

      const sum = vals.reduce((a, b) => a + b, 0)
      const avg = sum / count
      const variance = vals.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / count
      const stdDev = Math.sqrt(variance)

      statsByPid[pid] = {
        pid,
        unit: '',
        normalSessionAvg: Math.round(avg * 100) / 100,
        normalSessionStdDev: Math.round(stdDev * 100) / 100,
        minObserved: Math.min(...vals),
        maxObserved: Math.max(...vals),
        samplesCount: count,
      }

      const preVals = preByPid[pid] || []
      if (preVals.length > 0) {
        preSymptomWindowAvg[pid] =
          Math.round((preVals.reduce((a, b) => a + b, 0) / preVals.length) * 100) / 100
      }

      const postVals = postByPid[pid] || []
      if (postVals.length > 0) {
        postSymptomWindowAvg[pid] =
          Math.round((postVals.reduce((a, b) => a + b, 0) / postVals.length) * 100) / 100
      }
    }

    return {
      sessionId,
      pidsEvaluated: evaluatedPids,
      statsByPid,
      preSymptomWindowAvg,
      eventInstantValue: eventByPid,
      postSymptomWindowAvg,
    }
  }
}
