import pb from '@/lib/pocketbase/client'
import {
  TripSessionModel,
  TripDiaryEntryModel,
  TripDiaryEntryType,
  TollItem,
  FuelType,
  TripCostSummaryReport,
  ConsumptionSourceType,
} from '@/types/etapa6'
import {
  calculateTripCost,
  roundToTwo,
  buildTripCostSummaryReport,
  loadFuelPreference,
  saveVehicleHistoricalAvgKml,
  HybridConsumptionProvider,
  IConsumptionProvider,
  ConsumptionReading,
} from './trip-cost-service'

const LOCAL_TRIP_KEY = 'nc_active_trip_local'
const LOCAL_DIARY_KEY = 'nc_active_diary_local'
const LOCAL_TOLLS_KEY = 'nc_active_tolls_local'
const LOCAL_TRIP_HISTORY_KEY = 'nc_completed_trips_history_local'

/**
 * TripSessionManager:
 * Gerencia o ciclo de vida das sessões de viagem, custos em tempo real, pedágios,
 * estatísticas de condução e diário de bordo.
 * Opera 100% OFFLINE com resiliência a quedas/reaberturas e sincronização transparente com PocketBase.
 * Distingue explicitamente dados MEDIDOS, ESTIMADOS e INFORMADOS.
 */
export class TripSessionManager {
  private activeTrip: TripSessionModel | null = null
  private diaryEntries: TripDiaryEntryModel[] = []
  private tollsList: TollItem[] = []
  private totalSpeedSum = 0
  private speedSamplesCount = 0
  private totalMafSum = 0
  private mafSamplesCount = 0
  private tripStartMonoMs = 0
  private lastSampleMonoMs = 0
  private currentStopStartedMonoMs: number | null = null
  private consumptionProvider: IConsumptionProvider = new HybridConsumptionProvider()

  constructor(customProvider?: IConsumptionProvider) {
    if (customProvider) {
      this.consumptionProvider = customProvider
    }
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
      const rawTolls = localStorage.getItem(LOCAL_TOLLS_KEY)
      if (rawTolls) {
        this.tollsList = JSON.parse(rawTolls)
      }
    } catch {
      /* ignore storage load */
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
      localStorage.setItem(LOCAL_TOLLS_KEY, JSON.stringify(this.tollsList))
    } catch {
      /* ignore */
    }
  }

  /**
   * INICIAR VIAGEM COM CUSTO INTELIGENTE (NC-ME001-E6.5 Requisitos 1 a 4)
   */
  startTrip(params: {
    title: string
    origin?: string
    destination?: string
    vehiclePlate?: string
    vehicleId?: string
    initialOdometerKm?: number
    fuelPricePerLiter?: number
    fuelType?: FuelType
    consumptionKml?: number
    consumptionSource?: ConsumptionSourceType
    estimatedDistanceKm?: number
    estimatedTolls?: number
    workshopId?: string
  }): TripSessionModel {
    const tripUid = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const nowIso = new Date().toISOString()
    this.tripStartMonoMs = performance.now()
    this.lastSampleMonoMs = this.tripStartMonoMs
    this.totalSpeedSum = 0
    this.speedSamplesCount = 0
    this.totalMafSum = 0
    this.mafSamplesCount = 0
    this.currentStopStartedMonoMs = null
    this.diaryEntries = []
    this.tollsList = []

    const plate = params.vehiclePlate || 'S/PLACA'
    const storedPref = loadFuelPreference(plate)
    const pricePerLiter =
      params.fuelPricePerLiter !== undefined && params.fuelPricePerLiter > 0
        ? roundToTwo(params.fuelPricePerLiter)
        : storedPref.pricePerLiter

    const consumptionKml =
      params.consumptionKml !== undefined && params.consumptionKml > 0
        ? roundToTwo(params.consumptionKml)
        : storedPref.manualConsumptionKml

    const consumptionSource: ConsumptionSourceType = params.consumptionSource || 'MANUAL_INFORMADO'

    const estDist = Math.max(0, Number(params.estimatedDistanceKm) || 0)
    const estTolls = Math.max(0, Number(params.estimatedTolls) || 0)
    const estLiters = consumptionKml > 0 ? roundToTwo(estDist / consumptionKml) : 0
    const estFuelCost = roundToTwo(estLiters * pricePerLiter)
    const estTotalCost = roundToTwo(estFuelCost + estTolls)

    const authWorkshop = pb.authStore.model?.workshop_id
    const finalWorkshopId = authWorkshop || params.workshopId || undefined

    this.activeTrip = {
      trip_id: tripUid,
      workshop_id: finalWorkshopId,
      vehicle: params.vehicleId,
      vehicle_plate: plate,
      title: params.title || 'Viagem Network Car',
      origin: params.origin?.trim() || 'Origem',
      destination: params.destination?.trim() || 'Destino',
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
      // Campos de Custo Inteligente E6.5
      fuel_price_per_liter: pricePerLiter,
      fuel_type: params.fuelType || storedPref.fuelType || 'GASOLINA',
      consumption_source: consumptionSource,
      avg_consumption_kml: consumptionKml,
      estimated_distance_km: estDist > 0 ? estDist : undefined,
      estimated_cost_fuel: estDist > 0 ? estFuelCost : undefined,
      estimated_cost_tolls: estDist > 0 ? estTolls : undefined,
      estimated_cost_total: estDist > 0 ? estTotalCost : undefined,
      real_fuel_liters: 0,
      fuel_cost_total: 0,
      tolls_total: 0,
      total_cost: 0,
      tolls_breakdown: [],
      telemetry_summary: {
        avgRpm: 0,
        maxRpm: 0,
        avgCoolantTemp: 85,
        maxCoolantTemp: 85,
        minVoltage: 14.0,
      },
    }

    this.persistActiveTrip()

    // Sincroniza criação em background com PocketBase se autenticado
    if (pb.authStore.isValid) {
      const payload: Record<string, any> = { ...this.activeTrip }
      if (finalWorkshopId) payload.workshop_id = finalWorkshopId
      pb.collection('trip_sessions')
        .create(payload)
        .then((rec) => {
          if (this.activeTrip) this.activeTrip.id = rec.id
        })
        .catch(() => {})
    }

    return this.activeTrip
  }

  /**
   * Adiciona Pedágio em Reais (NC-ME001-E6.5 Requisito 7)
   */
  addToll(amount: number, name?: string): TollItem | null {
    if (!this.activeTrip || this.activeTrip.status !== 'EM_ANDAMENTO') return null
    if (isNaN(amount) || amount <= 0) return null

    const toll: TollItem = {
      id: `toll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name?.trim() || `Pedágio #${this.tollsList.length + 1}`,
      amount: roundToTwo(amount),
      createdAtUtc: new Date().toISOString(),
      source: 'MANUAL',
    }

    this.tollsList.push(toll)
    this.recalculateCurrentCost()
    this.persistActiveTrip()

    // Atualiza viagem no backend se já possuir id
    if (pb.authStore.isValid && this.activeTrip.id) {
      pb.collection('trip_sessions')
        .update(this.activeTrip.id, {
          tolls_total: this.activeTrip.tolls_total,
          total_cost: this.activeTrip.total_cost,
          tolls_breakdown: this.activeTrip.tolls_breakdown,
        })
        .catch(() => {})
    }

    return toll
  }

  /**
   * Recalcula em tempo real custo de combustível, pedágios e custo total acumulado
   * Litros = Distância / Consumo; Custo Comb = Litros * Preço; Custo Total = Comb + Pedágios
   */
  private recalculateCurrentCost() {
    if (!this.activeTrip) return

    const distance = this.activeTrip.distance_km || 0
    const consumptionKml = this.activeTrip.avg_consumption_kml || 11.2
    const pricePerLiter = this.activeTrip.fuel_price_per_liter || 0
    const tollsSum = roundToTwo(this.tollsList.reduce((sum, t) => sum + (t.amount || 0), 0))

    const calc = calculateTripCost({
      distanceKm: distance,
      consumptionKml,
      pricePerLiter,
      tollsAmount: tollsSum,
    })

    this.activeTrip.real_fuel_liters = calc.liters
    this.activeTrip.fuel_cost_total = calc.fuelCost
    this.activeTrip.tolls_total = calc.tollsAmount
    this.activeTrip.total_cost = calc.totalCost
    this.activeTrip.tolls_breakdown = [...this.tollsList]
  }

  /**
   * Atualização dinâmica de preço do combustível durante viagem (ajuste rápido)
   */
  updateFuelPrice(pricePerLiter: number) {
    if (!this.activeTrip || pricePerLiter <= 0 || isNaN(pricePerLiter)) return
    this.activeTrip.fuel_price_per_liter = roundToTwo(pricePerLiter)
    this.recalculateCurrentCost()
    this.persistActiveTrip()
  }

  /**
   * Atualização dinâmica de consumo médio
   */
  updateManualConsumption(kml: number) {
    if (!this.activeTrip || kml <= 0 || isNaN(kml)) return
    this.activeTrip.avg_consumption_kml = roundToTwo(kml)
    this.recalculateCurrentCost()
    this.persistActiveTrip()
  }

  /**
   * PROCESSAMENTO DE TELEMETRIA CONTÍNUA
   */
  processTelemetry(params: {
    speedKmh?: number
    rpm?: number
    coolantTemp?: number
    batteryVoltage?: number
    mafGps?: number
    monoMs?: number
    obdConsumptionKml?: number | null // Quando houver leitura OBD de consumo validada
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

      // Distância delta = (speed * dt) / 3600
      if (dtSeconds > 0 && dtSeconds < 10) {
        const deltaKm = (speed * dtSeconds) / 3600
        this.activeTrip.distance_km =
          Math.round((this.activeTrip.distance_km + deltaKm) * 100) / 100
      }

      // Detecção de Parada
      if (speed === 0) {
        if (this.currentStopStartedMonoMs === null) {
          this.currentStopStartedMonoMs = nowMono
        } else if (nowMono - this.currentStopStartedMonoMs > 45000) {
          this.activeTrip.stop_count++
          this.currentStopStartedMonoMs = null
        }
      } else {
        this.currentStopStartedMonoMs = null
      }
    }

    // 2. Consumo Estimado MAF (apenas telemetria técnica de apoio)
    if (params.mafGps !== undefined && !isNaN(params.mafGps) && params.mafGps > 0) {
      this.totalMafSum += params.mafGps
      this.mafSamplesCount++
      const litersPerSecond = params.mafGps / (14.7 * 740)
      const deltaLiters = litersPerSecond * dtSeconds
      this.activeTrip.estimated_fuel_liters =
        Math.round((this.activeTrip.estimated_fuel_liters + deltaLiters) * 100) / 100
    }

    // 3. Provedor de Consumo (Contrato Flexível OBD vs Manual)
    const consumptionReading = this.consumptionProvider.getConsumption({
      vehiclePlate: this.activeTrip.vehicle_plate,
      obdValidAverageKml: params.obdConsumptionKml,
      manualKml: this.activeTrip.avg_consumption_kml,
    })

    if (consumptionReading.isAutomatic) {
      this.activeTrip.avg_consumption_kml = consumptionReading.kml
      this.activeTrip.consumption_source = 'AUTOMATICO_OBD'
    }

    // 4. Recalcula custo acumulado com a distância percorrida até agora
    this.recalculateCurrentCost()

    // 5. Telemetria Resumida
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

  /**
   * FINALIZAÇÃO DE VIAGEM COM RELATÓRIO COMPLETO DE CUSTO (NC-ME001-E6.5 Requisitos 8 e 9)
   */
  endTrip(): TripSessionModel | null {
    if (!this.activeTrip) return null

    this.activeTrip.status = 'CONCLUIDA'
    this.activeTrip.ended_at = new Date().toISOString()
    this.recalculateCurrentCost()

    const consumptionReading: ConsumptionReading = {
      kml: this.activeTrip.avg_consumption_kml || 11.2,
      source: this.activeTrip.consumption_source || 'MANUAL_INFORMADO',
      sourceLabel:
        this.activeTrip.consumption_source === 'AUTOMATICO_OBD'
          ? 'Consumo automático'
          : 'Consumo informado',
      isAutomatic: this.activeTrip.consumption_source === 'AUTOMATICO_OBD',
      badge: this.activeTrip.consumption_source === 'AUTOMATICO_OBD' ? 'MEDIDO' : 'INFORMADO',
    }

    // Relatório Técnico de Custo com distinção MEDIDO / ESTIMADO / INFORMADO
    const costReport = buildTripCostSummaryReport({
      origin: this.activeTrip.origin,
      destination: this.activeTrip.destination,
      distanceKm: this.activeTrip.distance_km,
      durationSeconds: this.activeTrip.duration_seconds,
      consumption: consumptionReading,
      fuelPricePerLiter: this.activeTrip.fuel_price_per_liter || 0,
      litersUsed: this.activeTrip.real_fuel_liters || 0,
      fuelCost: this.activeTrip.fuel_cost_total || 0,
      tolls: this.tollsList,
      totalCost: this.activeTrip.total_cost || 0,
      estimatedTotalCost: this.activeTrip.estimated_cost_total,
    })

    this.activeTrip.cost_summary_report = costReport
    this.activeTrip.trip_summary_report = {
      ...costReport,
      totalDistanceKm: this.activeTrip.distance_km,
      totalDurationFormatted: costReport.durationFormatted,
      avgSpeedKmh: this.activeTrip.avg_speed_kmh,
      maxSpeedKmh: this.activeTrip.max_speed_kmh,
      diaryEntriesCount: this.diaryEntries.length,
      eventsCount: this.activeTrip.total_events_count,
      criticalAlertsCount: this.activeTrip.critical_alerts_count,
    }

    // Salva média histórica de consumo para sugestões futuras no veículo
    if (this.activeTrip.vehicle_plate && this.activeTrip.avg_consumption_kml) {
      saveVehicleHistoricalAvgKml(
        this.activeTrip.vehicle_plate,
        this.activeTrip.avg_consumption_kml,
      )
    }

    const finished = { ...this.activeTrip }

    // Salva no histórico local de viagens
    this.saveToLocalTripHistory(finished)

    // Atualiza viagem concluída no PocketBase
    if (pb.authStore.isValid && finished.id) {
      pb.collection('trip_sessions')
        .update(finished.id, {
          status: 'CONCLUIDA',
          ended_at: finished.ended_at,
          duration_seconds: finished.duration_seconds,
          distance_km: finished.distance_km,
          avg_speed_kmh: finished.avg_speed_kmh,
          max_speed_kmh: finished.max_speed_kmh,
          real_fuel_liters: finished.real_fuel_liters,
          fuel_cost_total: finished.fuel_cost_total,
          tolls_total: finished.tolls_total,
          total_cost: finished.total_cost,
          tolls_breakdown: finished.tolls_breakdown,
          cost_summary_report: finished.cost_summary_report,
          trip_summary_report: finished.trip_summary_report,
          stop_count: finished.stop_count,
          total_events_count: finished.total_events_count,
          critical_alerts_count: finished.critical_alerts_count,
        })
        .catch(() => {})
    }

    this.activeTrip = null
    this.tollsList = []
    this.persistActiveTrip()
    return finished
  }

  private saveToLocalTripHistory(trip: TripSessionModel) {
    if (typeof localStorage === 'undefined') return
    try {
      const history = this.getLocalTripHistory()
      // Mantém as últimas 50 viagens
      const updated = [trip, ...history.filter((t) => t.trip_id !== trip.trip_id)].slice(0, 50)
      localStorage.setItem(LOCAL_TRIP_HISTORY_KEY, JSON.stringify(updated))
    } catch {
      /* ignore */
    }
  }

  getLocalTripHistory(vehiclePlate?: string): TripSessionModel[] {
    if (typeof localStorage === 'undefined') return []
    try {
      const raw = localStorage.getItem(LOCAL_TRIP_HISTORY_KEY)
      if (raw) {
        const list: TripSessionModel[] = JSON.parse(raw)
        if (vehiclePlate) {
          const cleanPlate = vehiclePlate.toUpperCase().trim()
          return list.filter((t) => (t.vehicle_plate || '').toUpperCase().trim() === cleanPlate)
        }
        return list
      }
    } catch {
      /* ignore */
    }
    return []
  }

  getActiveTrip(): TripSessionModel | null {
    return this.activeTrip
  }

  getDiaryEntries(): TripDiaryEntryModel[] {
    return [...this.diaryEntries]
  }

  getTollsList(): TollItem[] {
    return [...this.tollsList]
  }
}
