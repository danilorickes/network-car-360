import { SampleQuality, VehicleModel } from './obd'

// -------------------------------------------------------------
// ETAPA 6 — TIPOS DE HARDWARE, HOMOLOGAÇÃO, MONITORAMENTO E VIAGEM
// -------------------------------------------------------------

export type HardwareStatus =
  | 'NAO_TESTADO'
  | 'EM_TESTE'
  | 'COMPATIVEL'
  | 'COMPATIVEL_COM_LIMITACOES'
  | 'INCOMPATIVEL'

export type TransportMedium = 'BLE' | 'BLUETOOTH_CLASSIC' | 'USB_SERIAL' | 'SIMULADOR'

export interface HardwareHomologationModel {
  id?: string
  manufacturer: string
  model: string
  hardware_version?: string
  firmware_version?: string
  transport: TransportMedium
  platform?: string
  status: HardwareStatus
  tested_vehicles: string[]
  supported_pids: string[]
  sample_rate_hz?: number
  stability_score?: number
  notes?: string
  field_test_report?: {
    physical_tested: boolean
    tested_at?: string
    operator?: string
    status_label: string
    connection_latency_ms?: number
    error_rate_pct?: number
    findings?: string[]
  }
  created?: string
  updated?: string
}

// Wizard de Conexão OBD
export type ConnectionWizardStep =
  | 'SELECIONAR_TRANSPORTE'
  | 'PROCURANDO'
  | 'CONECTANDO'
  | 'INICIALIZANDO'
  | 'IDENTIFICANDO_ECU'
  | 'DESCOBRINDO_PIDS'
  | 'CONECTADO'
  | 'CONEXAO_LIMITADA'
  | 'FALHA'

export interface ConnectionDiscoveryResult {
  step: ConnectionWizardStep
  transport: string
  adapterName: string
  adapterVersion?: string
  protocol?: string
  vin?: string
  ecuInfo?: string
  pidsSupported: string[]
  pidsUnavailable: string[]
  latencyMs?: number
  sampleRateHz?: number
  connectionQuality: 'EXCELENTE' | 'BOA' | 'INSTAVEL' | 'DEGRADADA'
  notes?: string
  error?: string
}

// Contexto de Condução Estimado Via Telemetria
export type DrivingContextType =
  | 'MOTOR_DESLIGADO'
  | 'MOTOR_FRIO'
  | 'MARCHA_LENTA_FRIA'
  | 'MARCHA_LENTA_QUENTE'
  | 'TRANSITO_URBANO'
  | 'ACELERACAO'
  | 'VELOCIDADE_ESTABILIZADA'
  | 'DESACELERACAO'
  | 'CARGA_ELEVADA'
  | 'ESTRADA'
  | 'PARADA_PROLONGADA'
  | 'DESCONHECIDO'

export interface DrivingContextInfo {
  type: DrivingContextType
  label: string
  confidence: number // 0 a 100
  estimatedAtMonoMs: number
  description: string
  activeSinceUtc: string
}

// Baseline Individual do Próprio Veículo por Contexto
export interface IndividualVehicleBaseline {
  id?: string
  vehicle_plate: string
  driving_context: DrivingContextType
  samples_count: number
  last_updated_utc: string
  stats_by_pid: Record<
    string,
    {
      pid: string
      name?: string
      unit: string
      mean: number
      stdDev: number
      min: number
      max: number
      samplesCount: number
    }
  >
}

// Detector de Mudança de Baseline
export interface BaselineTrendAlert {
  id: string
  vehicle_plate: string
  pid: string
  pidName: string
  context: DrivingContextType
  currentValue: number
  baselineMean: number
  stdDevDelta: number // Quantos desvios padrão acima/abaixo da média histórica
  trendDescription: string
  severity: 'INFORMATIVO' | 'ATENCAO' | 'CRITICO'
  detectedAtUtc: string
}

// Monitor Local de Segurança (VehicleSafetyMonitor)
export type SafetyLevel = 'NORMAL' | 'ATENCAO' | 'CRITICO'

export interface SafetyAlert {
  id: string
  code: string
  title: string
  message: string
  severity: SafetyLevel
  priority: number // 1 (mais prioritário) a 10
  source: 'TEMPERATURA' | 'TENSAO' | 'DTC_MIL' | 'COMUNICACAO' | 'MISTURA' | 'MOTOR'
  timestampUtc: string
  valueObserved?: string
  recommendedAction: string
  autoDismissSec?: number
}

// Modo Viagem
export type TripStatus = 'EM_ANDAMENTO' | 'PAUSADA' | 'CONCLUIDA' | 'CANCELADA'

export interface TripSessionModel {
  id?: string
  trip_id: string
  vehicle?: string
  vehicle_plate?: string
  title: string
  status: TripStatus
  started_at: string
  ended_at?: string
  duration_seconds: number
  distance_km: number
  avg_speed_kmh: number
  max_speed_kmh: number
  estimated_fuel_liters: number
  fuel_calculation_mode: 'ESTIMADO_MAF_SPEED' | 'MEDIDO_BOIA' | 'NAO_DISPONIVEL'
  stop_count: number
  total_events_count: number
  critical_alerts_count: number
  // OS-ME001-E6.5: Custo Inteligente de Viagem
  workshop_id?: string
  origin?: string
  destination?: string
  fuel_price_per_liter?: number
  fuel_type?: 'GASOLINA' | 'ETANOL' | 'DIESEL' | 'GNV' | 'OUTRO'
  consumption_source?: 'AUTOMATICO_OBD' | 'MANUAL_INFORMADO' | 'ESTIMADO_HISTORICO'
  avg_consumption_kml?: number
  estimated_distance_km?: number
  estimated_cost_fuel?: number
  estimated_cost_tolls?: number
  estimated_cost_total?: number
  real_fuel_liters?: number
  fuel_cost_total?: number
  tolls_total?: number
  total_cost?: number
  tolls_breakdown?: TollItem[]
  cost_summary_report?: TripCostSummaryReport
  telemetry_summary?: {
    avgRpm?: number
    maxRpm?: number
    avgCoolantTemp?: number
    maxCoolantTemp?: number
    minVoltage?: number
    batteryHealthStatus?: string
  }
  trip_summary_report?: Record<string, any>
  created?: string
  updated?: string
}

// NC-E6.1-VOICE: Configuração e Estado dos Boletins Periódicos da Nina
export type BulletinIntervalOption = 'DESATIVADO' | 5 | 10 | 20 | 30 | 60 | 'PERSONALIZADO'
export type BulletinDetailLevel = 'RESUMIDO' | 'NORMAL' | 'DETALHADO'

export interface NinaBulletinConfig {
  enabled: boolean
  intervalOption: BulletinIntervalOption
  customMinutes?: number
  effectiveMinutes: number // Minutos reais calculados (ou 0 se desativado)
  detailLevel: BulletinDetailLevel
  lastBulletinUtc?: string
  totalBulletinsEmitted: number
}

export interface NinaBulletinPayload {
  id: string
  timestampUtc: string
  detailLevel: BulletinDetailLevel
  text: string
  isShortUpdate: boolean // Anti-repetição ativado (resumo rápido pois nada relevante mudou)
  significantChanges: string[]
  telemetrySnapshot: {
    speedKmh?: number
    rpm?: number
    coolantTemp?: number
    batteryVoltage?: number
    stft?: number
    ltft?: number
    drivingContext: DrivingContextType
    safetyLevel: SafetyLevel
  }
}

export type TripDiaryEntryType =
  | 'PARADA'
  | 'PONTO_TURISTICO'
  | 'FOTO'
  | 'COMENTARIO'
  | 'MOMENTO_ESPECIAL'

export interface TripDiaryEntryModel {
  id?: string
  trip: string
  trip_id: string
  entry_type: TripDiaryEntryType
  title: string
  notes?: string
  location_label?: string
  latitude?: number
  longitude?: number
  has_location_consent: boolean
  odometer_km?: number
  photo_url?: string
  timestamp_utc: string
  created?: string
  updated?: string
}

// CopilotContext para Nina
// -------------------------------------------------------------
// OS-ME001-E6.2: ASSISTENTE PERSONALIZÁVEL (IDENTIDADE, VOZ, ESTILO)
// -------------------------------------------------------------
export type AssistantStyle = 'OBJETIVO' | 'AMIGAVEL' | 'TECNICO'

export interface AvailableTtsVoice {
  voiceURI: string
  name: string
  lang: string
  default: boolean
  localService?: boolean
}

export interface AssistantIdentityConfig {
  /** Nome livre configurável pelo condutor/oficina. Se não configurado, exibe ASSISTENTE */
  name: string
  /** Wake word configurável (ex: "luna", "nina", "copiloto"). Case-insensitive */
  wakeWord: string
  /** URI ou nome da voz TTS selecionada dentre as vozes reais do dispositivo/navegador */
  selectedVoiceUri?: string
  /** Estilo de resposta do assistente: Objetivo / Amigável / Técnico */
  style: AssistantStyle
  /** Se o usuário customizou a identidade (false = denominação neutra 'ASSISTENTE' antes da personalização) */
  isCustomized: boolean
  /** Data da última atualização da identidade */
  updatedAtUtc?: string
}

// OS-ME001-E6.5: Tipos de Custo de Viagem, Pedágios e Origens de Consumo
export interface TollItem {
  id: string
  name: string
  amount: number
  createdAtUtc: string
  source?: 'MANUAL' | 'AUTOMATICO'
}

export type ConsumptionSourceType = 'AUTOMATICO_OBD' | 'MANUAL_INFORMADO' | 'ESTIMADO_HISTORICO'

export type FuelType = 'GASOLINA' | 'ETANOL' | 'DIESEL' | 'GNV' | 'OUTRO'

export type DataOriginBadge = 'MEDIDO' | 'ESTIMADO' | 'INFORMADO'

export interface TripCostSummaryReport {
  origin: string
  destination: string
  distanceKm: number
  distanceOrigin: DataOriginBadge
  durationFormatted: string
  durationOrigin: DataOriginBadge
  avgConsumptionKml: number
  consumptionOrigin: DataOriginBadge // INFORMADO vs MEDIDO
  consumptionSourceLabel: 'Consumo automático' | 'Consumo informado'
  fuelPricePerLiter: number
  fuelPriceOrigin: DataOriginBadge
  fuelLitersUsed: number
  fuelLitersOrigin: DataOriginBadge
  fuelCost: number
  fuelCostOrigin: DataOriginBadge
  tollsTotal: number
  tollsCount: number
  tollsOrigin: DataOriginBadge
  totalCost: number
  totalCostOrigin: DataOriginBadge
  estimatedTotalCost?: number
  costDifference?: number // Real - Estimado (ex: -6.30)
  closedAtUtc: string
}

export interface CopilotContext {
  vehicleName: string
  vehiclePlate: string
  connectionStatus: string
  transportType: string
  drivingContext: DrivingContextType
  speedKmh?: number
  rpm?: number
  coolantTemp?: number
  batteryVoltage?: number
  stft?: number
  ltft?: number
  activeDtcs: string[]
  milOn: boolean
  safetyLevel: SafetyLevel
  activeAlerts: string[]
  isTripActive: boolean
  tripTitle?: string
  tripDuration?: string
  tripDistance?: string
  locationLabel?: string
  assistantIdentity?: AssistantIdentityConfig
  userPreferences?: {
    musicStyle?: string
    voiceVolume?: number
    allowLocation?: boolean
    bulletinConfig?: NinaBulletinConfig
    assistantIdentity?: AssistantIdentityConfig
  }
}
// Perfil de Homologação Guiada: Ford EcoSport 2020 1.5 Dragon 3Cil
export interface EcoSportValidationStep {
  id: string
  title: string
  description: string
  targetState: string
  expectedRpmRange?: [number, number]
  expectedSpeedRange?: [number, number]
  expectedTempRange?: [number, number]
  validationCriteria: string
  status: 'PENDENTE' | 'EM_EXECUCAO' | 'APROVADO' | 'REPROVADO' | 'PULADO'
  measuredData?: Record<string, any>
  notes?: string
}

export interface EcoSportHomologationProfile {
  profileId: 'ECOSPORT_2020_15_DRAGON'
  vehicleName: 'Ford EcoSport 2020 — 1.5 Dragon Flex'
  engineType: '1.5 Ti-VCT Dragon 3 Cilindros'
  protocolExpected: 'ISO 15765-4 (CAN 11/500)'
  steps: EcoSportValidationStep[]
}
