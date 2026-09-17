import { OBDTransport, OBDTransportEvents } from './obd-transport'
import { AndroidNativeTransport } from './android-native-transport'
import { techLogStore } from '../tech-log-store'

/**
 * Bluetooth Classic SPP Service Class ID padrão:
 * 00001101-0000-1000-8000-00805f9b34fb (Serial Port Profile - SPP)
 * Este é o único serviço Bluetooth Classic aceito pela especificação Web Serial sobre Bluetooth RFCOMM
 * (Chrome 117+ no Desktop e Chrome 138+ no Android sob Finch flag BluetoothRfcommAndroid).
 */
export const BLUETOOTH_CLASSIC_SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb'

/**
 * Estados detalhados de conexão OBD/Bluetooth exigidos pela especificação:
 * - BLUETOOTH_DESLIGADO: Bluetooth do rádio desativado no aparelho
 * - DISPOSITIVO_NAO_PAREADO: Adaptador ELM327 não pareado nas configurações do sistema
 * - ELM327_ENCONTRADO: Dispositivo OBDII selecionado/reconhecido
 * - CONECTANDO_ELM327: Canal RFCOMM / serial sendo aberto
 * - ELM327_CONECTADO: Modem ELM327 respondeu comandos ATZ / ATE0
 * - ECU_NAO_RESPONDEU: ELM327 ativo, mas veículo/injeção não enviou dados
 * - VEICULO_CONECTADO: ECU respondeu PIDs (0100/010C) com sucesso
 */
export type DetailedOBDConnectionStatus =
  | 'DESCONECTADO'
  | 'BLUETOOTH_DESLIGADO'
  | 'DISPOSITIVO_NAO_PAREADO'
  | 'ELM327_ENCONTRADO'
  | 'CONECTANDO_ELM327'
  | 'ELM327_CONECTADO'
  | 'ECU_NAO_RESPONDEU'
  | 'VEICULO_CONECTADO'
  | 'RECONECTANDO'
  | 'FALHA'

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
  private detailedStatus: DetailedOBDConnectionStatus = 'DESCONECTADO'
  private deviceName: string = 'OBDII'

  constructor(baudRate = 38400, reconnectAttempts = 3) {
    this.baudRate = baudRate
    this.reconnectAttempts = reconnectAttempts
  }

  getDetailedStatus(): DetailedOBDConnectionStatus {
    return this.detailedStatus
  }

  getDeviceName(): string {
    return this.deviceName
  }

  private setDetailedStatus(status: DetailedOBDConnectionStatus, message?: string) {
    this.detailedStatus = status
    techLogStore.addEntry({
      direction: status === 'FALHA' || status === 'ECU_NAO_RESPONDEU' ? 'ERR' : 'INFO',
      stage: 'STATUS',
      details: `[${status}] ${message || ''}`.trim(),
    })
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
    if (hasNativeBridge) {
      diagnosticMessage = 'Ponte nativa Android detectada (window.AndroidOBD / Capacitor).'
    } else if (canUseWebSerialRfcomm) {
      diagnosticMessage = isAndroid
        ? `Chrome Android ${chromeVersion} detectado: Web Serial ativa. Se o seletor informar "Nenhum dispositivo compatível encontrado", veja a ferramenta "Diag BT OBD" (/diagnostico-bluetooth).`
        : `Desktop Chromium ${chromeVersion || ''} detectado: suporte a Web Serial RFCOMM sobre Bluetooth Classic.`
    } else if (isAndroid) {
      diagnosticMessage = `Chrome Android ${chromeVersion || 'detectado'}: Web Serial RFCOMM não suportada ou navegador desatualizado. Recomenda-se Chrome 138+ ou ponte nativa Android.`
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

    techLogStore.addEntry({
      direction: 'INFO',
      stage: 'CONNECT_INIT',
      details: `Iniciando conexão. Android: ${env.isAndroid}, Chrome: ${env.chromeVersion}, WebSerial: ${env.isWebSerialAvailable}, NativeBridge: ${env.hasNativeBridge}`,
    })

    // 1. Tenta reabrir porta previamente concedida/autorizada (Reutilização de pareamento — Requisito 7)
    if (env.isWebSerialAvailable && (navigator as any).serial?.getPorts) {
      try {
        const ports = await (navigator as any).serial.getPorts()
        if (ports && ports.length > 0) {
          const reusedPort = ports[0]
          techLogStore.addEntry({
            direction: 'INFO',
            stage: 'REUSE_PORT',
            details: `Porta serial/Bluetooth previamente autorizada encontrada. Tentando reabertura rápida...`,
          })
          try {
            await reusedPort.open({
              baudRate: this.baudRate,
              dataBits: 8,
              stopBits: 1,
              parity: 'none',
              bufferSize: 4096,
            })
            this.port = reusedPort
            this.connected = false // Falso até validar a ECU
            this.activeMode = 'WEB_SERIAL_RFCOMM'
            this.setDetailedStatus(
              'ELM327_ENCONTRADO',
              'Porta Bluetooth reutilizada do pareamento salvo.',
            )

            await this.runElmInitSequence()
            this.connected = true
            this.setDetailedStatus(
              'VEICULO_CONECTADO',
              `Veículo conectado. Protocolo: ${this.detectedProtocol}`,
            )
            this.emit(
              'statusChange',
              'CONECTADO',
              `Conexão ELM327 Bluetooth Classic restabelecida. Protocolo: ${this.detectedProtocol}`,
            )
            return true
          } catch (reuseErr: any) {
            techLogStore.addEntry({
              direction: 'ERR',
              stage: 'REUSE_FAIL',
              details: `Falha ao reabrir porta salva: ${reuseErr?.message || reuseErr}. Abrindo seletor...`,
            })
            // Prossegue para o requestPort normal
          }
        }
      } catch (getPortsErr) {
        console.warn('Erro ao consultar getPorts():', getPortsErr)
      }
    }

    // 2. Se houver ponte nativa presente (window.AndroidOBD / Capacitor), prioriza ou faz fallback
    if (env.hasNativeBridge) {
      try {
        return await this.connectNativeBridge()
      } catch (bridgeErr) {
        if (!env.isWebSerialAvailable) throw bridgeErr
      }
    }

    // 3. Tenta Web Serial RFCOMM
    if (env.isWebSerialAvailable) {
      try {
        const ok = await this.connectWebSerialRfcomm()
        if (ok) {
          this.activeMode = 'WEB_SERIAL_RFCOMM'
          return true
        }
      } catch (err: any) {
        console.warn('Tentativa Web Serial RFCOMM falhou:', err?.message)
        if (env.hasNativeBridge) {
          return this.connectNativeBridge()
        }
        this.emit('statusChange', 'FALHA', err?.message || 'Falha na conexão Bluetooth Classic SPP')
        throw err
      }
    }

    // 4. Sem suporte
    const errMsg = env.diagnosticMessage || 'Bluetooth Classic SPP indisponível neste navegador.'
    this.setDetailedStatus('FALHA', errMsg)
    this.emit('statusChange', 'FALHA', errMsg)
    throw new Error(errMsg)
  }

  private async connectWebSerialRfcomm(): Promise<boolean> {
    this.setDetailedStatus('CONECTANDO_ELM327', 'Aguardando seleção do dispositivo OBDII...')
    this.emit(
      'statusChange',
      'CONECTANDO',
      'Selecione o adaptador ELM327 Bluetooth ("OBDII") pareado nas configurações...',
    )

    const serial = (navigator as any).serial
    if (!serial || !serial.requestPort) {
      throw new Error('API Web Serial não disponível neste navegador.')
    }

    try {
      techLogStore.addEntry({
        direction: 'INFO',
        stage: 'REQUEST_PORT',
        details: `Solicitando requestPort com allowedBluetoothServiceClassIds: [${BLUETOOTH_CLASSIC_SPP_UUID}]`,
      })

      // Solicita porta serial permitindo o UUID padrão SPP (RFCOMM)
      try {
        this.port = await serial.requestPort({
          allowedBluetoothServiceClassIds: [BLUETOOTH_CLASSIC_SPP_UUID],
        })
      } catch (filterErr: any) {
        techLogStore.addEntry({
          direction: 'ERR',
          stage: 'REQUEST_PORT_FILTER_ERR',
          details: `Filtro SPP recusado ou seletor rejeitado: ${filterErr?.message || filterErr}. Tentando requestPort sem opções...`,
        })
        // Fallback: se o navegador rejeitou com erro de opções (TypeError) tenta requestPort() comum
        if (filterErr?.name === 'TypeError') {
          this.port = await serial.requestPort()
        } else {
          throw filterErr
        }
      }

      if (!this.port) {
        this.setDetailedStatus(
          'DISPOSITIVO_NAO_PAREADO',
          'Nenhum dispositivo Bluetooth OBDII selecionado.',
        )
        throw new Error('Nenhum adaptador Bluetooth OBD-II selecionado.')
      }

      this.setDetailedStatus(
        'ELM327_ENCONTRADO',
        'Dispositivo OBDII selecionado. Abrindo canal RFCOMM...',
      )
      this.emit('statusChange', 'CONECTANDO', 'Abrindo canal RFCOMM SPP (38400 baud)...')

      await this.port.open({
        baudRate: this.baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 4096,
      })

      techLogStore.addEntry({
        direction: 'INFO',
        stage: 'PORT_OPEN',
        details: `Porta RFCOMM SPP aberta com sucesso a ${this.baudRate} bauds. Iniciando handshake ELM327...`,
      })

      this.setDetailedStatus('CONECTANDO_ELM327', 'Porta RFCOMM aberta. Inicializando ELM327...')

      // Executa sequência de inicialização ELM327 e validação de ECU
      await this.runElmInitSequence()

      // NUNCA marcar como VEÍCULO CONECTADO antes da validação completa do ELM e da ECU
      this.connected = true
      this.activeMode = 'WEB_SERIAL_RFCOMM'
      this.setDetailedStatus(
        'VEICULO_CONECTADO',
        `Veículo conectado. Protocolo: ${this.detectedProtocol}`,
      )

      this.emit(
        'statusChange',
        'CONECTADO',
        `Conexão ELM327 Bluetooth Classic ativa via Web Serial RFCOMM. Protocolo: ${this.detectedProtocol}`,
      )
      return true
    } catch (err: any) {
      this.connected = false
      this.port = null
      const msg = err?.message || 'Falha na conexão Bluetooth SPP'
      const errName = err?.name || ''
      if (
        errName === 'NotFoundError' ||
        msg.includes('No port selected') ||
        msg.includes('No device selected') ||
        msg.includes('cancelled') ||
        msg.includes('AbortError')
      ) {
        this.setDetailedStatus(
          'DISPOSITIVO_NAO_PAREADO',
          'Nenhum dispositivo selecionado no seletor nativo do sistema ou seletor cancelado.',
        )
      } else {
        this.setDetailedStatus('FALHA', msg)
      }
      throw err
    }
  }

  private async connectNativeBridge(): Promise<boolean> {
    this.setDetailedStatus('CONECTANDO_ELM327', 'Conectando via ponte nativa Android SPP...')
    this.emit('statusChange', 'CONECTANDO', 'Conectando via ponte nativa Android SPP...')
    this.nativeTransport = new AndroidNativeTransport()

    this.nativeTransport.on('statusChange', (st, msg) => {
      this.emit('statusChange', st, msg)
    })
    this.nativeTransport.on('data', (d) => this.emit('data', d))
    this.nativeTransport.on('error', (e) => this.emit('error', e))

    const ok = await this.nativeTransport.connect()
    if (ok) {
      this.activeMode = 'NATIVE_BRIDGE'
      await this.runElmInitSequence()
      this.connected = true
      this.setDetailedStatus('VEICULO_CONECTADO', `Veículo conectado via ponte nativa Android.`)
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
   * ATZ -> ATE0 -> ATL0 -> ATH0 -> ATS0 -> ATSP0 (ou protocolo específico Ford) -> confirmação de ECU (0100) -> RPM (010C)
   * NUNCA mostrar "Veículo conectado" se a ECU não responder.
   */
  private async runElmInitSequence(): Promise<void> {
    this.setDetailedStatus('CONECTANDO_ELM327', 'Enviando ATZ (Reset do adaptador)...')
    this.emit(
      'statusChange',
      'CONECTANDO',
      'Inicializando modem ELM327 Bluetooth (ATZ, ATE0, ATSP0)...',
    )

    // 1. Reset ATZ
    let atzResp = ''
    try {
      atzResp = await this.sendRaw('ATZ', 3500)
      await new Promise((r) => setTimeout(r, 400))
    } catch (e) {
      techLogStore.addEntry({
        direction: 'ERR',
        stage: 'ATZ_TIMEOUT',
        details: 'Timeout no ATZ. Tentando prosseguir com ATE0...',
      })
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
        await new Promise((r) => setTimeout(r, 80))
      } catch (e) {
        console.warn(`Comando ${item.cmd} (${item.desc}) ignorado ou timeout:`, e)
      }
    }

    this.setDetailedStatus(
      'ELM327_CONECTADO',
      `ELM327 respondeu handshake AT. Versão/ID: ${atzResp.replace(/[>\r\n]/g, '').trim() || 'ELM327'}`,
    )

    // 3. Confirmação de comunicação com a ECU via 0100
    this.setDetailedStatus('CONECTANDO_ELM327', 'Consultando PID 0100 para handshake com a ECU...')
    this.emit('statusChange', 'CONECTANDO', 'Confirmando comunicação com a ECU do motor...')
    let ecuResponded = false

    try {
      const resp0100 = await this.sendRaw('0100', 4500)
      const clean0100 = resp0100.replace(/[>\r\n]/g, '').trim()

      if (clean0100.includes('41 00') || clean0100.includes('4100')) {
        ecuResponded = true
      } else if (
        clean0100.includes('UNABLE TO CONNECT') ||
        clean0100.includes('BUS INIT: ERROR') ||
        clean0100.includes('NO DATA') ||
        clean0100.includes('ERROR')
      ) {
        // Tenta protocolo específico ISO 15765-4 CAN (11 bit / 500k) — comum no EcoSport Dragon
        techLogStore.addEntry({
          direction: 'INFO',
          stage: 'ECU_RETRY',
          details: `0100 retornou "${clean0100}". Forçando protocolo ATSP6 (CAN 11bit 500k Ford)...`,
        })
        try {
          await this.sendRaw('ATSP6', 2000)
          const respRetry = await this.sendRaw('0100', 4000)
          if (respRetry.includes('41 00') || respRetry.includes('4100')) {
            ecuResponded = true
          }
        } catch {
          /* continua */
        }
      }
    } catch (e: any) {
      techLogStore.addEntry({
        direction: 'ERR',
        stage: '0100_TIMEOUT',
        details: `Timeout ou erro na consulta 0100: ${e?.message || e}`,
      })
    }

    if (!ecuResponded) {
      this.setDetailedStatus(
        'ECU_NAO_RESPONDEU',
        'ELM327 conectado com sucesso, mas a ECU do veículo não respondeu (verifique se a ignição está ligada).',
      )
      // NUNCA declarar veículo conectado se a ECU não respondeu
      throw new Error(
        'ECU NÃO RESPONDEU: O adaptador ELM327 está conectado, mas a central do veículo não enviou resposta. Certifique-se de que a ignição está ligada.',
      )
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
    const startTime = performance.now()

    techLogStore.addEntry({
      direction: 'TX',
      command: cmd,
      stage: 'SEND',
    })

    if (this.activeMode === 'NATIVE_BRIDGE' && this.nativeTransport) {
      try {
        const res = await this.nativeTransport.send(cmd, timeoutMs)
        const latency = Math.round(performance.now() - startTime)
        techLogStore.addEntry({
          direction: 'RX',
          response: res,
          latencyMs: latency,
          stage: 'RECV_BRIDGE',
        })
        return res
      } catch (e: any) {
        const latency = Math.round(performance.now() - startTime)
        techLogStore.addEntry({
          direction: 'ERR',
          command: cmd,
          latencyMs: latency,
          details: e?.message || 'Erro envio bridge',
        })
        throw e
      }
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
      const latency = Math.round(performance.now() - startTime)
      techLogStore.addEntry({
        direction: 'RX',
        command: cmd,
        response: response.replace(/[>\r\n]/g, ' ').trim(),
        latencyMs: latency,
        stage: 'RECV_SERIAL',
      })

      this.emit('data', response)
      return response
    } catch (err: any) {
      const latency = Math.round(performance.now() - startTime)
      const isTimeout = err?.message === 'TIMEOUT_READ'
      techLogStore.addEntry({
        direction: 'ERR',
        command: cmd,
        latencyMs: latency,
        details: isTimeout
          ? 'TIMEOUT de leitura (sem prompt >)'
          : err?.message || 'Erro físico I/O',
      })

      if (isTimeout) {
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
