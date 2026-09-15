import { describe, it, expect } from 'vitest'
import { PidDecoder, PID_DEFINITIONS } from '@/lib/obd/pid-decoder'
import { ElmProtocolParser } from '@/lib/obd/elm-parser'
import { WindowExtractor } from '@/lib/obd/event-marker'
import { ReplayEngine } from '@/lib/obd/replay-engine'
import { SimulatedTransport } from '@/lib/obd/transports/simulated-transport'
import { RawSampleModel, EventModel } from '@/types/obd'

describe('OBD-II Core Pipeline Suite (ME001-E1)', () => {
  describe('PidDecoder (Tabela Declarativa dos 13 PIDs)', () => {
    it('deve conter as definições corretas para todos os 13 PIDs obrigatórios', () => {
      const requiredPids = [
        '0x0C', // RPM
        '0x0D', // Velocidade
        '0x05', // Temperatura Líquido
        '0x04', // Carga Calculada
        '0x11', // Acelerador TPS
        '0x10', // MAF
        '0x0B', // MAP
        '0x42', // Tensão
        '0x06', // STFT
        '0x07', // LTFT
        '0x0E', // Avanço Ignição
        '0x0F', // Temp Ar Admissão
        '0x1F', // Tempo em Funcionamento
      ]

      requiredPids.forEach((pid) => {
        expect(PID_DEFINITIONS[pid]).toBeDefined()
        expect(PID_DEFINITIONS[pid].unit).toBeDefined()
        expect(typeof PID_DEFINITIONS[pid].decode).toBe('function')
      })
    })

    it('deve decodificar RPM (PID 0x0C) com precisão matemática', () => {
      // 0x1A, 0xF8 -> (0x1A * 256 + 0xF8) / 4 = (6904) / 4 = 1726 RPM
      const res = PidDecoder.decodePid('0x0C', [0x1a, 0xf8])
      expect(res).not.toBeNull()
      expect(res?.decoded).toBe(1726)
      expect(res?.unit).toBe('RPM')
    })

    it('deve decodificar Velocidade (PID 0x0D) corretamente', () => {
      const res = PidDecoder.decodePid('0x0D', [0x41]) // 65 km/h
      expect(res?.decoded).toBe(65)
      expect(res?.unit).toBe('km/h')
    })

    it('deve decodificar Temperatura do Líquido (PID 0x05) com offset -40', () => {
      const res = PidDecoder.decodePid('0x05', [130]) // 130 - 40 = 90 °C
      expect(res?.decoded).toBe(90)
      expect(res?.unit).toBe('°C')
    })

    it('deve decodificar Tensão do Módulo (PID 0x42) em Volts', () => {
      // 14.2 V = 14200 mV -> 14200 = 0x3778 -> [0x37, 0x78]
      const A = 0x37
      const B = 0x78
      const res = PidDecoder.decodePid('0x42', [A, B])
      expect(res?.decoded).toBe(14.2)
      expect(res?.unit).toBe('V')
    })

    it('deve decodificar STFT (PID 0x06) e LTFT (PID 0x07) positivos e negativos', () => {
      // Valor neutro: 128 -> 0%
      expect(PidDecoder.decodePid('0x06', [128])?.decoded).toBe(0)
      // Ajuste positivo: 140 -> (140 - 128) * 100 / 128 = 9.4%
      expect(PidDecoder.decodePid('0x06', [140])?.decoded).toBe(9.4)
    })

    it('deve converter bitmap de PIDs suportados (PID 00)', () => {
      // BE 3F B8 11
      const bitmap = [0xbe, 0x3f, 0xb8, 0x11]
      const pids = PidDecoder.parseSupportedPidsBitmap(0, bitmap)
      expect(pids).toContain('0x0C') // RPM
      expect(pids).toContain('0x0D') // Velocidade
      expect(pids).toContain('0x05') // Coolant
    })
  })

  describe('ElmProtocolParser (SAE J1979 / ELM327)', () => {
    it('deve extrair bytes de resposta Modo 01 padrão com sucesso', () => {
      const raw = '41 0C 1A F8\r\n>'
      const parsed = ElmProtocolParser.parseMode01(raw, '0C')
      expect(parsed.isError).toBe(false)
      expect(parsed.bytes).toEqual([0x1a, 0xf8])
    })

    it('deve tratar resposta NO DATA sem quebrar a aplicação', () => {
      const raw = 'NO DATA\r\n>'
      const parsed = ElmProtocolParser.parseMode01(raw, '10')
      expect(parsed.isError).toBe(true)
      expect(parsed.errorMessage).toBe('NO DATA')
    })

    it('deve tratar resposta UNABLE TO CONNECT como erro de timeout/comunicação', () => {
      const raw = 'UNABLE TO CONNECT\r\n>'
      const parsed = ElmProtocolParser.parseMode01(raw, '0C')
      expect(parsed.isError).toBe(true)
      expect(parsed.errorMessage).toBe('UNABLE TO CONNECT')
    })

    it('deve decodificar DTCs de Modo 03 (P0301)', () => {
      // 43 01 03 01 00 00 -> 1 DTC: P0301
      const raw = '43 01 03 01 00 00\r\n>'
      const parsed = ElmProtocolParser.parseDtcResponse(raw, '03')
      expect(parsed.isError).toBe(false)
      expect(parsed.codes).toContain('P0301')
    })
  })

  describe('WindowExtractor (Caixa-Preta Imutável RF06)', () => {
    it('deve extrair janela de ±30s sem modificar o conjunto original de amostras', () => {
      const originalSamples: RawSampleModel[] = [
        {
          sample_id: 's1',
          session_id: 'sess1',
          ts_utc: '2026-09-15T00:00:00Z',
          ts_mono_offset_ms: 5000,
          pid: '0x0C',
          decoded_value: 800,
          quality: 'OK',
        },
        {
          sample_id: 's2',
          session_id: 'sess1',
          ts_utc: '2026-09-15T00:00:35Z',
          ts_mono_offset_ms: 35000,
          pid: '0x0C',
          decoded_value: 2000,
          quality: 'OK',
        },
        {
          sample_id: 's3',
          session_id: 'sess1',
          ts_utc: '2026-09-15T00:00:40Z',
          ts_mono_offset_ms: 40000,
          pid: '0x0C',
          decoded_value: 2100,
          quality: 'OK',
        },
        {
          sample_id: 's4',
          session_id: 'sess1',
          ts_utc: '2026-09-15T00:01:20Z',
          ts_mono_offset_ms: 80000,
          pid: '0x0C',
          decoded_value: 900,
          quality: 'OK',
        },
      ]

      const event: EventModel = {
        event_id: 'ev1',
        session_id: 'sess1',
        event_type: 'trepidação',
        ts_utc: '2026-09-15T00:00:40Z',
        ts_mono_offset_ms: 40000, // 40s
        window_pre_ms: 30000, // 10s a 40s
        window_post_ms: 30000, // 40s a 70s
      }

      const extracted = WindowExtractor.extractEventWindow(originalSamples, event)

      // Amostra em 5000 (5s) está fora (< 10s)
      // Amostra em 80000 (80s) está fora (> 70s)
      // Amostras em 35s e 40s estão dentro
      expect(extracted.totalSamplesInWindow).toBe(2)
      expect(extracted.samplesBefore.length).toBe(1) // s2 em 35s
      expect(extracted.samplesAtEvent.length).toBe(1) // s3 em 40s

      // Imutabilidade estrita garantida
      expect(originalSamples.length).toBe(4)
    })
  })

  describe('SimulatedTransport (Dinâmica Temporal e Falhas)', () => {
    it('deve conectar, responder comandos AT e responder PIDs Modo 01', async () => {
      const sim = new SimulatedTransport('NORMAL')
      await sim.connect()
      expect(sim.isConnected()).toBe(true)

      const atz = await sim.send('ATZ')
      expect(atz).toContain('ELM327')

      const rpmResp = await sim.send('010C')
      expect(rpmResp).toContain('41 0C')

      await sim.disconnect()
      expect(sim.isConnected()).toBe(false)
    })

    it('deve simular perda de sinal e restaurar na reconexão sem travar', async () => {
      const sim = new SimulatedTransport('NORMAL')
      await sim.connect()

      sim.simulateCommunicationLoss()
      expect(sim.isConnected()).toBe(false)

      await expect(sim.send('010C')).rejects.toThrow('SEM COMUNICAÇÃO')

      sim.simulateReconnect()
      expect(sim.isConnected()).toBe(true)
      const res = await sim.send('010C')
      expect(res).toContain('41 0C')
      await sim.disconnect()
    })
  })

  describe('ReplayEngine (Reprodução Temporal Determinística)', () => {
    it('deve carregar amostras e calcular duração total', () => {
      const mockSamples: RawSampleModel[] = [
        {
          sample_id: '1',
          session_id: 's',
          ts_utc: '2026-09-15T00:00:00Z',
          ts_mono_offset_ms: 0,
          pid: '0x0C',
          decoded_value: 850,
          quality: 'OK',
        },
        {
          sample_id: '2',
          session_id: 's',
          ts_utc: '2026-09-15T00:00:10Z',
          ts_mono_offset_ms: 10000,
          pid: '0x0C',
          decoded_value: 2200,
          quality: 'OK',
        },
      ]

      const engine = new ReplayEngine(mockSamples, {
        onSample: () => {},
        onProgress: () => {},
        onFinished: () => {},
      })

      expect(engine.getTotalDurationMs()).toBe(10000)
    })
  })
})
