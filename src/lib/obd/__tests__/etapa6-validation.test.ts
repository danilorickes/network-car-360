import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AndroidNativeTransport } from '../transports/android-native-transport'
import { ConnectionDiscoveryWizard } from '../connection-discovery-wizard'
import { SimulatedTransport } from '../transports/simulated-transport'
import { DrivingContextEstimator } from '@/lib/diagnostic/driving-context-estimator'
import { IndividualBaselineLearner } from '@/lib/diagnostic/individual-baseline-learner'
import { VehicleSafetyMonitor } from '@/lib/diagnostic/vehicle-safety-monitor'
import { TripSessionManager } from '@/lib/trip/trip-session-manager'
import { NinaCopilotService } from '@/lib/nina/nina-copilot-service'
import { CopilotContext } from '@/types/etapa6'

describe('OS-ME001-E6 — Validação Completa de Software (Automotivo Real + Drive + Nina)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  // 1. Transport Layer & Descoberta
  describe('1. Abstração de Transporte e Wizard de Conexão', () => {
    it('deve instanciar AndroidNativeTransport e emitir erro gracioso se ponte nativa estiver ausente no navegador', async () => {
      const transport = new AndroidNativeTransport()
      expect(transport.isConnected()).toBe(false)
      expect(transport.name).toContain('AndroidNativeTransport')

      await expect(transport.connect()).rejects.toThrow(
        /Interface nativa Android \(SPP Classic\/OTG\) não detectada/,
      )
    })

    it('deve executar o ConnectionDiscoveryWizard com SimulatedTransport e descobrir PIDs sem inventar dados', async () => {
      const sim = new SimulatedTransport('NORMAL')
      const wizard = new ConnectionDiscoveryWizard(sim)

      const stepsVisited: string[] = []
      const res = await wizard.runDiscovery({
        onStepChange: (step) => stepsVisited.push(step),
      })

      expect(res.step).toBe('CONECTADO')
      expect(res.pidsSupported.length).toBeGreaterThan(0)
      expect(stepsVisited).toContain('PROCURANDO')
      expect(stepsVisited).toContain('INICIALIZANDO')
      expect(stepsVisited).toContain('IDENTIFICANDO_ECU')
      expect(stepsVisited).toContain('DESCOBRINDO_PIDS')
      expect(res.connectionQuality).toBe('EXCELENTE')
    })

    it('deve tratar conexão limitada adequadamente quando a ECU retornar poucos PIDs', async () => {
      // Cria transporte mock com retorno restrito
      const mockTransport: any = {
        name: 'MockLimitedTransport',
        connect: vi.fn().mockResolvedValue(true),
        send: vi.fn().mockImplementation((cmd: string) => {
          if (cmd === 'ATI') return Promise.resolve('ELM327 v1.5')
          if (cmd === 'ATDP') return Promise.resolve('ISO 15765-4')
          if (cmd === '0100') return Promise.resolve('41 00 00 00 00 00') // Nenhum PID do mapa 0100
          if (cmd === '010C') return Promise.resolve('41 0C 0B B8') // Apenas RPM suportado
          return Promise.resolve('NO DATA')
        }),
      }

      const wizard = new ConnectionDiscoveryWizard(mockTransport)
      const res = await wizard.runDiscovery()

      expect(res.step).toBe('CONEXAO_LIMITADA')
      expect(res.pidsSupported).toContain('0x0C')
      expect(res.notes).toContain('número reduzido de PIDs')
    })
  })

  // 2. Classificação de Contexto de Condução
  describe('2. DrivingContextEstimator (Regimes de Condução via Física do Motor)', () => {
    it('deve classificar MOTOR_DESLIGADO quando RPM for zero ou inferior a 300', () => {
      const estimator = new DrivingContextEstimator()
      const ctx = estimator.updateSample({
        sample_id: 's1',
        session_id: 'test',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 100,
        pid: '0x0C',
        decoded_value: 0,
        quality: 'OK',
      })

      expect(ctx.type).toBe('MOTOR_DESLIGADO')
      expect(ctx.label).toBe('Motor Desligado')
    })

    it('deve classificar MARCHA_LENTA_FRIA e MARCHA_LENTA_QUENTE com base na temperatura ECT', () => {
      const estimator = new DrivingContextEstimator()

      // Motor girando com carro parado
      estimator.updateSample({
        sample_id: 's_rpm',
        session_id: 'test',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 100,
        pid: '0x0C',
        decoded_value: 1100,
        quality: 'OK',
      })
      estimator.updateSample({
        sample_id: 's_spd',
        session_id: 'test',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 100,
        pid: '0x0D',
        decoded_value: 0,
        quality: 'OK',
      })
      const coldCtx = estimator.updateSample({
        sample_id: 's_ect_cold',
        session_id: 'test',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 100,
        pid: '0x05',
        decoded_value: 45, // ECT < 70
        quality: 'OK',
      })
      expect(coldCtx.type).toBe('MARCHA_LENTA_FRIA')

      // Aquece o motor (ECT 88 °C)
      const warmCtx = estimator.updateSample({
        sample_id: 's_ect_warm',
        session_id: 'test',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 200,
        pid: '0x05',
        decoded_value: 88,
        quality: 'OK',
      })
      expect(warmCtx.type).toBe('MARCHA_LENTA_QUENTE')
    })

    it('deve classificar ESTRADA quando velocidade for alta e contínua', () => {
      const estimator = new DrivingContextEstimator()
      estimator.updateSample({
        sample_id: 's_rpm',
        session_id: 'test',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 100,
        pid: '0x0C',
        decoded_value: 2400,
        quality: 'OK',
      })
      const roadCtx = estimator.updateSample({
        sample_id: 's_spd',
        session_id: 'test',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: 100,
        pid: '0x0D',
        decoded_value: 100, // 100 km/h
        quality: 'OK',
      })

      expect(roadCtx.type).toBe('ESTRADA')
      expect(roadCtx.label).toBe('Rodagem em Estrada')
    })
  })

  // 3. Baseline Individual do Veículo e Detecção de Tendências
  describe('3. IndividualBaselineLearner & Detector de Mudança', () => {
    it('deve aprender estatísticas exclusivamente para a placa informada por contexto', () => {
      const learner = new IndividualBaselineLearner('BRA2E20')

      // Alimenta 35 amostras de STFT em MARCHA_LENTA_QUENTE
      for (let i = 0; i < 35; i++) {
        learner.learnObservation('MARCHA_LENTA_QUENTE', '0x06', 2.0, '%', 'STFT')
      }

      const baseline = learner.getBaseline('MARCHA_LENTA_QUENTE')
      expect(baseline).toBeDefined()
      expect(baseline?.samples_count).toBe(35)
      expect(baseline?.stats_by_pid['0x06'].mean).toBe(2.0)
    })

    it('deve detectar anomalia de tendência persistente quando o valor divergir por mais de 3.2 desvios padrão', () => {
      const learner = new IndividualBaselineLearner('BRA2E20')

      // Popula baseline com variância conhecida
      for (let i = 0; i < 40; i++) {
        // Valores variando levemente entre 1.0 e 3.0 (média 2.0)
        learner.learnObservation(
          'MARCHA_LENTA_QUENTE',
          '0x06',
          2.0 + (i % 2 === 0 ? 0.5 : -0.5),
          '%',
          'STFT',
        )
      }

      // Agora testa um valor extremo de +18% (ex: entrada falsa de ar)
      const trend = learner.detectTrendAnomaly('MARCHA_LENTA_QUENTE', '0x06', 18.0, 'STFT')

      expect(trend).not.toBeNull()
      expect(trend?.severity).toBe('ATENCAO')
      expect(trend?.trendDescription).toContain('divergindo em')
      expect(trend?.trendDescription).toContain('histórico aprendido para este veículo')
    })
  })

  // 4. VehicleSafetyMonitor Local Determinístico (Sem Internet)
  describe('4. VehicleSafetyMonitor (Motor Determinístico Local)', () => {
    it('deve manter nível NORMAL quando todos os parâmetros vitais estiverem dentro dos limites nominais', () => {
      const monitor = new VehicleSafetyMonitor()
      const res = monitor.evaluateSafety({
        coolantTemp: 88,
        batteryVoltage: 14.1,
        rpm: 800,
        speed: 0,
        milOn: false,
        dtcCodes: [],
        communicationState: 'CONECTADO',
      })

      expect(res.overallLevel).toBe('NORMAL')
      expect(res.alerts.length).toBe(0)
    })

    it('deve disparar alerta CRÍTICO imediato em caso de superaquecimento (ECT >= 110 °C) persistente', () => {
      const monitor = new VehicleSafetyMonitor()

      // Primeira leitura alta (112 °C)
      monitor.evaluateSafety({ coolantTemp: 112, batteryVoltage: 13.8, rpm: 2000 })
      // Segunda leitura alta consecutiva
      const res = monitor.evaluateSafety({ coolantTemp: 113, batteryVoltage: 13.8, rpm: 2000 })

      expect(res.overallLevel).toBe('CRITICO')
      expect(res.alerts[0].code).toBe('ECT_CRITICAL')
      expect(res.alerts[0].recommendedAction).toContain('pare o veículo em local seguro')
    })

    it('deve disparar alerta CRÍTICO em caso de subtensão grave (< 11.2V) com motor funcionando', () => {
      const monitor = new VehicleSafetyMonitor()

      monitor.evaluateSafety({ coolantTemp: 85, batteryVoltage: 10.9, rpm: 1500 })
      monitor.evaluateSafety({ coolantTemp: 85, batteryVoltage: 10.8, rpm: 1500 })
      const res = monitor.evaluateSafety({ coolantTemp: 85, batteryVoltage: 10.8, rpm: 1500 })

      expect(res.overallLevel).toBe('CRITICO')
      expect(res.alerts.some((a) => a.code === 'VOLT_CRITICAL')).toBe(true)
    })

    it('deve priorizar alerta CRÍTICO sobre alertas de ATENÇÃO', () => {
      const monitor = new VehicleSafetyMonitor()

      // Amostra que tem tanto ECT crítica quanto falha de comunicação
      monitor.evaluateSafety({ coolantTemp: 112, communicationState: 'RECONECTANDO' })
      const res = monitor.evaluateSafety({ coolantTemp: 112, communicationState: 'RECONECTANDO' })

      expect(res.overallLevel).toBe('CRITICO')
      // O alerta de prioridade 1 (ECT_CRITICAL) deve vir no topo
      expect(res.alerts[0].code).toBe('ECT_CRITICAL')
    })
  })

  // 5. TripSessionManager (Modo Viagem e Diário com Privacidade)
  describe('5. TripSessionManager (Modo Viagem e Diário de Bordo)', () => {
    it('deve iniciar viagem, integrar distância medida e calcular consumo estimado via MAF', () => {
      const manager = new TripSessionManager()
      const trip = manager.startTrip({
        title: 'Viagem Serra do Mar',
        vehiclePlate: 'ABC1D23',
      })

      expect(trip.status).toBe('EM_ANDAMENTO')
      expect(trip.distance_km).toBe(0)

      // Simula 2 segundos rodando a 90 km/h com MAF de 15 g/s
      manager.processTelemetry({
        speedKmh: 90,
        mafGps: 15,
        monoMs: 1000,
      })
      manager.processTelemetry({
        speedKmh: 90,
        mafGps: 15,
        monoMs: 3000, // dt = 2s
      })

      const current = manager.getActiveTrip()
      expect(current).toBeDefined()
      expect(current?.avg_speed_kmh).toBe(90)
      expect(current?.distance_km).toBeGreaterThan(0)
      expect(current?.estimated_fuel_liters).toBeGreaterThan(0)
      expect(current?.fuel_calculation_mode).toBe('ESTIMADO_MAF_SPEED')
    })

    it('deve registrar momentos do diário respeitando o consentimento explícito de localização', () => {
      const manager = new TripSessionManager()
      manager.startTrip({ title: 'Expedição Litoral' })

      // Ponto SEM consentimento
      const entryNoConsent = manager.addDiaryEntry({
        entryType: 'PARADA',
        title: 'Posto de Abastecimento',
        latitude: -23.55,
        longitude: -46.63,
        hasLocationConsent: false,
      })
      expect(entryNoConsent?.has_location_consent).toBe(false)
      expect(entryNoConsent?.latitude).toBeUndefined()
      expect(entryNoConsent?.longitude).toBeUndefined()

      // Ponto COM consentimento
      const entryConsent = manager.addDiaryEntry({
        entryType: 'PONTO_TURISTICO',
        title: 'Mirante da Serra',
        latitude: -23.55,
        longitude: -46.63,
        hasLocationConsent: true,
      })
      expect(entryConsent?.has_location_consent).toBe(true)
      expect(entryConsent?.latitude).toBe(-23.55)
      expect(entryConsent?.longitude).toBe(-46.63)
    })

    it('deve finalizar viagem gerando resumo estruturado', () => {
      const manager = new TripSessionManager()
      manager.startTrip({ title: 'Viagem Curta' })
      const finished = manager.endTrip()

      expect(finished?.status).toBe('CONCLUIDA')
      expect(finished?.ended_at).toBeDefined()
      expect(finished?.trip_summary_report).toBeDefined()
      expect(finished?.trip_summary_report?.vehicleHealthSummary).toContain('EXCELENTE')
    })
  })

  // 6. Nina Copilot (Contexto Seguro e Sem Alucinação)
  describe('6. Nina Copilot Service (Segurança e Contexto Real)', () => {
    const baseContext: CopilotContext = {
      vehicleName: 'Ford EcoSport 2020',
      vehiclePlate: 'BRA2E20',
      connectionStatus: 'CONECTADO',
      transportType: 'BLE',
      drivingContext: 'ESTRADA',
      speedKmh: 95,
      rpm: 2300,
      coolantTemp: 89,
      batteryVoltage: 14.1,
      activeDtcs: [],
      milOn: false,
      safetyLevel: 'NORMAL',
      activeAlerts: [],
      isTripActive: true,
      tripTitle: 'Viagem Interior',
      tripDuration: '45 min',
      tripDistance: '62 km',
    }

    it('deve responder estritamente com base nos dados reais do contexto e sem inventar telemetria', async () => {
      const nina = new NinaCopilotService()
      const resp = await nina.sendMessage('Nina, como está o carro?', baseContext, false)

      expect(resp.content).toContain('Tudo funcionando normalmente')
      expect(resp.content).toContain('ESTRADA')
      expect(resp.content).toContain('89 °C')
    })

    it('deve alertar prioritariamente quando houver alerta crítico no contexto', async () => {
      const nina = new NinaCopilotService()
      const criticalCtx: CopilotContext = {
        ...baseContext,
        safetyLevel: 'CRITICO',
        activeAlerts: ['Temperatura Excessiva do Motor (112 °C)'],
      }

      const resp = await nina.sendMessage('Nina, como está o carro?', criticalCtx, false)
      expect(resp.content).toContain('ATENÇÃO PRIORITÁRIA')
      expect(resp.content).toContain('parar o carro em local seguro')
    })

    it('deve avisar com precisão quando o adaptador estiver desconectado', async () => {
      const nina = new NinaCopilotService()
      const disconnectedCtx: CopilotContext = {
        ...baseContext,
        connectionStatus: 'DESCONECTADO',
      }

      const resp = await nina.sendMessage('Nina, como está o carro?', disconnectedCtx, false)
      expect(resp.content).toContain('adaptador OBD não está conectado')
    })
  })
})
