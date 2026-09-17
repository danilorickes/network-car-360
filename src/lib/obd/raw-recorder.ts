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

  // Cache de resolução de UID local (ex: sess_...) para ID interno PocketBase (ex: qngor401ahpe7pa)
  private sessionUidToDbIdCache = new Map<string, string>()

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
   * Registra manualmente o mapeamento entre o UID local da sessão e seu ID interno PocketBase.
   */
  setSessionMapping(sessionUid: string, dbSessionId: string): void {
    if (sessionUid && dbSessionId) {
      this.sessionUidToDbIdCache.set(sessionUid, dbSessionId)
      for (const item of this.pendingQueue) {
        if (item.session_id === sessionUid && !item.session) {
          item.session = dbSessionId
        }
      }
    }
  }

  /**
   * Resolve o ID interno da sessão PocketBase a partir do session_id (UID local)
   * consultando primeiro o cache em memória e depois a collection 'sessions' do PocketBase.
   */
  async resolveDbSessionId(sessionUid: string): Promise<string | null> {
    if (!sessionUid) return null
    if (this.sessionUidToDbIdCache.has(sessionUid)) {
      return this.sessionUidToDbIdCache.get(sessionUid)!
    }
    if (this.dbSessionRecordId) {
      return this.dbSessionRecordId
    }

    try {
      const records = await pb.collection('sessions').getList(1, 1, {
        filter: `session_id = "${sessionUid}"`,
      })
      if (records.items.length > 0) {
        const dbId = records.items[0].id
        this.sessionUidToDbIdCache.set(sessionUid, dbId)
        // Reconcilia amostras no IndexedDB
        offlineStorage.updateSessionDbIdForSession(sessionUid, dbId).catch(() => {})
        return dbId
      }
    } catch (err) {
      console.warn(`[RawRecorder] Não foi possível resolver ID PocketBase para ${sessionUid}:`, err)
    }

    return null
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
   * Drena paginado sem hardcap truncado e preserva todos os campos técnicos
   * (ecu, raw_frame, status, session_db_id).
   */
  async rehydratePendingQueue(maxTotalSamples = 15000): Promise<number> {
    try {
      let added = 0
      const BATCH_SIZE = 250
      let fetchedThisRound = 0

      // Drena via lotes até carregar todos os pendentes ou atingir o limite seguro de RAM
      do {
        // Pega próximo lote do storage
        const storedBatch = await offlineStorage.getAllPendingSamplesBatched(BATCH_SIZE)
        fetchedThisRound = storedBatch.length
        if (fetchedThisRound === 0) break

        let newInThisBatch = 0
        for (const item of storedBatch) {
          if (this.persistedIds.has(item.sample_id)) continue
          if (this.pendingQueue.some((q) => q.sample_id === item.sample_id)) continue

          const resolvedSession =
            item.session_db_id ||
            this.sessionUidToDbIdCache.get(item.session_id) ||
            this.dbSessionRecordId ||
            undefined

          const sample: RawSampleModel = {
            sample_id: item.sample_id,
            session_id: item.session_id,
            session: resolvedSession,
            ts_utc: item.ts_utc,
            ts_mono_offset_ms: item.ts_mono_offset_ms,
            pid: item.pid,
            raw_value: item.raw_value,
            decoded_value: item.decoded_value,
            unit: item.unit,
            quality: item.quality,
            origin: item.origin as any,
            ecu: item.ecu,
            raw_frame: item.raw_frame,
            status: item.status,
          }

          this.pendingQueue.push(sample)
          added++
          newInThisBatch++

          if (this.pendingQueue.length >= maxTotalSamples) {
            break
          }
        }

        // Se não adicionou nenhum novo item deste lote (já estavam em memória), paramos para evitar loop infinito
        if (newInThisBatch === 0 || this.pendingQueue.length >= maxTotalSamples) {
          break
        }
      } while (fetchedThisRound === BATCH_SIZE && this.pendingQueue.length < maxTotalSamples)

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
   * Mecanismo de flush revisado (NC-03 + Auditoria Offline-First v0.0.41):
   * (i) Não depende de this.dbSessionRecordId global — resolve por item / cache / PocketBase.
   * (ii) Trata HTTP 400 (ex: violação de idx_raw_samples_id em sample_id já existente)
   *      como SUCESSO IDEMPOTENTE (expurga da fila e do IndexedDB, não aborta o lote).
   * (iii) Executa retry com backoff exponencial (1s, 2s, 4s... máx ~10s, tentativas controladas)
   *       apenas para falhas reais de rede / 5xx transitórios, pausando sem perder dados.
   * (iv) Continua em lotes contínuos até zerar a fila pendente ou detectar falha irrecuperável de rede.
   * (v) NUNCA remove do IndexedDB antes da confirmação do backend de cada lote/amostra.
   */
  async flushOpportunistic(
    onBatchProgress?: (processed: number, remaining: number) => void,
  ): Promise<void> {
    if (this.isFlushing || this.pendingQueue.length === 0) {
      return
    }

    this.isFlushing = true
    this.lastFlushTimestamp = Date.now()

    try {
      const BATCH_SIZE = 100 // Processa lotes de até 100 amostras
      let consecutiveNetworkFailures = 0
      const MAX_CONSECUTIVE_NETWORK_RETRIES = 3

      while (this.pendingQueue.length > 0) {
        const batch = this.pendingQueue.slice(0, BATCH_SIZE)
        const successfullyPersistedIds: string[] = []
        let stopDueToNetworkError = false

        for (const item of batch) {
          // Proteção contra duplicação em memória
          if (this.persistedIds.has(item.sample_id)) {
            successfullyPersistedIds.push(item.sample_id)
            continue
          }

          // Resolução da sessão PocketBase para esta amostra
          let targetSession = item.session || this.dbSessionRecordId
          if (!targetSession && item.session_id) {
            targetSession = (await this.resolveDbSessionId(item.session_id)) || undefined
            if (targetSession) {
              item.session = targetSession
            }
          }

          // Se a sessão ainda não pôde ser resolvida no PocketBase, não podemos enviar esta amostra agora.
          // Mantém na fila e encerra este lote para tentar mais tarde (quando a sessão existir).
          if (!targetSession) {
            stopDueToNetworkError = true
            break
          }

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

          let sendSuccess = false
          let retryAttempt = 0
          const MAX_SAMPLE_RETRIES = 2

          while (!sendSuccess && retryAttempt <= MAX_SAMPLE_RETRIES) {
            try {
              const created = await pb.collection('raw_samples').create(payload)
              item.id = created.id
              this.persistedIds.add(item.sample_id)
              successfullyPersistedIds.push(item.sample_id)
              sendSuccess = true
              consecutiveNetworkFailures = 0
            } catch (e: any) {
              const status = e?.status || e?.response?.status || 0
              const errorStr = (e?.message || '') + JSON.stringify(e?.data || {})

              // Verificação de HTTP 400 por duplicidade (idx_raw_samples_id em sample_id)
              // Se já existe no banco, é um SUCESSO IDEMPOTENTE: remove da fila e do IndexedDB
              const isDuplicateKey =
                status === 400 &&
                (errorStr.includes('sample_id') ||
                  errorStr.includes('unique') ||
                  errorStr.includes('UNIQUE') ||
                  errorStr.includes('already exists') ||
                  errorStr.includes('ValidationFailed') ||
                  errorStr.includes('idx_raw_samples_id'))

              if (isDuplicateKey) {
                this.persistedIds.add(item.sample_id)
                successfullyPersistedIds.push(item.sample_id)
                sendSuccess = true
                break
              }

              // Falha transitória de rede ou 5xx: aplicar retry com backoff exponencial
              const isNetworkOr5xx =
                status === 0 ||
                status >= 500 ||
                e?.name === 'ClientResponseError 0' ||
                errorStr.includes('Failed to fetch') ||
                errorStr.includes('NetworkError') ||
                errorStr.includes('timeout')

              if (isNetworkOr5xx && retryAttempt < MAX_SAMPLE_RETRIES) {
                retryAttempt++
                consecutiveNetworkFailures++
                const delayMs = Math.min(1000 * Math.pow(2, retryAttempt - 1), 10000)
                await new Promise((resolve) => setTimeout(resolve, delayMs))
              } else {
                // Esgotou retries ou erro não recuperável nesta amostra:
                // Interrompe o envio sem perder amostras no IndexedDB
                console.warn(
                  `[RawRecorder] Falha ao enviar amostra ${item.sample_id} (retendo no IndexedDB):`,
                  e?.message || e,
                )
                stopDueToNetworkError = true
                break
              }
            }
          }

          if (stopDueToNetworkError) {
            break
          }
        }

        // Remove da fila em memória e do IndexedDB SOMENTE os confirmados pelo backend
        if (successfullyPersistedIds.length > 0) {
          const persistedSet = new Set(successfullyPersistedIds)
          this.pendingQueue = this.pendingQueue.filter((item) => !persistedSet.has(item.sample_id))

          // NUNCA apaga do IndexedDB antes da confirmação do backend de cada lote
          await offlineStorage.removePendingSamples(successfullyPersistedIds)

          if (onBatchProgress) {
            onBatchProgress(successfullyPersistedIds.length, this.pendingQueue.length)
          }
        }

        if (
          stopDueToNetworkError ||
          consecutiveNetworkFailures >= MAX_CONSECUTIVE_NETWORK_RETRIES
        ) {
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
