export type SampleQuality = 'OK' | 'TIMEOUT' | 'UNSUPPORTED' | 'INVALID' | 'NO_RESPONSE'

export type EventType =
  | 'falha'
  | 'trepidação'
  | 'perda de potência'
  | 'ruído'
  | 'oscilação'
  | 'apagamento'
  | 'outro/livre'

export type SessionStatus = 'ATIVO' | 'ENCERRADO' | 'INTERROMPIDO'
export type AdapterType = 'SIMULADOR' | 'OBD REAL'
export type DtcStatus = 'ATIVO' | 'PENDENTE'

export interface PidDefinition {
  pid: string // e.g. "0x0C"
  mode: string // e.g. "01"
  name: string // e.g. "RPM do Motor"
  shortName: string // e.g. "RPM"
  bytesCount: number
  unit: string
  min: number
  max: number
  isPriority: boolean // >=5 Hz if true, else >=1 Hz
  decode: (bytes: number[]) => number
  format: (value: number) => string
}

export interface RawSampleModel {
  id?: string
  sample_id: string
  session?: string
  session_id: string
  ts_utc: string
  ts_mono_offset_ms: number
  pid: string
  raw_value?: number
  decoded_value?: number
  unit?: string
  quality: SampleQuality
}

export interface SessionModel {
  id?: string
  session_id: string
  vehicle_name?: string
  adapter_type: AdapterType
  transport_detail?: string
  vin?: string
  protocol?: string
  pids_found?: string[]
  started_at: string
  ended_at?: string
  status: SessionStatus
  created?: string
}

export interface EventModel {
  id?: string
  event_id: string
  session?: string
  session_id: string
  event_type: EventType
  description?: string
  ts_utc: string
  ts_mono_offset_ms: number
  window_pre_ms: number
  window_post_ms: number
}

export interface DtcModel {
  id?: string
  session?: string
  session_id: string
  dtc_code: string
  status: DtcStatus
  mil_on: boolean
  read_at_utc: string
}

export interface AppConfig {
  baudRate: number
  serialPort: string
  reconnectAttempts: number
  priorityFreqHz: number
  secondaryFreqHz: number
  windowPreMs: number
  windowPostMs: number
  dtcIntervalMs: number
  simulatorIdleRpm: number
  simulatorCruiseRpm: number
  defaultVehicleName: string
}

export interface TelemetryState {
  currentValues: Record<
    string,
    {
      decoded?: number
      raw?: number
      unit?: string
      quality: SampleQuality
      lastUpdatedUtc: string
      sparkline: number[]
    }
  >
  connectionState: 'DESCONECTADO' | 'CONECTANDO' | 'CONECTADO' | 'RECONECTANDO' | 'FALHA'
  transportType: AdapterType
  sessionState: 'IDLE' | 'TESTE ATIVO' | 'ENCERRADO'
  activeSessionId?: string
  sessionStartTime?: number // monotonic
  durationMs: number
  effectiveFreqHz: number
  targetFreqHz: number
  totalSamples: number
  totalEvents: number
  dtcList: DtcModel[]
  milOn: boolean
  discoveredPids: string[]
  lastError?: string
}
