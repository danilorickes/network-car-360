import { RawSampleModel } from '../types/obd'
import pb from '../pocketbase/client'
import { offlineStorage, StoredPendingSample } from './offline-storage'

/**
 * RawRecorder: Persistência Append-Only com persistência offline verdadeira (IndexedDB)
 * e fila sincronizada com PocketBase.
 *
 * Correções de Auditoria (NC-02 e NC-03):
 * - Persistência no IndexedDB em tempo de execução: não depende de RAM.
 * - Encerramento/reabertura da aplicação: método rehydratePendingQueue() recupera dados pendentes.
 * - Flush revisado: registros persistidos com sucesso no backend são retirados da fila pendente
 *   e do IndexedDB, sem duplicar, sem vazamento de memória e sem perder amostras.
 * - Mantém um buffer circular leve em memória para visualizações em tempo real (sparklines, replay local).
 */
export class RawRecorder {
  // Fila de amostras aguardando envio ao PocketBase
  private pendingQueue: RawSampleModel[] = []
  // Buffer em memória para consulta local de telemetria da sessão (limitado para evitar estouro de RAM)
  private readonly MAX_IN_MEMORY_SAMPLES = 2000
  private recentMemoryBuffer: RawSampleModel[] = []

  private isFlushing = false
  private dbSessionRecordId: string | null = null
  private sampleSeq = 0
  private isOnline = true

  // Política de Buffer/Batch Periódico: ~35 amostras ou 2,5 segundos (adendo E6.6.1)
  private readonly BATCH_THRESHOLD_SAMPLES = 35
  private readonly BATCH_MAX_INTERVAL_MS = 2500
  private flushTimer: any = null
  private lastFlushTimestamp = Date.now()

  // Set de IDs já persistidos para proteção contra duplicidade
  private persistedIds = new Set<string>()

  constructor(dbSessionRecordId?: string) {
    if (dbSessionRecordId) {
      this.dbSessionRecordId = dbSessionRecordId
    }

    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine !== false
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }

    this.startPeriodicFlushTimer()
  }

  private startPeriodicFlushTimer(): void {
    if (typeof window === 'undefined') return
    if (this.flushTimer) clearInterval(this.flushTimer)
    this.flushTimer = setInterval(() => {
      const elapsed = Date.now() - this.lastFlushTimestamp
      if (this.pendingQueue.length > 0 && elapsed >= this.BATCH_MAX_INTERVAL_MS) {
        this.flushOpportunistic().catch(() => {})
      }
    }, 500)
  }

  private handleOnline = () => {
    this.isOnline = true
    this.flushOpportunistic()
  }

  private handleOffline = () => {
    this.isOnline = false
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  setDbSessionId(id: string): void {
    this.dbSessionRecordId = id
    // Atualiza amostras pendentes sem ID de sessão no DB
    for (const item of this.pendingQueue) {
      if (!item.session) {
        item.session = id
      }
    }
    // Dispara sincronização agora que temos o ID da sessão
    this.flushOpportunistic()
  }

  getDbSessionId(): string | null {
    return this.dbSessionRecordId
  }

  /**
   * Grava amostra de telemetria:
   * 1. Adiciona metadados e identificador imutável.
   * 2. Persiste imediatamente no IndexedDB (NC-02).
   * 3. Adiciona à fila pendente e ao buffer em memória (limitado).
   * 4. Dispara flush não bloqueante.
   */
  recordSample(sample: Omit<RawSampleModel, 'sample_id'>): RawSampleModel {
    this.sampleSeq++
    const fullSample: RawSampleModel = {
      ...sample,
      sample_id: `samp_${Date.now()}_${this.sampleSeq}_${Math.random().toString(36).substring(2, 6)}`,
      session: this.dbSessionRecordId || undefined,
    }

    // Armazenamento em memória para gráficos locais
    this.recentMemoryBuffer.push(fullSample)
    if (this.recentMemoryBuffer.length > this.MAX_IN_MEMORY_SAMPLES) {
      this.recentMemoryBuffer.shift()
    }

    // Fila pendente de persistência no backend
    this.pendingQueue.push(fullSample)

    // Persistência assíncrona imediata no IndexedDB (não bloqueia o loop OBD)
    offlineStorage
      .savePendingSamples([fullSample], this.dbSessionRecordId || undefined)
      .catch((err) => {
        console.warn('Erro ao salvar no IndexedDB:', err)
      })

    // Política de flush incremental (adendo E6.6.1):
    // Se atingir ~35 amostras ou se tiver tempo acumulado >= 2,5s, dispara flush imediato
    const elapsedSinceLastFlush = Date.now() - this.lastFlushTimestamp
    if (
      this.pendingQueue.length >= this.BATCH_THRESHOLD_SAMPLES ||
      elapsedSinceLastFlush >= this.BATCH_MAX_INTERVAL_MS
    ) {
      this.flushOpportunistic()
    }

    return fullSample
  }

  /**
   * Reidrata a fila de telemetria a partir do IndexedDB (NC-02).
   * Chamado na inicialização da aplicação para recuperar amostras pendentes
   * que não foram sincronizadas na sessão anterior.
   */
  async rehydratePendingQueue(): Promise<number> {
    try {
      const stored = await offlineStorage.getPendingSamples(1000)
      let added = 0
      for (const item of stored) {
        // Ignora itens já presentes na fila ou já persistidos
        if (this.persistedIds.has(item.sample_id)) continue
        if (this.pendingQueue.some((q) => q.sample_id === item.sample_id)) continue

        const sample: RawSampleModel = {
          sample_id: item.sample_id,
          session_id: item.session_id,
          session: item.session_db_id || this.dbSessionRecordId || undefined,
          ts_utc: item.ts_utc,
          ts_mono_offset_ms: item.ts_mono_offset_ms,
          pid: item.pid,
          raw_value: item.raw_value,
          decoded_value: item.decoded_value,
          unit: item.unit,
          quality: item.quality,
        }

        this.pendingQueue.push(sample)
        added++
      }

      if (added > 0 && this.dbSessionRecordId) {
        this.flushOpportunistic()
      }
      return added
    } catch (err) {
      console.warn('Erro ao reidratar do IndexedDB:', err)
      return 0
    }
  }

  getPendingCount(): number {
    return this.pendingQueue.length
  }

  getBufferedCount(): number {
    return this.recentMemoryBuffer.length
  }

  getSamplesCopy(): RawSampleModel[] {
    return [...this.recentMemoryBuffer]
  }

  getPendingQueueCopy(): RawSampleModel[] {
    return [...this.pendingQueue]
  }

  /**
   * Mecanismo de flush revisado (NC-03):
   * - Retira da fila SOMENTE os registros persistidos com sucesso.
   * - Remove do IndexedDB os registros concluídos para evitar crescimento desnecessário.
   * - Não duplica registros mesmo em reconexões.
   * - Mantém registros na fila em caso de falha de rede/offline.
   */
  async flushOpportunistic(): Promise<void> {
    if (this.isFlushing || this.pendingQueue.length === 0) {
      return
    }

    // Se não tivermos o ID da sessão do PocketBase, as amostras continuam salvas no IndexedDB
    // até que a sessão seja criada no backend.
    if (!this.dbSessionRecordId) {
      return
    }

    this.isFlushing = true

    this.lastFlushTimestamp = Date.now()

    try {
      // Processa em lotes de até 35 amostras por ciclo de flush (adendo E6.6.1)
      const BATCH_SIZE = 35
      while (this.pendingQueue.length > 0 && this.dbSessionRecordId) {
        const batch = this.pendingQueue.slice(0, BATCH_SIZE)
        const successfullyPersistedIds: string[] = []

        for (const item of batch) {
          // Proteção contra duplicação
          if (this.persistedIds.has(item.sample_id)) {
            successfullyPersistedIds.push(item.sample_id)
            continue
          }

          const targetSession = item.session || this.dbSessionRecordId
          if (!targetSession) break

          try {
            const payload: Record<string, any> = {
              session: targetSession,
              sample_id: item.sample_id,
              ts_utc: item.ts_utc,
              ts_mono_offset_ms: item.ts_mono_offset_ms,
              pid: item.pid,
              raw_value: item.raw_value ?? null,
              decoded_value: item.decoded_value ?? null,
              unit: item.unit ?? null,
              quality: item.quality,
            }
            if (item.ecu) payload.ecu = item.ecu
            if (item.raw_frame) payload.raw_frame = item.raw_frame
            if (item.status) payload.status = item.status

            const created = await pb.collection('raw_samples').create(payload)

            item.id = created.id
            this.persistedIds.add(item.sample_id)
            successfullyPersistedIds.push(item.sample_id)
          } catch (e: any) {
            // Falha de rede, timeout ou erro no PocketBase:
            // Interrompe o envio do lote atual sem retirar os itens com erro da fila.
            // Os dados continuam íntegros no IndexedDB e na pendingQueue.
            console.warn(
              'Falha no envio de amostra ao PocketBase (retendo na fila):',
              e?.message || e,
            )
            return
          }
        }

        // NC-03: Retira da fila pendente EXATAMENTE os registros persistidos com sucesso
        if (successfullyPersistedIds.length > 0) {
          const persistedSet = new Set(successfullyPersistedIds)
          this.pendingQueue = this.pendingQueue.filter((item) => !persistedSet.has(item.sample_id))

          // Remove do IndexedDB para liberar armazenamento persistente
          await offlineStorage.removePendingSamples(successfullyPersistedIds)
        }

        // Se o lote não conseguiu persistir tudo, encerra o ciclo de flush atual
        if (successfullyPersistedIds.length < batch.length) {
          break
        }
      }
    } finally {
      this.isFlushing = false
    }
  }

  /**
   * Força flush imediato de todo buffer pendente (usado no ENCERRAR TESTE)
   */
  async flushAllSync(): Promise<void> {
    await this.flushOpportunistic()
  }
}
