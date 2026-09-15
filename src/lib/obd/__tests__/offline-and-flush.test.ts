import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RawRecorder } from '@/lib/obd/raw-recorder'
import { offlineStorage } from '@/lib/obd/offline-storage'
import pb from '@/lib/pocketbase/client'
import { RawSampleModel } from '@/types/obd'

// Mock para simular IndexedDB em ambiente Node/Vitest
class MockIDBStore {
  private data = new Map<string, any>()

  put(item: any) {
    this.data.set(item.sample_id, { ...item })
    return {
      onsuccess: null,
      onerror: null,
    }
  }

  getAll() {
    const list = Array.from(this.data.values())
    const req: any = { result: list }
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess({ target: req })
    }, 0)
    return req
  }

  delete(key: string) {
    this.data.delete(key)
    return {
      onsuccess: null,
      onerror: null,
    }
  }

  count() {
    const req: any = { result: this.data.size }
    setTimeout(() => {
      if (req.onsuccess) req.onsuccess({ target: req })
    }, 0)
    return req
  }

  clear() {
    this.data.clear()
    return {
      onsuccess: null,
      onerror: null,
    }
  }
}

describe('Auditoria OS-ME001-E1.1: Testes Obrigatórios NC-02 e NC-03', () => {
  let mockStore: MockIDBStore

  beforeEach(() => {
    mockStore = new MockIDBStore()

    // Configura o mock de offlineStorage para testar persistência e reidratação
    vi.spyOn(offlineStorage, 'savePendingSamples').mockImplementation(
      async (samples: RawSampleModel[], sessionDbId?: string) => {
        for (const s of samples) {
          mockStore.put({
            sample_id: s.sample_id,
            session_id: s.session_id,
            session_db_id: sessionDbId || s.session,
            ts_utc: s.ts_utc,
            ts_mono_offset_ms: s.ts_mono_offset_ms,
            pid: s.pid,
            raw_value: s.raw_value,
            decoded_value: s.decoded_value,
            unit: s.unit,
            quality: s.quality,
            queued_at: Date.now(),
            retry_count: 0,
          })
        }
      },
    )

    vi.spyOn(offlineStorage, 'getPendingSamples').mockImplementation(async () => {
      return Array.from((mockStore as any).data.values())
    })

    vi.spyOn(offlineStorage, 'removePendingSamples').mockImplementation(async (ids: string[]) => {
      for (const id of ids) {
        mockStore.delete(id)
      }
    })

    vi.spyOn(offlineStorage, 'countPendingSamples').mockImplementation(async () => {
      return (mockStore as any).data.size
    })

    vi.spyOn(offlineStorage, 'clearAllPending').mockImplementation(async () => {
      mockStore.clear()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('NC-02 — Persistência Offline Verdadeira e Reidratação', () => {
    it('deve persistir amostras no armazenamento offline sem depender exclusivamente de memória RAM', async () => {
      const recorder = new RawRecorder()

      const s1 = recorder.recordSample({
        session_id: 'sess_offline_1',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 1000,
        pid: '0x0C',
        decoded_value: 850,
        unit: 'RPM',
        quality: 'OK',
      })

      const s2 = recorder.recordSample({
        session_id: 'sess_offline_1',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 2000,
        pid: '0x0D',
        decoded_value: 40,
        unit: 'km/h',
        quality: 'OK',
      })

      // Verifica se as amostras foram entregues ao armazenamento persistente
      expect(offlineStorage.savePendingSamples).toHaveBeenCalledTimes(2)
      const count = await offlineStorage.countPendingSamples()
      expect(count).toBe(2)

      const stored = await offlineStorage.getPendingSamples()
      expect(stored.map((x) => x.sample_id)).toContain(s1.sample_id)
      expect(stored.map((x) => x.sample_id)).toContain(s2.sample_id)
    })

    it('deve simular interrupção da aplicação e reidratar amostras pendentes do IndexedDB na reabertura', async () => {
      // 1. Instância 1 da aplicação coleta amostras em modo offline (sem backend conectado)
      const appInstance1 = new RawRecorder()
      const sample1 = appInstance1.recordSample({
        session_id: 'sess_crashed',
        ts_utc: '2026-09-15T12:00:00Z',
        ts_mono_offset_ms: 100,
        pid: '0x0C',
        decoded_value: 1200,
        unit: 'RPM',
        quality: 'OK',
      })
      const sample2 = appInstance1.recordSample({
        session_id: 'sess_crashed',
        ts_utc: '2026-09-15T12:00:01Z',
        ts_mono_offset_ms: 200,
        pid: '0x05',
        decoded_value: 88,
        unit: '°C',
        quality: 'OK',
      })

      // 2. SIMULAÇÃO DE INTERRUPÇÃO ABRUPTA: a instância 1 é destruída / encerra memória RAM
      appInstance1.destroy()

      // Os dados permanecem gravados no armazenamento persistente (IndexedDB)
      const countBeforeRestart = await offlineStorage.countPendingSamples()
      expect(countBeforeRestart).toBe(2)

      // 3. REABERTURA DA APLICAÇÃO: nova instância do RawRecorder inicia com RAM vazia
      const appInstance2 = new RawRecorder()
      expect(appInstance2.getPendingCount()).toBe(0)

      // Executa reidratação a partir do IndexedDB
      const recoveredCount = await appInstance2.rehydratePendingQueue()
      expect(recoveredCount).toBe(2)
      expect(appInstance2.getPendingCount()).toBe(2)

      const pendingSamples = appInstance2.getPendingQueueCopy()
      expect(pendingSamples[0].sample_id).toBe(sample1.sample_id)
      expect(pendingSamples[0].pid).toBe('0x0C')
      expect(pendingSamples[0].decoded_value).toBe(1200)

      expect(pendingSamples[1].sample_id).toBe(sample2.sample_id)
      expect(pendingSamples[1].pid).toBe('0x05')
      expect(pendingSamples[1].decoded_value).toBe(88)

      appInstance2.destroy()
    })
  })

  describe('NC-03 — RawRecorder Flush Mecanismo, Deduplicação e Descarte Correto', () => {
    it('deve retirar da fila e do IndexedDB SOMENTE os registros persistidos com sucesso no PocketBase', async () => {
      // Mock do PocketBase: aceita a primeira amostra, falha na segunda
      let callCount = 0
      vi.spyOn(pb.collection('raw_samples'), 'create').mockImplementation(async (data: any) => {
        callCount++
        if (callCount === 1) {
          return { id: `pb_rec_${callCount}`, ...data } as any
        }
        // Simula queda de rede no segundo registro
        throw new Error('Falha de rede temporária (PocketBase offline)')
      })

      const recorder = new RawRecorder('db_session_123')

      // Registra 2 amostras
      const s1 = recorder.recordSample({
        session_id: 'sess_1',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 50,
        pid: '0x0C',
        decoded_value: 900,
        unit: 'RPM',
        quality: 'OK',
      })
      const s2 = recorder.recordSample({
        session_id: 'sess_1',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 100,
        pid: '0x0D',
        decoded_value: 30,
        unit: 'km/h',
        quality: 'OK',
      })

      // Executa o flush
      await recorder.flushOpportunistic()

      // Amostra 1 foi enviada com sucesso: deve ter sido removida da fila e do IndexedDB
      // Amostra 2 falhou: DEVE permanecer na fila pendente para tentativa posterior
      expect(recorder.getPendingCount()).toBe(1)
      const remainingInQueue = recorder.getPendingQueueCopy()
      expect(remainingInQueue[0].sample_id).toBe(s2.sample_id)

      // IndexedDB deve ter removido s1 e mantido s2
      expect(offlineStorage.removePendingSamples).toHaveBeenCalledWith([s1.sample_id])
      const pendingInDb = await offlineStorage.getPendingSamples()
      expect(pendingInDb.map((x) => x.sample_id)).not.toContain(s1.sample_id)
      expect(pendingInDb.map((x) => x.sample_id)).toContain(s2.sample_id)

      recorder.destroy()
    })

    it('não deve duplicar registros no PocketBase em tentativas subsequentes de flush', async () => {
      const createdPbRecords: any[] = []
      vi.spyOn(pb.collection('raw_samples'), 'create').mockImplementation(async (data: any) => {
        createdPbRecords.push(data)
        return { id: `pb_${createdPbRecords.length}`, ...data } as any
      })

      const recorder = new RawRecorder('db_session_abc')

      recorder.recordSample({
        session_id: 'sess_nodup',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 10,
        pid: '0x0C',
        decoded_value: 1500,
        unit: 'RPM',
        quality: 'OK',
      })

      await recorder.flushOpportunistic()
      expect(createdPbRecords.length).toBe(1)
      expect(recorder.getPendingCount()).toBe(0)

      // Dispara flush novamente: não deve gerar chamadas repetidas
      await recorder.flushOpportunistic()
      expect(createdPbRecords.length).toBe(1)

      recorder.destroy()
    })

    it('deve sincronizar com sucesso todos os registros recuperados após restauração da conexão', async () => {
      const persistedRecords: any[] = []
      vi.spyOn(pb.collection('raw_samples'), 'create').mockImplementation(async (data: any) => {
        persistedRecords.push(data)
        return { id: `pb_${persistedRecords.length}`, ...data } as any
      })

      // Cria registros offline pré-existentes no mockStore
      await offlineStorage.savePendingSamples([
        {
          sample_id: 'samp_recovered_1',
          session_id: 'sess_prev',
          ts_utc: '2026-09-15T10:00:00Z',
          ts_mono_offset_ms: 10,
          pid: '0x0C',
          decoded_value: 2000,
          unit: 'RPM',
          quality: 'OK',
        },
        {
          sample_id: 'samp_recovered_2',
          session_id: 'sess_prev',
          ts_utc: '2026-09-15T10:00:01Z',
          ts_mono_offset_ms: 20,
          pid: '0x0D',
          decoded_value: 80,
          unit: 'km/h',
          quality: 'OK',
        },
      ])

      const recorder = new RawRecorder()
      await recorder.rehydratePendingQueue()
      expect(recorder.getPendingCount()).toBe(2)

      // Sessão de banco é associada e conexão é restabelecida
      recorder.setDbSessionId('db_sess_reconnected')
      await recorder.flushOpportunistic()

      expect(persistedRecords.length).toBe(2)
      expect(recorder.getPendingCount()).toBe(0)

      const remainingStorageCount = await offlineStorage.countPendingSamples()
      expect(remainingStorageCount).toBe(0)

      recorder.destroy()
    })
  })
})
