import {
  RawSampleModel,
  EventModel,
  VehicleModel,
  DtcModel,
  BlackBoxPackage,
  ParameterWindowStat,
  DiagnosticFact,
} from '@/types/obd'
import { PID_DEFINITIONS } from './pid-decoder'

export interface WindowPartitionResult {
  event: EventModel
  samplesBefore: RawSampleModel[]
  samplesAtEvent: RawSampleModel[]
  samplesAfter: RawSampleModel[]
  totalSamplesInWindow: number
  startMonoOffsetMs: number
  endMonoOffsetMs: number
}

/**
 * TemporalComparisonSeries: Agrupa telemetria por instante temporal para análise visual simultânea:
 * ANTES -> MOMENTO DO SINTOMA -> DEPOIS
 */
export interface TemporalComparisonPoint {
  timeOffsetMs: number
  relativeSec: number // Ex: -30.0s, 0.0s, +30.0s
  phase: 'BEFORE' | 'EVENT' | 'AFTER'
  rpm?: number
  speed?: number
  engineLoad?: number
  throttle?: number
  map?: number
  maf?: number
  stft?: number
  ltft?: number
  sparkAdvance?: number
  coolant?: number
  voltage?: number
}

export class BlackBoxBuilder {
  /**
   * Particiona a telemetria na janela ±30s garantindo a imutabilidade estrita dos dados brutos
   */
  static partitionWindow(
    samples: readonly RawSampleModel[],
    event: EventModel,
  ): WindowPartitionResult {
    const eventOffset = event.ts_mono_offset_ms
    const windowStart = Math.max(0, eventOffset - (event.window_pre_ms || 30000))
    const windowEnd = eventOffset + (event.window_post_ms || 30000)

    const samplesBefore: RawSampleModel[] = []
    const samplesAtEvent: RawSampleModel[] = []
    const samplesAfter: RawSampleModel[] = []

    for (const s of samples) {
      const sOffset = s.ts_mono_offset_ms
      if (sOffset >= windowStart && sOffset <= windowEnd) {
        // Cópia rasa do sample para assegurar imutabilidade do RAW original
        const copy: RawSampleModel = { ...s }
        if (Math.abs(sOffset - eventOffset) <= 250) {
          samplesAtEvent.push(copy)
        } else if (sOffset < eventOffset) {
          samplesBefore.push(copy)
        } else {
          samplesAfter.push(copy)
        }
      }
    }

    return {
      event,
      samplesBefore,
      samplesAtEvent,
      samplesAfter,
      totalSamplesInWindow: samplesBefore.length + samplesAtEvent.length + samplesAfter.length,
      startMonoOffsetMs: windowStart,
      endMonoOffsetMs: windowEnd,
    }
  }

  /**
   * Constrói pontos temporais sincronizados para exibição simultânea multi-parâmetro:
   * RPM, Velocidade, Carga, TPS, MAP/MAF, STFT, LTFT, Avanço, Temperaturas, Tensão
   */
  static buildComparisonSeries(
    partition: WindowPartitionResult,
    intervalMs = 500,
  ): TemporalComparisonPoint[] {
    const {
      startMonoOffsetMs,
      endMonoOffsetMs,
      event,
      samplesBefore,
      samplesAtEvent,
      samplesAfter,
    } = partition
    const allSamples = [...samplesBefore, ...samplesAtEvent, ...samplesAfter].sort(
      (a, b) => a.ts_mono_offset_ms - b.ts_mono_offset_ms,
    )

    if (allSamples.length === 0) return []

    const eventOffset = event.ts_mono_offset_ms
    const points: TemporalComparisonPoint[] = []

    // Agrupa por faixas temporais regulares
    for (let t = startMonoOffsetMs; t <= endMonoOffsetMs; t += intervalMs) {
      const windowSamples = allSamples.filter(
        (s) => Math.abs(s.ts_mono_offset_ms - t) <= intervalMs / 2,
      )

      const point: TemporalComparisonPoint = {
        timeOffsetMs: t,
        relativeSec: Math.round(((t - eventOffset) / 1000) * 10) / 10,
        phase:
          Math.abs(t - eventOffset) < intervalMs ? 'EVENT' : t < eventOffset ? 'BEFORE' : 'AFTER',
      }

      for (const s of windowSamples) {
        if (s.decoded_value === undefined) continue
        switch (s.pid) {
          case '0x0C':
            point.rpm = s.decoded_value
            break
          case '0x0D':
            point.speed = s.decoded_value
            break
          case '0x04':
            point.engineLoad = s.decoded_value
            break
          case '0x11':
            point.throttle = s.decoded_value
            break
          case '0x0B':
            point.map = s.decoded_value
            break
          case '0x10':
            point.maf = s.decoded_value
            break
          case '0x06':
            point.stft = s.decoded_value
            break
          case '0x07':
            point.ltft = s.decoded_value
            break
          case '0x0E':
            point.sparkAdvance = s.decoded_value
            break
          case '0x05':
            point.coolant = s.decoded_value
            break
          case '0x42':
            point.voltage = s.decoded_value
            break
        }
      }

      points.push(point)
    }

    return points
  }

  /**
   * Calcula estatísticas (mín, máx, média, contagem) por PID dentro da janela
   */
  static calculateWindowStats(
    partition: WindowPartitionResult,
  ): Record<string, ParameterWindowStat> {
    const allSamples = [
      ...partition.samplesBefore,
      ...partition.samplesAtEvent,
      ...partition.samplesAfter,
    ]
    const grouped: Record<string, number[]> = {}
    const beforeGroup: Record<string, number[]> = {}
    const atEventGroup: Record<string, number[]> = {}
    const afterGroup: Record<string, number[]> = {}

    for (const s of allSamples) {
      if (s.decoded_value !== undefined) {
        if (!grouped[s.pid]) grouped[s.pid] = []
        grouped[s.pid].push(s.decoded_value)
      }
    }

    for (const s of partition.samplesBefore) {
      if (s.decoded_value !== undefined) {
        if (!beforeGroup[s.pid]) beforeGroup[s.pid] = []
        beforeGroup[s.pid].push(s.decoded_value)
      }
    }

    for (const s of partition.samplesAtEvent) {
      if (s.decoded_value !== undefined) {
        if (!atEventGroup[s.pid]) atEventGroup[s.pid] = []
        atEventGroup[s.pid].push(s.decoded_value)
      }
    }

    for (const s of partition.samplesAfter) {
      if (s.decoded_value !== undefined) {
        if (!afterGroup[s.pid]) afterGroup[s.pid] = []
        afterGroup[s.pid].push(s.decoded_value)
      }
    }

    const stats: Record<string, ParameterWindowStat> = {}

    for (const [pid, vals] of Object.entries(grouped)) {
      if (vals.length === 0) continue
      const def = PID_DEFINITIONS[pid]
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100

      const bVals = beforeGroup[pid] || []
      const bAvg =
        bVals.length > 0
          ? Math.round((bVals.reduce((a, b) => a + b, 0) / bVals.length) * 100) / 100
          : undefined

      const atVals = atEventGroup[pid] || []
      const atVal = atVals.length > 0 ? atVals[atVals.length - 1] : undefined

      const aVals = afterGroup[pid] || []
      const aAvg =
        aVals.length > 0
          ? Math.round((aVals.reduce((a, b) => a + b, 0) / aVals.length) * 100) / 100
          : undefined

      stats[pid] = {
        pid,
        paramName: def?.name || pid,
        unit: def?.unit || '',
        min,
        max,
        avg,
        samplesCount: vals.length,
        beforeAvg: bAvg,
        atEventValue: atVal,
        afterAvg: aAvg,
      }
    }

    return stats
  }

  /**
   * REQUISITO 7 — PREPARAÇÃO PARA IA (DiagnosticEvidence)
   * Estrutura de FATOS OBSERVADOS PURAMENTE OBJETIVOS.
   * REGRA FUNDAMENTAL: Separar obrigatoriamente RAW -> DERIVED/EVIDENCE -> FUTURA INTERPRETAÇÃO IA.
   * Nenhuma hipótese de defeito ou atribuição de causa é gravada como fato.
   */
  static extractDiagnosticFacts(
    stats: Record<string, ParameterWindowStat>,
    dtcs: DtcModel[],
    communicationState: 'CONECTADO' | 'RECONECTANDO' | 'FALHA',
  ): DiagnosticFact[] {
    const facts: DiagnosticFact[] = []

    // 1. Fatos sobre DTCs presentes
    if (dtcs.length > 0) {
      dtcs.forEach((d, idx) => {
        facts.push({
          fact_id: `fact_dtc_${idx + 1}`,
          category: 'DTC_FLAG',
          parameter: 'DTC',
          statement: `Código de anomalia ${d.dtc_code} (${d.status}) estava presente na ECU (MIL: ${d.mil_on ? 'Aceso' : 'Apagado'}).`,
          value_observed: d.dtc_code,
        })
      })
    } else {
      facts.push({
        fact_id: 'fact_dtc_none',
        category: 'DTC_FLAG',
        parameter: 'DTC',
        statement: 'Nenhum código de falha (DTC) ativo no barramento no momento do evento.',
        value_observed: 'NONE',
      })
    }

    // 2. Fato sobre estado de comunicação
    facts.push({
      fact_id: 'fact_comm_state',
      category: 'COMMUNICATION',
      parameter: 'COMM_STATE',
      statement: `Estado do barramento de comunicação no momento da captura: ${communicationState}.`,
      value_observed: communicationState,
    })

    // 3. Fatos sobre RPM (0x0C)
    const rpmStat = stats['0x0C']
    if (rpmStat && rpmStat.beforeAvg && rpmStat.atEventValue !== undefined) {
      const delta = rpmStat.atEventValue - rpmStat.beforeAvg
      const pct = Math.round((delta / rpmStat.beforeAvg) * 1000) / 10
      facts.push({
        fact_id: 'fact_rpm_variation',
        category: 'TELEMETRY_VARIATION',
        parameter: 'RPM',
        statement:
          pct < 0
            ? `RPM decresceu ${Math.abs(pct)}% no momento do evento (de média ${rpmStat.beforeAvg} para ${rpmStat.atEventValue} RPM).`
            : `RPM elevou-se ${pct}% no momento do evento (de média ${rpmStat.beforeAvg} para ${rpmStat.atEventValue} RPM).`,
        baseline_value: rpmStat.beforeAvg,
        event_value: rpmStat.atEventValue,
        delta_percent: pct,
        reference_unit: 'RPM',
      })
    }

    // 4. Fatos sobre TPS (Acelerador 0x11)
    const tpsStat = stats['0x11']
    if (tpsStat && tpsStat.atEventValue !== undefined) {
      facts.push({
        fact_id: 'fact_tps_state',
        category: 'ACTUATOR_STATE',
        parameter: 'TPS',
        statement: `Posição do pedal do acelerador / borboleta (TPS) no evento: ${tpsStat.atEventValue}% (mín: ${tpsStat.min}%, máx: ${tpsStat.max}% na janela).`,
        value_observed: tpsStat.atEventValue,
        reference_unit: '%',
      })
    }

    // 5. Fatos sobre STFT (Trim de Combustível a Curto Prazo 0x06)
    const stftStat = stats['0x06']
    if (stftStat) {
      facts.push({
        fact_id: 'fact_stft_range',
        category: 'MIXTURE_TRIM',
        parameter: 'STFT',
        statement: `Ajuste de combustível a curto prazo (STFT) oscilou entre ${stftStat.min}% e ${stftStat.max}% (média da janela: ${stftStat.avg}%).`,
        value_observed: stftStat.avg,
        reference_unit: '%',
      })
    }

    // 6. Fatos sobre Pressão MAP (0x0B)
    const mapStat = stats['0x0B']
    if (mapStat) {
      facts.push({
        fact_id: 'fact_map_range',
        category: 'TELEMETRY_VARIATION',
        parameter: 'MAP',
        statement: `Pressão absoluta do coletor (MAP) variou de ${mapStat.min} kPa a ${mapStat.max} kPa (média: ${mapStat.avg} kPa).`,
        value_observed: mapStat.avg,
        reference_unit: 'kPa',
      })
    }

    // 7. Fatos sobre Tensão do Módulo (0x42)
    const voltStat = stats['0x42']
    if (voltStat) {
      facts.push({
        fact_id: 'fact_voltage_stability',
        category: 'TELEMETRY_VARIATION',
        parameter: 'BATTERY_VOLTAGE',
        statement: `Tensão elétrica do sistema permaneceu entre ${voltStat.min} V e ${voltStat.max} V (estabilidade média: ${voltStat.avg} V).`,
        value_observed: voltStat.avg,
        reference_unit: 'V',
      })
    }

    return facts
  }

  /**
   * Constrói o pacote completo e autocontido da Caixa-Preta do Sintoma
   */
  static buildPackage(params: {
    event: EventModel
    samples: readonly RawSampleModel[]
    vehicle: VehicleModel | { plate: string; make: string; model: string; vin?: string }
    dtcs: DtcModel[]
    communicationState?: 'CONECTADO' | 'RECONECTANDO' | 'FALHA'
  }): BlackBoxPackage {
    const { event, samples, vehicle, dtcs, communicationState = 'CONECTADO' } = params

    const partition = this.partitionWindow(samples, event)
    const stats = this.calculateWindowStats(partition)
    const facts = this.extractDiagnosticFacts(stats, dtcs, communicationState)

    const allWindow = [
      ...partition.samplesBefore,
      ...partition.samplesAtEvent,
      ...partition.samplesAfter,
    ]
    const okCount = allWindow.filter((s) => s.quality === 'OK').length
    const timeoutCount = allWindow.filter((s) => s.quality === 'TIMEOUT').length
    const invalidCount = allWindow.filter(
      (s) => s.quality === 'INVALID' || s.quality === 'NO_RESPONSE',
    ).length
    const totalSamples = allWindow.length
    const okPercentage = totalSamples > 0 ? Math.round((okCount / totalSamples) * 1000) / 10 : 100

    const pidsAvailable = Object.keys(stats)

    return {
      package_id: `pkg_${event.event_id}`,
      event_id: event.event_id,
      session_id: event.session_id,
      vehicle,
      event_type: event.event_type,
      description: event.description,
      timestamp_utc: event.ts_utc,
      mono_offset_ms: event.ts_mono_offset_ms,
      window_pre_ms: event.window_pre_ms || 30000,
      window_post_ms: event.window_post_ms || 30000,
      communication_state: communicationState,
      sample_quality_summary: {
        totalSamples,
        okCount,
        timeoutCount,
        invalidCount,
        okPercentage,
      },
      pids_available: pidsAvailable,
      dtcs_context: dtcs,
      window_stats: stats,
      facts,
      samples_before_count: partition.samplesBefore.length,
      samples_at_event_count: partition.samplesAtEvent.length,
      samples_after_count: partition.samplesAfter.length,
    }
  }
}
