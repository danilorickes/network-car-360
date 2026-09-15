import React, { useState, useEffect } from 'react'
import {
  DollarSign,
  Fuel,
  Receipt,
  Navigation,
  Plus,
  Play,
  Square,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  History,
  Info,
  Clock,
  Gauge,
  MapPin,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  TripSessionModel,
  TollItem,
  FuelType,
  TripCostSummaryReport,
  ConsumptionSourceType,
  DataOriginBadge,
} from '@/types/etapa6'
import {
  formatBrl,
  roundToTwo,
  loadFuelPreference,
  saveFuelPreference,
  calculateTripCost,
  calculateEstimatedTripCost,
  compareEstimatedVsReal,
  getVehicleHistoricalAvgKml,
} from '@/lib/trip/trip-cost-service'

interface TripCostPanelProps {
  activeTrip: TripSessionModel | null
  vehiclePlate?: string
  isVehicleMoving?: boolean
  isPassengerMode?: boolean
  isNightMode?: boolean
  onStartTrip: (params: {
    title: string
    origin: string
    destination: string
    fuelPricePerLiter: number
    fuelType: FuelType
    consumptionKml: number
    consumptionSource: ConsumptionSourceType
    estimatedDistanceKm?: number
    estimatedTolls?: number
  }) => void
  onEndTrip: () => void
  onAddToll: (amount: number, name?: string) => void
  onUpdateFuelPrice?: (price: number) => void
  tripHistory?: TripSessionModel[]
}

export const TripCostPanel: React.FC<TripCostPanelProps> = ({
  activeTrip,
  vehiclePlate,
  isVehicleMoving = false,
  isPassengerMode = false,
  isNightMode = true,
  onStartTrip,
  onEndTrip,
  onAddToll,
  onUpdateFuelPrice,
  tripHistory = [],
}) => {
  // Carrega preferências salvas
  const [fuelPref, setFuelPref] = useState(() => loadFuelPreference(vehiclePlate))

  // Formulário Pré-Viagem (Configuração Antes da Saída)
  const [origin, setOrigin] = useState('Pelotas')
  const [destination, setDestination] = useState('Porto Alegre')
  const [fuelPriceInput, setFuelPriceInput] = useState(String(fuelPref.pricePerLiter))
  const [fuelType, setFuelType] = useState<FuelType>(fuelPref.fuelType || 'GASOLINA')
  const [consumptionInput, setConsumptionInput] = useState(String(fuelPref.manualConsumptionKml))
  const [estimatedDistanceInput, setEstimatedDistanceInput] = useState('260')
  const [estimatedTollsInput, setEstimatedTollsInput] = useState('32.80')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showFinishedSummaryModal, setShowFinishedSummaryModal] = useState(false)
  const [lastFinishedReport, setLastFinishedReport] = useState<TripCostSummaryReport | null>(null)

  // Pedágio Rápido durante Viagem
  const [tollAmountInput, setTollAmountInput] = useState('')
  const [tollNameInput, setTollNameInput] = useState('')
  const [showTollForm, setShowTollForm] = useState(false)

  // Ajuste rápido de preço do combustível durante viagem
  const [showQuickFuelEdit, setShowQuickFuelEdit] = useState(false)
  const [quickFuelPrice, setQuickFuelPrice] = useState(
    String(activeTrip?.fuel_price_per_liter || fuelPref.pricePerLiter),
  )

  // Histórico de consumo do veículo
  const historicalAvgKml = getVehicleHistoricalAvgKml(vehiclePlate)

  // Sincroniza preferências quando muda a placa
  useEffect(() => {
    const loaded = loadFuelPreference(vehiclePlate)
    setFuelPref(loaded)
    setFuelPriceInput(String(loaded.pricePerLiter))
    setConsumptionInput(String(loaded.manualConsumptionKml))
    setFuelType(loaded.fuelType || 'GASOLINA')
  }, [vehiclePlate])

  // Preço e consumo válidos numéricos
  const currentPrice = parseFloat(fuelPriceInput) || 0
  const currentConsumption = parseFloat(consumptionInput) || 0
  const estDistance = parseFloat(estimatedDistanceInput) || 0
  const estTolls = parseFloat(estimatedTollsInput) || 0

  // Cálculo prévio em tempo real para a tela "Antes da Saída"
  const estimatedSummary = calculateEstimatedTripCost({
    estimatedDistanceKm: estDistance,
    consumptionKml: currentConsumption > 0 ? currentConsumption : 11.2,
    pricePerLiter: currentPrice > 0 ? currentPrice : 6.19,
    estimatedTolls: estTolls,
  })

  // Handlers
  const handleStartTripSubmit = () => {
    if (currentPrice <= 0) return
    if (currentConsumption <= 0) return

    // Salva preferências por oficina + usuário + veículo
    saveFuelPreference(
      {
        pricePerLiter: currentPrice,
        fuelType,
        manualConsumptionKml: currentConsumption,
      },
      vehiclePlate,
    )

    onStartTrip({
      title: `${origin.trim() || 'Origem'} → ${destination.trim() || 'Destino'}`,
      origin: origin.trim() || 'Origem',
      destination: destination.trim() || 'Destino',
      fuelPricePerLiter: currentPrice,
      fuelType,
      consumptionKml: currentConsumption,
      consumptionSource: 'MANUAL_INFORMADO',
      estimatedDistanceKm: estDistance > 0 ? estDistance : undefined,
      estimatedTolls: estTolls > 0 ? estTolls : undefined,
    })
  }

  const handleAddTollSubmit = () => {
    const val = parseFloat(tollAmountInput.replace(',', '.'))
    if (!isNaN(val) && val > 0) {
      onAddToll(val, tollNameInput.trim() || undefined)
      setTollAmountInput('')
      setTollNameInput('')
      setShowTollForm(false)
    }
  }

  const handleQuickFuelSave = () => {
    const val = parseFloat(quickFuelPrice.replace(',', '.'))
    if (!isNaN(val) && val > 0) {
      saveFuelPreference({ pricePerLiter: val }, vehiclePlate)
      onUpdateFuelPrice?.(val)
      setShowQuickFuelEdit(false)
    }
  }

  // Badges de dados (MEDIDO / ESTIMADO / INFORMADO)
  const renderDataBadge = (badge: DataOriginBadge) => {
    if (badge === 'MEDIDO') {
      return (
        <span
          data-testid="badge-medido"
          className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700 uppercase"
        >
          MEDIDO
        </span>
      )
    }
    if (badge === 'INFORMADO') {
      return (
        <span
          data-testid="badge-informado"
          className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700 uppercase"
        >
          INFORMADO
        </span>
      )
    }
    return (
      <span
        data-testid="badge-estimado"
        className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-[#FFB300] border border-amber-700 uppercase"
      >
        ESTIMADO
      </span>
    )
  }

  // =====================================================================
  // CENÁRIO A: DURANTE A VIAGEM — Card Modo Motorista com Números Grandes
  // =====================================================================
  if (activeTrip && activeTrip.status === 'EM_ANDAMENTO') {
    const distanceKm = activeTrip.distance_km || 0
    const consumptionKml = activeTrip.avg_consumption_kml || 11.2
    const litersUsed = activeTrip.real_fuel_liters || 0
    const fuelCost = activeTrip.fuel_cost_total || 0
    const tollsTotal = activeTrip.tolls_total || 0
    const totalCost = activeTrip.total_cost || 0
    const tollsList = activeTrip.tolls_breakdown || []

    const estTotal = activeTrip.estimated_cost_total
    const hasEstimation = estTotal !== undefined && estTotal > 0
    const vsReal = hasEstimation ? compareEstimatedVsReal(estTotal!, totalCost) : null

    const isAutomatic = activeTrip.consumption_source === 'AUTOMATICO_OBD'
    const consumptionBadgeText = isAutomatic ? 'Consumo automático' : 'Consumo informado'

    return (
      <div className="space-y-2 sm:space-y-3">
        {/* Header da Viagem em Andamento */}
        <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-center sm:text-left">
            <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-600 flex items-center justify-center text-emerald-400 shrink-0">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2 justify-center sm:justify-start">
                <span className="text-xs font-bold text-[#FFB300] uppercase tracking-wider">
                  Viagem em Andamento
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  {consumptionBadgeText}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-black text-white">{activeTrip.title}</h3>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {/* Botão Adicionar Pedágio */}
            <Button
              size="sm"
              onClick={() => setShowTollForm(!showTollForm)}
              className="btn-touch-automotive bg-[#1F2B3A] hover:bg-[#2B394A] text-cyan-300 border border-cyan-800 font-bold text-xs h-9 px-3.5 rounded-xl"
            >
              <Receipt className="w-3.5 h-3.5 mr-1 text-cyan-400" />+ Pedágio
            </Button>

            {/* Botão Finalizar Viagem */}
            <Button
              size="sm"
              onClick={onEndTrip}
              className="btn-touch-automotive bg-red-600 hover:bg-red-700 text-white font-black text-xs h-9 px-4 rounded-xl shadow"
            >
              <Square className="w-3.5 h-3.5 mr-1 fill-current" />
              Finalizar Viagem
            </Button>
          </div>
        </div>

        {/* Modal / Card Inline de Adicionar Pedágio */}
        {showTollForm && (
          <div className="bg-[#0B0F14] border-2 border-cyan-600 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Receipt className="w-4 h-4" />
                <span>Adicionar Pedágio em Reais (R$)</span>
              </span>
              <span className="text-[11px] text-gray-400 font-mono">Entrada rápida</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Identificação (ex: Praça Pelotas / Pedágio BR-116)"
                value={tollNameInput}
                onChange={(e) => setTollNameInput(e.target.value)}
                className="bg-[#121A24] border border-[#202B37] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">R$</span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="0,00"
                  value={tollAmountInput}
                  onChange={(e) => setTollAmountInput(e.target.value)}
                  className="w-full bg-[#121A24] border border-[#202B37] rounded-lg pl-9 pr-3 py-2 text-sm font-bold font-mono text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={handleAddTollSubmit}
                  className="btn-touch-automotive flex-1 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs h-9 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Salvar Pedágio
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowTollForm(false)}
                  className="text-xs text-gray-400 hover:text-white h-9 px-2"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* CARD MODO MOTORISTA: Números Grandes, Leitura Rápida e Custo em Tempo Real */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5">
          {/* 1. Distância Percorrida */}
          <div className="bg-[#0B0F14] border border-[#202B37] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-gray-400 font-medium">
                Km Percorridos
              </span>
              {renderDataBadge('MEDIDO')}
            </div>
            <div className="flex items-baseline space-x-1 my-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-black font-mono text-white">
                {distanceKm.toFixed(1)}
              </span>
              <span className="text-xs text-gray-400 font-bold font-mono">km</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono truncate">
              Distância acumulada
            </span>
          </div>

          {/* 2. Consumo Médio */}
          <div className="bg-[#0B0F14] border border-[#202B37] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-gray-400 font-medium">
                Consumo Médio
              </span>
              {renderDataBadge(isAutomatic ? 'MEDIDO' : 'INFORMADO')}
            </div>
            <div className="flex items-baseline space-x-1 my-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-black font-mono text-cyan-300">
                {consumptionKml.toFixed(1)}
              </span>
              <span className="text-xs text-gray-400 font-bold font-mono">km/L</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono truncate">
              {consumptionBadgeText}
            </span>
          </div>

          {/* 3. Combustível Consumido (Litros) */}
          <div className="bg-[#0B0F14] border border-[#202B37] rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-gray-400 font-medium">Combustível</span>
              {renderDataBadge(isAutomatic ? 'MEDIDO' : 'ESTIMADO')}
            </div>
            <div className="flex items-baseline space-x-1 my-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-black font-mono text-[#FFB300]">
                {litersUsed.toFixed(2)}
              </span>
              <span className="text-xs text-gray-400 font-bold font-mono">L</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono truncate">
              {formatBrl(activeTrip.fuel_price_per_liter || 0)}/L (
              {activeTrip.fuel_type || 'GASOLINA'})
            </span>
          </div>

          {/* 4. Custo Total Acumulado */}
          <div className="bg-gradient-to-br from-[#121A24] to-[#162231] border-2 border-emerald-500/60 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] sm:text-xs text-emerald-400 font-bold uppercase tracking-wider">
                Custo Até Agora
              </span>
              {renderDataBadge('ESTIMADO')}
            </div>
            <div className="flex items-baseline space-x-1 my-1">
              <span className="text-2xl sm:text-3xl md:text-4xl font-black font-mono text-emerald-300">
                {formatBrl(totalCost)}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono truncate">
              Comb: {formatBrl(fuelCost)} • Ped: {formatBrl(tollsTotal)}
            </span>
          </div>
        </div>

        {/* Linhas Separadas: Combustível, Pedágios e Total (Requisito 5 & 7) */}
        <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-[#202B37] pb-1.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#FFB300]" />
              <span>Detalhamento dos Custos da Viagem Atual</span>
            </span>
            <button
              type="button"
              onClick={() => setShowQuickFuelEdit(!showQuickFuelEdit)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-mono"
            >
              Ajustar preço/L ({formatBrl(activeTrip.fuel_price_per_liter || 0)})
            </button>
          </div>

          {showQuickFuelEdit && (
            <div className="bg-[#0B0F14] p-2 rounded-lg border border-[#202B37] flex items-center space-x-2">
              <span className="text-xs text-gray-300 font-mono">Novo preço/L (R$):</span>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={quickFuelPrice}
                onChange={(e) => setQuickFuelPrice(e.target.value)}
                className="w-24 bg-[#121A24] border border-[#202B37] rounded px-2 py-1 text-xs font-bold text-white font-mono"
              />
              <Button
                size="sm"
                onClick={handleQuickFuelSave}
                className="btn-touch-automotive bg-[#FFB300] text-black font-bold text-xs h-7 px-3"
              >
                Salvar
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs">
            <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37] flex justify-between items-center">
              <div>
                <span className="text-gray-400 block text-[11px]">Combustível</span>
                <span className="text-[10px] text-gray-500">
                  {litersUsed.toFixed(2)} L utilizados
                </span>
              </div>
              <strong className="text-white text-sm">{formatBrl(fuelCost)}</strong>
            </div>

            <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37] flex justify-between items-center">
              <div>
                <span className="text-gray-400 block text-[11px]">
                  Pedágios ({tollsList.length})
                </span>
                <span className="text-[10px] text-gray-500">
                  {tollsList.length > 0 ? 'Entrada manual' : 'Nenhum adicionado'}
                </span>
              </div>
              <strong className="text-cyan-300 text-sm">{formatBrl(tollsTotal)}</strong>
            </div>

            <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-emerald-600/50 flex justify-between items-center">
              <div>
                <span className="text-emerald-400 block text-[11px] font-bold">
                  TOTAL DA VIAGEM
                </span>
                <span className="text-[10px] text-gray-400">Combustível + Pedágios</span>
              </div>
              <strong className="text-emerald-300 text-base font-black">
                {formatBrl(totalCost)}
              </strong>
            </div>
          </div>

          {/* Comparativo Estimado × Realizado Até Agora (Requisito 6) */}
          {vsReal && (
            <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400 font-mono">Estimado Previsto:</span>
                <strong className="text-white font-mono">
                  {formatBrl(vsReal.estimatedTotalCost)}
                </strong>
                <span className="text-gray-500">•</span>
                <span className="text-gray-400 font-mono">Real até agora:</span>
                <strong className="text-emerald-300 font-mono">
                  {formatBrl(vsReal.realTotalCost)}
                </strong>
              </div>

              <div className="flex items-center space-x-1.5">
                <span className="text-gray-400 font-mono">Diferença:</span>
                <span
                  className={`font-mono font-bold px-2 py-0.5 rounded text-xs flex items-center space-x-1 ${
                    vsReal.isEconomy
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {vsReal.isEconomy ? (
                    <TrendingDown className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <TrendingUp className="w-3 h-3 text-amber-400" />
                  )}
                  <span>{vsReal.differenceFormatted}</span>
                </span>
              </div>
            </div>
          )}

          {/* Lista de Pedágios Adicionados */}
          {tollsList.length > 0 && (
            <div className="pt-1 space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                Pedágios Registrados nesta viagem:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                {tollsList.map((t) => (
                  <div
                    key={t.id}
                    className="bg-[#0B0F14] px-2.5 py-1.5 rounded border border-[#202B37] flex justify-between items-center text-xs"
                  >
                    <span className="text-gray-300 truncate font-sans">{t.name}</span>
                    <strong className="text-cyan-300 font-mono ml-2">{formatBrl(t.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // =====================================================================
  // CENÁRIO B: ANTES DA VIAGEM — Painel de Custo Estimado & Configuração Rápida
  // =====================================================================
  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Header com botão de histórico */}
      <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-[#FFB300] uppercase tracking-wider block mb-0.5">
            Custo Inteligente de Viagem
          </span>
          <div className="text-base sm:text-lg font-black text-white">
            Previsão e Configuração da Rota
          </div>
          <div className="text-[11px] sm:text-xs text-gray-400">
            Valores prévios salvos automaticamente por oficina + usuário + veículo. Mínimo
            preenchimento manual.
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowHistoryModal(!showHistoryModal)}
            className="btn-touch-automotive bg-[#121A24] border-[#202B37] text-cyan-300 hover:text-white font-bold text-xs h-9 px-3 rounded-xl"
          >
            <History className="w-3.5 h-3.5 mr-1" />
            Histórico ({tripHistory.length})
          </Button>

          <Button
            size="lg"
            onClick={handleStartTripSubmit}
            disabled={currentPrice <= 0 || currentConsumption <= 0}
            className="btn-touch-automotive font-black tracking-wider text-xs sm:text-sm px-6 rounded-xl shadow-lg bg-[#2ECC71] hover:bg-[#27ae60] text-black"
          >
            <Play className="w-4 h-4 mr-2 fill-current" />
            INICIAR VIAGEM
          </Button>
        </div>
      </div>

      {/* Formulário Pré-Viagem: Origem, Destino, Preço do Combustível e Consumo */}
      <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#202B37] pb-1.5">
          <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
            <Fuel className="w-3.5 h-3.5 text-[#FFB300]" />
            <span>Parâmetros de Custo Antes da Saída</span>
          </span>
          {historicalAvgKml && (
            <span className="text-[10px] text-emerald-400 font-mono">
              Média histórica do veículo: <strong>{historicalAvgKml} km/L</strong>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {/* Origem e Destino */}
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-medium block">Origem</label>
            <input
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="Ex: Pelotas"
              className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-medium block">Destino</label>
            <input
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex: Porto Alegre"
              className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          {/* Preço do Combustível R$/Litro */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-400 font-medium block">
                Preço Combustível
              </label>
              {renderDataBadge('INFORMADO')}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={fuelPriceInput}
                onChange={(e) => setFuelPriceInput(e.target.value)}
                placeholder="6,19"
                className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg pl-9 pr-12 py-2 text-white text-xs font-bold font-mono focus:outline-none focus:border-[#FFB300]"
              />
              <span className="absolute right-3 top-2 text-[11px] text-gray-400 font-bold">/L</span>
            </div>
          </div>

          {/* Consumo Médio Informado */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-400 font-medium block">Consumo Médio</label>
              {renderDataBadge('INFORMADO')}
            </div>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.5"
                value={consumptionInput}
                onChange={(e) => setConsumptionInput(e.target.value)}
                placeholder="11.2"
                className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg px-3 py-2 text-white text-xs font-bold font-mono focus:outline-none focus:border-[#FFB300]"
              />
              <span className="absolute right-3 top-2 text-[11px] text-gray-400 font-bold">
                km/L
              </span>
            </div>
          </div>
        </div>

        {/* Linha 2: Distância Prevista, Pedágios Previstos e Tipo de Combustível */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-medium block">
              Distância Prevista (km)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={estimatedDistanceInput}
              onChange={(e) => setEstimatedDistanceInput(e.target.value)}
              placeholder="260"
              className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg px-3 py-2 text-white text-xs font-bold font-mono focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-medium block">
              Pedágios Previstos (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">R$</span>
              <input
                type="number"
                step="0.1"
                min="0"
                value={estimatedTollsInput}
                onChange={(e) => setEstimatedTollsInput(e.target.value)}
                placeholder="32.80"
                className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg pl-9 pr-3 py-2 text-white text-xs font-bold font-mono focus:outline-none focus:border-[#FFB300]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-gray-400 font-medium block">Tipo Combustível</label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value as FuelType)}
              className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg px-3 py-2 text-white text-xs font-bold focus:outline-none focus:border-[#FFB300]"
            >
              <option value="GASOLINA">Gasolina</option>
              <option value="ETANOL">Etanol</option>
              <option value="DIESEL">Diesel</option>
              <option value="GNV">GNV</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* CARD DE CUSTO ESTIMADO DA VIAGEM (NC-ME001-E6.5 Requisito 4)          */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-r from-[#121A24] via-[#15212F] to-[#121A24] border-2 border-[#FFB300]/40 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#202B37] pb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#FFB300]" />
            <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Custo Estimado da Viagem
            </span>
          </div>
          <span className="text-[11px] font-mono text-gray-300">
            {origin} → {destination}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {/* Distância */}
          <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37]">
            <span className="text-[10px] text-gray-400 font-medium block">Distância Prevista</span>
            <div className="flex items-baseline space-x-1 my-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-white">
                {estimatedSummary.estimatedDistanceKm}
              </span>
              <span className="text-[10px] text-gray-400 font-bold font-mono">km</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              Consumo: {estimatedSummary.consumptionKml} km/L
            </span>
          </div>

          {/* Litros Estimados */}
          <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37]">
            <span className="text-[10px] text-gray-400 font-medium block">Litros Estimados</span>
            <div className="flex items-baseline space-x-1 my-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-[#FFB300]">
                {estimatedSummary.estimatedLiters}
              </span>
              <span className="text-[10px] text-gray-400 font-bold font-mono">L</span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              {formatBrl(estimatedSummary.pricePerLiter)}/L
            </span>
          </div>

          {/* Combustível Previsto */}
          <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37]">
            <span className="text-[10px] text-gray-400 font-medium block">Custo Combustível</span>
            <div className="flex items-baseline space-x-1 my-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-white">
                {formatBrl(estimatedSummary.estimatedFuelCost)}
              </span>
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              Pedágios: {formatBrl(estimatedSummary.estimatedTolls)}
            </span>
          </div>

          {/* TOTAL ESTIMADO */}
          <div className="bg-[#0B0F14] p-2.5 rounded-lg border-2 border-emerald-500/70">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              TOTAL ESTIMADO
            </span>
            <div className="flex items-baseline space-x-1 my-0.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-emerald-300">
                {formatBrl(estimatedSummary.estimatedTotalCost)}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono">Combustível + Pedágios</span>
          </div>
        </div>
      </div>

      {/* Histórico das Viagens (Modal / Gaveta) */}
      {showHistoryModal && (
        <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between border-b border-[#202B37] pb-1.5">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
              <History className="w-4 h-4 text-cyan-400" />
              <span>Histórico de Viagens Concluídas ({tripHistory.length})</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHistoryModal(false)}
              className="text-xs text-gray-400 hover:text-white h-7 px-2"
            >
              Fechar
            </Button>
          </div>

          {tripHistory.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">
              Nenhuma viagem concluída salva para este veículo.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              {tripHistory.map((trip) => {
                const rep = trip.cost_summary_report
                const tollsCount = (trip.tolls_breakdown || []).length
                return (
                  <div
                    key={trip.trip_id}
                    className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37] text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white">
                        {trip.origin || 'Origem'} → {trip.destination || 'Destino'}
                      </span>
                      <span className="text-emerald-300 font-mono text-sm">
                        {formatBrl(trip.total_cost || 0)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 font-mono">
                      <span>Data: {new Date(trip.started_at).toLocaleDateString('pt-BR')}</span>
                      <span>Dist: {trip.distance_km || 0} km</span>
                      <span>Consumo: {trip.avg_consumption_kml || '—'} km/L</span>
                      <span>Combustível: {formatBrl(trip.fuel_cost_total || 0)}</span>
                      <span>
                        Pedágios ({tollsCount}): {formatBrl(trip.tolls_total || 0)}
                      </span>
                      <span>
                        Fonte:{' '}
                        {trip.consumption_source === 'AUTOMATICO_OBD' ? 'Automático' : 'Informado'}
                      </span>
                    </div>

                    {rep?.costDifference !== undefined && (
                      <div className="text-[10px] text-gray-400 font-mono pt-0.5">
                        Estimado: {formatBrl(rep.estimatedTotalCost || 0)} • Diferença:{' '}
                        <span
                          className={
                            rep.costDifference <= 0
                              ? 'text-emerald-400 font-bold'
                              : 'text-amber-400'
                          }
                        >
                          {rep.costDifference <= 0 ? '−' : '+'}
                          {formatBrl(Math.abs(rep.costDifference))}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
