import { EventModel, EventType, RawSampleModel } from '../types/obd'
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

    // Persiste oportunisticamente no PocketBase
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
      } catch (e) {
        console.warn('Persistência de evento em fallback local:', e)
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
  static extractEventWindow(
    samples: readonly RawSampleModel[],
    event: EventModel,
  ): {
    event: EventModel
    samplesBefore: RawSampleModel[]
    samplesAtEvent: RawSampleModel[]
    samplesAfter: RawSampleModel[]
    totalSamplesInWindow: number
    startMonoOffsetMs: number
    endMonoOffsetMs: number
  } {
    const eventOffset = event.ts_mono_offset_ms
    const windowStart = Math.max(0, eventOffset - (event.window_pre_ms || 30000))
    const windowEnd = eventOffset + (event.window_post_ms || 30000)

    const samplesBefore: RawSampleModel[] = []
    const samplesAtEvent: RawSampleModel[] = []
    const samplesAfter: RawSampleModel[] = []

    // Opera sobre cópias para garantir imutabilidade estrita
    for (const s of samples) {
      const sOffset = s.ts_mono_offset_ms
      if (sOffset >= windowStart && sOffset <= windowEnd) {
        const copy = { ...s }
        if (Math.abs(sOffset - eventOffset) < 150) {
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
}
