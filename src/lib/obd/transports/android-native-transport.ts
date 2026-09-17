import { OBDTransport, OBDTransportEvents } from './obd-transport'
import {
  AndroidBluetoothDevice,
  AndroidOBDBridge,
  NativeConnectionInfo,
} from '@/types/android-bridge'
import { techLogStore } from '../tech-log-store'

const LAST_DEVICE_KEY = 'networkcar_last_paired_bt_device'

/**
 * AndroidNativeTransport:
 * Camada nativa Android para comunicação direta Bluetooth Classic (RFCOMM / SPP)
 * utilizando a bridge `window.AndroidOBD` (JavascriptInterface do WebView)
 * ou `Capacitor.Plugins.AndroidOBD` / `Capacitor.Plugins.OBDPlugin`.
 *
 * Características Mandatórias:
 * 1. Não depende do navegador Chrome para RFCOMM nem para autorizações.
 * 2. Faz chamadas nativas de BluetoothAdapter, pareados, createRfcommSocketToServiceRecord com UUID SPP.
 * 3. Trata runtime permissions de Android (BLUETOOTH_CONNECT, BLUETOOTH_SCAN, etc.).
 * 4. Permite selecionar qualquer dispositivo pareado (não fixa "OBDII").
 * 5. Memoriza o último dispositivo pareado utilizado para reconexão controlada.
 */
export class AndroidNativeTransport implements OBDTransport {
  readonly name = 'AndroidNativeTransport (Bridge Nativa Android Bluetooth SPP)'
  private connected = false
  private listeners: { [K in keyof OBDTransportEvents]?: Set<OBDTransportEvents[K]> } = {}
  private selectedDevice: AndroidBluetoothDevice | null = null
  private lastProtocol: string = 'ISO 15765-4 (CAN 11/500)'

  constructor() {
    this.restoreLastSelectedDevice()
  }

  /**
   * Obtém a instância da bridge exposta pelo ambiente nativo
   */
  static getBridge(): AndroidOBDBridge | null {
    if (typeof window === 'undefined') return null
    if (window.AndroidOBD) return window.AndroidOBD
    if (window.Capacitor?.Plugins?.AndroidOBD) return window.Capacitor.Plugins.AndroidOBD
    if (window.Capacitor?.Plugins?.OBDPlugin) return window.Capacitor.Plugins.OBDPlugin
    return null
  }

  static isNativeBridgeAvailable(): boolean {
    return Boolean(AndroidNativeTransport.getBridge())
  }

  private restoreLastSelectedDevice() {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(LAST_DEVICE_KEY)
      if (stored) {
        this.selectedDevice = JSON.parse(stored)
      }
    } catch {
      /* ignore */
    }
  }

  private persistSelectedDevice(device: AndroidBluetoothDevice) {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(LAST_DEVICE_KEY, JSON.stringify(device))
    } catch {
      /* ignore */
    }
  }

  getSelectedDevice(): AndroidBluetoothDevice | null {
    return this.selectedDevice
  }

  setSelectedDevice(device: AndroidBluetoothDevice | null) {
    this.selectedDevice = device
    if (device) {
      this.persistSelectedDevice(device)
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  getProtocol(): string {
    return this.lastProtocol
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

  /**
   * Consulta se o hardware Bluetooth existe
   */
  async hasBluetooth(): Promise<boolean> {
    const bridge = AndroidNativeTransport.getBridge()
    if (!bridge) return false
    try {
      const res = await Promise.resolve(bridge.hasBluetooth())
      return Boolean(res)
    } catch {
      return false
    }
  }

  /**
   * Consulta se o rádio Bluetooth está ativo
   */
  async isBluetoothEnabled(): Promise<boolean> {
    const bridge = AndroidNativeTransport.getBridge()
    if (!bridge) return false
    try {
      const res = await Promise.resolve(bridge.isBluetoothEnabled())
      return Boolean(res)
    } catch {
      return false
    }
  }

  /**
   * Solicita ao SO a ativação do rádio Bluetooth
   */
  async requestEnableBluetooth(): Promise<boolean> {
    const bridge = AndroidNativeTransport.getBridge()
    if (!bridge) return false
    try {
      const res = await Promise.resolve(bridge.requestEnableBluetooth())
      return Boolean(res)
    } catch {
      return false
    }
  }

  /**
   * Solicita runtime permissions (BLUETOOTH_CONNECT etc.)
   */
  async requestPermissions(): Promise<boolean> {
    const bridge = AndroidNativeTransport.getBridge()
    if (!bridge) return false
    try {
      const res = await Promise.resolve(bridge.requestPermissions())
      return Boolean(res)
    } catch {
      return false
    }
  }

  /**
   * Lista dispositivos já pareados no SO Android
   */
  async getPairedDevices(): Promise<AndroidBluetoothDevice[]> {
    const bridge = AndroidNativeTransport.getBridge()
    if (!bridge) return []
    try {
      const res = await Promise.resolve(bridge.getPairedDevices())
      if (typeof res === 'string') {
        try {
          return JSON.parse(res) as AndroidBluetoothDevice[]
        } catch {
          return []
        }
      }
      return Array.isArray(res) ? res : []
    } catch (err: any) {
      techLogStore.addEntry({
        direction: 'ERR',
        stage: 'BT_PAIRED_ERR',
        details: `Erro ao obter dispositivos pareados: ${err?.message || err}`,
      })
      return []
    }
  }

  /**
   * Consulta o estado nativo detalhado
   */
  async getNativeState(): Promise<NativeConnectionInfo | null> {
    const bridge = AndroidNativeTransport.getBridge()
    if (!bridge) return null
    try {
      const res = await Promise.resolve(bridge.getConnectionState())
      if (typeof res === 'string') {
        try {
          return JSON.parse(res) as NativeConnectionInfo
        } catch {
          return null
        }
      }
      return res || null
    } catch {
      return null
    }
  }

  /**
   * Conecta ao dispositivo especificado por endereço ou ao previamente selecionado
   */
  async connect(targetAddress?: string): Promise<boolean> {
    const bridge = AndroidNativeTransport.getBridge()

    if (!bridge) {
      const msg =
        'Ponte nativa Android não detectada neste ambiente. Disponível apenas no APK instalável do Network Car.'
      this.emit('statusChange', 'FALHA', msg)
      throw new Error(msg)
    }

    // 1. Validação de hardware e rádio
    const hasBt = await this.hasBluetooth()
    if (!hasBt) {
      const msg = 'Dispositivo sem hardware Bluetooth disponível.'
      this.emit('statusChange', 'FALHA', msg)
      throw new Error(msg)
    }

    const isEnabled = await this.isBluetoothEnabled()
    if (!isEnabled) {
      const msg =
        'Bluetooth desligado no aparelho. Ative o Bluetooth nas configurações ou permita a ativação.'
      this.emit('statusChange', 'FALHA', msg)
      techLogStore.addEntry({
        direction: 'ERR',
        stage: 'BT_OFF',
        details: msg,
      })
      // Tenta solicitar ativação
      await this.requestEnableBluetooth().catch(() => {})
      throw new Error(msg)
    }

    // 2. Garante permissões
    await this.requestPermissions().catch(() => {})

    // 3. Resolve endereço do dispositivo
    let address = targetAddress || this.selectedDevice?.address
    if (!address) {
      // Tenta buscar nos pareados
      const paired = await this.getPairedDevices()
      if (paired.length === 0) {
        const msg =
          'Nenhum dispositivo Bluetooth pareado no Android. Pareie o adaptador ELM327 nas configurações do sistema.'
        this.emit('statusChange', 'FALHA', msg)
        throw new Error(msg)
      }

      // Prioriza dispositivo chamado "OBDII" ou com nome automotivo, mas se não houver pega o primeiro
      const preferred = paired.find((d) => /obd|elm|ecu|vlink|car/i.test(d.name)) || paired[0]
      address = preferred.address
      this.setSelectedDevice(preferred)
    }

    const devName = this.selectedDevice?.name || address
    techLogStore.addEntry({
      direction: 'INFO',
      stage: 'NATIVE_CONNECT',
      details: `BT: Dispositivo selecionado [${devName}] (${address}). Abrindo RFCOMM nativo...`,
    })

    this.emit('statusChange', 'CONECTANDO', `Conectando via RFCOMM ao adaptador [${devName}]...`)

    try {
      const ok = await Promise.resolve(bridge.connect(address))
      if (ok) {
        this.connected = true
        techLogStore.addEntry({
          direction: 'INFO',
          stage: 'NATIVE_SOCKET_OK',
          details: `BT: RFCOMM conectado com sucesso em ${address}.`,
        })
        this.emit('statusChange', 'CONECTADO', `Socket RFCOMM conectado a [${devName}].`)
        return true
      } else {
        throw new Error(`Falha ao abrir canal RFCOMM nativo para ${devName}.`)
      }
    } catch (err: any) {
      this.connected = false
      const errTxt = err?.message || 'Falha na conexão Bluetooth Classic nativa'
      techLogStore.addEntry({
        direction: 'ERR',
        stage: 'NATIVE_CONNECT_FAIL',
        details: `BT: Erro na conexão RFCOMM com [${devName}]: ${errTxt}`,
      })
      this.emit('statusChange', 'FALHA', errTxt)
      this.emit('error', err)
      throw err
    }
  }

  async send(cmd: string, timeoutMs = 2500): Promise<string> {
    if (!this.connected) {
      throw new Error('SEM COMUNICAÇÃO: Transporte Android nativo desconectado.')
    }
    const bridge = AndroidNativeTransport.getBridge()
    if (!bridge) {
      throw new Error('Ponte Android nativa inacessível.')
    }

    const startTime = performance.now()
    techLogStore.addEntry({
      direction: 'TX',
      command: cmd,
      stage: 'SEND_NATIVE',
    })

    try {
      const resRaw = await Promise.resolve(bridge.send(cmd, timeoutMs))
      const res = typeof resRaw === 'string' ? resRaw : String(resRaw)
      const latency = Math.round(performance.now() - startTime)

      techLogStore.addEntry({
        direction: 'RX',
        command: cmd,
        response: res.replace(/[>\r\n]/g, ' ').trim(),
        latencyMs: latency,
        stage: 'RECV_NATIVE',
      })

      this.emit('data', res)
      return res
    } catch (e: any) {
      const latency = Math.round(performance.now() - startTime)
      techLogStore.addEntry({
        direction: 'ERR',
        command: cmd,
        latencyMs: latency,
        details: `Erro envio bridge: ${e?.message || e}`,
      })
      this.emit('error', e)
      throw e
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
    const bridge = AndroidNativeTransport.getBridge()
    try {
      if (bridge) {
        await Promise.resolve(bridge.disconnect())
      }
    } catch {
      /* ignore */
    } finally {
      techLogStore.addEntry({
        direction: 'INFO',
        stage: 'NATIVE_DISCONNECT',
        details: 'BT: RFCOMM desconectado.',
      })
      this.emit('statusChange', 'DESCONECTADO', 'Ponte nativa Android encerrada.')
    }
  }
}
