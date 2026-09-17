import { PidDefinition } from '../types/obd'

/**
 * Tabela Declarativa e Extensível de PIDs OBD-II (SAE J1979 / ISO 15031-5).
 * Nenhuma regra fixa de veículo no código.
 * Fórmulas padrão OBD-II normalizadas.
 */
export const PID_DEFINITIONS: Record<string, PidDefinition> = {
  '0x0C': {
    pid: '0x0C',
    mode: '01',
    name: 'Rotação do Motor',
    shortName: 'RPM',
    bytesCount: 2,
    unit: 'RPM',
    min: 0,
    max: 16383.75,
    isPriority: true,
    decode: (bytes: number[]) => {
      const [A, B] = bytes
      return Math.round(((A * 256 + B) / 4) * 10) / 10
    },
    format: (v: number) => Math.round(v).toLocaleString('pt-BR'),
  },
  '0x0D': {
    pid: '0x0D',
    mode: '01',
    name: 'Velocidade do Veículo',
    shortName: 'Velocidade',
    bytesCount: 1,
    unit: 'km/h',
    min: 0,
    max: 255,
    isPriority: true,
    decode: (bytes: number[]) => bytes[0],
    format: (v: number) => Math.round(v).toString(),
  },
  '0x05': {
    pid: '0x05',
    mode: '01',
    name: 'Temp. Líquido Arrefecimento',
    shortName: 'Temp. Arrefecimento',
    bytesCount: 1,
    unit: '°C',
    min: -40,
    max: 215,
    isPriority: true,
    decode: (bytes: number[]) => bytes[0] - 40,
    format: (v: number) => `${Math.round(v)} °C`,
  },
  '0x04': {
    pid: '0x04',
    mode: '01',
    name: 'Carga Calculada do Motor',
    shortName: 'Carga do Motor',
    bytesCount: 1,
    unit: '%',
    min: 0,
    max: 100,
    isPriority: true,
    decode: (bytes: number[]) => Math.round(((bytes[0] * 100) / 255) * 10) / 10,
    format: (v: number) => `${v.toFixed(1)}%`,
  },
  '0x11': {
    pid: '0x11',
    mode: '01',
    name: 'Posição do Acelerador (TPS)',
    shortName: 'Acelerador',
    bytesCount: 1,
    unit: '%',
    min: 0,
    max: 100,
    isPriority: true,
    decode: (bytes: number[]) => Math.round(((bytes[0] * 100) / 255) * 10) / 10,
    format: (v: number) => `${v.toFixed(1)}%`,
  },
  '0x10': {
    pid: '0x10',
    mode: '01',
    name: 'Fluxo de Massa de Ar (MAF)',
    shortName: 'MAF',
    bytesCount: 2,
    unit: 'g/s',
    min: 0,
    max: 655.35,
    isPriority: false,
    decode: (bytes: number[]) => {
      const [A, B] = bytes
      return Math.round(((A * 256 + B) / 100) * 100) / 100
    },
    format: (v: number) => `${v.toFixed(2)} g/s`,
  },
  '0x0B': {
    pid: '0x0B',
    mode: '01',
    name: 'Pressão Absoluta no Coletor (MAP)',
    shortName: 'MAP',
    bytesCount: 1,
    unit: 'kPa',
    min: 0,
    max: 255,
    isPriority: false,
    decode: (bytes: number[]) => bytes[0],
    format: (v: number) => `${v} kPa`,
  },
  '0x42': {
    pid: '0x42',
    mode: '01',
    name: 'Tensão do Módulo de Controle',
    shortName: 'Tensão Bateria/ECU',
    bytesCount: 2,
    unit: 'V',
    min: 0,
    max: 65.535,
    isPriority: false,
    decode: (bytes: number[]) => {
      const [A, B] = bytes
      return Math.round(((A * 256 + B) / 1000) * 100) / 100
    },
    format: (v: number) => `${v.toFixed(2)} V`,
  },
  '0x06': {
    pid: '0x06',
    mode: '01',
    name: 'Ajuste Combustível Curto Prazo (STFT Banco 1)',
    shortName: 'STFT',
    bytesCount: 1,
    unit: '%',
    min: -100,
    max: 99.2,
    isPriority: false,
    decode: (bytes: number[]) => Math.round((((bytes[0] - 128) * 100) / 128) * 10) / 10,
    format: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  },
  '0x07': {
    pid: '0x07',
    mode: '01',
    name: 'Ajuste Combustível Longo Prazo (LTFT Banco 1)',
    shortName: 'LTFT',
    bytesCount: 1,
    unit: '%',
    min: -100,
    max: 99.2,
    isPriority: false,
    decode: (bytes: number[]) => Math.round((((bytes[0] - 128) * 100) / 128) * 10) / 10,
    format: (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`,
  },
  '0x0E': {
    pid: '0x0E',
    mode: '01',
    name: 'Avanço de Ignição (Cilindro 1)',
    shortName: 'Avanço Ignição',
    bytesCount: 1,
    unit: '°',
    min: -64,
    max: 63.5,
    isPriority: false,
    decode: (bytes: number[]) => Math.round((bytes[0] / 2 - 64) * 10) / 10,
    format: (v: number) => `${v.toFixed(1)}°`,
  },
  '0x0F': {
    pid: '0x0F',
    mode: '01',
    name: 'Temp. do Ar de Admissão (IAT)',
    shortName: 'Temp. Ar Admissão',
    bytesCount: 1,
    unit: '°C',
    min: -40,
    max: 215,
    isPriority: false,
    decode: (bytes: number[]) => bytes[0] - 40,
    format: (v: number) => `${Math.round(v)} °C`,
  },
  '0x1F': {
    pid: '0x1F',
    mode: '01',
    name: 'Tempo com Motor em Funcionamento',
    shortName: 'Tempo Motor',
    bytesCount: 2,
    unit: 's',
    min: 0,
    max: 65535,
    isPriority: false,
    decode: (bytes: number[]) => {
      const [A, B] = bytes
      return A * 256 + B
    },
    format: (v: number) => {
      const mins = Math.floor(v / 60)
      const secs = Math.floor(v % 60)
      return `${mins}m ${secs}s`
    },
  },
  '0x14': {
    pid: '0x14',
    mode: '01',
    name: 'Sensor O2 / Lambda (Banco 1, Sensor 1)',
    shortName: 'O2 B1S1 (Tensão)',
    bytesCount: 2,
    unit: 'V',
    min: 0,
    max: 1.275,
    isPriority: false,
    decode: (bytes: number[]) => {
      // Byte A: Tensão da Sonda = A / 200 (em Volts)
      // Byte B: STFT correspondente = (B - 128) * 100 / 128 (%)
      const A = bytes[0]
      return Math.round((A / 200) * 1000) / 1000
    },
    format: (v: number) => `${v.toFixed(3)} V`,
  },
  '0x24': {
    pid: '0x24',
    mode: '01',
    name: 'Sensor Lambda Banda Larga (Razão de Equivalência)',
    shortName: 'Lambda / O2',
    bytesCount: 4,
    unit: 'λ',
    min: 0,
    max: 2,
    isPriority: false,
    decode: (bytes: number[]) => {
      // Razão de equivalência Lambda = ((A * 256) + B) * 2 / 65536
      const [A, B] = bytes
      const lambda = ((A * 256 + B) * 2) / 65535
      return Math.round(lambda * 1000) / 1000
    },
    format: (v: number) => `λ ${v.toFixed(3)}`,
  },
  '0x00': {
    pid: '0x00',
    mode: '01',
    name: 'PIDs Suportados [01-20]',
    shortName: 'Suporte PIDs 01-20',
    bytesCount: 4,
    unit: 'bitmap',
    min: 0,
    max: 0xffffffff,
    isPriority: false,
    decode: (bytes: number[]) => (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
    format: (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
  },
  '0x20': {
    pid: '0x20',
    mode: '01',
    name: 'PIDs Suportados [21-40]',
    shortName: 'Suporte PIDs 21-40',
    bytesCount: 4,
    unit: 'bitmap',
    min: 0,
    max: 0xffffffff,
    isPriority: false,
    decode: (bytes: number[]) => (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
    format: (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
  },
  '0x40': {
    pid: '0x40',
    mode: '01',
    name: 'PIDs Suportados [41-60]',
    shortName: 'Suporte PIDs 41-60',
    bytesCount: 4,
    unit: 'bitmap',
    min: 0,
    max: 0xffffffff,
    isPriority: false,
    decode: (bytes: number[]) => (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
    format: (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
  },
  '0x60': {
    pid: '0x60',
    mode: '01',
    name: 'PIDs Suportados [61-80]',
    shortName: 'Suporte PIDs 61-80',
    bytesCount: 4,
    unit: 'bitmap',
    min: 0,
    max: 0xffffffff,
    isPriority: false,
    decode: (bytes: number[]) => (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
    format: (v: number) => `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`,
  },
  '0x01': {
    pid: '0x01',
    mode: '01',
    name: 'Status dos Monitores & Luz da Injeção (MIL)',
    shortName: 'Status MIL / Monitores',
    bytesCount: 4,
    unit: 'flags',
    min: 0,
    max: 0xffffffff,
    isPriority: false,
    decode: (bytes: number[]) => (bytes[0] & 0x80 ? 1 : 0),
    format: (v: number) => (v === 1 ? 'MIL ACESA' : 'MIL APAGADA'),
  },
}
export class PidDecoder {
  /**
   * Decodifica bytes brutos para o valor físico correspondente
   */
  static decodePid(pidHex: string, bytes: number[]): { decoded: number; unit: string } | null {
    const normalizedPid = pidHex.toUpperCase().startsWith('0X')
      ? pidHex.toUpperCase()
      : `0X${pidHex.toUpperCase()}`
    const def = PID_DEFINITIONS[normalizedPid]
    if (!def) return null
    if (bytes.length < def.bytesCount) return null

    try {
      const decoded = def.decode(bytes.slice(0, def.bytesCount))
      return { decoded, unit: def.unit }
    } catch {
      return null
    }
  }

  /**
   * Converte máscara binária de PID 00, 20, 40 etc. em lista de PIDs suportados
   */
  static parseSupportedPidsBitmap(baseOffset: number, bytes: number[]): string[] {
    const supported: string[] = []
    if (bytes.length < 4) return supported

    for (let byteIdx = 0; byteIdx < 4; byteIdx++) {
      const b = bytes[byteIdx]
      for (let bit = 7; bit >= 0; bit--) {
        const isSupported = (b & (1 << bit)) !== 0
        if (isSupported) {
          const pidNum = baseOffset + byteIdx * 8 + (7 - bit) + 1
          const pidHex = `0x${pidNum.toString(16).toUpperCase().padStart(2, '0')}`
          supported.push(pidHex)
        }
      }
    }
    return supported
  }
}
