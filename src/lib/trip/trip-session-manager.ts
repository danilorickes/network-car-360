import pb from '@/lib/pocketbase/client'
import {
  TripSessionModel,
  TripDiaryEntryModel,
  TripStatus,
  TripDiaryEntryType,
  DrivingContextType,
} from '@/types/etapa6'

const LOCAL_TRIP_KEY = 'nc_active_trip_local'
const LOCAL_DIARY_KEY = 'nc_active_diary_local'

/**
 * TripSessionManager:
 * Gerencia o ciclo de vida das sessões de viagem, estatísticas de condução e diário de bordo.
 * Opera 100% OFFLINE com sincronização transparente quando online.
 * Distingue explicitamente dados MEDIDOS de ESTIMADOS.
 */
export class TripSessionManager {
  private activeTrip: TripSessionModel | null = null
  private diaryEntries: TripDiaryEntryModel[] = []
  private totalSpeedSum = 0
  private speedSamplesCount = 0
  private totalMafSum = 0
  private mafSamplesCount = 0
  private lastOdometerKm = 0
  private tripStartMonoMs = 0
  private lastSampleMonoMs = 0
  private currentStopStartedMonoMs: number | null = null

  constructor() {
    this.restoreActiveTrip()
  }

  private restoreActiveTrip() {
    try {
      if (typeof localStorage === 'undefined') return
      const raw = localStorage.getItem(LOCAL_TRIP_KEY)
      if (raw) {
        this.activeTrip = JSON.parse(raw)
      }
      const rawDiary = localStorage.getItem(LOCAL_DIARY_KEY)
      if (rawDiary) {
        this.diaryEntries = JSON.parse(rawDiary)
      }
    } catch {
      /* ignore */
    }
  }

  private persistActiveTrip() {
    try {
      if (typeof localStorage === 'undefined') return
      if (this.activeTrip) {
        localStorage.setItem(LOCAL_TRIP_KEY, JSON.stringify(this.activeTrip))
      } else {
        localStorage.removeItem(LOCAL_TRIP_KEY)
      }
      localStorage.setItem(LOCAL_DIARY_KEY, JSON.stringify(this.diaryEntries))
    } catch {
      /* ignore */
    }
  }

  startTrip(params: {
    title: string
    vehiclePlate?: string
    vehicleId?: string
    initialOdometerKm?: number
  }): TripSessionModel {
    const tripUid = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const nowIso = new Date().toISOString()
    this.tripStartMonoMs = performance.now()
    this.lastSampleMonoMs = this.tripStartMonoMs
    this.lastOdometerKm = params.initialOdometerKm || 0
    this.totalSpeedSum = 0
    this.speedSamplesCount = 0
    this.totalMafSum = 0
    this.mafSamplesCount = 0
    this.currentStopStartedMonoMs = null
    this.diaryEntries = []

    this.activeTrip = {
      trip_id: tripUid,
      vehicle: params.vehicleId,
      vehicle_plate: params.vehiclePlate || 'S/PLACA',
      title: params.title || 'Viagem Network Car',
      status: 'EM_ANDAMENTO',
      started_at: nowIso,
      duration_seconds: 0,
      distance_km: 0,
      avg_speed_kmh: 0,
      max_speed_kmh: 0,
      estimated_fuel_liters: 0,
      fuel_calculation_mode: 'ESTIMADO_MAF_SPEED',
      stop_count: 0,
      total_events_count: 0,
      critical_alerts_count: 0,
      telemetry_summary: {
        avgRpm: 0,
        maxRpm: 0,
        avgCoolantTemp: 85,
        maxCoolantTemp: 85,
        minVoltage: 14.0,
      },
    }

    this.persistActiveTrip()

    // Sincroniza em background com PocketBase se online
    if (pb.authStore.isValid) {
      pb.collection('trip_sessions')
        .create({ ...this.activeTrip })
        .then((rec) => {
          if (this.activeTrip) this.activeTrip.id = rec.id
        })
        .catch(() => {})
    }

    return this.activeTrip
  }

  processTelemetry(params: {
    speedKmh?: number
    rpm?: number
    coolantTemp?: number
    batteryVoltage?: number
    mafGps?: number
    monoMs?: number
  }) {
    if (!this.activeTrip || this.activeTrip.status !== 'EM_ANDAMENTO') return

    const nowMono = params.monoMs || performance.now()
    const dtSeconds = Math.max(0, (nowMono - this.lastSampleMonoMs) / 1000)
    this.lastSampleMonoMs = nowMono

    this.activeTrip.duration_seconds = Math.round((nowMono - this.tripStartMonoMs) / 1000)

    // 1. Velocidade e Distância
    if (params.speedKmh !== undefined && !isNaN(params.speedKmh)) {
      const speed = params.speedKmh
      this.totalSpeedSum += speed
      this.speedSamplesCount++
      this.activeTrip.avg_speed_kmh = Math.round(this.totalSpeedSum / this.speedSamplesCount)
      this.activeTrip.max_speed_kmh = Math.max(this.activeTrip.max_speed_kmh, speed)

      // Distância percorrida delta = (velocidade km/h * dt segundos) / 3600
      if (dtSeconds > 0 && dtSeconds < 10) {
        const deltaKm = (speed * dtSeconds) / 3600
        this.activeTrip.distance_km =
          Math.round((this.activeTrip.distance_km + deltaKm) * 100) / 100
      }

      // Detecção de Parada (velocidade == 0 por mais de 45 segundos)
      if (speed === 0) {
        if (this.currentStopStartedMonoMs === null) {
          this.currentStopStartedMonoMs = nowMono
        } else if (nowMono - this.currentStopStartedMonoMs > 45000) {
          // Incrementa contagem de paradas apenas uma vez por intervalo
          this.activeTrip.stop_count++
          this.currentStopStartedMonoMs = null
        }
      } else {
        this.currentStopStartedMonoMs = null
      }
    }

    // 2. Consumo Estimado de Combustível via MAF
    // Fórmula padrão: Combustível (g/s) = MAF (g/s) / 14.7 (estequiometria gasolina)
    // Densidade da gasolina ~ 740 g/L -> Litros = (MAF / 14.7 / 740) * dtSeconds
    if (params.mafGps !== undefined && !isNaN(params.mafGps) && params.mafGps > 0) {
      this.totalMafSum += params.mafGps
      this.mafSamplesCount++
      const litersPerSecond = params.mafGps / (14.7 * 740)
      const deltaLiters = litersPerSecond * dtSeconds
      this.activeTrip.estimated_fuel_liters =
        Math.round((this.activeTrip.estimated_fuel_liters + deltaLiters) * 100) / 100
      this.activeTrip.fuel_calculation_mode = 'ESTIMADO_MAF_SPEED'
    }

    // 3. Telemetria Resumida
    const summary = this.activeTrip.telemetry_summary || {}
    if (params.rpm !== undefined && !isNaN(params.rpm)) {
      summary.maxRpm = Math.max(summary.maxRpm || 0, params.rpm)
    }
    if (params.coolantTemp !== undefined && !isNaN(params.coolantTemp)) {
      summary.maxCoolantTemp = Math.max(summary.maxCoolantTemp || 0, params.coolantTemp)
      summary.avgCoolantTemp = Math.round(((summary.avgCoolantTemp || 85) + params.coolantTemp) / 2)
    }
    if (params.batteryVoltage !== undefined && !isNaN(params.batteryVoltage)) {
      summary.minVoltage = Math.min(summary.minVoltage || 14.0, params.batteryVoltage)
    }
    this.activeTrip.telemetry_summary = summary

    this.persistActiveTrip()
  }

  recordEventOrAlert(isCritical = false) {
    if (!this.activeTrip) return
    this.activeTrip.total_events_count++
    if (isCritical) {
      this.activeTrip.critical_alerts_count++
    }
    this.persistActiveTrip()
  }

  addDiaryEntry(params: {
    entryType: TripDiaryEntryType
    title: string
    notes?: string
    locationLabel?: string
    latitude?: number
    longitude?: number
    hasLocationConsent?: boolean
    odometerKm?: number
    photoUrl?: string
  }): TripDiaryEntryModel | null {
    if (!this.activeTrip) return null

    const entry: TripDiaryEntryModel = {
      trip: this.activeTrip.id || this.activeTrip.trip_id,
      trip_id: this.activeTrip.trip_id,
      entry_type: params.entryType,
      title: params.title,
      notes: params.notes,
      location_label: params.locationLabel,
      latitude: params.hasLocationConsent ? params.latitude : undefined,
      longitude: params.hasLocationConsent ? params.longitude : undefined,
      has_location_consent: Boolean(params.hasLocationConsent),
      odometer_km: params.odometerKm,
      photo_url: params.photoUrl,
      timestamp_utc: new Date().toISOString(),
    }

    this.diaryEntries.push(entry)
    this.persistActiveTrip()

    if (pb.authStore.isValid && this.activeTrip.id) {
      pb.collection('trip_diary_entries')
        .create({ ...entry })
        .then((rec) => {
          entry.id = rec.id
        })
        .catch(() => {})
    }

    return entry
  }

  endTrip(): TripSessionModel | null {
    if (!this.activeTrip) return null

    this.activeTrip.status = 'CONCLUIDA'
    this.activeTrip.ended_at = new Date().toISOString()
    this.activeTrip.trip_summary_report = {
      totalDistanceKm: this.activeTrip.distance_km,
      totalDurationFormatted: `${Math.floor(this.activeTrip.duration_seconds / 60)} min`,
      avgSpeedKmh: this.activeTrip.avg_speed_kmh,
      maxSpeedKmh: this.activeTrip.max_speed_kmh,
      estimatedFuelLiters: this.activeTrip.estimated_fuel_liters,
      fuelMode: this.activeTrip.fuel_calculation_mode,
      diaryEntriesCount: this.diaryEntries.length,
      eventsCount: this.activeTrip.total_events_count,
      criticalAlertsCount: this.activeTrip.critical_alerts_count,
      vehicleHealthSummary:
        this.activeTrip.critical_alerts_count === 0
          ? 'EXCELENTE — Nenhum alerta crítico detectado'
          : `ATENÇÃO — ${this.activeTrip.critical_alerts_count} alerta(s) de segurança registrados`,
    }

    const finished = { ...this.activeTrip }

    if (pb.authStore.isValid && finished.id) {
      pb.collection('trip_sessions')
        .update(finished.id, {
          status: 'CONCLUIDA',
          ended_at: finished.ended_at,
          duration_seconds: finished.duration_seconds,
          distance_km: finished.distance_km,
          avg_speed_kmh: finished.avg_speed_kmh,
          max_speed_kmh: finished.max_speed_kmh,
          estimated_fuel_liters: finished.estimated_fuel_liters,
          stop_count: finished.stop_count,
          total_events_count: finished.total_events_count,
          critical_alerts_count: finished.critical_alerts_count,
          trip_summary_report: finished.trip_summary_report,
        })
        .catch(() => {})
    }

    this.activeTrip = null
    this.persistActiveTrip()
    return finished
  }

  getActiveTrip(): TripSessionModel | null {
    return this.activeTrip
  }

  getDiaryEntries(): TripDiaryEntryModel[] {
    return [...this.diaryEntries]
  }
}
