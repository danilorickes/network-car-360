import { OBDTransport, OBDTransportEvents } from './obd-transport'

export type SimulatorScenario =
  | 'NORMAL'
  | 'PERDA_POTENCIA'
  | 'OSCILACAO'
  | 'TREPIDACAO_FALHA'
  | 'APAGAMENTO'
  | 'DTC_ATIVO'
  | 'PERDA_COMUNICACAO'
  | 'ANOMALIA' // Retrocompatibilidade

export interface ScenarioMetadata {
  id: SimulatorScenario
  name: string
  description: string
  dtcExpected?: string
  expectedSymptomType?: string
}

export const SIMULATOR_SCENARIOS: ScenarioMetadata[] = [
  {
    id: 'NORMAL',
    name: 'Funcionamento Normal',
    description:
      'Ciclo completo de condução (marcha lenta, aceleração, cruzeiro, desaceleração) sem falhas.',
  },
  {
    id: 'PERDA_POTENCIA',
    name: 'Perda de Potência',
    description:
      'Acelerador aberto (TPS alto), mas RPM e carga caem acentuadamente após subida de regime.',
    expectedSymptomType: 'perda de potência',
  },
  {
    id: 'OSCILACAO',
    name: 'Oscilação de Marcha Lenta',
    description: 'RPM oscilando com amplitude de ±250 RPM e variação brusca de MAP e STFT.',
    expectedSymptomType: 'oscilação',
  },
  {
    id: 'TREPIDACAO_FALHA',
    name: 'Trepidação / Falha de Ignição (Misfire)',
    description:
      'Misfire no cilindro 1 sob aceleração com flutter de RPM, STFT positivo e DTC P0301.',
    dtcExpected: 'P0301',
    expectedSymptomType: 'trepidação',
  },
  {
    id: 'APAGAMENTO',
    name: 'Apagamento Súbito do Motor',
    description:
      'Queda drástica de RPM para 0 após desaceleração, simulando estol ou corte de combustível.',
    expectedSymptomType: 'apagamento',
  },
  {
    id: 'DTC_ATIVO',
    name: 'DTC Associado (Mistura Pobre P0171 + MIL)',
    description: 'Lâmpada MIL acesa, STFT > +22% e código P0171 ativo no Modo 03/07.',
    dtcExpected: 'P0171',
    expectedSymptomType: 'falha',
  },
  {
    id: 'PERDA_COMUNICACAO',
    name: 'Perda Temporária de Comunicação',
    description:
      'Gera queda periódica de pacotes e timeout de comunicação OBD-II para teste de resiliência.',
    expectedSymptomType: 'ruído',
  },
]

/**
 * SimulatedTransport: Gerador temporal dinâmico e realista de telemetria OBD-II.
 * Atende plenamente ao Requisito 8 da OS-ME001-E2.
 */
export class SimulatedTransport implements OBDTransport {
  readonly name = 'SimulatedTransport (Simulador Veicular Multicenário)'
  private connected = false
  private scenario: SimulatorScenario = 'NORMAL'
  private listeners: { [K in keyof OBDTransportEvents]?: Set<OBDTransportEvents[K]> } = {}
  private startTime = 0
  private forcedDisconnect = false
  private simulatedVin = '9BFBJ55E6L8104921'
  private simulatedProtocol = 'ISO 15765-4 (CAN 11/500)'

  // Parâmetros dinâmicos do motor simulado
  private rpm = 850
  private speed = 0
  private coolantTemp = 78
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

  setVin(vin: string): void {
    this.simulatedVin = vin
  }

  getVin(): string {
    return this.simulatedVin
  }

  getProtocol(): string {
    return this.simulatedProtocol
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
    await new Promise((r) => setTimeout(r, 180))

    this.connected = true
    this.forcedDisconnect = false
    this.startTime = Date.now()
    this.emit('statusChange', 'CONECTADO', `Simulador conectado (Cenário: ${this.scenario})`)
    return true
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.emit('statusChange', 'DESCONECTADO', 'Simulador desconectado.')
  }

  simulateCommunicationLoss(): void {
    this.forcedDisconnect = true
    this.emit(
      'statusChange',
      'FALHA',
      'SIMULAÇÃO: Perda de comunicação súbita com o adaptador OBD-II',
    )
  }

  simulateReconnect(): void {
    this.forcedDisconnect = false
    this.emit('statusChange', 'CONECTADO', 'Comunicação restaurada com sucesso.')
  }

  /**
   * Atualização das grandezas físicas conforme o cenário ativo
   */
  private updatePhysics(): void {
    const elapsedSec = (Date.now() - this.startTime) / 1000
    this.runTimeSeconds = Math.floor(elapsedSec)

    if (this.coolantTemp < 92) {
      this.coolantTemp = Math.min(92, 75 + elapsedSec * 0.25)
    }

    const cycleTime = elapsedSec % 45

    // Base de condução
    if (cycleTime < 8) {
      this.speed = 0
      this.throttle = 12 + Math.sin(elapsedSec * 2) * 0.8
      this.engineLoad = 20 + Math.random() * 2
      this.rpm = 820 + Math.sin(elapsedSec * 3) * 35
      this.map = 34 + Math.random() * 2
      this.maf = 2.4 + Math.random() * 0.2
    } else if (cycleTime < 18) {
      const progress = (cycleTime - 8) / 10
      this.speed = Math.min(75, progress * 75)
      this.throttle = 35 + progress * 25 + Math.random() * 3
      this.engineLoad = 45 + progress * 35
      this.rpm = 1200 + progress * 2400 + Math.sin(elapsedSec * 5) * 80
      this.map = 45 + progress * 40
      this.maf = 5.0 + progress * 18.0
    } else if (cycleTime < 32) {
      this.speed = 68 + Math.sin(elapsedSec * 0.5) * 4
      this.throttle = 26 + Math.random() * 2
      this.engineLoad = 38 + Math.random() * 4
      this.rpm = 2100 + Math.sin(elapsedSec * 1.5) * 90
      this.map = 50 + Math.random() * 3
      this.maf = 12.5 + Math.random() * 1.2
    } else if (cycleTime < 40) {
      const progress = (cycleTime - 32) / 8
      this.speed = Math.max(0, 70 - progress * 70)
      this.throttle = 10
      this.engineLoad = 15
      this.rpm = Math.max(850, 2100 - progress * 1250)
      this.map = 28 + Math.random() * 2
      this.maf = 2.8 + Math.random() * 0.3
    } else {
      this.speed = 0
      this.throttle = 12
      this.engineLoad = 21
      this.rpm = 840 + Math.random() * 20
      this.map = 33
      this.maf = 2.3
    }

    this.voltage = 14.1 + Math.sin(elapsedSec * 0.2) * 0.15
    this.sparkAdvance = Math.max(5, Math.min(38, 10 + this.rpm / 200 - this.engineLoad / 10))
    this.intakeAirTemp = 28 + Math.sin(elapsedSec * 0.05) * 2
    this.stft = Math.sin(elapsedSec * 0.8) * 2.5
    this.ltft = 1.2

    // Efeitos específicos de cada cenário:
    switch (this.scenario) {
      case 'PERDA_POTENCIA':
        // Acelerador sobe mas RPM despenca e carga cai drasticamente
        if (cycleTime > 12 && cycleTime < 24) {
          this.throttle = 78 // Pé no fundo
          this.rpm = Math.max(900, 2800 - (cycleTime - 12) * 160) // RPM caindo
          this.engineLoad = Math.max(18, 70 - (cycleTime - 12) * 4)
          this.speed = Math.max(20, this.speed - (cycleTime - 12) * 3)
          this.map = 75
        }
        break

      case 'OSCILACAO':
        // Oscilação periódica de RPM e MAP
        {
          const wave = Math.sin(elapsedSec * 4) * 280
          this.rpm = Math.max(600, this.rpm + wave)
          this.map = Math.max(25, this.map + Math.sin(elapsedSec * 4) * 14)
          this.stft = Math.sin(elapsedSec * 3) * 12
        }
        break

      case 'TREPIDACAO_FALHA':
      case 'ANOMALIA':
        // Misfire com flutter de rotação e trim positivo elevado
        if (elapsedSec > 8) {
          const misfireFlutter = Math.sin(elapsedSec * 18) * 180
          this.rpm = Math.max(620, this.rpm + misfireFlutter)
          this.stft = 15.2 + Math.sin(elapsedSec * 4) * 5.5
          this.ltft = 8.5
        }
        break

      case 'APAGAMENTO':
        // Após 15s de condução, apaga o motor
        if (elapsedSec > 14) {
          this.rpm = 0
          this.speed = Math.max(0, this.speed - (elapsedSec - 14) * 8)
          this.throttle = 10
          this.engineLoad = 0
          this.voltage = 12.1 // Queda da tensão para nível de bateria desligada
          this.maf = 0
          this.map = 100 // Pressão atmosférica (motor parado)
        }
        break

      case 'DTC_ATIVO':
        // Mistura excessivamente pobre (STFT muito alto)
        this.stft = 24.5 + Math.sin(elapsedSec * 2) * 3.2
        this.ltft = 18.0
        break

      case 'PERDA_COMUNICACAO':
        // A cada ciclo, perde temporariamente a comunicação
        break

      default:
        break
    }
  }

  async send(cmd: string): Promise<string> {
    if (!this.connected || this.forcedDisconnect) {
      throw new Error('SEM COMUNICAÇÃO: Adaptador desconectado ou sinal perdido.')
    }

    // Se estiver no cenário PERDA_COMUNICACAO, falha periodicamente
    if (this.scenario === 'PERDA_COMUNICACAO') {
      const elapsed = (Date.now() - this.startTime) / 1000
      if (Math.floor(elapsed) % 12 >= 8) {
        throw new Error('TIMEOUT: Nenhuma resposta da ECU (Perda Temporária de Comunicação).')
      }
    }

    // Atraso realista de barramento
    await new Promise((r) => setTimeout(r, 14 + Math.random() * 12))

    const trimmed = cmd.trim().toUpperCase()

    // Comandos AT ELM327
    if (trimmed === 'ATZ') return 'ELM327 v1.5\r\n>'
    if (trimmed === 'ATE0' || trimmed === 'ATL0' || trimmed === 'ATH0' || trimmed === 'ATS0')
      return 'OK\r\n>'
    if (trimmed === 'ATSP0') return 'OK\r\n>'
    if (trimmed === 'ATDP') return `${this.simulatedProtocol}\r\n>`

    // Modo 09 PID 02: Leitura do VIN
    if (trimmed === '0902') {
      // Formato OBD-II Modo 09 PID 02 (VIN ASCII): 49 02 ...
      // Para simulação limpa, devolve o VIN codificado ou representação ELM
      return `49 02 01 ${this.simulatedVin}\r\n>`
    }

    // Modo 01 PID 00 (Bitmap 01-20)
    if (trimmed === '0100') {
      return '41 00 BE 3F B8 11\r\n>'
    }
    // Modo 01 PID 20 (Bitmap 21-40)
    if (trimmed === '0120') {
      return '41 20 80 00 00 01\r\n>'
    }
    // Modo 01 PID 40 (Bitmap 41-60)
    if (trimmed === '0140') {
      return '41 40 40 00 00 00\r\n>'
    }

    // Modo 01 PID 01 (Status do MIL e DTCs armazenados)
    if (trimmed === '0101') {
      const milActive =
        this.scenario === 'TREPIDACAO_FALHA' ||
        this.scenario === 'ANOMALIA' ||
        this.scenario === 'DTC_ATIVO'
      // Byte A bit 7 = MIL ON/OFF. 0x81 = MIL ON + 1 DTC; 0x00 = MIL OFF
      return milActive ? '41 01 81 07 65 04\r\n>' : '41 01 00 07 65 04\r\n>'
    }

    // Leitura de DTCs Modo 03 / Modo 07
    if (trimmed === '03' || trimmed === '07') {
      if (this.scenario === 'TREPIDACAO_FALHA' || this.scenario === 'ANOMALIA') {
        // P0301 (Cylinder 1 Misfire)
        return '43 01 03 01 00 00\r\n>'
      } else if (this.scenario === 'DTC_ATIVO') {
        // P0171 (System Too Lean Bank 1)
        return '43 01 01 71 00 00\r\n>'
      } else if (this.scenario === 'PERDA_POTENCIA') {
        // P0299 (Turbocharger Underboost)
        return '43 01 02 99 00 00\r\n>'
      } else {
        return '43 00 00 00 00 00\r\n>'
      }
    }

    // Leitura de telemetria Modo 01
    if (trimmed.startsWith('01')) {
      this.updatePhysics()
      const pidHex = trimmed.slice(2, 4)

      switch (pidHex) {
        case '0C': {
          // RPM
          const rawVal = Math.round(this.rpm * 4)
          const A = (rawVal >> 8) & 0xff
          const B = rawVal & 0xff
          return `41 0C ${A.toString(16).padStart(2, '0').toUpperCase()} ${B.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0D': {
          // Velocidade
          const raw = Math.round(Math.max(0, Math.min(255, this.speed)))
          return `41 0D ${raw.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '05': {
          // Temp coolant
          const A = Math.round(this.coolantTemp + 40)
          return `41 05 ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '04': {
          // Carga calculada
          const A = Math.round((this.engineLoad * 255) / 100)
          return `41 04 ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '11': {
          // TPS
          const A = Math.round((this.throttle * 255) / 100)
          return `41 11 ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '10': {
          // MAF
          const raw = Math.round(this.maf * 100)
          const A = (raw >> 8) & 0xff
          const B = raw & 0xff
          return `41 10 ${A.toString(16).padStart(2, '0').toUpperCase()} ${B.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0B': {
          // MAP
          const A = Math.round(this.map)
          return `41 0B ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '42': {
          // Tensão
          const raw = Math.round(this.voltage * 1000)
          const A = (raw >> 8) & 0xff
          const B = raw & 0xff
          return `41 42 ${A.toString(16).padStart(2, '0').toUpperCase()} ${B.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '06': {
          // STFT
          const A = Math.round((this.stft * 128) / 100 + 128)
          return `41 06 ${Math.max(0, Math.min(255, A)).toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '07': {
          // LTFT
          const A = Math.round((this.ltft * 128) / 100 + 128)
          return `41 07 ${Math.max(0, Math.min(255, A)).toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0E': {
          // Avanço
          const A = Math.round((this.sparkAdvance + 64) * 2)
          return `41 0E ${Math.max(0, Math.min(255, A)).toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '0F': {
          // Temp admissão
          const A = Math.round(this.intakeAirTemp + 40)
          return `41 0F ${A.toString(16).padStart(2, '0').toUpperCase()}\r\n>`
        }
        case '1F': {
          // Run time
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
