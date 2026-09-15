import { OBDTransport, OBDTransportEvents } from './obd-transport'

/**
 * Definições padrão de serviços e características BLE comumente utilizados
 * por adaptadores ELM327 BLE (Vgate iCar Pro BLE4.0, OBDLink CX, Veepeak BLE, etc.)
 */
const KNOWN_BLE_SERVICES = [
  // Padrão Nordic UART Service (NUS) - amplamente adotado por adaptadores ELM327 BLE
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  // TI CC2540 / HM-10 Serial
  '0000ffe0-0000-1000-8000-00805f9b34fb',
  // Microchip transparent UART
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  // Vgate vLinker / Veepeak OBD
  '000018f0-0000-1000-8000-00805f9b34fb',
]

const KNOWN_BLE_RX_CHARS = [
  // TX do ponto de vista do dispositivo = RX no navegador
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-1e4d-4bd9-ba61-23c647249616',
]

const KNOWN_BLE_TX_CHARS = [
  // RX do ponto de vista do dispositivo = TX no navegador
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
]

/**
 * BluetoothTransport: Implementação Web Bluetooth API para adaptador ELM327 BLE / Bluetooth 4.0+.
 * Atende NC-01 para plataformas Android, tablets e multimídias compatíveis com Chromium.
 *
 * Status oficial: "IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"
 *
 * Preserva estritamente a interface OBDTransport, sem acoplamento da camada de aplicação à plataforma.
 */
export class BluetoothTransport implements OBDTransport {
  readonly name = 'BluetoothTransport (Web Bluetooth ELM327 BLE)'
  private device: any = null
  private server: any = null
  private rxCharacteristic: any = null
  private txCharacteristic: any = null
  private listeners: { [K in keyof OBDTransportEvents]?: Set<OBDTransportEvents[K]> } = {}
  private connected = false
  private receiveBuffer = ''
  private pendingResolver: ((data: string) => void) | null = null

  static isWebBluetoothSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
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
          console.error('Error in bluetooth transport event listener:', e)
        }
      })
    }
  }

  private handleCharacteristicValueChanged = (event: any) => {
    const value = event.target.value as DataView
    if (!value) return
    const decoder = new TextDecoder('utf-8')
    const chunk = decoder.decode(value)
    this.receiveBuffer += chunk

    if (this.receiveBuffer.includes('>')) {
      const fullResponse = this.receiveBuffer
      this.receiveBuffer = ''
      this.emit('data', fullResponse)
      if (this.pendingResolver) {
        const resolve = this.pendingResolver
        this.pendingResolver = null
        resolve(fullResponse)
      }
    }
  }

  private handleGattServerDisconnected = () => {
    this.connected = false
    this.emit('statusChange', 'DESCONECTADO', 'Adaptador Bluetooth ELM327 desconectado.')
  }

  async connect(): Promise<boolean> {
    if (!BluetoothTransport.isWebBluetoothSupported()) {
      const msg =
        'Web Bluetooth API não é suportada neste navegador. Utilize Google Chrome ou Edge no Android/Desktop.'
      this.emit('statusChange', 'FALHA', msg)
      throw new Error(msg)
    }

    try {
      this.emit(
        'statusChange',
        'CONECTANDO',
        'Aguardando seleção do dispositivo Bluetooth ELM327...',
      )

      const navBt = (navigator as any).bluetooth
      this.device = await navBt.requestDevice({
        filters: [
          { namePrefix: 'OBD' },
          { namePrefix: 'ELM' },
          { namePrefix: 'V-LINK' },
          { namePrefix: 'IOS-Vlink' },
          { namePrefix: 'Viecar' },
          { namePrefix: 'VGATE' },
          { namePrefix: 'Vgate' },
          { namePrefix: 'Konnwei' },
        ],
        optionalServices: KNOWN_BLE_SERVICES,
      })

      if (!this.device) {
        throw new Error('Nenhum adaptador selecionado')
      }

      this.device.addEventListener('gattserverdisconnected', this.handleGattServerDisconnected)

      this.emit('statusChange', 'CONECTANDO', 'Conectando ao servidor GATT Bluetooth...')
      this.server = await this.device.gatt.connect()

      // Tenta localizar um dos serviços seriais conhecidos
      let targetService: any = null
      for (const serviceUuid of KNOWN_BLE_SERVICES) {
        try {
          targetService = await this.server.getPrimaryService(serviceUuid)
          if (targetService) break
        } catch {
          // tenta o próximo serviço
        }
      }

      if (!targetService) {
        // Se nenhum UUID conhecido bateu, tenta buscar todos os serviços disponíveis
        try {
          const services = await this.server.getPrimaryServices()
          if (services && services.length > 0) {
            targetService = services[0]
          }
        } catch {
          // ignora
        }
      }

      if (!targetService) {
        throw new Error('Serviço Serial UART GATT não encontrado no dispositivo Bluetooth.')
      }

      // Localiza características RX e TX
      const characteristics = await targetService.getCharacteristics()
      for (const char of characteristics) {
        const props = char.properties || {}
        if (props.notify || props.indicate) {
          this.rxCharacteristic = char
        }
        if (props.write || props.writeWithoutResponse) {
          this.txCharacteristic = char
        }
      }

      if (!this.rxCharacteristic || !this.txCharacteristic) {
        // Fallback para UUIDs conhecidos se a introspecção não pegou
        for (const rxUuid of KNOWN_BLE_RX_CHARS) {
          try {
            this.rxCharacteristic = await targetService.getCharacteristic(rxUuid)
            if (this.rxCharacteristic) break
          } catch {
            /* intentionally ignored */
          }
        }
        for (const txUuid of KNOWN_BLE_TX_CHARS) {
          try {
            this.txCharacteristic = await targetService.getCharacteristic(txUuid)
            if (this.txCharacteristic) break
          } catch {
            /* intentionally ignored */
          }
        }
      }

      if (!this.txCharacteristic) {
        throw new Error('Característica TX para envio de comandos AT não encontrada.')
      }

      if (this.rxCharacteristic) {
        await this.rxCharacteristic.startNotifications()
        this.rxCharacteristic.addEventListener(
          'characteristicvaluechanged',
          this.handleCharacteristicValueChanged,
        )
      }

      this.connected = true
      this.emit('statusChange', 'CONECTANDO', 'Inicializando sequência AT ELM327 via Bluetooth...')

      // Sequência obrigatória de inicialização ELM327
      const initSequence = ['ATZ', 'ATE0', 'ATL0', 'ATH0', 'ATS0', 'ATSP0']
      for (const cmd of initSequence) {
        await this.send(cmd, 3500)
        await new Promise((r) => setTimeout(r, 120))
      }

      this.emit(
        'statusChange',
        'CONECTADO',
        'Conexão Bluetooth BLE estabelecida e inicializada com sucesso.',
      )
      return true
    } catch (err: any) {
      this.connected = false
      const msg = err?.message || 'Falha ao conectar via Bluetooth'
      this.emit('statusChange', 'FALHA', msg)
      this.emit('error', err)
      return false
    }
  }

  async send(cmd: string, timeoutMs = 3000): Promise<string> {
    if (!this.connected || !this.txCharacteristic) {
      throw new Error('SEM COMUNICAÇÃO: Transporte Bluetooth desconectado.')
    }

    this.receiveBuffer = ''

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingResolver = null
        reject(new Error('TIMEOUT de comunicação Bluetooth ELM327'))
      }, timeoutMs)

      this.pendingResolver = (response: string) => {
        clearTimeout(timer)
        resolve(response)
      }

      const encoder = new TextEncoder()
      const payload = encoder.encode(`${cmd}\r`)

      const writePromise = this.txCharacteristic.writeValueWithoutResponse
        ? this.txCharacteristic.writeValueWithoutResponse(payload)
        : this.txCharacteristic.writeValue(payload)

      writePromise.catch((err: any) => {
        clearTimeout(timer)
        this.pendingResolver = null
        this.emit('error', err)
        reject(err)
      })
    })
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.pendingResolver = null
    try {
      if (this.rxCharacteristic) {
        await this.rxCharacteristic.stopNotifications().catch(() => {})
        this.rxCharacteristic.removeEventListener(
          'characteristicvaluechanged',
          this.handleCharacteristicValueChanged,
        )
      }
      if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect()
      }
    } catch {
      // ignore
    } finally {
      this.device = null
      this.server = null
      this.rxCharacteristic = null
      this.txCharacteristic = null
      this.emit('statusChange', 'DESCONECTADO', 'Transporte Bluetooth desconectado pelo usuário.')
    }
  }
}
