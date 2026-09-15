import pb from '@/lib/pocketbase/client'
import {
  ConsumptionSourceType,
  DataOriginBadge,
  FuelType,
  TollItem,
  TripCostSummaryReport,
} from '@/types/etapa6'

// Prefixos para isolamento estrito por Oficina + Usuário + Veículo
const FUEL_PREF_PREFIX = 'nc_trip_fuel_pref_'
const HISTORICAL_AVG_PREFIX = 'nc_vehicle_consumption_history_'

export interface FuelPreference {
  pricePerLiter: number
  fuelType: FuelType
  manualConsumptionKml: number
  updatedAtUtc?: string
}

export interface ConsumptionReading {
  kml: number
  source: ConsumptionSourceType
  sourceLabel: 'Consumo automático' | 'Consumo informado'
  isAutomatic: boolean
  badge: DataOriginBadge // MEDIDO ou INFORMADO
}

/**
 * Provedor Abstrato de Consumo:
 * Permite desacoplar a origem dos dados de consumo (hoje Manual/MAF; amanhã PID OBD direto validado por homologação).
 * NÃO simula dados do veículo como se fossem reais.
 */
export interface IConsumptionProvider {
  getConsumption(context: {
    vehiclePlate?: string
    obdValidAverageKml?: number | null
    manualKml?: number
  }): ConsumptionReading
}

export class HybridConsumptionProvider implements IConsumptionProvider {
  getConsumption(context: {
    vehiclePlate?: string
    obdValidAverageKml?: number | null
    manualKml?: number
  }): ConsumptionReading {
    // 1. Prioridade Automática: apenas quando houver medição OBD real comprovada e válida
    if (
      context.obdValidAverageKml !== undefined &&
      context.obdValidAverageKml !== null &&
      context.obdValidAverageKml > 0 &&
      !isNaN(context.obdValidAverageKml)
    ) {
      return {
        kml: roundToTwo(context.obdValidAverageKml),
        source: 'AUTOMATICO_OBD',
        sourceLabel: 'Consumo automático',
        isAutomatic: true,
        badge: 'MEDIDO',
      }
    }

    // 2. Fonte Manual / Informada pelo condutor
    const manual = context.manualKml && context.manualKml > 0 ? context.manualKml : 11.2
    return {
      kml: roundToTwo(manual),
      source: 'MANUAL_INFORMADO',
      sourceLabel: 'Consumo informado',
      isAutomatic: false,
      badge: 'INFORMADO',
    }
  }
}

// Utilitários de arredondamento seguro
export function roundToTwo(val: number): number {
  if (isNaN(val) || !isFinite(val)) return 0
  return Math.round((val + Number.EPSILON) * 100) / 100
}

export function formatBrl(val: number): string {
  const safe = isNaN(val) || !isFinite(val) ? 0 : val
  return safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Retorna a chave de armazenamento de preferências de combustível
 * Isolada por oficina + usuário + veículo (NC-ME001-E6.5 Requisito 1 & 12).
 */
export function getFuelPreferenceStorageKey(vehiclePlate?: string): string {
  const authUser = pb.authStore.model
  const workshopId = authUser?.workshop_id || 'ws_default'
  const userId = authUser?.id || 'anon'
  const cleanPlate = (vehiclePlate || 'PADRAO').toUpperCase().trim()
  return `${FUEL_PREF_PREFIX}${workshopId}_${userId}_${cleanPlate}`
}

/**
 * Carrega a preferência de preço de combustível e consumo informado.
 */
export function loadFuelPreference(vehiclePlate?: string): FuelPreference {
  const fallback: FuelPreference = {
    pricePerLiter: 6.19,
    fuelType: 'GASOLINA',
    manualConsumptionKml: 11.2,
  }

  if (typeof localStorage === 'undefined') return fallback

  try {
    const key = getFuelPreferenceStorageKey(vehiclePlate)
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        pricePerLiter:
          typeof parsed.pricePerLiter === 'number' && parsed.pricePerLiter > 0
            ? parsed.pricePerLiter
            : fallback.pricePerLiter,
        fuelType: parsed.fuelType || 'GASOLINA',
        manualConsumptionKml:
          typeof parsed.manualConsumptionKml === 'number' && parsed.manualConsumptionKml > 0
            ? parsed.manualConsumptionKml
            : fallback.manualConsumptionKml,
        updatedAtUtc: parsed.updatedAtUtc,
      }
    }
  } catch {
    /* ignore storage error */
  }

  return fallback
}

/**
 * Salva a preferência de combustível persistindo por oficina + usuário + veículo.
 */
export function saveFuelPreference(
  pref: Partial<FuelPreference>,
  vehiclePlate?: string,
): FuelPreference {
  const current = loadFuelPreference(vehiclePlate)
  const updated: FuelPreference = {
    ...current,
    ...pref,
    pricePerLiter:
      pref.pricePerLiter !== undefined && pref.pricePerLiter > 0
        ? roundToTwo(pref.pricePerLiter)
        : current.pricePerLiter,
    manualConsumptionKml:
      pref.manualConsumptionKml !== undefined && pref.manualConsumptionKml > 0
        ? roundToTwo(pref.manualConsumptionKml)
        : current.manualConsumptionKml,
    updatedAtUtc: new Date().toISOString(),
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const key = getFuelPreferenceStorageKey(vehiclePlate)
      localStorage.setItem(key, JSON.stringify(updated))
    } catch {
      /* ignore */
    }
  }

  return updated
}

/**
 * Salva/recupera média histórica de consumo por veículo (para sugerir no custo estimado).
 */
export function getVehicleHistoricalAvgKml(vehiclePlate?: string): number | null {
  if (!vehiclePlate || typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${HISTORICAL_AVG_PREFIX}${vehiclePlate.toUpperCase().trim()}`)
    if (raw) {
      const parsed = parseFloat(raw)
      return isNaN(parsed) || parsed <= 0 ? null : parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

export function saveVehicleHistoricalAvgKml(vehiclePlate: string, kml: number) {
  if (!vehiclePlate || kml <= 0 || isNaN(kml) || typeof localStorage === 'undefined') return
  try {
    const current = getVehicleHistoricalAvgKml(vehiclePlate)
    // Média móvel ponderada
    const newAvg = current ? roundToTwo((current * 3 + kml) / 4) : roundToTwo(kml)
    localStorage.setItem(
      `${HISTORICAL_AVG_PREFIX}${vehiclePlate.toUpperCase().trim()}`,
      String(newAvg),
    )
  } catch {
    /* ignore */
  }
}

/**
 * CÁLCULO DE CUSTO (NC-ME001-E6.5 Requisito 3):
 * Litros = distância ÷ consumo médio;
 * Custo combustível = litros × preço/L;
 * Custo total = combustível + pedágios.
 * Proteção contra divisão por zero e valores inválidos (consumo zero, preço zero, campos vazios).
 */
export interface CostCalculationInput {
  distanceKm: number
  consumptionKml: number
  pricePerLiter: number
  tollsAmount?: number
}

export interface CostCalculationResult {
  liters: number
  fuelCost: number
  tollsAmount: number
  totalCost: number
  isValid: boolean
  errorMessage?: string
}

export function calculateTripCost(input: CostCalculationInput): CostCalculationResult {
  const distance = Math.max(0, Number(input.distanceKm) || 0)
  const consumption = Number(input.consumptionKml) || 0
  const price = Number(input.pricePerLiter) || 0
  const tolls = Math.max(0, Number(input.tollsAmount) || 0)

  if (consumption <= 0) {
    return {
      liters: 0,
      fuelCost: 0,
      tollsAmount: tolls,
      totalCost: tolls,
      isValid: false,
      errorMessage: 'Consumo médio deve ser maior que zero.',
    }
  }

  if (price <= 0) {
    const lit = roundToTwo(distance / consumption)
    return {
      liters: lit,
      fuelCost: 0,
      tollsAmount: tolls,
      totalCost: tolls,
      isValid: false,
      errorMessage: 'Preço do combustível deve ser maior que zero.',
    }
  }

  const liters = roundToTwo(distance / consumption)
  const fuelCost = roundToTwo(liters * price)
  const totalCost = roundToTwo(fuelCost + tolls)

  return {
    liters,
    fuelCost,
    tollsAmount: roundToTwo(tolls),
    totalCost,
    isValid: true,
  }
}

/**
 * CUSTO ESTIMADO PRÉVIO (NC-ME001-E6.5 Requisito 4):
 */
export interface EstimatedTripCostInput {
  estimatedDistanceKm: number
  consumptionKml: number
  pricePerLiter: number
  estimatedTolls?: number
}

export interface EstimatedTripCostResult {
  estimatedDistanceKm: number
  consumptionKml: number
  pricePerLiter: number
  estimatedLiters: number
  estimatedFuelCost: number
  estimatedTolls: number
  estimatedTotalCost: number
}

export function calculateEstimatedTripCost(input: EstimatedTripCostInput): EstimatedTripCostResult {
  const calc = calculateTripCost({
    distanceKm: input.estimatedDistanceKm,
    consumptionKml: input.consumptionKml,
    pricePerLiter: input.pricePerLiter,
    tollsAmount: input.estimatedTolls || 0,
  })

  return {
    estimatedDistanceKm: roundToTwo(input.estimatedDistanceKm),
    consumptionKml: roundToTwo(input.consumptionKml),
    pricePerLiter: roundToTwo(input.pricePerLiter),
    estimatedLiters: calc.liters,
    estimatedFuelCost: calc.fuelCost,
    estimatedTolls: calc.tollsAmount,
    estimatedTotalCost: calc.totalCost,
  }
}

/**
 * COMPARAÇÃO ESTIMADO × REALIZADO (NC-ME001-E6.5 Requisito 6):
 */
export interface EstimatedVsRealComparison {
  estimatedTotalCost: number
  realTotalCost: number
  differenceCost: number // Real - Estimado (ex: R$ 158,70 - R$ 165,00 = -R$ 6,30)
  differencePercent: number
  isEconomy: boolean // Custo real menor que o estimado
  differenceFormatted: string // ex: "-R$ 6,30" ou "+R$ 12,50"
}

export function compareEstimatedVsReal(
  estimatedTotal: number,
  realTotal: number,
): EstimatedVsRealComparison {
  const est = roundToTwo(estimatedTotal)
  const real = roundToTwo(realTotal)
  const diff = roundToTwo(real - est)
  const percent = est > 0 ? roundToTwo((diff / est) * 100) : 0
  const isEconomy = diff < 0
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : ''
  const absFormatted = formatBrl(Math.abs(diff))

  return {
    estimatedTotalCost: est,
    realTotalCost: real,
    differenceCost: diff,
    differencePercent: percent,
    isEconomy,
    differenceFormatted: `${sign}${absFormatted}`,
  }
}

/**
 * Constrói o Resumo Final da Viagem com crachás de MEDIDO / ESTIMADO / INFORMADO
 * (NC-ME001-E6.5 Requisito 8)
 */
export function buildTripCostSummaryReport(params: {
  origin?: string
  destination?: string
  distanceKm: number
  durationSeconds: number
  consumption: ConsumptionReading
  fuelPricePerLiter: number
  litersUsed: number
  fuelCost: number
  tolls: TollItem[]
  totalCost: number
  estimatedTotalCost?: number
}): TripCostSummaryReport {
  const hours = Math.floor(params.durationSeconds / 3600)
  const minutes = Math.floor((params.durationSeconds % 3600) / 60)
  const durationFormatted =
    hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes} min`

  const tollsSum = roundToTwo(params.tolls.reduce((sum, t) => sum + (t.amount || 0), 0))
  const estDiff =
    params.estimatedTotalCost !== undefined && params.estimatedTotalCost > 0
      ? roundToTwo(params.totalCost - params.estimatedTotalCost)
      : undefined

  return {
    origin: params.origin?.trim() || 'Origem',
    destination: params.destination?.trim() || 'Destino',
    distanceKm: roundToTwo(params.distanceKm),
    distanceOrigin: 'MEDIDO',
    durationFormatted,
    durationOrigin: 'MEDIDO',
    avgConsumptionKml: roundToTwo(params.consumption.kml),
    consumptionOrigin: params.consumption.badge,
    consumptionSourceLabel: params.consumption.sourceLabel,
    fuelPricePerLiter: roundToTwo(params.fuelPricePerLiter),
    fuelPriceOrigin: 'INFORMADO',
    fuelLitersUsed: roundToTwo(params.litersUsed),
    fuelLitersOrigin: params.consumption.isAutomatic ? 'MEDIDO' : 'ESTIMADO',
    fuelCost: roundToTwo(params.fuelCost),
    fuelCostOrigin: 'ESTIMADO',
    tollsTotal: tollsSum,
    tollsCount: params.tolls.length,
    tollsOrigin: 'INFORMADO',
    totalCost: roundToTwo(params.totalCost),
    totalCostOrigin: 'ESTIMADO',
    estimatedTotalCost: params.estimatedTotalCost,
    costDifference: estDiff,
    closedAtUtc: new Date().toISOString(),
  }
}
