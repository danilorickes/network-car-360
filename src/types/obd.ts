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
export type AdapterType = 'SIMULADOR' | 'OBD REAL' | 'OBD REAL BLUETOOTH'
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

export interface VehicleModel {
  id?: string
  plate: string
  make: string
  model: string
  version?: string
  year_model?: string
  engine?: string
  fuel?: string
  transmission?: string
  odometer_km?: number
  vin?: string
  notes?: string
  created?: string
  updated?: string
}

export interface ObdCapabilityModel {
  id?: string
  vehicle?: string
  protocol_detected: string
  adapter_type: string
  adapter_name?: string
  pids_supported: string[]
  pids_unavailable: string[]
  vin_supported: boolean
  vin_read?: string
  mil_initial_state: boolean
  dtcs_present: string[]
  raw_discovery_log?: Record<string, any>
  created?: string
  updated?: string
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
  created?: string
}

export interface SessionModel {
  id?: string
  session_id: string
  vehicle?: string // relation to vehicles collection
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
  updated?: string
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
  created?: string
  updated?: string
}

export interface DtcModel {
  id?: string
  session?: string
  session_id: string
  dtc_code: string
  status: DtcStatus
  mil_on: boolean
  read_at_utc: string
  created?: string
}

// -------------------------------------------------------------
// REQUISITO ETAPA 2: PREPARAÇÃO PARA IA (DiagnosticEvidence)
// Separar obrigatoriamente: RAW -> DERIVED/EVIDENCE -> FUTURA INTERPRETAÇÃO IA.
// Nenhuma hipótese de defeito deve ser gravada como fato.
// -------------------------------------------------------------
export interface DiagnosticFact {
  fact_id: string
  category: 'TELEMETRY_VARIATION' | 'ACTUATOR_STATE' | 'MIXTURE_TRIM' | 'COMMUNICATION' | 'DTC_FLAG'
  parameter: string // e.g. "RPM", "TPS", "STFT", "MAP", "BATTERY_VOLTAGE", "DTC"
  statement: string // Fato objetivo observado (ex.: "RPM caiu 28.5% durante evento", "TPS permaneceu aberto a 45%")
  value_observed?: number | string
  reference_unit?: string
  baseline_value?: number
  event_value?: number
  delta_percent?: number
}

export interface ParameterWindowStat {
  pid: string
  paramName: string
  unit: string
  min: number
  max: number
  avg: number
  samplesCount: number
  beforeAvg?: number
  atEventValue?: number
  afterAvg?: number
}

export interface BlackBoxPackage {
  package_id: string
  event_id: string
  session_id: string
  vehicle: VehicleModel | { plate: string; make: string; model: string; vin?: string }
  event_type: EventType
  description?: string
  timestamp_utc: string
  mono_offset_ms: number
  window_pre_ms: number
  window_post_ms: number
  communication_state: 'CONECTADO' | 'RECONECTANDO' | 'FALHA'
  sample_quality_summary: {
    totalSamples: number
    okCount: number
    timeoutCount: number
    invalidCount: number
    okPercentage: number
  }
  pids_available: string[]
  dtcs_context: DtcModel[]
  window_stats: Record<string, ParameterWindowStat>
  facts: DiagnosticFact[] // Fatos observados (DiagnosticEvidence)
  samples_before_count: number
  samples_at_event_count: number
  samples_after_count: number
}

export interface DiagnosticEvidenceModel {
  id?: string
  event: string
  session: string
  event_id: string
  session_id: string
  vehicle_info?: Record<string, any>
  symptom_type: string
  description?: string
  timestamp_utc: string
  mono_offset_ms: number
  window_stats: Record<string, ParameterWindowStat>
  dtcs_context: DtcModel[]
  communication_state: string
  sample_quality_summary: Record<string, any>
  pids_available: string[]
  facts: DiagnosticFact[]
  created?: string
  updated?: string
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
  selectedVehicleId?: string
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
  activeVehicle?: VehicleModel | null
  activeObdCapability?: ObdCapabilityModel | null
}
