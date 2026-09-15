import React from 'react'
import {
  CheckCircle2,
  Receipt,
  Fuel,
  Navigation,
  Clock,
  Gauge,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TripCostSummaryReport, DataOriginBadge } from '@/types/etapa6'
import { formatBrl } from '@/lib/trip/trip-cost-service'

interface TripFinishedSummaryModalProps {
  report: TripCostSummaryReport | null
  isOpen: boolean
  onClose: () => void
}

export const TripFinishedSummaryModal: React.FC<TripFinishedSummaryModalProps> = ({
  report,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !report) return null

  const renderBadge = (badge: DataOriginBadge) => {
    if (badge === 'MEDIDO') {
      return (
        <span
          data-testid="badge-modal-medido"
          className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-700"
        >
          MEDIDO
        </span>
      )
    }
    if (badge === 'INFORMADO') {
      return (
        <span
          data-testid="badge-modal-informado"
          className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-700"
        >
          INFORMADO
        </span>
      )
    }
    return (
      <span
        data-testid="badge-modal-estimado"
        className="text-[9px] font-bold font-mono px-1.5 py-0.2 rounded bg-amber-950 text-[#FFB300] border border-amber-700"
      >
        ESTIMADO
      </span>
    )
  }

  const hasEstimated = report.estimatedTotalCost !== undefined && report.estimatedTotalCost > 0
  const diff = report.costDifference || 0
  const isEconomy = diff < 0

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#101720] border-2 border-emerald-500 rounded-2xl max-w-xl w-full p-4 sm:p-5 shadow-2xl space-y-4">
        {/* Topo do Modal */}
        <div className="flex items-center justify-between border-b border-[#202B37] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#FFB300] uppercase tracking-wider block">
                Viagem Concluída
              </span>
              <h3 className="text-base sm:text-lg font-black text-white">
                {report.origin} → {report.destination}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1A232E]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo Formatado do Requisito 8:
            "Pelotas → Porto Alegre · Distância: 260 km · Tempo: 3h12 · Média: 11,7 km/L · Combustível utilizado: 22,2 L · Custo combustível: R$ 137,42 · Pedágios: R$ 32,80 · Custo total: R$ 170,22"
        */}
        <div className="bg-[#0B0F14] border border-[#202B37] rounded-xl p-3 text-xs sm:text-sm font-medium text-gray-200 leading-relaxed font-sans">
          <span className="text-[#FFB300] font-bold">{report.origin}</span> →{' '}
          <span className="text-[#FFB300] font-bold">{report.destination}</span> · Distância:{' '}
          <strong className="text-white font-mono">{report.distanceKm} km</strong> · Tempo:{' '}
          <strong className="text-white font-mono">{report.durationFormatted}</strong> · Média:{' '}
          <strong className="text-cyan-300 font-mono">{report.avgConsumptionKml} km/L</strong> ·
          Combustível utilizado:{' '}
          <strong className="text-white font-mono">{report.fuelLitersUsed} L</strong> · Custo
          combustível:{' '}
          <strong className="text-white font-mono">{formatBrl(report.fuelCost)}</strong> · Pedágios:{' '}
          <strong className="text-cyan-300 font-mono">{formatBrl(report.tollsTotal)}</strong> ·{' '}
          <span className="text-emerald-400 font-bold">Custo total:</span>{' '}
          <strong className="text-emerald-300 font-black text-sm font-mono">
            {formatBrl(report.totalCost)}
          </strong>
        </div>

        {/* Tabela de Classificação de Dados: MEDIDO, ESTIMADO ou INFORMADO (Requisito 8) */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block">
            Classificação da Origem dos Dados (Transparência Automotiva):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-[#121A24] p-2 rounded-lg border border-[#202B37] flex justify-between items-center">
              <span className="text-gray-400">Distância:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-white">{report.distanceKm} km</span>
                {renderBadge(report.distanceOrigin)}
              </div>
            </div>

            <div className="bg-[#121A24] p-2 rounded-lg border border-[#202B37] flex justify-between items-center">
              <span className="text-gray-400">Tempo:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-white">{report.durationFormatted}</span>
                {renderBadge(report.durationOrigin)}
              </div>
            </div>

            <div className="bg-[#121A24] p-2 rounded-lg border border-[#202B37] flex justify-between items-center">
              <span className="text-gray-400">Consumo:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-cyan-300">{report.avgConsumptionKml} km/L</span>
                {renderBadge(report.consumptionOrigin)}
              </div>
            </div>

            <div className="bg-[#121A24] p-2 rounded-lg border border-[#202B37] flex justify-between items-center">
              <span className="text-gray-400">Litros:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-white">{report.fuelLitersUsed} L</span>
                {renderBadge(report.fuelLitersOrigin)}
              </div>
            </div>

            <div className="bg-[#121A24] p-2 rounded-lg border border-[#202B37] flex justify-between items-center">
              <span className="text-gray-400">Preço/L:</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-white">{formatBrl(report.fuelPricePerLiter)}</span>
                {renderBadge(report.fuelPriceOrigin)}
              </div>
            </div>

            <div className="bg-[#121A24] p-2 rounded-lg border border-[#202B37] flex justify-between items-center">
              <span className="text-gray-400">Pedágios ({report.tollsCount}):</span>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono text-cyan-300">{formatBrl(report.tollsTotal)}</span>
                {renderBadge(report.tollsOrigin)}
              </div>
            </div>
          </div>
        </div>

        {/* Comparativo Final Estimado vs Real (Requisito 6) */}
        {hasEstimated && (
          <div className="bg-[#121A24] p-3 rounded-xl border border-[#202B37] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">
                Balanço Estimado × Realizado
              </span>
              <div className="text-gray-300 font-mono">
                Estimado: <strong>{formatBrl(report.estimatedTotalCost!)}</strong> • Real:{' '}
                <strong className="text-emerald-300">{formatBrl(report.totalCost)}</strong>
              </div>
            </div>

            <div
              className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs flex items-center space-x-1.5 ${
                isEconomy
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                  : 'bg-amber-950 text-amber-300 border border-amber-700'
              }`}
            >
              {isEconomy ? (
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingUp className="w-4 h-4 text-amber-400" />
              )}
              <span>
                Diferença: {diff < 0 ? '−' : '+'}
                {formatBrl(Math.abs(diff))}
              </span>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button
            onClick={onClose}
            className="btn-touch-automotive bg-[#FFB300] hover:bg-[#e5a000] text-black font-black text-xs px-6 rounded-xl"
          >
            Fechar e Salvar no Histórico
          </Button>
        </div>
      </div>
    </div>
  )
}
