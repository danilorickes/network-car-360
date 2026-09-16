import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PidDecoder, PID_DEFINITIONS } from '../pid-decoder'
import { ElmProtocolParser } from '../elm-parser'
import {
  AndroidBluetoothTransport,
  BLUETOOTH_CLASSIC_SPP_UUID,
} from '../transports/android-bluetooth-transport'
import { SamplerScheduler } from '../sampler-scheduler'
import { RawRecorder } from '../raw-recorder'
import { OBDTransport } from '../transports/obd-transport'

describe('E7 — Integração Real ELM327 Bluetooth Classic & PIDs Ford EcoSport 1.5 Dragon', () => {
  describe('1. Decodificação de Fórmulas dos PIDs de Homologação (Modo 01 Padrão)', () => {
    it('Decodifica RPM (PID 0x0C): ((A * 256) + B) / 4', () => {
      // 0x1F, 0x40 -> (31 * 256 + 64) / 4 = 8000 / 4 = 2000 RPM
      const bytes = [0x1f, 0x40]
      const res = PidDecoder.decodePid('0x0C', bytes)
      expect(res).toBeDefined()
      expect(res?.decoded).toBe(2000)
      expect(res?.unit).toBe('RPM')
      expect(PID_DEFINITIONS['0x0C'].format(res!.decoded)).toBe('2000 RPM')
    })

    it('Decodifica Velocidade (PID 0x0D): A em km/h', () => {
      const bytes = [0x50] // 80 km/h
      const res = PidDecoder.decodePid('0x0D', bytes)
      expect(res?.decoded).toBe(80)
      expect(res?.unit).toBe('km/h')
      expect(PID_DEFINITIONS['0x0D'].format(res!.decoded)).toBe('80 km/h')
    })

    it('Decodifica Temperatura do Arrefecimento (PID 0x05): A - 40 em °C', () => {
      // 0x7D = 125 -> 125 - 40 = 85 °C
      const bytes = [0x7d]
      const res = PidDecoder.decodePid('0x05', bytes)
      expect(res?.decoded).toBe(85)
      expect(res?.unit).toBe('°C')
    })

    it('Decodifica Carga do Motor (PID 0x04): (A * 100) / 255 em %', () => {
      // 0x80 = 128 -> (128 * 100) / 255 = 50.2%
      const bytes = [0x80]
      const res = PidDecoder.decodePid('0x04', bytes)
      expect(res?.decoded).toBeCloseTo(50.2, 1)
      expect(res?.unit).toBe('%')
    })

    it('Decodifica Posição da Borboleta TPS (PID 0x11): (A * 100) / 255 em %', () => {
      // 0x33 = 51 -> 20.0%
      const bytes = [0x33]
      const res = PidDecoder.decodePid('0x11', bytes)
      expect(res?.decoded).toBeCloseTo(20.0, 1)
      expect(res?.unit).toBe('%')
    })

    it('Decodifica Pressão Absoluta no Coletor MAP (PID 0x0B): A em kPa', () => {
      const bytes = [0x62] // 98 kPa
      const res = PidDecoder.decodePid('0x0B', bytes)
      expect(res?.decoded).toBe(98)
      expect(res?.unit).toBe('kPa')
      expect(PID_DEFINITIONS['0x0B'].format(res!.decoded)).toBe('98 kPa')
    })

    it('Decodifica Tensão do Módulo de Controle (PID 0x42): ((A * 256) + B) / 1000 em V', () => {
      // 14.2V -> 14200 -> 0x3778 (55 * 256 + 120 = 14200)
      const bytes = [0x37, 0x78]
      const res = PidDecoder.decodePid('0x42', bytes)
      expect(res?.decoded).toBeCloseTo(14.2, 2)
      expect(res?.unit).toBe('V')
      expect(PID_DEFINITIONS['0x42'].format(res!.decoded)).toBe('14.20 V')
    })

    it('Decodifica Short Term Fuel Trim STFT (PID 0x06): (A - 128) * 100 / 128 em %', () => {
      // A = 128 -> 0.0%
      const resZero = PidDecoder.decodePid('0x06', [128])
      expect(resZero?.decoded).toBe(0)

      // A = 140 -> (140 - 128) * 100 / 128 = +9.38% (enriquecimento)
      const resRich = PidDecoder.decodePid('0x06', [140])
      expect(resRich?.decoded).toBeCloseTo(9.38, 1)
      expect(PID_DEFINITIONS['0x06'].format(resRich!.decoded)).toBe('+9.4%')

      // A = 115 -> (115 - 128) * 100 / 128 = -10.16% (empobrecimento)
      const resLean = PidDecoder.decodePid('0x06', [115])
      expect(resLean?.decoded).toBeCloseTo(-10.2, 1)
      expect(PID_DEFINITIONS['0x06'].format(resLean!.decoded)).toBe('-10.2%')
    })

    it('Decodifica Long Term Fuel Trim LTFT (PID 0x07): (A - 128) * 100 / 128 em %', () => {
      const res = PidDecoder.decodePid('0x07', [128])
      expect(res?.decoded).toBe(0)
      expect(res?.unit).toBe('%')
    })

    it('Decodifica Sensor O2 B1S1 Tensão (PID 0x14) e Lambda Banda Larga (PID 0x24)', () => {
      // 0x14: Tensão da sonda convencional (A / 200)
      const resO2 = PidDecoder.decodePid('0x14', [90, 128])
      expect(resO2?.decoded).toBe(0.45)
      expect(resO2?.unit).toBe('V')

      // 0x24: Razão de equivalência Lambda ((A * 256 + B) * 2 / 65535)
      // Para lambda estequiométrico 1.0 -> (A*256 + B) = 32768 (0x8000)
      const resLambda = PidDecoder.decodePid('0x24', [0x80, 0x00, 0x00, 0x00])
      expect(resLambda?.decoded).toBeCloseTo(1.0, 2)
      expect(resLambda?.unit).toBe('λ')
    })
  })

  describe('2. Bitmap de PIDs Suportados pela ECU (PID 0x00, 0x20, 0x40)', () => {
    it('Decodifica corretamente o bitmap de PIDs 01 a 20 a partir do byte payload', () => {
      // Exemplo EcoSport: suporta 0x04 (Carga), 0x05 (ECT), 0x0C (RPM), 0x0D (Speed), 0x11 (TPS)
      // Byte 1: 0001 1000 = 0x18 -> PIDs 0x04 (bit 5), 0x05 (bit 4)
      // Byte 2: 0001 1000 = 0x18 -> PIDs 0x0C (bit 5), 0x0D (bit 4)
      // Byte 3: 1000 0000 = 0x80 -> PID 0x11 (bit 8)
      // Byte 4: 0000 0001 = 0x01 -> PID 0x20 (indica suporte ao próximo bloco 21-40)
      const bytes = [0x18, 0x18, 0x80, 0x01]
      const supported = PidDecoder.parseSupportedPidsBitmap(0, bytes)

      expect(supported).toContain('0x04')
      expect(supported).toContain('0x05')
      expect(supported).toContain('0x0C')
      expect(supported).toContain('0x0D')
      expect(supported).toContain('0x11')
      expect(supported).toContain('0x20')
      expect(supported).not.toContain('0x01')
      expect(supported).not.toContain('0x03')
    })
  })

  describe('3. Parser ELM327 com Tolerância a Clones, NO DATA, ? e Timeouts', () => {
    it('Trata resposta válida do Modo 01 (ex: "41 0C 1F 40>")', () => {
      const raw = '41 0C 1F 40\r\r>'
      const parsed = ElmProtocolParser.parseMode01(raw, '0C')
      expect(parsed.isError).toBe(false)
      expect(parsed.bytes).toEqual([0x1f, 0x40])
      expect(parsed.pid).toBe('0x0C')
    })

    it('Trata resposta NO DATA marcando erro e mensagem correta', () => {
      const raw = '010C\rNO DATA\r\r>'
      const parsed = ElmProtocolParser.parseMode01(raw, '0C')
      expect(parsed.isError).toBe(true)
      expect(parsed.errorMessage).toBe('NO DATA')
      expect(parsed.bytes).toHaveLength(0)
    })

    it('Trata resposta de comando não reconhecido ("?") comum em clones', () => {
      const raw = '?\r\r>'
      const parsed = ElmProtocolParser.parseMode01(raw, '0B')
      expect(parsed.isError).toBe(true)
      expect(parsed.errorMessage).toBe('RESPOSTA INVÁLIDA (?)')
    })

    it('Trata desconexão da ECU ("UNABLE TO CONNECT" ou "CAN ERROR")', () => {
      const raw = 'UNABLE TO CONNECT\r>'
      const parsed = ElmProtocolParser.parseMode01(raw, '05')
      expect(parsed.isError).toBe(true)
      expect(parsed.errorMessage).toBe('UNABLE TO CONNECT')
    })
  })

  describe('4. Arquitetura AndroidBluetoothTransport (Bluetooth Classic SPP/RFCOMM)', () => {
    it('Possui constante do UUID padrão SPP (00001101-0000-1000-8000-00805f9b34fb)', () => {
      expect(BLUETOOTH_CLASSIC_SPP_UUID).toBe('00001101-0000-1000-8000-00805f9b34fb')
    })

    it('Inspeciona corretamente o ambiente informando a exigência de Chrome 138+ no Android', () => {
      // Simula Chrome Android 120
      const globalTarget = typeof window !== 'undefined' ? window : (globalThis as any)
      const origNav = globalTarget.navigator
      try {
        Object.defineProperty(globalTarget, 'navigator', {
          value: {
            userAgent:
              'Mozilla/5.0 (Linux; Android 13; Xiaomi Redmi) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
            serial: {},
          },
          configurable: true,
        })

        const env = AndroidBluetoothTransport.inspectEnvironment()
        expect(env.isAndroid).toBe(true)
        expect(env.chromeVersion).toBe(120)
        expect(env.canUseWebSerialRfcomm).toBe(false)
        expect(env.diagnosticMessage).toContain('Chrome 138+')
      } finally {
        Object.defineProperty(globalTarget, 'navigator', { value: origNav, configurable: true })
      }
    })

    it('Identifica suporte direto a RFCOMM quando Chrome Android for >= 138', () => {
      const globalTarget = typeof window !== 'undefined' ? window : (globalThis as any)
      const origNav = globalTarget.navigator
      try {
        Object.defineProperty(globalTarget, 'navigator', {
          value: {
            userAgent:
              'Mozilla/5.0 (Linux; Android 14; Xiaomi 13) AppleWebKit/537.36 Chrome/138.0.7200.0 Mobile',
            serial: {},
          },
          configurable: true,
        })

        const env = AndroidBluetoothTransport.inspectEnvironment()
        expect(env.isAndroid).toBe(true)
        expect(env.chromeVersion).toBe(138)
        expect(env.canUseWebSerialRfcomm).toBe(true)
        expect(env.diagnosticMessage).toContain('suporte nativo a Web Serial RFCOMM')
      } finally {
        Object.defineProperty(globalTarget, 'navigator', { value: origNav, configurable: true })
      }
    })
  })

  describe('5. SamplerScheduler: Tratamento de Qualidade de Amostra e Não-Substituição por Simulação', () => {
    let mockTransport: OBDTransport
    let recorder: RawRecorder

    beforeEach(() => {
      mockTransport = {
        name: 'MockRealBluetoothTransport',
        isConnected: vi.fn().mockReturnValue(true),
        connect: vi.fn().mockResolvedValue(true),
        disconnect: vi.fn().mockResolvedValue(undefined),
        send: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      }
      recorder = new RawRecorder()
    })

    it('Marca qualidade como UNSUPPORTED quando resposta for NO DATA e nunca gera valor zero inventado', async () => {
      ;(mockTransport.send as any).mockResolvedValueOnce('NO DATA\r>')

      const scheduler = new SamplerScheduler(mockTransport, recorder, performance.now(), 5, 1)
      scheduler.setOrigin('REAL')

      let emittedSample: any = null
      scheduler.on('sample', (s) => {
        emittedSample = s
      })

      // Executa consulta individual via método interno
      await (scheduler as any).queryPid('0x42')

      expect(emittedSample).toBeDefined()
      expect(emittedSample.quality).toBe('UNSUPPORTED')
      expect(emittedSample.decoded_value).toBeUndefined()
      expect(emittedSample.origin).toBe('REAL')
    })

    it('Preserva a origem REAL nos dados e carimbo da etapa de manutenção (ANTES_MANUTENCAO / DEPOIS_MANUTENCAO)', async () => {
      ;(mockTransport.send as any).mockResolvedValueOnce('41 0C 1F 40\r>')

      const scheduler = new SamplerScheduler(mockTransport, recorder, performance.now(), 5, 1)
      scheduler.setOrigin('REAL')
      scheduler.setMaintenanceStage('ANTES_MANUTENCAO')

      let emittedSample: any = null
      scheduler.on('sample', (s) => {
        emittedSample = s
      })

      await (scheduler as any).queryPid('0x0C')

      expect(emittedSample).toBeDefined()
      expect(emittedSample.origin).toBe('REAL')
      expect(emittedSample.maintenance_stage).toBe('ANTES_MANUTENCAO')
      expect(emittedSample.decoded_value).toBe(2000)
    })

    it('Quando a conexão física cai, emite NO_RESPONSE e NUNCA substitui silenciosamente por dados simulados', async () => {
      ;(mockTransport.isConnected as any).mockReturnValue(false)

      const scheduler = new SamplerScheduler(mockTransport, recorder, performance.now(), 5, 1)
      scheduler.setOrigin('REAL')

      let emittedSample: any = null
      scheduler.on('sample', (s) => {
        emittedSample = s
      })

      await (scheduler as any).queryPid('0x0C')

      expect(emittedSample).toBeDefined()
      expect(emittedSample.quality).toBe('NO_RESPONSE')
      expect(emittedSample.decoded_value).toBeUndefined()
      expect(emittedSample.origin).toBe('REAL')
    })
  })
})
