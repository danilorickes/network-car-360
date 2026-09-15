import { EventModel, EventType, RawSampleModel, VehicleModel, DtcModel } from '../types/obd'
import { BlackBoxBuilder } from './blackbox-builder'
import pb from '../pocketbase/client'

export class EventMarker {
  private events: EventModel[] = []
  private dbSessionRecordId: string | null = null
  private sessionUniqueId: string
  private sessionMonoStart: number

  constructor(sessionUniqueId: string, sessionMonoStart: number, dbSessionRecordId?: string) {
    this.sessionUniqueId = sessionUniqueId
    this.sessionMonoStart = sessionMonoStart
    this.dbSessionRecordId = dbSessionRecordId || null
  }

  setDbSessionId(id: string): void {
    this.dbSessionRecordId = id
  }

  async markSymptom(
    eventType: EventType,
    description: string,
    windowPreMs = 30000,
    windowPostMs = 30000,
    context?: {
      samples?: readonly RawSampleModel[]
      vehicle?: VehicleModel | null
      dtcs?: DtcModel[]
      communicationState?: 'CONECTADO' | 'RECONECTANDO' | 'FALHA'
    },
  ): Promise<EventModel> {
    const monoNow = performance.now()
    const monoOffsetMs = Math.round(monoNow - this.sessionMonoStart)
    const utcDate = new Date()
    const utcIso = utcDate.toISOString()

    const event: EventModel = {
      event_id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      session: this.dbSessionRecordId || undefined,
      session_id: this.sessionUniqueId,
      event_type: eventType,
      description: description.trim() || undefined,
      ts_utc: utcIso,
      ts_mono_offset_ms: monoOffsetMs,
      window_pre_ms: windowPreMs,
      window_post_ms: windowPostMs,
    }

    this.events.push(event)

    // Persiste oportunisticamente no PocketBase (events)
    let eventRecordId: string | undefined = undefined
    if (this.dbSessionRecordId) {
      try {
        const rec = await pb.collection('events').create({
          session: this.dbSessionRecordId,
          event_id: event.event_id,
          event_type: event.event_type,
          description: event.description || '',
          ts_utc: event.ts_utc,
          ts_mono_offset_ms: event.ts_mono_offset_ms,
          window_pre_ms: event.window_pre_ms,
          window_post_ms: event.window_post_ms,
        })
        event.id = rec.id
        eventRecordId = rec.id
      } catch (e) {
        console.warn('Persistência de evento em fallback local:', e)
      }
    }

    // Se houver telemetria e contexto, constrói e persiste automaticamente a Caixa-Preta (DiagnosticEvidence)
    if (context && context.samples && context.samples.length > 0) {
      try {
        const pkg = BlackBoxBuilder.buildPackage({
          event,
          samples: context.samples,
          vehicle: context.vehicle || {
            plate: 'S/PLACA',
            make: 'Veículo',
            model: 'Genérico OBD-II',
          },
          dtcs: context.dtcs || [],
          communicationState: context.communicationState || 'CONECTADO',
        })

        if (eventRecordId && this.dbSessionRecordId) {
          await pb.collection('diagnostic_evidences').create({
            event: eventRecordId,
            session: this.dbSessionRecordId,
            event_id: event.event_id,
            session_id: this.sessionUniqueId,
            vehicle_info: pkg.vehicle,
            symptom_type: event.event_type,
            description: event.description || '',
            timestamp_utc: event.ts_utc,
            mono_offset_ms: event.ts_mono_offset_ms,
            window_stats: pkg.window_stats,
            dtcs_context: pkg.dtcs_context,
            communication_state: pkg.communication_state,
            sample_quality_summary: pkg.sample_quality_summary,
            pids_available: pkg.pids_available,
            facts: pkg.facts,
          })
        }
      } catch (err) {
        console.warn('Persistência de evidência diagnóstica da caixa-preta em fallback local:', err)
      }
    }

    return event
  }

  getEvents(): EventModel[] {
    return [...this.events]
  }
}

/**
 * WindowExtractor: "Caixa-Preta" do Diagnóstico 360.
 * Ao marcar um evento, extrai uma projeção imutável contendo:
 * 30 s anteriores + instante exato + 30 s posteriores (configurável).
 * REGRA INVIOLÁVEL: A extração NUNCA altera nem remove a telemetria bruta original.
 */
export class WindowExtractor {
  static extractEventWindow(samples: readonly RawSampleModel[], event: EventModel) {
    return BlackBoxBuilder.partitionWindow(samples, event)
  }
}
