import { DrivingContextType, IndividualVehicleBaseline, BaselineTrendAlert } from '@/types/etapa6'

const LOCAL_STORAGE_KEY_PREFIX = 'nc_ind_baseline_'

/**
 * IndividualBaselineLearner:
 * Aprende estatisticamente o baseline individual do próprio veículo, separado por contexto.
 * Regras mandatórias:
 * 1. Aprende estatisticamente o comportamento normal daquele veículo específico.
 * 2. Separa estritamente por condições (ex.: "quente + marcha lenta", "quente + 100 km/h", "aceleração moderada").
 * 3. NUNCA transforma aprendizado em verdade absoluta (usa janelas móveis com desvio padrão).
 * 4. NUNCA compara veículos diferentes como baseline.
 */
export class IndividualBaselineLearner {
  private vehiclePlate: string
  private baselines: Map<DrivingContextType, IndividualVehicleBaseline> = new Map()

  constructor(vehiclePlate: string) {
    this.vehiclePlate = vehiclePlate || 'GENERICO'
    this.loadFromStorage()
  }

  private getStorageKey(): string {
    return `${LOCAL_STORAGE_KEY_PREFIX}${this.vehiclePlate.replace(/[^a-zA-Z0-9]/g, '')}`
  }

  private loadFromStorage() {
    try {
      if (typeof localStorage === 'undefined') return
      const raw = localStorage.getItem(this.getStorageKey())
      if (raw) {
        const parsed: Record<string, IndividualVehicleBaseline> = JSON.parse(raw)
        Object.entries(parsed).forEach(([ctx, data]) => {
          this.baselines.set(ctx as DrivingContextType, data)
        })
      }
    } catch {
      /* ignore */
    }
  }

  private saveToStorage() {
    try {
      if (typeof localStorage === 'undefined') return
      const obj: Record<string, IndividualVehicleBaseline> = {}
      this.baselines.forEach((v, k) => {
        obj[k] = v
      })
      localStorage.setItem(this.getStorageKey(), JSON.stringify(obj))
    } catch {
      /* ignore */
    }
  }

  learnObservation(
    context: DrivingContextType,
    pid: string,
    value: number,
    unit = '',
    pidName = '',
  ): void {
    if (isNaN(value) || value === undefined) return

    let current = this.baselines.get(context)
    if (!current) {
      current = {
        vehicle_plate: this.vehiclePlate,
        driving_context: context,
        samples_count: 0,
        last_updated_utc: new Date().toISOString(),
        stats_by_pid: {},
      }
      this.baselines.set(context, current)
    }

    current.samples_count++
    current.last_updated_utc = new Date().toISOString()

    let stat = current.stats_by_pid[pid]
    if (!stat) {
      stat = {
        pid,
        name: pidName,
        unit,
        mean: value,
        stdDev: 0,
        min: value,
        max: value,
        samplesCount: 1,
      }
      current.stats_by_pid[pid] = stat
    } else {
      const n = stat.samplesCount + 1
      const oldMean = stat.mean
      const newMean = oldMean + (value - oldMean) / n
      // Algoritmo de Welford para variância e desvio padrão acumulado
      const oldVar = Math.pow(stat.stdDev, 2)
      const newVar = ((n - 2) * oldVar + (value - oldMean) * (value - newMean)) / (n - 1 || 1)

      stat.mean = Math.round(newMean * 100) / 100
      stat.stdDev = Math.round(Math.sqrt(Math.max(0, newVar)) * 100) / 100
      stat.min = Math.min(stat.min, value)
      stat.max = Math.max(stat.max, value)
      stat.samplesCount = n
    }

    // Salva periodicamente a cada 20 amostras para poupar storage
    if (current.samples_count % 20 === 0) {
      this.saveToStorage()
    }
  }

  getBaseline(context: DrivingContextType): IndividualVehicleBaseline | undefined {
    return this.baselines.get(context)
  }

  /**
   * BaselineChangeDetector:
   * Compara o comportamento atual com a linha de base aprendida do próprio veículo.
   * NUNCA afirma "seu carro está com defeito X" sem evidência.
   * Produz alertas de tendência (ex: "LTFT deste veículo apresenta tendência diferente do histórico normal")
   */
  detectTrendAnomaly(
    context: DrivingContextType,
    pid: string,
    currentValue: number,
    pidName: string,
  ): BaselineTrendAlert | null {
    const baseline = this.baselines.get(context)
    if (!baseline) return null

    const stat = baseline.stats_by_pid[pid]
    if (!stat || stat.samplesCount < 30) {
      // Amostragem insuficiente para inferência confiável
      return null
    }

    const delta = currentValue - stat.mean
    const thresholdDev = Math.max(stat.stdDev, 1.0)
    const zScore = delta / thresholdDev

    // Se estiver a mais de 3.2 desvios padrão da média histórica para o mesmo contexto
    if (Math.abs(zScore) >= 3.2) {
      const isPositive = zScore > 0
      return {
        id: `trend_${pid}_${Date.now()}`,
        vehicle_plate: this.vehiclePlate,
        pid,
        pidName,
        context,
        currentValue,
        baselineMean: stat.mean,
        stdDevDelta: Math.round(zScore * 10) / 10,
        trendDescription: `No contexto de [${context}], o parâmetro ${pidName} está medindo ${currentValue}${stat.unit}, divergindo em ${Math.abs(Math.round(zScore * 10) / 10)}σ do histórico aprendido para este veículo (média histórica: ${stat.mean}${stat.unit}).`,
        severity: Math.abs(zScore) > 4.5 ? 'ATENCAO' : 'INFORMATIVO',
        detectedAtUtc: new Date().toISOString(),
      }
    }

    return null
  }
}
