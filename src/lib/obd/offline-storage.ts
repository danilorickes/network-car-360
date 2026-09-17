import { RawSampleModel } from '@/types/obd'

const DB_NAME = 'network_car_diagnostico_360_db'
const DB_VERSION = 1
const STORE_PENDING_SAMPLES = 'pending_samples'

export interface StoredPendingSample {
  sample_id: string
  session_id: string
  session_db_id?: string
  ts_utc: string
  ts_mono_offset_ms: number
  pid: string
  raw_value?: number
  decoded_value?: number
  unit?: string
  quality: any
  origin?: string
  ecu?: string
  raw_frame?: string
  status?: string
  queued_at: number
  retry_count: number
}

/**
 * OfflineStorageService: Armazenamento persistente local baseado em IndexedDB
 * Atende NC-02: Resistente a encerramento/reabertura da aplicação,
 * mantendo alto volume de telemetria pendente de sincronização com o PocketBase.
 */
class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB não disponível neste ambiente.'))
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_PENDING_SAMPLES)) {
          const store = db.createObjectStore(STORE_PENDING_SAMPLES, { keyPath: 'sample_id' })
          store.createIndex('idx_session_id', 'session_id', { unique: false })
          store.createIndex('idx_queued_at', 'queued_at', { unique: false })
        }
      }

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        this.dbPromise = null
        reject(request.error)
      }
    })

    return this.dbPromise
  }

  /**
   * Salva uma amostra ou lote de amostras pendentes no IndexedDB
   */
  async savePendingSamples(samples: RawSampleModel[], sessionDbId?: string): Promise<void> {
    if (samples.length === 0) return

    try {
      const db = await this.getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING_SAMPLES, 'readwrite')
        const store = tx.objectStore(STORE_PENDING_SAMPLES)

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)

        for (const sample of samples) {
          const stored: StoredPendingSample = {
            sample_id: sample.sample_id,
            session_id: sample.session_id,
            session_db_id: sessionDbId || sample.session,
            ts_utc: sample.ts_utc,
            ts_mono_offset_ms: sample.ts_mono_offset_ms,
            pid: sample.pid,
            raw_value: sample.raw_value,
            decoded_value: sample.decoded_value,
            unit: sample.unit,
            quality: sample.quality,
            origin: sample.origin,
            ecu: sample.ecu,
            raw_frame: sample.raw_frame,
            status: sample.status,
            queued_at: Date.now(),
            retry_count: 0,
          }
          store.put(stored)
        }
      })
    } catch (err) {
      console.warn('Erro ao persistir amostras no IndexedDB:', err)
    }
  }

  /**
   * Retorna todas as amostras pendentes para reidratação/sincronização (compatibilidade)
   */
  async getPendingSamples(limit = 200): Promise<StoredPendingSample[]> {
    try {
      const db = await this.getDB()
      return new Promise<StoredPendingSample[]>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING_SAMPLES, 'readonly')
        const store = tx.objectStore(STORE_PENDING_SAMPLES)
        const request = limit > 0 ? store.getAll(null, limit) : store.getAll()

        request.onsuccess = () => {
          resolve(request.result || [])
        }
        request.onerror = () => reject(request.error)
      })
    } catch {
      return []
    }
  }

  /**
   * Busca amostras pendentes em lote via cursor IndexedDB sem limite rígido.
   * Suporta paginação limpa para drenar filas com milhares de itens (ex: 10.650 amostras).
   */
  async getAllPendingSamplesBatched(batchSize = 250): Promise<StoredPendingSample[]> {
    try {
      const db = await this.getDB()
      return new Promise<StoredPendingSample[]>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING_SAMPLES, 'readonly')
        const store = tx.objectStore(STORE_PENDING_SAMPLES)
        const results: StoredPendingSample[] = []
        const request = store.openCursor()

        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor && results.length < batchSize) {
            results.push(cursor.value)
            cursor.continue()
          } else {
            resolve(results)
          }
        }

        request.onerror = () => reject(request.error)
      })
    } catch {
      return []
    }
  }

  /**
   * Atualiza session_db_id de amostras no IndexedDB para reconciliar amostras órfãs
   * cujo ID interno do PocketBase foi descoberto ou criado posteriormente.
   */
  async updateSessionDbIdForSession(sessionUid: string, sessionDbId: string): Promise<number> {
    if (!sessionUid || !sessionDbId) return 0
    try {
      const db = await this.getDB()
      return new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING_SAMPLES, 'readwrite')
        const store = tx.objectStore(STORE_PENDING_SAMPLES)
        let updatedCount = 0

        const request = store.openCursor()
        request.onsuccess = (event: Event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            const item: StoredPendingSample = cursor.value
            if (item.session_id === sessionUid && item.session_db_id !== sessionDbId) {
              item.session_db_id = sessionDbId
              cursor.update(item)
              updatedCount++
            }
            cursor.continue()
          } else {
            resolve(updatedCount)
          }
        }

        request.onerror = () => reject(request.error)
        tx.onabort = () => reject(tx.error)
      })
    } catch (err) {
      console.warn('Erro ao atualizar session_db_id no IndexedDB:', err)
      return 0
    }
  }

  /**
   * Remove registros já persistidos no PocketBase (NC-03)
   */
  async removePendingSamples(sampleIds: string[]): Promise<void> {
    if (sampleIds.length === 0) return

    try {
      const db = await this.getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING_SAMPLES, 'readwrite')
        const store = tx.objectStore(STORE_PENDING_SAMPLES)

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)

        for (const id of sampleIds) {
          store.delete(id)
        }
      })
    } catch (err) {
      console.warn('Erro ao remover amostras sincronizadas do IndexedDB:', err)
    }
  }

  /**
   * Retorna a contagem total de amostras pendentes no IndexedDB
   */
  async countPendingSamples(): Promise<number> {
    try {
      const db = await this.getDB()
      return new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING_SAMPLES, 'readonly')
        const store = tx.objectStore(STORE_PENDING_SAMPLES)
        const request = store.count()

        request.onsuccess = () => resolve(request.result || 0)
        request.onerror = () => reject(request.error)
      })
    } catch {
      return 0
    }
  }

  /**
   * Limpa todas as amostras pendentes (usado em testes ou manutenção)
   */
  async clearAllPending(): Promise<void> {
    try {
      const db = await this.getDB()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING_SAMPLES, 'readwrite')
        const store = tx.objectStore(STORE_PENDING_SAMPLES)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
        store.clear()
      })
    } catch {
      // ignore
    }
  }
}

export const offlineStorage = new OfflineStorageService()
