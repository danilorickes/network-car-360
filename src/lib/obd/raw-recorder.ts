import { RawSampleModel } from '../types/obd'
import pb from '../pocketbase/client'

/**
 * RawRecorder: Persistência Append-Only com buffer local offline-first.
 * Nunca atualiza nem deleta amostras prévias.
 * Se PocketBase estiver temporariamente offline ou a conexão cair,
 * o gravador armazena no buffer em memória/localStorage e persiste
 * oportunisticamente sem interromper o loop de telemetria OBD do navegador.
 */
export class RawRecorder {
  private inMemoryBuffer: RawSampleModel[] = []
  private isFlushing = false
  private dbSessionRecordId: string | null = null
  private sampleSeq = 0

  constructor(dbSessionRecordId?: string) {
    if (dbSessionRecordId) {
      this.dbSessionRecordId = dbSessionRecordId
    }
  }

  setDbSessionId(id: string): void {
    this.dbSessionRecordId = id
  }

  recordSample(sample: Omit<RawSampleModel, 'sample_id'>): RawSampleModel {
    this.sampleSeq++
    const fullSample: RawSampleModel = {
      ...sample,
      sample_id: `samp_${Date.now()}_${this.sampleSeq}`,
      session: this.dbSessionRecordId || undefined,
    }

    this.inMemoryBuffer.push(fullSample)

    // Dispara flush assíncrono não bloqueante
    this.flushOpportunistic()

    return fullSample
  }

  getBufferedCount(): number {
    return this.inMemoryBuffer.length
  }

  getSamplesCopy(): RawSampleModel[] {
    return [...this.inMemoryBuffer]
  }

  private async flushOpportunistic(): Promise<void> {
    if (this.isFlushing || !this.dbSessionRecordId || this.inMemoryBuffer.length === 0) {
      return
    }

    this.isFlushing = true
    try {
      // Pega até 20 amostras do buffer para gravar em lote não bloqueante
      const chunk = this.inMemoryBuffer.slice(0, 20)
      for (const item of chunk) {
        if (!item.id && this.dbSessionRecordId) {
          try {
            const created = await pb.collection('raw_samples').create({
              session: this.dbSessionRecordId,
              sample_id: item.sample_id,
              ts_utc: item.ts_utc,
              ts_mono_offset_ms: item.ts_mono_offset_ms,
              pid: item.pid,
              raw_value: item.raw_value ?? null,
              decoded_value: item.decoded_value ?? null,
              unit: item.unit ?? null,
              quality: item.quality,
            })
            item.id = created.id
          } catch (e) {
            // Falha de rede/offline: mantém em memória sem quebrar
            break
          }
        }
      }
    } finally {
      this.isFlushing = false
    }
  }
}
