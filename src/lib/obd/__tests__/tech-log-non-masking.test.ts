import { describe, it, expect, beforeEach, vi } from 'vitest'
import { techLogStore } from '../tech-log-store'
import { SamplerScheduler } from '../sampler-scheduler'
import { RawRecorder } from '../raw-recorder'
import { OBDTransport } from '../transports/obd-transport'

class MockOBDTransport implements OBDTransport {
  readonly name = 'MockTransport'
  private connected = true
  public sendMock = vi.fn()

  isConnected(): boolean {
    return this.connected
  }

  setConnected(val: boolean) {
    this.connected = val
  }

  async connect(): Promise<boolean> {
    this.connected = true
    return true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async send(cmd: string): Promise<string> {
    return this.sendMock(cmd)
  }

  on(): void {}
  off(): void {}
}

describe('TechLogStore & Validação de Não-Máscara (E6.6.1)', () => {
  beforeEach(() => {
    techLogStore.clear()
  })

  it('TechLogStore registra entradas completas com direção, comando, resposta e rawResponse', () => {
    techLogStore.addEntry({
      direction: 'TX',
      command: '010C',
      stage: 'POLL',
      transport: 'ANDROID_BRIDGE',
    })

    techLogStore.addEntry({
      direction: 'RX',
      command: '010C',
      response: '41 0C 1A F8',
      rawResponse: '41 0C 1A F8\r\r>',
      latencyMs: 42,
      stage: 'POLL',
      transport: 'ANDROID_BRIDGE',
    })

    const entries = techLogStore.getEntries()
    expect(entries).toHaveLength(2)
    expect(entries[0].direction).toBe('RX')
    expect(entries[0].rawResponse).toBe('41 0C 1A F8\r\r>')
    expect(entries[1].direction).toBe('TX')
    expect(entries[1].command).toBe('010C')
  })

  it('exportAsText() produz formato cronológico estruturado com RAW e TX/RX', () => {
    techLogStore.addEntry({
      direction: 'TX',
      command: 'ATZ',
      stage: 'INIT',
    })
    techLogStore.addEntry({
      direction: 'RX',
      command: 'ATZ',
      response: 'ELM327 v1.5',
      rawResponse: 'ELM327 v1.5\r\r>',
      latencyMs: 15,
      stage: 'INIT',
    })

    const exported = techLogStore.exportAsText()
    expect(exported).toContain('TX -> "ATZ"')
    expect(exported).toContain('RX <- "ELM327 v1.5" (15ms) [RAW: "ELM327 v1.5\\r\\r>"]')
  })

  it('Não-máscara: resposta com formato não reconhecido pelo parser registra no TechLogStore com rawText bruto', async () => {
    const mockTransport = new MockOBDTransport()
    mockTransport.sendMock.mockImplementation(async (cmd: string) => {
      if (cmd === '0100') return '41 00 BE 3F B8 11\r>'
      if (cmd === '010C') return '7E8 04 41 0C 1A F8\r>' // CAN header que o parser Modo 01 reconhece
      if (cmd === '0110') return 'ECO CAN BUFFER GARBAGE ???\r>' // Resposta desconhecida do MAF
      return 'NO DATA\r>'
    })

    const recorder = new RawRecorder()
    const sampler = new SamplerScheduler(mockTransport, recorder, performance.now(), 10, 10)
    sampler.setSupportedPids(['0x10']) // Consulta o MAF

    // Dispara a consulta interna pelo start / pollLoop
    sampler.start()
    await new Promise((r) => setTimeout(r, 80))
    sampler.stop()

    const entries = techLogStore.getEntries()
    const parserRejectedEntry = entries.find(
      (e) => e.direction === 'ERR' && e.command === '0110' && e.stage === 'PARSER_REJECTED',
    )

    expect(parserRejectedEntry).toBeDefined()
    expect(parserRejectedEntry?.rawResponse).toBe('ECO CAN BUFFER GARBAGE ???\r>')
    expect(parserRejectedEntry?.errorReason).toBe('RESPOSTA INVÁLIDA (?)')
    expect(parserRejectedEntry?.details).toContain('classificado como INVALID')
  })

  it('Não-máscara: resposta NO DATA gera entrada com rawResponse e UNSUPPORTED registrado', async () => {
    const mockTransport = new MockOBDTransport()
    mockTransport.sendMock.mockImplementation(async () => 'NO DATA\r>')

    const recorder = new RawRecorder()
    const sampler = new SamplerScheduler(mockTransport, recorder, performance.now(), 10, 10)
    sampler.setSupportedPids(['0x10'])

    sampler.start()
    await new Promise((r) => setTimeout(r, 80))
    sampler.stop()

    const entries = techLogStore.getEntries()
    const noDataEntry = entries.find(
      (e) => e.direction === 'ERR' && e.command === '0110' && e.errorReason === 'NO DATA',
    )

    expect(noDataEntry).toBeDefined()
    expect(noDataEntry?.rawResponse).toBe('NO DATA\r>')
    expect(noDataEntry?.details).toContain('classificado como UNSUPPORTED')
  })
})
