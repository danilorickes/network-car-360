import React, { useState, useEffect, useRef } from 'react'
import { techLogStore, TechLogEntry } from '@/lib/obd/tech-log-store'
import { Button } from '@/components/ui/button'
import {
  Terminal,
  Trash2,
  Download,
  Pause,
  Play,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Info,
  Clock,
} from 'lucide-react'

interface TechLogLiveViewProps {
  compact?: boolean
  maxDisplay?: number
}

export const TechLogLiveView: React.FC<TechLogLiveViewProps> = ({
  compact = false,
  maxDisplay = 100,
}) => {
  const [logs, setLogs] = useState<TechLogEntry[]>([])
  const [isPaused, setIsPaused] = useState(false)
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsub = techLogStore.subscribe((all) => {
      if (!isPausedRef.current) {
        setLogs(all.slice(0, maxDisplay))
      }
    })
    return unsub
  }, [maxDisplay])

  const handleClear = () => {
    techLogStore.clear()
    setLogs([])
  }

  const handleExport = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.direction}] ${
            l.direction === 'TX'
              ? `TX -> ${l.command}`
              : l.direction === 'RX'
                ? `RX <- ${l.response || ''} (${l.latencyMs || 0}ms)`
                : l.details || l.stage || ''
          }`,
      )
      .join('\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-car-techlog-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bg-[#0B0F14] border border-[#202B37] rounded-xl overflow-hidden flex flex-col font-mono text-xs shadow-xl">
      {/* Topo / Barra de Ferramentas */}
      <div className="bg-[#121A24] px-3 py-2 border-b border-[#202B37] flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-[#FFB300]" />
          <span className="font-bold text-gray-200 uppercase text-[11px] tracking-wider">
            Log Técnico OBD em Tempo Real (TX / RX / Latência)
          </span>
          <span className="bg-[#1C2633] text-[#FFB300] px-1.5 py-0.5 rounded text-[10px] border border-[#2B394A]">
            {logs.length} registros
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsPaused(!isPaused)}
            className="h-7 px-2 text-[11px] text-gray-300 hover:text-white hover:bg-[#1A232E]"
            title={isPaused ? 'Continuar atualização' : 'Pausar fluxo'}
          >
            {isPaused ? (
              <Play className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            ) : (
              <Pause className="w-3.5 h-3.5 mr-1 text-amber-400" />
            )}
            <span>{isPaused ? 'Retomar' : 'Pausar'}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleExport}
            className="h-7 px-2 text-[11px] text-gray-300 hover:text-white hover:bg-[#1A232E]"
            title="Exportar log para arquivo de texto"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            <span>Exportar</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-7 px-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/40"
            title="Limpar logs"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />
            <span>Limpar</span>
          </Button>
        </div>
      </div>

      {/* Lista com scroll */}
      <div
        ref={containerRef}
        className={`p-2.5 overflow-y-auto space-y-1 select-text ${
          compact ? 'max-h-60' : 'max-h-96'
        }`}
      >
        {logs.length === 0 ? (
          <div className="text-gray-500 py-6 text-center italic text-xs">
            Nenhuma transmissão registrada ainda. Os comandos TX/RX enviados ao ELM327 aparecerão
            aqui em tempo real.
          </div>
        ) : (
          logs.map((entry) => (
            <div
              key={entry.id}
              className={`p-1.5 rounded flex items-start space-x-2 text-[11px] leading-relaxed border ${
                entry.direction === 'TX'
                  ? 'bg-[#0E1520] border-cyan-950/80 text-cyan-300'
                  : entry.direction === 'RX'
                    ? 'bg-[#0F1A14] border-emerald-950/80 text-emerald-300'
                    : entry.direction === 'ERR'
                      ? 'bg-red-950/40 border-red-900/60 text-red-300'
                      : 'bg-[#121A24] border-[#1C2633] text-gray-300'
              }`}
            >
              {/* Direção */}
              <span className="shrink-0 flex items-center font-bold">
                {entry.direction === 'TX' && (
                  <span className="bg-cyan-950 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-800 flex items-center space-x-0.5">
                    <ArrowUpRight className="w-3 h-3 inline" />
                    <span>TX</span>
                  </span>
                )}
                {entry.direction === 'RX' && (
                  <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-800 flex items-center space-x-0.5">
                    <ArrowDownLeft className="w-3 h-3 inline" />
                    <span>RX</span>
                  </span>
                )}
                {entry.direction === 'ERR' && (
                  <span className="bg-red-950 text-red-300 px-1.5 py-0.2 rounded border border-red-800 flex items-center space-x-0.5">
                    <AlertCircle className="w-3 h-3 inline" />
                    <span>ERR</span>
                  </span>
                )}
                {entry.direction === 'INFO' && (
                  <span className="bg-gray-800 text-gray-300 px-1.5 py-0.2 rounded border border-gray-700 flex items-center space-x-0.5">
                    <Info className="w-3 h-3 inline" />
                    <span>INFO</span>
                  </span>
                )}
              </span>

              {/* Timestamp */}
              <span className="text-gray-500 shrink-0 text-[10px] flex items-center">
                <Clock className="w-2.5 h-2.5 mr-0.5 inline opacity-60" />
                {entry.timestamp}
              </span>

              {/* Corpo */}
              <div className="flex-1 min-w-0 break-all font-mono">
                {entry.command && (
                  <span className="font-bold text-white mr-2">
                    cmd: <span className="text-[#FFB300]">{entry.command}</span>
                  </span>
                )}
                {entry.response && (
                  <span>
                    resp: <span className="text-emerald-200">{entry.response}</span>
                  </span>
                )}
                {entry.details && <span className="text-gray-300">{entry.details}</span>}
              </div>

              {/* Latência */}
              {entry.latencyMs !== undefined && (
                <span
                  className={`shrink-0 text-[10px] font-mono px-1.5 py-0.2 rounded ${
                    entry.latencyMs > 1000
                      ? 'bg-red-950 text-red-300'
                      : entry.latencyMs > 300
                        ? 'bg-amber-950 text-[#FFB300]'
                        : 'bg-emerald-950 text-emerald-300'
                  }`}
                >
                  {entry.latencyMs}ms
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
