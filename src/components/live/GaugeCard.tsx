import React from 'react'
import { SampleQuality } from '@/types/obd'

interface SparklineProps {
  data: number[]
  color?: string
  width?: number
  height?: number
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#FFB300',
  width = 100,
  height = 28,
}) => {
  if (!data || data.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="flex items-center justify-center text-[10px] text-[#9AA7B4]/40 font-mono"
      >
        --
      </div>
    )
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width
      const y = height - ((val - min) / range) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

interface GaugeCardProps {
  pid: string
  label: string
  shortName: string
  value?: number
  formattedValue?: string
  unit?: string
  quality?: SampleQuality
  sparkline?: number[]
  isPriority?: boolean
  accentColor?: string
}

export const GaugeCard: React.FC<GaugeCardProps> = ({
  pid,
  label,
  shortName,
  value,
  formattedValue,
  unit,
  quality = 'NO_RESPONSE',
  sparkline = [],
  isPriority = false,
  accentColor = '#FFB300',
}) => {
  // Tradução do status de qualidade
  const getQualityBadge = () => {
    switch (quality) {
      case 'OK':
        return (
          <span className="text-[10px] text-[#2ECC71] font-semibold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
            OK
          </span>
        )
      case 'TIMEOUT':
        return (
          <span className="text-[10px] text-amber-400 font-semibold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
            TIMEOUT
          </span>
        )
      case 'UNSUPPORTED':
        return (
          <span className="text-[10px] text-gray-400 font-semibold bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">
            N/D
          </span>
        )
      case 'INVALID':
        return (
          <span className="text-[10px] text-red-400 font-semibold bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/60">
            INVÁLIDO
          </span>
        )
      case 'NO_RESPONSE':
      default:
        return (
          <span className="text-[10px] text-red-300 font-semibold bg-red-950/80 px-1.5 py-0.5 rounded border border-red-800/80">
            SEM COMUNICAÇÃO
          </span>
        )
    }
  }

  const isDisconnectedOrError = quality === 'NO_RESPONSE' || quality === 'UNSUPPORTED'

  return (
    <div
      className={`relative bg-[#131A22] border rounded-lg p-3.5 transition-all duration-200 hover:-translate-y-0.5 ${
        isPriority ? 'border-[#263340] hover:border-[#FFB300]/50' : 'border-[#263340]/80'
      }`}
    >
      {/* Header: ShortName + PID Hex + Quality Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-sm text-white tracking-tight">{shortName}</span>
          <span className="text-[11px] font-mono text-[#9AA7B4] bg-[#0B0F14] px-1.5 py-0.5 rounded border border-[#263340]">
            {pid}
          </span>
        </div>
        <div>{getQualityBadge()}</div>
      </div>

      {/* Full descriptive label */}
      <div className="text-[11px] text-[#9AA7B4] truncate mb-2" title={label}>
        {label}
      </div>

      {/* Main Value Display */}
      <div className="flex items-baseline justify-between mt-1">
        <div className="tabular-nums font-bold tracking-tight text-white flex items-baseline space-x-1.5">
          {isDisconnectedOrError ? (
            <span className="text-xl sm:text-2xl text-[#9AA7B4]/60 font-mono">
              {quality === 'UNSUPPORTED' ? 'N/D' : '--'}
            </span>
          ) : (
            <>
              <span
                className={isPriority ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}
                style={{ color: accentColor }}
              >
                {formattedValue !== undefined ? formattedValue : value !== undefined ? value : '--'}
              </span>
              {unit && (
                <span className="text-xs sm:text-sm font-normal text-[#9AA7B4]">{unit}</span>
              )}
            </>
          )}
        </div>

        {/* Mini Sparkline */}
        <div className="shrink-0 pl-2">
          <Sparkline
            data={sparkline}
            color={accentColor}
            width={isPriority ? 90 : 70}
            height={26}
          />
        </div>
      </div>
    </div>
  )
}
