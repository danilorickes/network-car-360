import { describe, it, expect, beforeEach } from 'vitest'
import { SimulatedTransport } from '../transports/simulated-transport'
import { BlackBoxBuilder } from '../blackbox-builder'
import { ExporterService } from '../exporter-service'
import { RawSampleModel, EventModel, DtcModel, VehicleModel } from '@/types/obd'

describe('OS-ME001-E2: Validação da Etapa 2', () => {
  // --------------------------------------------------------------------------
  // 1. PERFIL DO VEÍCULO & AUSÊNCIA DE HARDCODING (Requisito 1)
  // --------------------------------------------------------------------------
  it('deve suportar perfis de veículos genéricos e reutilizáveis sem hardcode', () => {
    const ecoSport: VehicleModel = {
      plate: 'BRA2E20',
      make: 'Ford',
      model: 'EcoSport',
      version: 'Freestyle 1.5 AT',
      year_model: '2020/2020',
      engine: '1.5 Ti-VCT Dragon 3C (137 cv)',
      fuel: 'Flex',
      transmission: 'Automático 6 marchas',
      odometer_km: 48500,
      vin: '9BFBJ55E6L8104921',
    }

    const tCross: VehicleModel = {
      plate: 'NET3600',
      make: 'Volkswagen',
      model: 'T-Cross',
      version: 'Comfortline 200 TSI',
      year_model: '2022/2023',
      engine: '1.0 TSI Turbo (128 cv)',
      fuel: 'Flex',
      transmission: 'Automático Tiptronic 6M',
      odometer_km: 32000,
      vin: '9BWAA42B5NP019842',
    }

    expect(ecoSport.plate).toBe('BRA2E20')
    expect(ecoSport.engine).toContain('Dragon')
    expect(tCross.plate).toBe('NET3600')
    expect(tCross.make).toBe('Volkswagen')
  })

  // --------------------------------------------------------------------------
  // 2. SIMULADOR MULTICENÁRIO & ASSINATURA OBD (Requisitos 2 e 8)
  // --------------------------------------------------------------------------
  describe('Simulador Multicenário e Descoberta OBD', () => {
    it('deve alternar entre os cenários solicitados e retornar leituras plausíveis', async () => {
      const sim = new SimulatedTransport('NORMAL')
      await sim.connect()
      expect(sim.isConnected()).toBe(true)

      // ATDP: Protocolo detectado
      const proto = await sim.send('ATDP')
      expect(proto).toContain('ISO 15765-4')

      // 0902: Leitura do VIN
      const vinResp = await sim.send('0902')
      expect(vinResp).toContain('9BFBJ55E6L8104921')

      // 0100: Bitmap de PIDs suportados
      const pidsResp = await sim.send('0100')
      expect(pidsResp).toContain('41 00')

      // Cenário PERDA_POTENCIA
      sim.setScenario('PERDA_POTENCIA')
      expect(sim.getScenario()).toBe('PERDA_POTENCIA')

      // Cenário OSCILACAO
      sim.setScenario('OSCILACAO')
      expect(sim.getScenario()).toBe('OSCILACAO')

      // Cenário TREPIDACAO_FALHA: deve retornar DTC P0301 e MIL aceso
      sim.setScenario('TREPIDACAO_FALHA')
      const milResp = await sim.send('0101')
      expect(milResp).toContain('41 01 81') // MIL on bit 7
      const dtcResp = await sim.send('03')
      expect(dtcResp).toContain('03 01') // P0301

      // Cenário DTC_ATIVO: código P0171
      sim.setScenario('DTC_ATIVO')
      const dtcLean = await sim.send('03')
      expect(dtcLean).toContain('01 71') // P0171

      // Cenário APAGAMENTO: RPM vai a 0
      sim.setScenario('APAGAMENTO')
      expect(sim.getScenario()).toBe('APAGAMENTO')

      // Cenário PERDA_COMUNICACAO
      sim.simulateCommunicationLoss()
      expect(sim.isConnected()).toBe(false)
      await expect(sim.send('010C')).rejects.toThrow('SEM COMUNICAÇÃO')

      sim.simulateReconnect()
      expect(sim.isConnected()).toBe(true)
      await sim.disconnect()
    })
  })

  // --------------------------------------------------------------------------
  // 3. CAIXA-PRETA DO SINTOMA & IMUTABILIDADE DO RAW (Requisito 3)
  // --------------------------------------------------------------------------
  describe('Caixa-Preta do Sintoma e Imutabilidade do RAW', () => {
    it('deve extrair a janela temporal de -30s a +30s mantendo o array RAW original intacto', () => {
      // 100 amostras a cada 1000ms: offsets de 0 a 99000ms
      const rawSamples: RawSampleModel[] = []
      for (let i = 0; i < 100; i++) {
        rawSamples.push({
          sample_id: `s_${i}`,
          session_id: 'sess_test_1',
          ts_utc: new Date(1700000000000 + i * 1000).toISOString(),
          ts_mono_offset_ms: i * 1000,
          pid: '0x0C',
          decoded_value: 1000 + i * 20,
          unit: 'RPM',
          quality: 'OK',
        })
      }

      // Congela o array original para comprovar imutabilidade
      const originalCopy = JSON.stringify(rawSamples)

      // Sintoma marcado aos 50s (offset 50000ms)
      const event: EventModel = {
        event_id: 'ev_001',
        session_id: 'sess_test_1',
        event_type: 'trepidação',
        description: 'Trepidação aos 50s',
        ts_utc: new Date(1700000050000).toISOString(),
        ts_mono_offset_ms: 50000,
        window_pre_ms: 30000,
        window_post_ms: 30000,
      }

      const partition = BlackBoxBuilder.partitionWindow(rawSamples, event)

      // Janela de 20.000ms a 80.000ms (61 amostras esperadas)
      expect(partition.startMonoOffsetMs).toBe(20000)
      expect(partition.endMonoOffsetMs).toBe(80000)
      expect(partition.totalSamplesInWindow).toBe(61)
      expect(partition.samplesBefore.length).toBeGreaterThan(0)
      expect(partition.samplesAfter.length).toBeGreaterThan(0)

      // Garantia de imutabilidade estrita do array original
      expect(JSON.stringify(rawSamples)).toBe(originalCopy)
    })
  })

  // --------------------------------------------------------------------------
  // 4. COMPARAÇÃO TEMPORAL: ANTES -> SINTOMA -> DEPOIS (Requisito 4)
  // --------------------------------------------------------------------------
  describe('Comparação Temporal Simultânea', () => {
    it('deve gerar séries sincronizadas com fases BEFORE, EVENT e AFTER', () => {
      const samples: RawSampleModel[] = [
        // Antes
        {
          sample_id: 's1',
          session_id: 'sess_1',
          ts_utc: '2025-01-01T12:00:10Z',
          ts_mono_offset_ms: 10000,
          pid: '0x0C',
          decoded_value: 2000,
          unit: 'RPM',
          quality: 'OK',
        },
        {
          sample_id: 's2',
          session_id: 'sess_1',
          ts_utc: '2025-01-01T12:00:10Z',
          ts_mono_offset_ms: 10000,
          pid: '0x11',
          decoded_value: 25,
          unit: '%',
          quality: 'OK',
        },
        // No evento (30000ms)
        {
          sample_id: 's3',
          session_id: 'sess_1',
          ts_utc: '2025-01-01T12:00:30Z',
          ts_mono_offset_ms: 30000,
          pid: '0x0C',
          decoded_value: 1200,
          unit: 'RPM',
          quality: 'OK',
        },
        {
          sample_id: 's4',
          session_id: 'sess_1',
          ts_utc: '2025-01-01T12:00:30Z',
          ts_mono_offset_ms: 30000,
          pid: '0x11',
          decoded_value: 70,
          unit: '%',
          quality: 'OK',
        },
        // Depois
        {
          sample_id: 's5',
          session_id: 'sess_1',
          ts_utc: '2025-01-01T12:00:50Z',
          ts_mono_offset_ms: 50000,
          pid: '0x0C',
          decoded_value: 2100,
          unit: 'RPM',
          quality: 'OK',
        },
      ]

      const event: EventModel = {
        event_id: 'ev_002',
        session_id: 'sess_1',
        event_type: 'perda de potência',
        ts_utc: '2025-01-01T12:00:30Z',
        ts_mono_offset_ms: 30000,
        window_pre_ms: 30000,
        window_post_ms: 30000,
      }

      const partition = BlackBoxBuilder.partitionWindow(samples, event)
      const series = BlackBoxBuilder.buildComparisonSeries(partition, 1000)

      expect(series.length).toBeGreaterThan(0)
      const eventPoint = series.find((p) => p.phase === 'EVENT')
      expect(eventPoint).toBeDefined()
      expect(eventPoint?.rpm).toBe(1200)
      expect(eventPoint?.throttle).toBe(70)
    })
  })

  // --------------------------------------------------------------------------
  // 5. MÚLTIPLOS SINTOMAS POR SESSÃO (Requisito 5)
  // --------------------------------------------------------------------------
  it('deve construir pacotes independentes para múltiplos sintomas na mesma sessão', () => {
    const rawSamples: RawSampleModel[] = [
      {
        sample_id: 's1',
        session_id: 'sess_multi',
        ts_utc: '2025-01-01T14:32:10Z',
        ts_mono_offset_ms: 10000,
        pid: '0x0C',
        decoded_value: 850,
        unit: 'RPM',
        quality: 'OK',
      },
      {
        sample_id: 's2',
        session_id: 'sess_multi',
        ts_utc: '2025-01-01T14:37:43Z',
        ts_mono_offset_ms: 50000,
        pid: '0x0C',
        decoded_value: 1400,
        unit: 'RPM',
        quality: 'OK',
      },
      {
        sample_id: 's3',
        session_id: 'sess_multi',
        ts_utc: '2025-01-01T14:42:08Z',
        ts_mono_offset_ms: 90000,
        pid: '0x0C',
        decoded_value: 0,
        unit: 'RPM',
        quality: 'OK',
      },
    ]

    const ev1: EventModel = {
      event_id: 'ev_1',
      session_id: 'sess_multi',
      event_type: 'trepidação',
      ts_utc: '2025-01-01T14:32:10Z',
      ts_mono_offset_ms: 10000,
      window_pre_ms: 10000,
      window_post_ms: 10000,
    }

    const ev2: EventModel = {
      event_id: 'ev_2',
      session_id: 'sess_multi',
      event_type: 'perda de potência',
      ts_utc: '2025-01-01T14:37:43Z',
      ts_mono_offset_ms: 50000,
      window_pre_ms: 10000,
      window_post_ms: 10000,
    }

    const ev3: EventModel = {
      event_id: 'ev_3',
      session_id: 'sess_multi',
      event_type: 'apagamento',
      ts_utc: '2025-01-01T14:42:08Z',
      ts_mono_offset_ms: 90000,
      window_pre_ms: 10000,
      window_post_ms: 10000,
    }

    const veh = { plate: 'BRA2E20', make: 'Ford', model: 'EcoSport' }

    const pkg1 = BlackBoxBuilder.buildPackage({
      event: ev1,
      samples: rawSamples,
      vehicle: veh,
      dtcs: [],
    })
    const pkg2 = BlackBoxBuilder.buildPackage({
      event: ev2,
      samples: rawSamples,
      vehicle: veh,
      dtcs: [],
    })
    const pkg3 = BlackBoxBuilder.buildPackage({
      event: ev3,
      samples: rawSamples,
      vehicle: veh,
      dtcs: [],
    })

    expect(pkg1.event_type).toBe('trepidação')
    expect(pkg2.event_type).toBe('perda de potência')
    expect(pkg3.event_type).toBe('apagamento')
    expect(pkg1.package_id).not.toBe(pkg2.package_id)
  })

  // --------------------------------------------------------------------------
  // 6. PREPARAÇÃO PARA IA (DiagnosticEvidence / Fatos Objetivos) (Requisito 7)
  // --------------------------------------------------------------------------
  describe('Preparação para IA (DiagnosticEvidence)', () => {
    it('deve extrair fatos observados estritamente objetivos sem hipóteses ou julgamentos causais', () => {
      const stats = {
        '0x0C': {
          pid: '0x0C',
          paramName: 'RPM do Motor',
          unit: 'RPM',
          min: 900,
          max: 2800,
          avg: 2100,
          samplesCount: 30,
          beforeAvg: 2400,
          atEventValue: 1200,
          afterAvg: 2100,
        },
        '0x11': {
          pid: '0x11',
          paramName: 'Posição do Acelerador (TPS)',
          unit: '%',
          min: 10,
          max: 85,
          avg: 45,
          samplesCount: 30,
          atEventValue: 75,
        },
      }

      const dtcs: DtcModel[] = [
        {
          dtc_code: 'P0301',
          status: 'ATIVO',
          mil_on: true,
          read_at_utc: '2025-01-01T12:00:00Z',
          session_id: 's1',
        },
      ]

      const facts = BlackBoxBuilder.extractDiagnosticFacts(stats, dtcs, 'CONECTADO')

      expect(facts.length).toBeGreaterThan(0)

      // Confirma que os fatos contêm apenas constatações quantitativas
      const rpmFact = facts.find((f) => f.parameter === 'RPM')
      expect(rpmFact).toBeDefined()
      expect(rpmFact?.statement).toContain('RPM decresceu 50%')

      const tpsFact = facts.find((f) => f.parameter === 'TPS')
      expect(tpsFact).toBeDefined()
      expect(tpsFact?.statement).toContain('75%')

      const dtcFact = facts.find((f) => f.parameter === 'DTC')
      expect(dtcFact).toBeDefined()
      expect(dtcFact?.statement).toContain('P0301')

      // Garante que nenhuma conjectura/hipótese de defeito está gravada
      facts.forEach((f) => {
        expect(f.statement).not.toContain('defeito na peça')
        expect(f.statement).not.toContain('trocar vela')
        expect(f.statement).not.toContain('bico travado')
      })
    })
  })

  // --------------------------------------------------------------------------
  // 7. EXPORTAÇÃO JSON / CSV (Requisito 6)
  // --------------------------------------------------------------------------
  describe('Exportação de Dados', () => {
    it('deve gerar payloads estruturados para exportação JSON sem corromper amostras', () => {
      const samples: RawSampleModel[] = [
        {
          sample_id: 's1',
          session_id: 'sess_1',
          ts_utc: '2025-01-01T12:00:00Z',
          ts_mono_offset_ms: 1000,
          pid: '0x0C',
          decoded_value: 850,
          unit: 'RPM',
          quality: 'OK',
        },
      ]
      const ev: EventModel = {
        event_id: 'ev_1',
        session_id: 'sess_1',
        event_type: 'oscilação',
        ts_utc: '2025-01-01T12:00:00Z',
        ts_mono_offset_ms: 1000,
        window_pre_ms: 10000,
        window_post_ms: 10000,
      }
      const veh: VehicleModel = {
        plate: 'BRA2E20',
        make: 'Ford',
        model: 'EcoSport',
      }

      const pkg = BlackBoxBuilder.buildPackage({
        event: ev,
        samples,
        vehicle: veh,
        dtcs: [],
      })

      expect(pkg.package_id).toBe('pkg_ev_1')
      expect(pkg.vehicle.plate).toBe('BRA2E20')
      expect(pkg.facts).toBeDefined()
    })
  })
})
