import { AppConfig } from '@/types/obd'

const STORAGE_KEY = 'network_car_obd_config_v1'

export const DEFAULT_CONFIG: AppConfig = {
  baudRate: 38400,
  serialPort: 'COM3 / /dev/ttyUSB0',
  reconnectAttempts: 3,
  priorityFreqHz: 5,
  secondaryFreqHz: 1,
  windowPreMs: 30000,
  windowPostMs: 30000,
  dtcIntervalMs: 60000,
  simulatorIdleRpm: 850,
  simulatorCruiseRpm: 2100,
  defaultVehicleName: 'Ford EcoSport 2020 1.5 Dragon 3C',
}

export function loadAppConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveAppConfig(config: Partial<AppConfig>): AppConfig {
  try {
    const current = loadAppConfig()
    const updated = { ...current, ...config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return { ...DEFAULT_CONFIG, ...config }
  }
}
