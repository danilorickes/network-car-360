import { OBDTransport, OBDTransportEvents } from './obd-transport'

export type SimulatorScenario = 'NORMAL' | 'ANOMALIA'

/**
 * SimulatedTransport: Gerador temporal realista de dados veiculares OBD-II.
 * Não utiliza valores estáticos nem regras engessadas no código:
 * Emula ciclo de condução completo (marcha lenta, aceleração, cruzeiro, desaceleração, parada).
 * No cenário com Anomalia: engloba falha de ignição (misfire P0301), oscilação de RPM e STFT anormal.
 * Possui gatilho para "Simular Perda de Comunicação" e "Reconexão".
 */
export class SimulatedTransport implements OBDTransport {
  readonly name = 'SimulatedTransport (Simulador Veicular Temporal)'
  private connected = false
  private scenario: SimulatorScenario = 'NORMAL'
  private listeners: { [K in keyof OBDTransportEvents]?: Set<OBDTransportEvents[K]> } = {}
  private startTime = 0
  private forcedDisconnect = false
  private droppedPacketsCount = 0

  // Parâmetros dinâmicos do motor simulado
  private rpm = 850
  private speed = 0
  private coolantTemp = 75 // esquenta até 90 °C
  private engineLoad = 22
  private throttle = 14
  private maf = 2.8
  private map = 35
  private voltage = 14.2
  private stft = 0
  private ltft = 1.2
  private sparkAdvance = 12
  private intakeAirTemp = 28
  private runTimeSeconds = 0

  constructor(scenario: SimulatorScenario = 'NORMAL') {
    this.scenario = scenario
  }

  setScenario(s: SimulatorScenario): void {
    this.scenario = s
  }

  getScenario(): SimulatorScenario {
    return this.scenario
  }

  isConnected(): boolean {
    return this.connected && !this.forcedDisconnect
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
          console.error('SimulatedTransport event err:', e)
        }
      })
    }
  }

  async connect(): Promise<boolean> {
    this.emit('statusChange', 'CONECTANDO', 'Inicializando simulador OBD-II...')
    await new Promise((r) => setTimeout(r, 200))

    // Simula sequência de inicialização AT
    this.connected = true
    this.forcedDisconnect = false
    this.startTime = Date.now()
    this.emit('statusChange', 'CONECTADO', 'Simulador pronto (cenário: ' + this.scenario + ')')
    return true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.emit('statusChange', 'DESCONECTADO', 'Simulador desconectado.')
  }

  /**
   * Força perda de comunicação para testar tratamento de falhas e resiliência
   */
  simulateCommunicationLoss(): void {
    this.forcedDisconnect = true
    this.emit(
      'statusChange',
      'FALHA',
      'SIMULAÇÃO: Perda de comunicação súbita com o adaptador OBD-II',
    )
  }

  /**
   * Restaura comunicação após perda simulada
   */
  simulateReconnect(): void {
    this.forcedDisconnect = false
    this.emit('statusChange', 'CONECTADO', 'Comunicação restaurada com sucesso.')
  }

  /**
   * Atualiza as grandezas físicas internas conforme o tempo decorrido e o cenário
   */
  private updatePhysics(): void {
    const elapsedSec = (Date.now() - this.startTime) / 1000
    this.runTimeSeconds = Math.floor(elapsedSec)

    // Aquecimento progressivo do motor
    if (this.coolantTemp < 92) {
      this.coolantTemp = Math.min(92, 75 + elapsedSec * 0.25)
    }

    // Ciclo temporal de condução (período de 45 segundos):
    // 0..8s: Marcha lenta no semáforo
    // 8..18s: Aceleração progressiva
    // 18..32s: Velocidade de cruzeiro (estrada / avenida)
    // 32..40s: Desaceleração / frenagem suave
    // 40..45s: Parada
    const cycleTime = elapsedSec % 45

    if (cycleTime < 8) {
      // Marcha lenta
      this.speed = 0
      this.throttle = 12 + Math.sin(elapsedSec * 2) * 0.8
      this.engineLoad = 20 + Math.random() * 2
      this.rpm = 820 + Math.sin(elapsedSec * 3) * 35
      this.map = 34 + Math.random() * 2
      this.maf = 2.4 + Math.random() * 0.2
    } else if (cycleTime < 18) {
      // Aceleração progressiva
      const progress = (cycleTime - 8) / 10
      this.speed = Math.min(75, progress * 75)
      this.throttle = 35 + progress * 25 + Math.random() * 3
      this.engineLoad = 45 + progress * 35
      this.rpm = 1200 + progress * 2400 + Math.sin(elapsedSec * 5) * 80
      this.map = 45 + progress * 40
      this.maf = 5.0 + progress * 18.0
    } else if (cycleTime < 32) {
      // Cruzeiro (~65-75 km/h)
      this.speed = 68 + Math.sin(elapsedSec * 0.5) * 4
      this.throttle = 26 + Math.random() * 2
      this.engineLoad = 38 + Math.random() * 4
      this.rpm = 2100 + Math.sin(elapsedSec * 1.5) * 90
      this.map = 50 + Math.random() * 3
      this.maf = 12.5 + Math.random() * 1.2
    } else if (cycleTime < 40) {
      // Desaceleração
      const progress = (cycleTime - 32) / 8
      this.speed = Math.max(0, 70 - progress * 70)
      this.throttle = 10
      this.engineLoad = 15
      this.rpm = Math.max(850, 2100 - progress * 1250)
      this.map = 28 + Math.random() * 2
      this.maf = 2.8 + Math.random() * 0.3
    } else {
      // Parada
      this.speed = 0
      this.throttle = 12
      this.engineLoad = 21
      this.rpm = 840 + Math.random() * 20
      this.map = 33
      this.maf = 2.3
    }

    // Cenário de Anomalia:
    // A partir de 15 segundos ou periodicamente, simula trepidação / falha no cilindro
    if (this.scenario === 'ANOMALIA' && elapsedSec > 12) {
      // Oscilação brusca de RPM (misfire)
      const misfireFlutter = Math.sin(elapsedSec * 18) * 160
      this.rpm = Math.max(650, this.rpm + misfireFlutter)
      // STFT tenta compensar misturando combustível (trim positivo elevado)
      this.stft = 14.8 + Math.sin(elapsedSec * 4) * 5.2
      this.ltft = 8.5
    } else {
      this.stft = Math.sin(elapsedSec * 0.8) * 2.5
      this.ltft = 1.2
    }

    this.voltage = 14.1 + Math.sin(elapsedSec * 0.2) * 0.15
    this.sparkAdvance = Math.max(5, Math.min(38, 10 + this.rpm / 200 - this.engineLoad / 10))
    this.intakeAirTemp = 28 + Math.sin(elapsedSec * 0.05) * 2
  }

  async send(cmd: string): Promise<string> {
    if (!this.connected || this.forcedDisconnect) {
      throw new Error('SEM COMUNICAÇÃO: Adaptador desconectado ou sinal perdido.')
    }

    // Pequeno atraso realista de barramento CAN (15 a 35ms)
    await new Promise((r) => setTimeout(r, 18 + Math.random() * 15))

    const trimmed = cmd.trim().toUpperCase()

    // Comandos AT ELM327
    if (trimmed === 'ATZ') return 'ELM327 v1.5\r\n>'
    if (trimmed === 'ATE0' || trimmed === 'ATL0' || trimmed === 'ATH0' || trimmed === 'ATS0')
      return 'OK\r\n>'
    if (trimmed === 'ATSP0') return 'OK\r\n>'
    if (trimmed === 'ATDP') return 'ISO 15765-4 (CAN 11/500)\r\n>'
    if (trimmed === '0100') {
      // PIDs 01-20 suportados: bitmask indicando RPM, velocidade, temp, load, etc.
      // Retorna 41 00 BE 3F B8 11
      return '41 00 BE 3F B8 11\r\n>'
    }
    if (trimmed === '0120') {
      // PIDs 21-40: bitmask
      return '41 20 80 00 00 01\r\n>'
    }
    if (trimmed === '0140') {
      // PIDs 41-60: PID 0x42 (tensão)
      return '41 40 40 00 00 00\r\n>'
    }

    // Leitura de DTCs
    if (trimmed === '03' || trimmed === '07') {
      if (this.scenario === 'ANOMALIA') {
        // Retorna P0301 (Cylinder 1 Misfire Detected)
        // 43 01 03 01 00 00
        return '43 01 03 01 00 00\r\n>'
      } else {
        // Sem falhas
        return '43 00 00 00 00 00\r\n>'
      }
    }

    // Leitura Modo 01 (PIDs de telemetria)
    if (trimmed.startsWith('01')) {
      this.updatePhysics()
      const pidHex = trimmed.slice(2, 4)

      switch (pidHex) {
        case '0C': {
          // RPM: (A * 256 + B) / 4 = rpm -> (rpm * 4) = A * 256 + B
          const rawVal = Math.round(this.rpm * 4)
          const A = (rawVal >> 8) & 0xff
          const B = rawVal & 0xff
          return `41 0C ${A.toString(16).padStart(2, '0').toUpperCase()} ${B.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0D': {
          // Velocidade: 1 byte km/h
          const raw = Math.round(Math.max(0, Math.min(255, this.speed)))
          return `41 0D ${raw.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '05': {
          // Temp coolant: A - 40 = temp -> A = temp + 40
          const A = Math.round(this.coolantTemp + 40)
          return `41 05 ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '04': {
          // Carga calculada: (A * 100) / 255 -> A = (load * 255) / 100
          const A = Math.round((this.engineLoad * 255) / 100)
          return `41 04 ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '11': {
          // Posição do acelerador: (A * 100) / 255
          const A = Math.round((this.throttle * 255) / 100)
          return `41 11 ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '10': {
          // MAF: (A * 256 + B) / 100
          const raw = Math.round(this.maf * 100)
          const A = (raw >> 8) & 0xff
          const B = raw & 0xff
          return `41 10 ${A.toString(16).padStart(2, '0').toUpperCase()} ${B.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0B': {
          // MAP: 1 byte kPa
          const A = Math.round(this.map)
          return `41 0B ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '42': {
          // Tensão: (A * 256 + B) / 1000
          const raw = Math.round(this.voltage * 1000)
          const A = (raw >> 8) & 0xff
          const B = raw & 0xff
          return `41 42 ${A.toString(16).padStart(2, '0').toUpperCase()} ${B.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '06': {
          // STFT: (A - 128) * 100 / 128 -> A = (stft * 128 / 100) + 128
          const A = Math.round((this.stft * 128) / 100 + 128)
          return `41 06 ${Math.max(0, Math.min(255, A)).toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '07': {
          // LTFT: (A - 128) * 100 / 128
          const A = Math.round((this.ltft * 128) / 100 + 128)
          return `41 07 ${Math.max(0, Math.min(255, A)).toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0E': {
          // Avanço: (A / 2) - 64 -> A = (adv + 64) * 2
          const A = Math.round((this.sparkAdvance + 64) * 2)
          return `41 0E ${Math.max(0, Math.min(255, A)).toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0F': {
          // Temp admissão: A - 40
          const A = Math.round(this.intakeAirTemp + 40)
          return `41 0F ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '1F': {
          // Run time: A * 256 + B
          const A = (this.runTimeSeconds >> 8) & 0xff
          const B = this.runTimeSeconds & 0xff
          return `41 1F ${A.toString(16).padStart(2, '0').toUpperCase()} ${B.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        default:
          return 'NO DATA\r\n>'
      }
    }

    return 'OK\r\n>'
  }
}
