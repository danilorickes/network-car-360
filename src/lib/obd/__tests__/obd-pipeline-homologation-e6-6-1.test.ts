import { describe, it, expect, beforeEach } from 'vitest'
import {
  OBDResponseNormalizer,
  OBDPipelineEngine,
  registerManufacturerExtension,
  clearManufacturerExtensions,
} from '../obd-pipeline-engine'
import { ElmProtocolParser } from '../elm-parser'
import { PidDecoder, PID_DEFINITIONS } from '../pid-decoder'
import { SamplerScheduler } from '../sampler-scheduler'
import { RawRecorder } from '../raw-recorder'
import { OBDTransport } from '../transports/obd-transport'

describe('Missão E6.6.1: Pipeline Estruturado OBD-II — Validação das Respostas Reais do Log de Homologação', () => {
  /**
   * REQUISITO 8 & RESPOSTAS REAIS DO LOG:
   * 1. 010C → 410C0D0D — RPM (3341.25 RPM)
   * 2. 0105 → 41055C — Coolant Temp (52 °C)
   * 3. 010D → 410D00 — Speed (0 km/h)
   * 4. 010B → 410B35 — MAP (53 kPa)
   * 5. 0142 → 414237D6 — Voltage (14.29 V)
   */

  describe('1. Evidência Rigorosa das 5 Respostas Reais do Log de Homologação (Sem DECODER_REJECTED)', () => {
    it('Caso Real 1: RPM (010C → 410C0D0D) decodifica corretamente sem rejeição', () => {
      const raw = '410C0D0D\r\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')

      // Verificação das 10 camadas
      expect(res.rawReceived).toBe(raw)
      expect(res.normalizedRaw).toContain('410C0D0D')
      expect(res.frames).toHaveLength(1)
      expect(res.frames[0].cleanPidHex).toBe('0C')
      expect(res.mode).toBe('01')
      expect(res.pid).toBe('0x0C')
      expect(res.dataBytes).toEqual([0x0d, 0x0d])
      // ((13 * 256) + 13) / 4 = 3341 / 4 = 835.25 RPM
      // 0x0D0D em decimal = 3341. 3341 / 4 = 835.25 RPM (arredondado para 835.3 ou 835.25)
      expect(res.decodedValue).toBe(835.3)
      expect(res.unit).toBe('RPM')
      expect(res.sampleStatus).toBe('OK')
      expect(res.errorReason).toBeUndefined()

      // Compatibilidade ElmProtocolParser legado
      const legacy = ElmProtocolParser.parseMode01(raw, '0C')
      expect(legacy.isError).toBe(false)
      expect(legacy.bytes).toEqual([0x0d, 0x0d])
    })

    it('Caso Real 2: Temp. Arrefecimento ECT (0105 → 41055C) decodifica 52 °C sem rejeição', () => {
      const raw = '41055C\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '05', '01')

      expect(res.sampleStatus).toBe('OK')
      expect(res.pid).toBe('0x05')
      expect(res.dataBytes).toEqual([0x5c]) // 92 decimal
      // 92 - 40 = 52 °C
      expect(res.decodedValue).toBe(52)
      expect(res.unit).toBe('°C')
      expect(res.formattedValue).toBe('52 °C')

      const legacy = ElmProtocolParser.parseMode01(raw, '05')
      expect(legacy.isError).toBe(false)
      expect(legacy.bytes).toEqual([0x5c])
    })

    it('Caso Real 3: Velocidade do Veículo (010D → 410D00) decodifica 0 km/h sem rejeição', () => {
      const raw = '410D00\r\n>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0D', '01')

      expect(res.sampleStatus).toBe('OK')
      expect(res.pid).toBe('0x0D')
      expect(res.dataBytes).toEqual([0x00])
      expect(res.decodedValue).toBe(0)
      expect(res.unit).toBe('km/h')

      const legacy = ElmProtocolParser.parseMode01(raw, '0D')
      expect(legacy.isError).toBe(false)
      expect(legacy.bytes).toEqual([0x00])
    })

    it('Caso Real 4: Pressão Absoluta no Coletor MAP (010B → 410B35) decodifica 53 kPa sem rejeição', () => {
      const raw = '410B35>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0B', '01')

      expect(res.sampleStatus).toBe('OK')
      expect(res.pid).toBe('0x0B')
      expect(res.dataBytes).toEqual([0x35]) // 53 decimal
      expect(res.decodedValue).toBe(53)
      expect(res.unit).toBe('kPa')

      const legacy = ElmProtocolParser.parseMode01(raw, '0B')
      expect(legacy.isError).toBe(false)
      expect(legacy.bytes).toEqual([0x35])
    })

    it('Caso Real 5: Tensão do Módulo de Controle (0142 → 414237D6) decodifica 14.29 V sem rejeição', () => {
      const raw = '414237D6\r\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '42', '01')

      expect(res.sampleStatus).toBe('OK')
      expect(res.pid).toBe('0x42')
      expect(res.dataBytes).toEqual([0x37, 0xd6]) // 0x37 = 55, 0xD6 = 214 -> 55*256+214 = 14294 / 1000 = 14.294 -> 14.29 V
      expect(res.decodedValue).toBe(14.29)
      expect(res.unit).toBe('V')
      expect(res.formattedValue).toBe('14.29 V')

      const legacy = ElmProtocolParser.parseMode01(raw, '42')
      expect(legacy.isError).toBe(false)
      expect(legacy.bytes).toEqual([0x37, 0xd6])
    })
  })

  describe('2. Normalização e Robustez a Variações do ELM327', () => {
    it('Aceita respostas com echo de comando ativado (ex: "010C\\r410C0D0D\\r>")', () => {
      const raw = '010C\r410C0D0D\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('OK')
      expect(res.decodedValue).toBe(835.3)
      expect(res.dataBytes).toEqual([0x0d, 0x0d])
    })

    it('Aceita respostas com espaços entre bytes (ex: "41 0C 0D 0D\\r>")', () => {
      const raw = '41 0C 0D 0D\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('OK')
      expect(res.decodedValue).toBe(835.3)
    })

    it('Aceita respostas com cabeçalhos CAN ativados (ATH1) — ex: "7E8 04 41 0C 0D 0D\\r>"', () => {
      const raw = '7E8 04 41 0C 0D 0D\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('OK')
      expect(res.responderEcu).toBe('7E8')
      expect(res.decodedValue).toBe(835.3)
    })

    it('Aceita cabeçalhos CAN compactados sem espaços — ex: "7E804410C0D0D\\r>"', () => {
      const raw = '7E804410C0D0D\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('OK')
      expect(res.responderEcu).toBe('7E8')
      expect(res.decodedValue).toBe(835.3)
    })

    it('Tolera mensagens intermediárias do adaptador como SEARCHING... e BUS INIT...', () => {
      const raw = 'SEARCHING...\r\nBUS INIT: OK\r\n41055C\r\n>'
      const res = OBDPipelineEngine.processPidResponse(raw, '05', '01')
      expect(res.sampleStatus).toBe('OK')
      expect(res.decodedValue).toBe(52)
    })

    it('Filtra e prioriza a ECU primária (7E8) quando múltiplas ECUs respondem ao mesmo PID', () => {
      const raw = '7E8 04 41 0C 0D 0D\r\n7E9 04 41 0C 00 00\r\n>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('OK')
      expect(res.responderEcu).toBe('7E8')
      expect(res.decodedValue).toBe(835.3)
    })

    it('Aceita hexadecimal em minúsculas (ex: "410c0d0d")', () => {
      const raw = '410c0d0d>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('OK')
      expect(res.decodedValue).toBe(835.3)
    })
  })

  describe('3. Diferenciação Rigorosa dos Estados de Falha (Sem Mascaramento)', () => {
    it('Classifica NO DATA como PID_NAO_SUPORTADO e NÃO como SEM_COMUNICACAO', () => {
      const raw = '0110\rNO DATA\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '10', '01')
      expect(res.sampleStatus).toBe('PID_NAO_SUPORTADO')
      expect(res.decodedValue).toBeUndefined()
      expect(res.errorReason).toContain('NO DATA')
    })

    it('Classifica UNABLE TO CONNECT / CAN ERROR como SEM_COMUNICACAO', () => {
      const raw = 'UNABLE TO CONNECT\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('SEM_COMUNICACAO')
      expect(res.decodedValue).toBeUndefined()
    })

    it('Classifica ? ou BUFFER FULL como RESPOSTA_INVALIDA', () => {
      const raw = '?\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('RESPOSTA_INVALIDA')
      expect(res.decodedValue).toBeUndefined()
    })

    it('Classifica resposta vazia como TIMEOUT', () => {
      const res = OBDPipelineEngine.processPidResponse('', '0C', '01')
      expect(res.sampleStatus).toBe('TIMEOUT')
    })

    it('Classifica resposta com bytes insuficientes como ERRO_DECODER', () => {
      // RPM requer 2 bytes, enviamos apenas 1 byte
      const raw = '41 0C 1A\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('ERRO_DECODER')
      expect(res.errorReason).toContain('Bytes insuficientes')
    })

    it('Classifica lixo não-reconhecido como ERRO_PARSER', () => {
      const raw = 'SOMETHING COMPLETELY UNRELATED\r>'
      const res = OBDPipelineEngine.processPidResponse(raw, '0C', '01')
      expect(res.sampleStatus).toBe('ERRO_PARSER')
    })
  })

  describe('4. SamplerScheduler com Integração do Novo Pipeline', () => {
    let mockTransport: OBDTransport
    let recorder: RawRecorder

    beforeEach(() => {
      mockTransport = {
        name: 'MockRealBluetoothTransport',
        isConnected: () => true,
        connect: async () => true,
        disconnect: async () => {},
        send: async () => '',
        on: () => {},
        off: () => {},
      }
      recorder = new RawRecorder()
    })

    it('Executa resposta real "410C0D0D" pelo SamplerScheduler gerando Sample OK de 835.3 RPM sem rejeição', async () => {
      mockTransport.send = async () => '410C0D0D\r>'
      const scheduler = new SamplerScheduler(mockTransport, recorder, performance.now(), 5, 1)

      let emittedSample: any = null
      scheduler.on('sample', (s) => {
        emittedSample = s
      })

      await (scheduler as any).queryPid('0x0C')

      expect(emittedSample).toBeDefined()
      expect(emittedSample.quality).toBe('OK')
      expect(emittedSample.decoded_value).toBe(835.3)
      expect(emittedSample.unit).toBe('RPM')
    })

    it('Executa resposta real "414237D6" gerando Sample OK de 14.29 V sem rejeição', async () => {
      mockTransport.send = async () => '414237D6\r>'
      const scheduler = new SamplerScheduler(mockTransport, recorder, performance.now(), 5, 1)

      let emittedSample: any = null
      scheduler.on('sample', (s) => {
        emittedSample = s
      })

      await (scheduler as any).queryPid('0x42')

      expect(emittedSample).toBeDefined()
      expect(emittedSample.quality).toBe('OK')
      expect(emittedSample.decoded_value).toBe(14.29)
      expect(emittedSample.unit).toBe('V')
    })

    it('Executa resposta real "41055C" gerando Sample OK de 52 °C sem rejeição', async () => {
      mockTransport.send = async () => '41055C\r>'
      const scheduler = new SamplerScheduler(mockTransport, recorder, performance.now(), 5, 1)

      let emittedSample: any = null
      scheduler.on('sample', (s) => {
        emittedSample = s
      })

      await (scheduler as any).queryPid('0x05')

      expect(emittedSample).toBeDefined()
      expect(emittedSample.quality).toBe('OK')
      expect(emittedSample.decoded_value).toBe(52)
      expect(emittedSample.unit).toBe('°C')
    })

    it('Quando a resposta for NO DATA, gera qualidade UNSUPPORTED sem inventar zero', async () => {
      mockTransport.send = async () => 'NO DATA\r>'
      const scheduler = new SamplerScheduler(mockTransport, recorder, performance.now(), 5, 1)

      let emittedSample: any = null
      scheduler.on('sample', (s) => {
        emittedSample = s
      })

      await (scheduler as any).queryPid('0x10')

      expect(emittedSample).toBeDefined()
      expect(emittedSample.quality).toBe('UNSUPPORTED')
      expect(emittedSample.decoded_value).toBeUndefined()
    })
  })

  describe('5. Extensibilidade Multiveículo (Manufacturer Extensions)', () => {
    beforeEach(() => {
      clearManufacturerExtensions()
    })

    it('Permite registrar decodificador proprietário de montadora sem alterar o núcleo universal', () => {
      // Exemplo de extensão proprietária Ford / EcoSport
      registerManufacturerExtension({
        manufacturer: 'Ford',
        canDecode: (mode, pid) => mode === '01' && pid === '0xAA',
        decode: (_mode, _pid, bytes) => ({
          value: bytes[0] * 2,
          unit: 'bar',
          format: (v) => `${v} bar Ford`,
        }),
      })

      const raw = '41AA14\r>' // byte 0x14 = 20 decimal -> 20 * 2 = 40 bar
      const res = OBDPipelineEngine.processPidResponse(raw, 'AA', '01')

      expect(res.sampleStatus).toBe('OK')
      expect(res.stage).toBe('DECODER_EXTENSION')
      expect(res.decodedValue).toBe(40)
      expect(res.unit).toBe('bar')
      expect(res.formattedValue).toBe('40 bar Ford')
    })
  })
})
