import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  calculateTripCost,
  calculateEstimatedTripCost,
  compareEstimatedVsReal,
  buildTripCostSummaryReport,
  roundToTwo,
  formatBrl,
  loadFuelPreference,
  saveFuelPreference,
  getFuelPreferenceStorageKey,
  HybridConsumptionProvider,
  saveVehicleHistoricalAvgKml,
  getVehicleHistoricalAvgKml,
} from '../trip-cost-service'
import { TripSessionManager } from '../trip-session-manager'
import pb from '@/lib/pocketbase/client'

describe('OS-ME001-E6.5 — Módulo Custo Inteligente de Viagem', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset pb authStore
    pb.authStore.clear()
  })

  // -------------------------------------------------------------
  // REQUISITO 1: PREÇO DO COMBUSTÍVEL E PERSISTÊNCIA MULTITENANT
  // -------------------------------------------------------------
  describe('1. Preço do combustível e persistência de preferências', () => {
    it('deve carregar valor padrão quando não houver preferência salva', () => {
      const pref = loadFuelPreference('ABC1D23')
      expect(pref.pricePerLiter).toBe(6.19)
      expect(pref.fuelType).toBe('GASOLINA')
      expect(pref.manualConsumptionKml).toBe(11.2)
    })

    it('deve salvar e carregar preferências isoladas por oficina + usuário + veículo', () => {
      // Mock de authStore com oficina e usuário
      pb.authStore.save('mock-token', {
        id: 'usr_joao',
        workshop_id: 'ws_auto_sul',
      } as any)

      const saved = saveFuelPreference(
        {
          pricePerLiter: 5.89,
          fuelType: 'ETANOL',
          manualConsumptionKml: 8.5,
        },
        'BRA2E19',
      )

      expect(saved.pricePerLiter).toBe(5.89)
      expect(saved.fuelType).toBe('ETANOL')
      expect(saved.manualConsumptionKml).toBe(8.5)

      // Outro veículo não deve ser afetado
      const otherPref = loadFuelPreference('OUT9999')
      expect(otherPref.pricePerLiter).toBe(6.19)

      // O mesmo veículo deve retornar a preferência salva
      const reloaded = loadFuelPreference('BRA2E19')
      expect(reloaded.pricePerLiter).toBe(5.89)
      expect(reloaded.fuelType).toBe('ETANOL')
      expect(reloaded.manualConsumptionKml).toBe(8.5)

      // Chave correta no localStorage
      const key = getFuelPreferenceStorageKey('BRA2E19')
      expect(key).toContain('ws_auto_sul_usr_joao_BRA2E19')
    })

    it('deve permitir alteração rápida de preço e consumo', () => {
      saveFuelPreference({ pricePerLiter: 6.45 }, 'ABC1234')
      expect(loadFuelPreference('ABC1234').pricePerLiter).toBe(6.45)

      saveFuelPreference({ pricePerLiter: 6.22 }, 'ABC1234')
      expect(loadFuelPreference('ABC1234').pricePerLiter).toBe(6.22)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 2 & 10: CONSUMO (AUTOMÁTICO OBD vs MANUAL)
  // -------------------------------------------------------------
  describe('2 & 10. Provedor de Consumo e Origem dos Dados', () => {
    it('deve usar consumo manual informado quando não houver telemetria OBD de consumo', () => {
      const provider = new HybridConsumptionProvider()
      const reading = provider.getConsumption({
        vehiclePlate: 'ABC1234',
        obdValidAverageKml: null,
        manualKml: 12.5,
      })

      expect(reading.isAutomatic).toBe(false)
      expect(reading.source).toBe('MANUAL_INFORMADO')
      expect(reading.sourceLabel).toBe('Consumo informado')
      expect(reading.badge).toBe('INFORMADO')
      expect(reading.kml).toBe(12.5)
    })

    it('deve usar consumo real automático quando houver OBD validado', () => {
      const provider = new HybridConsumptionProvider()
      const reading = provider.getConsumption({
        vehiclePlate: 'ABC1234',
        obdValidAverageKml: 14.8,
        manualKml: 11.2,
      })

      expect(reading.isAutomatic).toBe(true)
      expect(reading.source).toBe('AUTOMATICO_OBD')
      expect(reading.sourceLabel).toBe('Consumo automático')
      expect(reading.badge).toBe('MEDIDO')
      expect(reading.kml).toBe(14.8)
    })

    it('NÃO deve simular dados automáticos se o OBD retornar inválido ou zero', () => {
      const provider = new HybridConsumptionProvider()
      const reading = provider.getConsumption({
        vehiclePlate: 'ABC1234',
        obdValidAverageKml: 0,
        manualKml: 10.5,
      })

      expect(reading.isAutomatic).toBe(false)
      expect(reading.source).toBe('MANUAL_INFORMADO')
      expect(reading.badge).toBe('INFORMADO')
      expect(reading.kml).toBe(10.5)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 3: CÁLCULOS MATEMÁTICOS, DECIMAIS E PROTEÇÃO ZERO
  // -------------------------------------------------------------
  describe('3. Cálculos de litros, combustível, pedágios e total', () => {
    it('deve calcular corretamente o caso de referência: 180 km ÷ 11,2 km/L a R$ 6,19/L → ~16,07 L → R$ 99,47', () => {
      const res = calculateTripCost({
        distanceKm: 180,
        consumptionKml: 11.2,
        pricePerLiter: 6.19,
        tollsAmount: 0,
      })

      expect(res.isValid).toBe(true)
      expect(res.liters).toBe(16.07) // 180 / 11.2 = 16.0714 -> 16.07
      expect(res.fuelCost).toBe(99.47) // 16.07 * 6.19 = 99.4733 -> 99.47
      expect(res.tollsAmount).toBe(0)
      expect(res.totalCost).toBe(99.47)
    })

    it('deve calcular viagem com múltiplos pedágios', () => {
      const res = calculateTripCost({
        distanceKm: 260,
        consumptionKml: 11.7,
        pricePerLiter: 6.19,
        tollsAmount: 32.8,
      })

      expect(res.isValid).toBe(true)
      // 260 / 11.7 = 22.22 L
      expect(res.liters).toBe(22.22)
      // 22.22 * 6.19 = 137.54
      expect(res.fuelCost).toBe(137.54)
      expect(res.tollsAmount).toBe(32.8)
      // Total = 137.54 + 32.80 = 170.34
      expect(res.totalCost).toBe(170.34)
    })

    it('deve tratar e proteger contra consumo zero ou negativo (evitar divisão por zero)', () => {
      const resZero = calculateTripCost({
        distanceKm: 100,
        consumptionKml: 0,
        pricePerLiter: 6.19,
        tollsAmount: 15,
      })

      expect(resZero.isValid).toBe(false)
      expect(resZero.liters).toBe(0)
      expect(resZero.fuelCost).toBe(0)
      expect(resZero.totalCost).toBe(15) // preserva pedágio sem travar
      expect(resZero.errorMessage).toContain('Consumo médio deve ser maior que zero')
    })

    it('deve tratar preço zero de combustível', () => {
      const resPriceZero = calculateTripCost({
        distanceKm: 100,
        consumptionKml: 10,
        pricePerLiter: 0,
        tollsAmount: 20,
      })

      expect(resPriceZero.isValid).toBe(false)
      expect(resPriceZero.liters).toBe(10)
      expect(resPriceZero.fuelCost).toBe(0)
      expect(resPriceZero.totalCost).toBe(20)
      expect(resPriceZero.errorMessage).toContain('Preço do combustível deve ser maior que zero')
    })

    it('deve tratar campos vazios / NaN com segurança', () => {
      const resNan = calculateTripCost({
        distanceKm: NaN,
        consumptionKml: NaN,
        pricePerLiter: NaN,
        tollsAmount: NaN,
      })

      expect(resNan.isValid).toBe(false)
      expect(resNan.totalCost).toBe(0)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 4: CUSTO ESTIMADO ANTES DA SAÍDA E MÉDIA HISTÓRICA
  // -------------------------------------------------------------
  describe('4. Custo Estimado prévio e Média Histórica', () => {
    it('deve calcular o custo estimado com base na distância prevista', () => {
      const est = calculateEstimatedTripCost({
        estimatedDistanceKm: 260,
        consumptionKml: 11.7,
        pricePerLiter: 6.19,
        estimatedTolls: 32.8,
      })

      expect(est.estimatedDistanceKm).toBe(260)
      expect(est.estimatedLiters).toBe(22.22)
      expect(est.estimatedFuelCost).toBe(137.54)
      expect(est.estimatedTolls).toBe(32.8)
      expect(est.estimatedTotalCost).toBe(170.34)
    })

    it('deve salvar e carregar média histórica de consumo por veículo', () => {
      saveVehicleHistoricalAvgKml('ECO2020', 12.0)
      expect(getVehicleHistoricalAvgKml('ECO2020')).toBe(12.0)

      // Atualiza com média móvel
      saveVehicleHistoricalAvgKml('ECO2020', 10.0)
      // (12*3 + 10)/4 = 46/4 = 11.5
      expect(getVehicleHistoricalAvgKml('ECO2020')).toBe(11.5)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 6: ESTIMADO × REALIZADO
  // -------------------------------------------------------------
  describe('6. Comparação Estimado × Real', () => {
    it('deve calcular economia quando o real for menor que o estimado', () => {
      const comp = compareEstimatedVsReal(165.0, 158.7)
      expect(comp.estimatedTotalCost).toBe(165.0)
      expect(comp.realTotalCost).toBe(158.7)
      expect(comp.differenceCost).toBe(-6.3)
      expect(comp.isEconomy).toBe(true)
      expect(comp.differenceFormatted).toContain('6,30')
    })

    it('deve calcular acréscimo quando o real for maior que o estimado', () => {
      const comp = compareEstimatedVsReal(100.0, 115.5)
      expect(comp.differenceCost).toBe(15.5)
      expect(comp.isEconomy).toBe(false)
      expect(comp.differenceFormatted).toContain('15,50')
    })
  })

  // -------------------------------------------------------------
  // REQUISITOS 5, 7, 8, 9, 12: CICLO COMPLETO DO TRIP SESSION MANAGER
  // -------------------------------------------------------------
  describe('TripSessionManager — Ciclo de Vida e Resiliência', () => {
    it('deve iniciar viagem com parâmetros de custo inteligente e persistir em localStorage', () => {
      const manager = new TripSessionManager()
      const trip = manager.startTrip({
        title: 'Pelotas → Porto Alegre',
        origin: 'Pelotas',
        destination: 'Porto Alegre',
        vehiclePlate: 'BRA2E19',
        fuelPricePerLiter: 6.19,
        consumptionKml: 11.7,
        estimatedDistanceKm: 260,
        estimatedTolls: 32.8,
        workshopId: 'ws_test',
      })

      expect(trip.status).toBe('EM_ANDAMENTO')
      expect(trip.origin).toBe('Pelotas')
      expect(trip.destination).toBe('Porto Alegre')
      expect(trip.fuel_price_per_liter).toBe(6.19)
      expect(trip.avg_consumption_kml).toBe(11.7)
      expect(trip.estimated_distance_km).toBe(260)
      expect(trip.estimated_cost_total).toBe(170.34)

      // Teste de resiliência: reabertura do TripSessionManager (recarrega do localStorage)
      const restoredManager = new TripSessionManager()
      const active = restoredManager.getActiveTrip()
      expect(active).not.toBeNull()
      expect(active?.trip_id).toBe(trip.trip_id)
      expect(active?.fuel_price_per_liter).toBe(6.19)
    })

    it('deve permitir adicionar múltiplos pedágios separados do combustível', () => {
      const manager = new TripSessionManager()
      manager.startTrip({
        title: 'Viagem com Pedágio',
        vehiclePlate: 'BRA2E19',
        fuelPricePerLiter: 6.0,
        consumptionKml: 10.0,
      })

      const t1 = manager.addToll(12.5, 'Praça 1')
      const t2 = manager.addToll(18.3, 'Praça 2')

      expect(t1?.amount).toBe(12.5)
      expect(t2?.amount).toBe(18.3)

      const tolls = manager.getTollsList()
      expect(tolls).toHaveLength(2)
      expect(manager.getActiveTrip()?.tolls_total).toBe(30.8)
    })

    it('deve acumular distância e custo em tempo real ao processar telemetria', () => {
      const manager = new TripSessionManager()
      manager.startTrip({
        title: 'Teste Telemetria',
        vehiclePlate: 'BRA2E19',
        fuelPricePerLiter: 6.0,
        consumptionKml: 10.0, // 10 km/L -> R$ 0,60 por km
      })

      // Simula 20 segundos a 100 km/h: deltaKm = (100 * 20)/3600 = 0.555 km
      const t0 = 1000
      const t1 = 21000
      manager.processTelemetry({ speedKmh: 100, monoMs: t0 })
      manager.processTelemetry({ speedKmh: 100, monoMs: t1 })

      const trip = manager.getActiveTrip()!
      expect(trip.distance_km).toBeGreaterThan(0)
      expect(trip.real_fuel_liters).toBeGreaterThan(0)
      expect(trip.fuel_cost_total).toBeGreaterThan(0)
      expect(trip.total_cost).toBe(trip.fuel_cost_total)
    })

    it('deve atualizar dinamicamente o preço do combustível durante a viagem', () => {
      const manager = new TripSessionManager()
      manager.startTrip({
        title: 'Ajuste Dinâmico',
        fuelPricePerLiter: 5.0,
        consumptionKml: 10.0,
      })

      // Força distância de 50 km
      manager.getActiveTrip()!.distance_km = 50
      manager.updateFuelPrice(6.0)

      const trip = manager.getActiveTrip()!
      expect(trip.fuel_price_per_liter).toBe(6.0)
      // 50 km / 10 = 5 L * 6.0 = R$ 30,00
      expect(trip.real_fuel_liters).toBe(5.0)
      expect(trip.fuel_cost_total).toBe(30.0)
    })

    it('deve finalizar a viagem, gerar Resumo Completo com distinção MEDIDO/ESTIMADO/INFORMADO e salvar no Histórico', () => {
      const manager = new TripSessionManager()
      manager.startTrip({
        title: 'Pelotas → Porto Alegre',
        origin: 'Pelotas',
        destination: 'Porto Alegre',
        vehiclePlate: 'BRA2E19',
        fuelPricePerLiter: 6.19,
        consumptionKml: 11.7,
        estimatedDistanceKm: 260,
        estimatedTolls: 32.8,
      })

      manager.addToll(32.8, 'Praça BR-116')

      // Simula término com 260 km
      manager.getActiveTrip()!.distance_km = 260
      manager.getActiveTrip()!.duration_seconds = 3 * 3600 + 12 * 60 // 3h12

      const finished = manager.endTrip()
      expect(finished).not.toBeNull()
      expect(finished?.status).toBe('CONCLUIDA')
      expect(finished?.total_cost).toBeGreaterThan(100)

      const report = finished?.cost_summary_report
      expect(report).toBeDefined()
      expect(report?.origin).toBe('Pelotas')
      expect(report?.destination).toBe('Porto Alegre')
      expect(report?.distanceKm).toBe(260)
      expect(report?.distanceOrigin).toBe('MEDIDO')
      expect(report?.durationFormatted).toBe('3h12')
      expect(report?.durationOrigin).toBe('MEDIDO')
      expect(report?.consumptionOrigin).toBe('INFORMADO')
      expect(report?.fuelPriceOrigin).toBe('INFORMADO')
      expect(report?.fuelLitersOrigin).toBe('ESTIMADO')
      expect(report?.tollsOrigin).toBe('INFORMADO')
      expect(report?.tollsTotal).toBe(32.8)

      // Viagem ativa deve ter sido limpa
      expect(manager.getActiveTrip()).toBeNull()

      // Histórico local deve conter a viagem concluída
      const history = manager.getLocalTripHistory('BRA2E19')
      expect(history.length).toBeGreaterThanOrEqual(1)
      expect(history[0].trip_id).toBe(finished?.trip_id)
      expect(history[0].cost_summary_report).toBeDefined()
    })
  })
})
