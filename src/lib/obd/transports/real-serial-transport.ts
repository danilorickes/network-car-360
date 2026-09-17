import { OBDTransport, OBDTransportEvents } from './obd-transport'
import { techLogStore } from '../tech-log-store'

/**
 * RealSerialTransport: Implementação Web Serial API para adaptador ELM327 físico (USB/Bluetooth Serial).
 * Status oficial: "IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"
 * Funciona nativamente em navegadores baseados em Chromium (Chrome, Edge, Opera, Brave).
 */
export class RealSerialTransport implements OBDTransport {
  readonly name = 'RealSerialTransport (Web Serial ELM327)'
  private port: any = null
  private reader: any = null
  private writer: any = null
  private listeners: { [K in keyof OBDTransportEvents]?: Set<OBDTransportEvents[K]> } = {}
  private connected = false
  private reconnectAttempts = 3
  private baudRate = 38400

  constructor(baudRate = 38400, reconnectAttempts = 3) {
    this.baudRate = baudRate
    this.reconnectAttempts = reconnectAttempts
  }

  static isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  isConnected(): boolean {
    return this.connected
  }

  on<K extends keyof OBDTransportEvents>(event: K, listener: OBDTransportEvents[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = new Set() as any
    }
    this.listeners[event]!.add(listener)
  }

  off<K extends keyof OBDTransportEvents>(event: K, listener: OBDTransportEvents[K]): void {
    this.listeners[event]?.delete(listener)
  }

  private emit<K extends keyof OBDTransportEvents>(
    event: K,
    ...args: Parameters<OBDTransportEvents[K]>
  ): void {
    const list = this.listeners[event]
    if (list) {
      list.forEach((cb: any) => {
        try {
          cb(...args)
        } catch (e) {
          console.error('Error in transport event listener:', e)
        }
      })
    }
  }

  async connect(): Promise<boolean> {
    if (!RealSerialTransport.isWebSerialSupported()) {
      const msg =
        'Web Serial API não é suportada neste navegador. Use Google Chrome ou Microsoft Edge.'
      this.emit('statusChange', 'FALHA', msg)
      throw new Error(msg)
    }

    try {
      this.emit('statusChange', 'CONECTANDO', 'Aguardando seleção de porta serial pelo usuário...')
      // @ts-expect-error
      this.port = await navigator.serial.requestPort()
      await this.port.open({
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 4096,
      })

      this.connected = true
      this.emit('statusChange', 'CONECTANDO', 'Inicializando sequência AT ELM327...')

      // Sequência obrigatória de inicialização ELM327:
      // ATZ: Reset
      // ATE0: Echo off
      // ATL0: Linefeeds off
      // ATH0: Headers off
      // ATS0: Spaces off / on
      // ATSP0: Set Protocol Auto
      const initSequence = ['ATZ', 'ATE0', 'ATL0', 'ATH0', 'ATS0', 'ATSP0']
      for (const cmd of initSequence) {
        await this.send(cmd, 3000)
        await new Promise((r) => setTimeout(r, 100))
      }

      this.emit(
        'statusChange',
        'CONECTADO',
        'Conexão serial estabelecida e inicializada com sucesso.',
      )
      return true
    } catch (err: any) {
      this.connected = false
      const msg = err?.message || 'Falha ao conectar porta serial'
      this.emit('statusChange', 'FALHA', msg)
      this.emit('error', err)
      return false
    }
  }

  async send(cmd: string, timeoutMs = 2500): Promise<string> {
    if (!this.connected || !this.port) {
      throw new Error('SEM COMUNICAÇÃO: Transporte serial desconectado.')
    }

    const startTime = performance.now()
    techLogStore.addEntry({
      direction: 'TX',
      command: cmd,
      stage: 'SERIAL_SEND',
      transport: 'WEB_SERIAL',
    })

    try {
      const textEncoder = new TextEncoder()
      const textDecoder = new TextDecoder()
      const writer = this.port.writable.getWriter()
      await writer.write(textEncoder.encode(`${cmd}\r`))
      writer.releaseLock()

      const reader = this.port.readable.getReader()
      let response = ''
      const deadline = Date.now() + timeoutMs

      while (Date.now() < deadline) {
        const { value, done } = await Promise.race([
          reader.read(),
          new Promise<{ value: undefined; done: boolean }>((_, reject) =>
            setTimeout(
              () => reject(new Error('TIMEOUT_READ')),
              Math.max(100, deadline - Date.now()),
            ),
          ),
        ])

        if (done) break
        if (value) {
          response += textDecoder.decode(value)
          if (response.includes('>')) {
            break // Prompt ELM recebido
          }
        }
      }

      reader.releaseLock()
      const latency = Math.round(performance.now() - startTime)
      techLogStore.addEntry({
        direction: 'RX',
        command: cmd,
        response: response.replace(/[>\r\n]/g, ' ').trim(),
        rawResponse: response,
        latencyMs: latency,
        stage: 'SERIAL_RECV',
        transport: 'WEB_SERIAL',
      })

      this.emit('data', response)
      return response
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime)
      const errReason = err?.message || 'Erro serial'
      techLogStore.addEntry({
        direction: 'ERR',
        command: cmd,
        latencyMs: latency,
        errorReason: errReason,
        details: errReason,
        transport: 'WEB_SERIAL',
      })
      if (err?.message === 'TIMEOUT_READ') {
        throw new Error('TIMEOUT de comunicação serial')
      }
      this.emit('error', err)
      // Provoca tentativa de recuperação
      await this.handleDisconnect()
      throw err
    }
  }

  private async handleDisconnect(): Promise<void> {
    this.connected = false
    techLogStore.addEntry({
      direction: 'ERR',
      stage: 'SERIAL_DISCONNECT',
      details: 'Perda de comunicação física serial USB. Tentando restabelecer...',
    })
    this.emit('statusChange', 'RECONECTANDO', 'Tentando recuperar comunicação serial...')

    for (let i = 1; i <= this.reconnectAttempts; i++) {
      try {
        await new Promise((r) => setTimeout(r, 1500))
        if (this.port) {
          await this.port.close().catch(() => {})
          await this.port.open({ baudRate: this.baudRate })
          this.connected = true
          techLogStore.addEntry({
            direction: 'INFO',
            stage: 'SERIAL_RECONNECT_OK',
            details: `Reconexão serial USB bem-sucedida na tentativa ${i}!`,
          })
          this.emit('statusChange', 'CONECTADO', 'Reconexão serial bem-sucedida!')
          return
        }
      } catch {
        // continua tentando
      }
    }

    this.emit('statusChange', 'DESCONECTADO', 'Perda permanente de comunicação.')
  }

  async disconnect(): Promise<void> {
    this.connected = false
    try {
      if (this.reader) await this.reader.cancel().catch(() => {})
      if (this.port) await this.port.close().catch(() => {})
    } catch {
      // ignore
    } finally {
      this.port = null
      this.emit('statusChange', 'DESCONECTADO', 'Transporte desconectado pelo usuário.')
    }
  }
}
