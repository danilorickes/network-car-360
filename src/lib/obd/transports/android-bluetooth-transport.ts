import { OBDTransport, OBDTransportEvents } from './obd-transport'
import { AndroidNativeTransport } from './android-native-transport'

/**
 * Bluetooth Classic SPP Service Class ID padrão:
 * 00001101-0000-1000-8000-00805f9b34fb (Serial Port Profile - SPP)
 * Este é o único serviço Bluetooth Classic aceito pela especificação Web Serial sobre Bluetooth RFCOMM
 * (Chrome 117+ no Desktop e Chrome 138+ no Android sob Finch flag BluetoothRfcommAndroid).
 */
export const BLUETOOTH_CLASSIC_SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb'

export interface BluetoothClassicEnvironment {
  isSupported: boolean
  isWebSerialAvailable: boolean
  isAndroid: boolean
  chromeVersion: number | null
  canUseWebSerialRfcomm: boolean
  hasNativeBridge: boolean
  diagnosticMessage: string
}

/**
 * AndroidBluetoothTransport:
 * Implementa comunicação real com adaptadores ELM327 Bluetooth Classic (SPP/RFCOMM)
 * conforme homologado no Ford EcoSport 2020 1.5 Dragon com Xiaomi Android.
 *
 * Estratégia de Duplo Canal:
 * 1. Web Serial API RFCOMM (Chrome Android 138+ / Desktop Chrome 117+)
 *    - navigator.serial.requestPort({ allowedBluetoothServiceClassIds: [BLUETOOTH_CLASSIC_SPP_UUID] })
 * 2. Fallback Transparente para Native Android Bridge (window.AndroidOBD / Capacitor)
 *    - Quando executando em navegadores Chrome Android anteriores a 138 ou wrapper APK/WebView.
 *
 * NUNCA utiliza Web Bluetooth (GATT/BLE) para adaptadores Bluetooth Classic SPP.
 * NUNCA substitui conexão real por dados simulados silenciosamente.
 */
export class AndroidBluetoothTransport implements OBDTransport {
  readonly name = 'AndroidBluetoothTransport (Bluetooth Classic SPP/RFCOMM)'
  private port: any = null
  private reader: any = null
  private writer: any = null
  private nativeTransport: AndroidNativeTransport | null = null
  private activeMode: 'WEB_SERIAL_RFCOMM' | 'NATIVE_BRIDGE' | null = null
  private connected = false
  private listeners: { [K in keyof OBDTransportEvents]?: Set<OBDTransportEvents[K]> } = {}
  private reconnectAttempts = 3
  private baudRate = 38400
  private detectedProtocol = 'ISO 15765-4 (CAN 11/500)'

  constructor(baudRate = 38400, reconnectAttempts = 3) {
    this.baudRate = baudRate
    this.reconnectAttempts = reconnectAttempts
  }

  /**
   * Avalia as capacidades do ambiente com precisão técnica
   */
  static inspectEnvironment(): BluetoothClassicEnvironment {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        isSupported: false,
        isWebSerialAvailable: false,
        isAndroid: false,
        chromeVersion: null,
        canUseWebSerialRfcomm: false,
        hasNativeBridge: false,
        diagnosticMessage: 'Ambiente sem navegador identificado.',
      }
    }

    const ua = navigator.userAgent || ''
    const isAndroid = /android/i.test(ua)
    const isWebSerialAvailable = 'serial' in navigator

    let chromeVersion: number | null = null
    const chromeMatch = ua.match(/Chrome\/(\d+)/i)
    if (chromeMatch && chromeMatch[1]) {
      chromeVersion = parseInt(chromeMatch[1], 10)
    }

    const hasNativeBridge = AndroidNativeTransport.isNativeBridgeAvailable()

    // No Android, Web Serial over Bluetooth RFCOMM requer Chrome 138+ (feature flag BluetoothRfcommAndroid)
    // No Desktop, Web Serial over RFCOMM opera a partir do Chrome 117+
    const canUseWebSerialRfcomm =
      isWebSerialAvailable &&
      (isAndroid
        ? chromeVersion !== null && chromeVersion >= 138
        : chromeVersion !== null
          ? chromeVersion >= 117
          : true)

    const isSupported = canUseWebSerialRfcomm || hasNativeBridge

    let diagnosticMessage = ''
    if (canUseWebSerialRfcomm) {
      diagnosticMessage = isAndroid
        ? `Chrome Android ${chromeVersion} detectado: suporte nativo a Web Serial RFCOMM sobre Bluetooth Classic (SPP 00001101).`
        : `Desktop Chrome ${chromeVersion || ''} detectado: suporte a Web Serial RFCOMM sobre Bluetooth Classic.`
    } else if (hasNativeBridge) {
      diagnosticMessage = 'Ponte nativa Android detectada (window.AndroidOBD / Capacitor).'
    } else if (isAndroid) {
      diagnosticMessage = `Chrome Android ${chromeVersion || 'antigo'} detectado: Web Serial sobre Bluetooth Classic SPP requer Chrome 138+ (chromestatus: Web serial over Bluetooth on Android). Para versões anteriores, utilize a ponte nativa Android (APK wrapper).`
    } else {
      diagnosticMessage = 'Navegador sem suporte a Web Serial RFCOMM ou Bluetooth Classic SPP.'
    }

    return {
      isSupported,
      isWebSerialAvailable,
      isAndroid,
      chromeVersion,
      canUseWebSerialRfcomm,
      hasNativeBridge,
      diagnosticMessage,
    }
  }

  isConnected(): boolean {
    return this.connected
  }

  getProtocol(): string {
    return this.detectedProtocol
  }

  getActiveMode(): 'WEB_SERIAL_RFCOMM' | 'NATIVE_BRIDGE' | null {
    return this.activeMode
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
          console.error('Erro em listener do AndroidBluetoothTransport:', e)
        }
      })
    }
  }

  async connect(): Promise<boolean> {
    const env = AndroidBluetoothTransport.inspectEnvironment()

    // 1. Tenta Web Serial RFCOMM (se suportado ou disponível no navegador)
    if (env.isWebSerialAvailable) {
      try {
        const ok = await this.connectWebSerialRfcomm()
        if (ok) {
          this.activeMode = 'WEB_SERIAL_RFCOMM'
          return true
        }
      } catch (err: any) {
        console.warn('Tentativa Web Serial RFCOMM falhou:', err?.message)
        // Se houver ponte nativa, faz fallback
        if (env.hasNativeBridge) {
          return this.connectNativeBridge()
        }
        this.emit('statusChange', 'FALHA', err?.message || 'Falha na conexão Bluetooth Classic SPP')
        throw err
      }
    }

    // 2. Se não houver Web Serial ou for Chrome Android < 138, tenta Native Bridge
    if (env.hasNativeBridge) {
      return this.connectNativeBridge()
    }

    // 3. Nem Web Serial RFCOMM nem Native Bridge disponíveis: relatório claro da limitação
    const errMsg = env.diagnosticMessage || 'Bluetooth Classic SPP indisponível neste navegador.'
    this.emit('statusChange', 'FALHA', errMsg)
    throw new Error(errMsg)
  }

  private async connectWebSerialRfcomm(): Promise<boolean> {
    this.emit(
      'statusChange',
      'CONECTANDO',
      'Selecione o adaptador ELM327 Bluetooth Classic pareado no Android/PC...',
    )

    const serial = (navigator as any).serial
    if (!serial || !serial.requestPort) {
      throw new Error('API Web Serial não disponível neste navegador.')
    }

    try {
      // Solicita porta serial filtrando pelo UUID padrão SPP (RFCOMM)
      try {
        this.port = await serial.requestPort({
          allowedBluetoothServiceClassIds: [BLUETOOTH_CLASSIC_SPP_UUID],
        })
      } catch (filterErr: any) {
        // Fallback: se o navegador recusar o parâmetro allowedBluetoothServiceClassIds, tenta requestPort comum
        console.warn('requestPort com filtro SPP não suportado, tentando sem filtro:', filterErr)
        this.port = await serial.requestPort()
      }

      if (!this.port) {
        throw new Error('Nenhum adaptador Bluetooth OBD-II selecionado.')
      }

      this.emit('statusChange', 'CONECTANDO', 'Abrindo canal RFCOMM SPP (38400 baud)...')
      await this.port.open({
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 4096,
      })

      this.connected = true
      this.activeMode = 'WEB_SERIAL_RFCOMM'

      // Executa sequência de inicialização ELM327
      await this.runElmInitSequence()

      this.emit(
        'statusChange',
        'CONECTADO',
        `Conexão ELM327 Bluetooth Classic ativa via Web Serial RFCOMM. Protocolo: ${this.detectedProtocol}`,
      )
      return true
    } catch (err: any) {
      this.connected = false
      this.port = null
      throw err
    }
  }

  private async connectNativeBridge(): Promise<boolean> {
    this.emit('statusChange', 'CONECTANDO', 'Conectando via ponte nativa Android SPP...')
    this.nativeTransport = new AndroidNativeTransport()

    this.nativeTransport.on('statusChange', (st, msg) => {
      this.emit('statusChange', st, msg)
    })
    this.nativeTransport.on('data', (d) => this.emit('data', d))
    this.nativeTransport.on('error', (e) => this.emit('error', e))

    const ok = await this.nativeTransport.connect()
    if (ok) {
      this.connected = true
      this.activeMode = 'NATIVE_BRIDGE'
      await this.runElmInitSequence()
      this.emit(
        'statusChange',
        'CONECTADO',
        `Conexão ELM327 Bluetooth ativa via ponte nativa Android. Protocolo: ${this.detectedProtocol}`,
      )
      return true
    }
    return false
  }

  /**
   * Sequência rigorosa de inicialização ELM327 com tolerância a clones:
   * ATZ -> ATE0 -> ATL0 -> ATH0 -> ATS0 -> ATSP0 (ou protocolo específico Ford) -> confirmação de ECU
   */
  private async runElmInitSequence(): Promise<void> {
    this.emit(
      'statusChange',
      'CONECTANDO',
      'Inicializando modem ELM327 Bluetooth (ATZ, ATE0, ATSP0)...',
    )

    // 1. Reset ATZ
    try {
      await this.sendRaw('ATZ', 3500)
      await new Promise((r) => setTimeout(r, 400))
    } catch {
      // Tolera timeout em clones lentos
    }

    // 2. Parâmetros essenciais de formatação
    const setupCommands = [
      { cmd: 'ATE0', desc: 'Echo off' },
      { cmd: 'ATL0', desc: 'Linefeeds off' },
      { cmd: 'ATH0', desc: 'Headers off' },
      { cmd: 'ATS0', desc: 'Spaces off' },
      { cmd: 'ATSP0', desc: 'Auto Protocol' },
    ]

    for (const item of setupCommands) {
      try {
        await this.sendRaw(item.cmd, 2500)
        await new Promise((r) => setTimeout(r, 100))
      } catch (e) {
        console.warn(`Comando ${item.cmd} (${item.desc}) ignorado ou timeout:`, e)
      }
    }

    // 3. Confirmação de comunicação com a ECU via 0100
    this.emit('statusChange', 'CONECTANDO', 'Confirmando comunicação com a ECU do motor...')
    try {
      const resp0100 = await this.sendRaw('0100', 4000)
      if (resp0100.includes('UNABLE TO CONNECT') || resp0100.includes('BUS INIT: ERROR')) {
        // Tenta protocolo específico ISO 15765-4 CAN (11 bit / 500k) — comum no EcoSport Dragon
        try {
          await this.sendRaw('ATSP6', 2000) // Protocol 6 = ISO 15765-4 (CAN 11/500)
          await this.sendRaw('0100', 3500)
        } catch {
          /* continua */
        }
      }
    } catch {
      /* tolera falha inicial e prossegue */
    }

    // 4. Detecção de protocolo
    try {
      const dpResp = await this.sendRaw('ATDP', 2000)
      const cleanDp = dpResp.replace(/[>\r\n]/g, '').trim()
      if (cleanDp && !cleanDp.includes('ERROR') && !cleanDp.includes('?')) {
        this.detectedProtocol = cleanDp
      }
    } catch {
      this.detectedProtocol = 'ISO 15765-4 (CAN 11/500)'
    }
  }

  async send(cmd: string, timeoutMs = 2500): Promise<string> {
    if (!this.connected) {
      throw new Error('SEM COMUNICAÇÃO: Transporte Bluetooth Classic desconectado.')
    }
    return this.sendRaw(cmd, timeoutMs)
  }

  private async sendRaw(cmd: string, timeoutMs = 2500): Promise<string> {
    if (this.activeMode === 'NATIVE_BRIDGE' && this.nativeTransport) {
      return this.nativeTransport.send(cmd, timeoutMs)
    }

    if (!this.port) {
      throw new Error('SEM COMUNICAÇÃO: Porta serial Bluetooth não disponível.')
    }

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
        const remaining = Math.max(80, deadline - Date.now())
        const readResult = await Promise.race([
          reader.read(),
          new Promise<{ value: undefined; done: boolean }>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT_READ')), remaining),
          ),
        ])

        if (readResult.done) break
        if (readResult.value) {
          response += textDecoder.decode(readResult.value)
          if (response.includes('>')) {
            break // Prompt do ELM327 recebido
          }
        }
      }

      reader.releaseLock()
      this.emit('data', response)
      return response
    } catch (err: any) {
      if (err?.message === 'TIMEOUT_READ') {
        throw new Error('TIMEOUT de comunicação Bluetooth ELM327')
      }
      this.emit('error', err)
      // Dispara recuperação de conexão se for erro de I/O físico
      await this.handleConnectionLoss()
      throw err
    }
  }

  /**
   * Reconexão automática em caso de perda temporária de sinal Bluetooth.
   * REGRA CRÍTICA: NUNCA substituir silenciosamente uma conexão real perdida por dados simulados.
   */
  private async handleConnectionLoss(): Promise<void> {
    this.connected = false
    this.emit(
      'statusChange',
      'RECONECTANDO',
      'Perda de sinal com o adaptador Bluetooth ELM327. Tentando reconexão...',
    )

    for (let attempt = 1; attempt <= this.reconnectAttempts; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, 1500))
        if (this.port) {
          await this.port.close().catch(() => {})
          await this.port.open({ baudRate: this.baudRate })
          this.connected = true
          this.emit(
            'statusChange',
            'CONECTADO',
            `Reconexão Bluetooth restabelecida (tentativa ${attempt}/${this.reconnectAttempts}).`,
          )
          return
        }
      } catch {
        // continua tentando até esgotar
      }
    }

    this.emit(
      'statusChange',
      'FALHA',
      'Perda permanente de comunicação Bluetooth. O sistema NÃO ativou simulação.',
    )
  }

  async disconnect(): Promise<void> {
    this.connected = false
    try {
      if (this.activeMode === 'NATIVE_BRIDGE' && this.nativeTransport) {
        await this.nativeTransport.disconnect()
      }
      if (this.reader) await this.reader.cancel().catch(() => {})
      if (this.port) await this.port.close().catch(() => {})
    } catch {
      /* ignore */
    } finally {
      this.port = null
      this.reader = null
      this.writer = null
      this.activeMode = null
      this.emit('statusChange', 'DESCONECTADO', 'Adaptador Bluetooth desconectado.')
    }
  }
}
