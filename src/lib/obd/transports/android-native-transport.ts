import { OBDTransport, OBDTransportEvents } from './obd-transport'

/**
 * AndroidNativeTransport:
 * Camada preparada para comunicação nativa em ambiente Android (multimídias, tablets e smartphones).
 * Suporta:
 * 1. Bluetooth Classic (RFCOMM / SPP - Serial Port Profile padrão ELM327 v1.5/v2.1)
 * 2. USB Serial / OTG (FTDI, Prolific, CH340, CP2102)
 * 3. Ponte via Webview Javascript Interface (window.AndroidOBD) ou Capacitor Plugins
 *
 * Status: "IMPLEMENTADA — AGUARDANDO HARDWARE NATIVO / COMPATIBILIDADE NAVEGADOR"
 */
export class AndroidNativeTransport implements OBDTransport {
  readonly name = 'AndroidNativeTransport (SPP Classic / USB-OTG Native Bridge)'
  private connected = false
  private listeners: { [K in keyof OBDTransportEvents]?: Set<OBDTransportEvents[K]> } = {}
  private bridgeAvailable = false

  constructor() {
    this.checkBridgeAvailability()
  }

  static isNativeBridgeAvailable(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean((window as any).AndroidOBD || (window as any).Capacitor?.Plugins?.OBDPlugin)
    )
  }

  private checkBridgeAvailability() {
    this.bridgeAvailable = AndroidNativeTransport.isNativeBridgeAvailable()
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
          console.error('Erro em listener do AndroidNativeTransport:', e)
        }
      })
    }
  }

  async connect(): Promise<boolean> {
    this.emit('statusChange', 'CONECTANDO', 'Inicializando ponte Android nativa SPP/USB-OTG...')

    if (!this.bridgeAvailable) {
      // Quando em navegador normal (PWA sem container Android nativo instalado), fornece aviso claro
      const msg =
        'Interface nativa Android (SPP Classic/OTG) não detectada neste ambiente. Para Bluetooth no navegador, selecione a opção "BLUETOOTH (BLE/Android)" ou "USB/SERIAL".'
      this.emit('statusChange', 'FALHA', msg)
      throw new Error(msg)
    }

    try {
      const bridge = (window as any).AndroidOBD || (window as any).Capacitor?.Plugins?.OBDPlugin
      const ok = await bridge.connect()
      if (ok) {
        this.connected = true
        this.emit('statusChange', 'CONECTADO', 'Conexão nativa Android estabelecida com sucesso.')
        return true
      } else {
        throw new Error('Falha na resposta do adaptador nativo Android.')
      }
    } catch (err: any) {
      this.connected = false
      const errTxt = err?.message || 'Falha na conexão nativa Android SPP'
      this.emit('statusChange', 'FALHA', errTxt)
      this.emit('error', err)
      return false
    }
  }

  async send(cmd: string, timeoutMs = 2500): Promise<string> {
    if (!this.connected) {
      throw new Error('SEM COMUNICAÇÃO: Transporte Android nativo desconectado.')
    }
    const bridge = (window as any).AndroidOBD || (window as any).Capacitor?.Plugins?.OBDPlugin
    if (!bridge) {
      throw new Error('Ponte Android nativa inacessível.')
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TIMEOUT nativo Android')), timeoutMs)
      bridge
        .send(cmd)
        .then((res: string) => {
          clearTimeout(timer)
          this.emit('data', res)
          resolve(res)
        })
        .catch((e: any) => {
          clearTimeout(timer)
          this.emit('error', e)
          reject(e)
        })
    })
  }

  async disconnect(): Promise<void> {
    this.connected = false
    try {
      const bridge = (window as any).AndroidOBD || (window as any).Capacitor?.Plugins?.OBDPlugin
      if (bridge) {
        await bridge.disconnect()
      }
    } catch {
      /* ignore */
    } finally {
      this.emit('statusChange', 'DESCONECTADO', 'Ponte nativa Android encerrada.')
    }
  }
}
