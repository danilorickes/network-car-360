import { describe, it, expect } from 'vitest'
import { PidDecoder } from '@/lib/obd/pid-decoder'
import { ElmProtocolParser } from '@/lib/obd/elm-parser'
import { WindowExtractor } from '@/lib/obd/event-marker'
import { RawSampleModel, EventModel } from '@/types/obd'

describe('OBD-II Core Pipeline Suite', () => {
  describe('PidDecoder', () => {
    it('deve decodificar RPM (PID 0x0C) corretamente', () => {
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

    it('deve converter bitmap de PIDs suportados (PID 00)', () => {
      // BE 3F B8 11
      const bitmap = [0xbe, 0x3f, 0xb8, 0x11]
      const pids = PidDecoder.parseSupportedPidsBitmap(0, bitmap)
      expect(pids).toContain('0x0C') // RPM deve estar presente
      expect(pids).toContain('0x0D') // Velocidade
      expect(pids).toContain('0x05') // Coolant
    })
  })

  describe('ElmProtocolParser', () => {
    it('deve extrair bytes de resposta Modo 01 padrão com sucesso', () => {
      const raw = '41 0C 1A F8\r\n>'
      const parsed = ElmProtocolParser.parseMode01(raw, '0C')
      expect(parsed.isError).toBe(false)
      expect(parsed.bytes).toEqual([0x1a, 0xf8])
    })

    it('deve tratar resposta NO DATA sem crash', () => {
      const raw = 'NO DATA\r\n>'
      const parsed = ElmProtocolParser.parseMode01(raw, '10')
      expect(parsed.isError).toBe(true)
      expect(parsed.errorMessage).toBe('NO DATA')
    })

    it('deve decodificar DTCs de Modo 03 (P0301)', () => {
      // 43 01 03 01 00 00 -> 1 DTC: P0301
      const raw = '43 01 03 01 00 00\r\n>'
      const parsed = ElmProtocolParser.parseDtcResponse(raw, '03')
      expect(parsed.isError).toBe(false)
      expect(parsed.codes).toContain('P0301')
    })
  })

  describe('WindowExtractor (Caixa-Preta RF06)', () => {
    it('deve extrair janela de ±30s sem modificar amostras originais', () => {
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

      // Imutabilidade estrita
      expect(originalSamples.length).toBe(4)
    })
  })
})
