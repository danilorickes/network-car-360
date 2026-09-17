/**
 * Definições TypeScript para a Ponte Nativa Android (window.AndroidOBD e Capacitor OBDPlugin)
 * ETAPA E6.6.1: PONTE NATIVA ANDROID / ELM327 BLUETOOTH CLASSIC (SPP/RFCOMM)
 */

export interface AndroidBluetoothDevice {
  name: string
  address: string
  bondState?: number // 10: NONE, 11: BONDING, 12: BONDED
  type?: number // 1: CLASSIC, 2: LE, 3: DUAL
}

export interface AndroidBluetoothState {
  hasBluetooth: boolean
  isEnabled: boolean
  hasPermissions: boolean
  state: 'OFF' | 'TURNING_ON' | 'ON' | 'TURNING_OFF' | 'UNAVAILABLE'
}

export type NativeOBDConnectionState =
  | 'DISCONNECTED'
  | 'BLUETOOTH_OFF'
  | 'PERMISSION_DENIED'
  | 'CONNECTING_SOCKET'
  | 'SOCKET_CONNECTED'
  | 'INITIALIZING_ELM'
  | 'ELM_READY'
  | 'WAITING_ECU'
  | 'ECU_CONNECTED'
  | 'DISCONNECTING'
  | 'ERROR'

export interface NativeConnectionInfo {
  connected: boolean
  state: NativeOBDConnectionState
  deviceAddress: string | null
  deviceName: string | null
  protocol: string | null
  error?: string | null
}

/**
 * Interface exposta pela camada nativa Android (Kotlin) para o JavaScript/TypeScript:
 * Injetada em `window.AndroidOBD` (JavascriptInterface do WebView)
 * ou disponível via `Capacitor.Plugins.AndroidOBD` / `Capacitor.Plugins.OBDPlugin`.
 */
export interface AndroidOBDBridge {
  /** Verifica se o aparelho possui adaptador Bluetooth de hardware */
  hasBluetooth(): Promise<boolean> | boolean

  /** Verifica se o rádio Bluetooth está atualmente ligado */
  isBluetoothEnabled(): Promise<boolean> | boolean

  /** Solicita ao sistema operacional a ativação do Bluetooth (Intent ACTION_REQUEST_ENABLE) */
  requestEnableBluetooth(): Promise<boolean> | boolean

  /** Solicita runtime permissions (BLUETOOTH_CONNECT no Android 12+, BLUETOOTH/ADMIN legados) */
  requestPermissions(): Promise<boolean> | boolean

  /** Retorna lista de dispositivos Bluetooth Classic já pareados no SO */
  getPairedDevices(): Promise<AndroidBluetoothDevice[]> | string // Pode retornar array ou JSON string em WebView síncrono

  /**
   * Conecta via RFCOMM SPP ao dispositivo especificado por endereço MAC.
   * Se omitido, pode conectar ao último dispositivo salvo ou padrão.
   */
  connect(address?: string): Promise<boolean> | boolean

  /** Encerra a conexão RFCOMM e fecha streams */
  disconnect(): Promise<void | boolean> | boolean

  /** Envia comando ELM327 e aguarda prompt '>' ou retorno */
  send(command: string, timeoutMs?: number): Promise<string> | string

  /** Retorna o estado atual da conexão física e rádio */
  getConnectionState(): Promise<NativeConnectionInfo> | string

  /** Retorna informações do dispositivo atualmente conectado */
  getConnectedDevice(): Promise<AndroidBluetoothDevice | null> | string | null

  /** Registra listener de mudanças de estado (se suportado pelo WebView/Capacitor) */
  onStateChange?(callbackName: string): void
}

declare global {
  interface Window {
    AndroidOBD?: AndroidOBDBridge
    Capacitor?: {
      isNativePlatform?: () => boolean
      getPlatform?: () => string
      Plugins?: {
        AndroidOBD?: AndroidOBDBridge
        OBDPlugin?: AndroidOBDBridge
        [key: string]: any
      }
    }
  }
}
