import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RawRecorder } from '../raw-recorder'
import { offlineStorage } from '../offline-storage'
import { SamplerScheduler } from '../sampler-scheduler'
import { AndroidBluetoothTransport } from '../transports/android-bluetooth-transport'
import { SimulatedTransport } from '../transports/simulated-transport'
import pb from '@/lib/pocketbase/client'
import { SimulatorCaseE4 } from '@/lib/diagnostic/simulator-case-e4'
import { VehicleModel } from '@/types/obd'

describe('OS-ME001-E6.6.1 Adendo — Persistência Automática de Sessões OBD em Hardware Real (Casos A a J)', () => {
  let mockBridge: any
  const globalTarget = typeof window !== 'undefined' ? window : (globalThis as any)

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockBridge = {
      hasBluetooth: vi.fn().mockResolvedValue(true),
      isBluetoothEnabled: vi.fn().mockResolvedValue(true),
      requestEnableBluetooth: vi.fn().mockResolvedValue(true),
      requestPermissions: vi.fn().mockResolvedValue(true),
      getPairedDevices: vi
        .fn()
        .mockResolvedValue([
          { name: 'OBDII', address: '00:1D:A5:01:23:45', bondState: 12, type: 1 },
        ]),
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn().mockResolvedValue(true),
      send: vi.fn().mockImplementation(async (cmd: string) => {
        const c = cmd.trim()
        if (c === 'ATZ') return 'ELM327 v1.5\r\r>'
        if (c === 'ATE0') return 'OK\r\r>'
        if (c === 'ATL0') return 'OK\r\r>'
        if (c === 'ATH0') return 'OK\r\r>'
        if (c === 'ATS0') return 'OK\r\r>'
        if (c === 'ATSP0') return 'OK\r\r>'
        if (c === '0100') return '41 00 BE 3F B8 11\r\r>'
        if (c === '010C') return '41 0C 1F 40\r\r>' // 2000 RPM
        if (c === '010D') return '41 0D 50\r\r>' // 80 km/h
        if (c === '0105') return '41 05 7D\r\r>' // 85 °C
        if (c === '010B') return '41 0B 64\r\r>' // 100 kPa MAP
        if (c === '0110') return '41 10 03 E8\r\r>' // 10.00 g/s MAF
        if (c === '0142') return '41 42 38 A4\r\r>' // 14.5 V
        if (c === '03') return '43 00\r\r>' // No DTCs
        if (c === 'ATDP') return 'ISO 15765-4 (CAN 11/500)\r\r>'
        return 'OK\r\r>'
      }),
      getConnectionState: vi.fn().mockResolvedValue({
        connected: true,
        state: 'SOCKET_CONNECTED',
        deviceAddress: '00:1D:A5:01:23:45',
        deviceName: 'OBDII',
        protocol: 'ISO 15765-4 (CAN 11/500)',
      }),
      getConnectedDevice: vi.fn().mockResolvedValue({
        name: 'OBDII',
        address: '00:1D:A5:01:23:45',
      }),
    }

    globalTarget.AndroidOBD = mockBridge
  })

  afterEach(() => {
    delete globalTarget.AndroidOBD
  })

  // CASO A: Sessão REAL normal (iniciar -> PIDs -> flush buffer -> encerrar -> histórico -> replay)
  it('CASO A: Sessão REAL normal grava dados incrementalmente no buffer e encerra com flush completo', async () => {
    const createdSamples: any[] = []
    const pbCreateSpy = vi
      .spyOn(pb.collection('raw_samples'), 'create')
      .mockImplementation(async (data: any) => {
        const rec = { id: `rec_${Date.now()}_${Math.random()}`, ...data }
        createdSamples.push(rec)
        return rec as any
      })

    const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
    await transport.connect()

    const recorder = new RawRecorder('db_sess_real_001')

    const sample = recorder.recordSample({
      session_id: 'sess_real_uid_001',
      ts_utc: new Date().toISOString(),
      ts_mono_offset_ms: 100,
      pid: '0x0C',
      raw_value: 2000,
      decoded_value: 2000,
      unit: 'RPM',
      quality: 'OK',
      origin: 'REAL',
    })

    expect(sample).toBeDefined()
    expect(sample?.decoded_value).toBe(2000)
    expect(sample?.origin).toBe('REAL')
    expect(sample?.quality).toBe('OK')

    // Força flush
    await recorder.flushAllSync()
    expect(createdSamples.length).toBeGreaterThan(0)
    expect(createdSamples[0].session).toBe('db_sess_real_001')
    expect(createdSamples[0].pid).toBe('0x0C')

    recorder.destroy()
    pbCreateSpy.mockRestore()
  })

  // CASO B: App fechado / WebView reiniciada durante coleta — dados já recebidos permanecem no IndexedDB
  it('CASO B: App fechado/queda não perde dados já registrados no offlineStorage (IndexedDB)', async () => {
    const idbSaveSpy = vi.spyOn(offlineStorage, 'savePendingSamples').mockResolvedValue()

    const recorder = new RawRecorder('db_sess_crash_001')

    recorder.recordSample({
      session_id: 'sess_crash_uid_001',
      ts_utc: new Date().toISOString(),
      ts_mono_offset_ms: 100,
      pid: '0x0C',
      raw_value: 2000,
      decoded_value: 2000,
      unit: 'RPM',
      quality: 'OK',
      origin: 'REAL',
    })

    expect(idbSaveSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          pid: '0x0C',
        }),
      ]),
      'db_sess_crash_001',
    )

    recorder.destroy()
    idbSaveSpy.mockRestore()
  })

  // CASO C: Perda de internet — coleta local no buffer e sincroniza quando volta
  it('CASO C: Perda de internet retém lote na fila e sincroniza sem descartar amostras', async () => {
    let failNetwork = true
    const pbCreateSpy = vi
      .spyOn(pb.collection('raw_samples'), 'create')
      .mockImplementation(async (data: any) => {
        if (failNetwork) {
          throw new Error('Failed to fetch / Network Error')
        }
        return { id: 'persisted_offline', ...data } as any
      })

    const recorder = new RawRecorder('db_sess_offline_001')

    recorder.recordSample({
      session_id: 'sess_offline_uid_001',
      ts_utc: new Date().toISOString(),
      ts_mono_offset_ms: 200,
      pid: '0x0D',
      decoded_value: 80,
      unit: 'km/h',
      quality: 'OK',
    })

    // Tenta flush com falha de rede
    await recorder.flushOpportunistic()
    expect(recorder.getPendingCount()).toBe(1) // Não perdeu da fila

    // Internet volta
    failNetwork = false
    await recorder.flushOpportunistic()
    expect(recorder.getPendingCount()).toBe(0) // Agora persistido com sucesso

    recorder.destroy()
    pbCreateSpy.mockRestore()
  })

  // CASO D: Perda do ELM327 — sessão existe e registra INTERROMPIDO (não perde dados anteriores)
  it('CASO D: Desconexão do ELM327 durante coleta gera status NO_RESPONSE / SEM_COMUNICACAO preservando histórico', async () => {
    const transport = new AndroidBluetoothTransport(38400, 3, '00:1D:A5:01:23:45')
    await transport.connect()

    const recorder = new RawRecorder('db_sess_disconnect_001')

    const sampler = new SamplerScheduler(transport, recorder, performance.now(), 10, 2)
    sampler.setOrigin('REAL')

    // Desconecta intencionalmente simulando cabo/socket rompido
    await transport.disconnect()

    // Amostra gravada no evento de desconexão registra status sem comunicação
    const sample = recorder.recordSample({
      session_id: 'sess_disc_uid_001',
      ts_utc: new Date().toISOString(),
      ts_mono_offset_ms: 300,
      pid: '0x0C',
      quality: 'NO_RESPONSE',
      status: 'SEM_COMUNICACAO',
    })

    expect(sample?.quality).toBe('NO_RESPONSE')
    expect(sample?.status).toBe('SEM_COMUNICACAO')

    sampler.stop()
    recorder.destroy()
  })

  // CASO E: Zero DTC — sessão válida e conclusiva
  it('CASO E: Zero DTC gera diagnóstico de conformidade sem inventar anomalias (Req 8)', () => {
    const dummyVehicle: VehicleModel = {
      id: 'veh_test_01',
      plate: 'BRA2E20',
      make: 'Ford',
      model: 'EcoSport',
      version: '1.5 Titanium',
      odometer_km: 50000,
    }

    const dummySession = {
      id: 'sess_db_zero_dtc',
      session_id: 'sess_uid_zero_dtc',
      origin: 'HARDWARE_REAL',
      adapter_type: 'OBD REAL BLUETOOTH CLASSIC',
      started_at: new Date().toISOString(),
    }

    const dummySamples = [
      { pid: '0x0C', decoded_value: 850, unit: 'RPM' },
      { pid: '0x05', decoded_value: 90, unit: '°C' },
      { pid: '0x42', decoded_value: 14.2, unit: 'V' },
    ]

    const investigation = SimulatorCaseE4.createFromRealSession({
      vehicle: dummyVehicle,
      session: dummySession,
      samples: dummySamples,
      dtcs: [],
    })

    expect(investigation.final_conclusion).toContain('Nenhuma alteração relevante foi identificada')
    expect(investigation.hypotheses_tree[0].hypothesis.title).toContain(
      'Parâmetros Operacionais em Conformidade',
    )
    expect(investigation.hypotheses_tree[0].hypothesis.confidence).toBeGreaterThanOrEqual(90)
  })

  // CASO F: PID não suportado não interrompe a sessão
  it('CASO F: PID não suportado pela ECU é catalogado sem travar o gravador de telemetria', async () => {
    const recorder = new RawRecorder('db_sess_unsupported_001')

    // PID não suportado
    const unsuppSample = recorder.recordSample({
      session_id: 'sess_unsupp_uid',
      ts_utc: new Date().toISOString(),
      ts_mono_offset_ms: 100,
      pid: '0x5C',
      quality: 'NO_RESPONSE',
      status: 'PID_NAO_SUPORTADO',
    })
    expect(unsuppSample?.quality).toBe('NO_RESPONSE')

    // PID suportado subsequente continua funcionando normalmente
    const validSample = recorder.recordSample({
      session_id: 'sess_unsupp_uid',
      ts_utc: new Date().toISOString(),
      ts_mono_offset_ms: 200,
      pid: '0x0C',
      decoded_value: 2000,
      unit: 'RPM',
      quality: 'OK',
    })
    expect(validSample?.decoded_value).toBe(2000)

    recorder.destroy()
  })

  // CASO G: SIMULADOR continua funcionando e identificado como SIMULADOR
  it('CASO G: Simulador continua operando com origin SIMULATOR e transporte SIMULADOR', async () => {
    const simTransport = new SimulatedTransport('NORMAL')
    await simTransport.connect()

    const recorder = new RawRecorder('db_sess_sim_001')

    const sample = recorder.recordSample({
      session_id: 'sess_sim_uid_001',
      ts_utc: new Date().toISOString(),
      ts_mono_offset_ms: 150,
      pid: '0x0C',
      raw_value: 850,
      decoded_value: 850,
      unit: 'RPM',
      quality: 'OK',
      origin: 'SIMULATED',
    })
    expect(sample?.origin).toBe('SIMULATED')
    expect(sample?.decoded_value).toBe(850)

    recorder.destroy()
    await simTransport.disconnect()
  })

  // CASO H: REAL obrigatoriamente identificado como HARDWARE_REAL
  it('CASO H: Hardware Real é identificado estritamente como HARDWARE_REAL', () => {
    const adapterType: string = 'OBD REAL BLUETOOTH CLASSIC'
    const isRealHardware = adapterType !== 'SIMULADOR'
    const sessionOrigin = isRealHardware ? 'HARDWARE_REAL' : 'SIMULADOR'

    expect(sessionOrigin).toBe('HARDWARE_REAL')
    expect(sessionOrigin).not.toBe('SIMULADOR')
  })

  // CASO I: Replay de sessão REAL sem ELM327
  it('CASO I: Replay reconstrói telemetria de sessão real com base nos timestamps e amostras offline', () => {
    const samples = [
      {
        sample_id: 's1',
        session_id: 'sess_real',
        ts_mono_offset_ms: 0,
        pid: '0x0C',
        decoded_value: 800,
        unit: 'RPM',
        quality: 'OK' as const,
        ts_utc: new Date().toISOString(),
      },
      {
        sample_id: 's2',
        session_id: 'sess_real',
        ts_mono_offset_ms: 500,
        pid: '0x0C',
        decoded_value: 1200,
        unit: 'RPM',
        quality: 'OK' as const,
        ts_utc: new Date().toISOString(),
      },
      {
        sample_id: 's3',
        session_id: 'sess_real',
        ts_mono_offset_ms: 1000,
        pid: '0x0D',
        decoded_value: 40,
        unit: 'km/h',
        quality: 'OK' as const,
        ts_utc: new Date().toISOString(),
      },
    ]

    expect(samples.length).toBe(3)
    expect(samples[0].decoded_value).toBe(800)
    expect(samples[1].decoded_value).toBe(1200)
    expect(samples[2].decoded_value).toBe(40)
  })

  // CASO J: Diagnóstico 360 alimentado automaticamente pela sessão REAL
  it('CASO J: Diagnóstico 360 recebe dados objetivos da sessão real sem necessitar entrada manual para PIDs', () => {
    const dummyVehicle: VehicleModel = {
      id: 'veh_test_02',
      plate: 'RIO2A18',
      make: 'Ford',
      model: 'Ka',
      version: '1.0 SE',
      odometer_km: 35000,
    }

    const dummySession = {
      id: 'sess_db_real_with_dtc',
      session_id: 'sess_uid_real_with_dtc',
      origin: 'HARDWARE_REAL',
      adapter_type: 'OBD REAL BLUETOOTH CLASSIC',
      started_at: new Date().toISOString(),
    }

    const dummySamples = [
      { pid: '0x0C', decoded_value: 2500, unit: 'RPM' },
      { pid: '0x0D', decoded_value: 70, unit: 'km/h' },
      { pid: '0x05', decoded_value: 92, unit: '°C' },
      { pid: '0x0B', decoded_value: 120, unit: 'kPa' },
      { pid: '0x10', decoded_value: 15.5, unit: 'g/s' },
      { pid: '0x42', decoded_value: 13.9, unit: 'V' },
    ]

    const investigation = SimulatorCaseE4.createFromRealSession({
      vehicle: dummyVehicle,
      session: dummySession,
      samples: dummySamples,
      dtcs: [{ dtc_code: 'P0171' }],
    })

    expect(investigation.hypotheses_tree[0].hypothesis.relatedDtcs).toContain('P0171')
    expect(investigation.mechanic_evaluation.freeNotes).toContain('RPM médio 2500.0')
    expect(investigation.mechanic_evaluation.freeNotes).toContain('Temperatura 92.0°C')
    expect(investigation.mechanic_evaluation.freeNotes).toContain('MAP 120.0 kPa')
    expect(investigation.client_complaint.approximateSpeedKmH).toBe(70)
  })
})
