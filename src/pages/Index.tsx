import React from 'react'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { PID_DEFINITIONS } from '@/lib/obd/pid-decoder'
import { ConnectionControlPanel } from '@/components/live/ConnectionControlPanel'
import { GaugeCard } from '@/components/live/GaugeCard'
import { SymptomMarkerButton } from '@/components/live/SymptomMarkerButton'
import { MiniLiveChart } from '@/components/live/MiniLiveChart'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function Index() {
  const { telemetry, recentHistory } = useTelemetry()

  // Separar PIDs prioritários (destacados no grid) e secundários
  const priorityPids = ['0x0C', '0x0D', '0x05', '0x04', '0x11']
  const secondaryPids = ['0x10', '0x0B', '0x42', '0x06', '0x07', '0x0E', '0x0F', '0x1F']

  const colorMap: Record<string, string> = {
    '0x0C': '#FFB300', // RPM âmbar elétrico
    '0x0D': '#26C6DA', // Velocidade ciano
    '0x05': '#EF5350', // Temperatura líquido arrefecimento vermelho
    '0x04': '#66BB6A', // Carga verde
    '0x11': '#AB47BC', // Acelerador roxo
    '0x10': '#42A5F5', // MAF azul
    '0x0B': '#FF7043', // MAP laranja
    '0x42': '#81C784', // Tensão
    '0x06': '#EC407A', // STFT rosa
    '0x07': '#F06292', // LTFT
    '0x0E': '#FFA726', // Avanço de ignição
    '0x0F': '#4DD0E1', // Temp ar
    '0x1F': '#B0BEC5', // Tempo motor
  }

  return (
    <div className="space-y-6">
      {/* Connection & Session Controller */}
      <ConnectionControlPanel />

      {/* Link de Diagnóstico 360 se houver relatório recente gerado na sessão ativa */}
      {telemetry.sessionState === 'ENCERRADO' && (
        <div className="bg-[#1A232E] border border-[#FFB300] p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#FFB300]/20 text-[#FFB300] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-sm text-white">Sessão Encerrada com Sucesso</span>
              <p className="text-xs text-[#9AA7B4]">
                A telemetria completa e as caixas-pretas registradas estão prontas para a síntese do
                Diagnóstico 360.
              </p>
            </div>
          </div>
          <a
            href={`/replay${telemetry.activeSessionId ? `?session=${telemetry.activeSessionId}` : ''}`}
            className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs px-4 py-2 rounded-lg flex items-center space-x-1.5 shrink-0 shadow"
          >
            <span>Abrir Diagnóstico 360</span>
          </a>
        </div>
      )}

      {/* DTC & MIL Warning Alert Strip (se houver DTCs detectados) */}
      {telemetry.milOn || telemetry.dtcList.length > 0 ? (
        <div className="bg-amber-950/40 border-l-4 border-amber-500 p-3 rounded text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-amber-300">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-bold uppercase tracking-wider">
                Atenção: Falha de Injeção Detectada (MIL ON)
              </span>
              <p className="text-[#9AA7B4]">
                {telemetry.dtcList.length} código(s) de anomalia registrado(s) pela ECU do motor.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {telemetry.dtcList.map((dtc) => (
              <span
                key={dtc.dtc_code}
                className="bg-amber-900/60 text-amber-200 border border-amber-600 px-2 py-0.5 rounded font-mono font-bold"
              >
                {dtc.dtc_code} ({dtc.status})
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/20 border-l-4 border-emerald-500/60 p-2.5 rounded text-xs flex items-center justify-between text-[#9AA7B4]">
          <div className="flex items-center space-x-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Diagnóstico do Sistema: Nenhuma anomalia ativa no módulo (MIL Apagado).</span>
          </div>
          <span className="text-[11px] font-mono">Modo 03/07 OK</span>
        </div>
      )}

      {/* Grid de Medidores Prioritários (RPM, Velocidade, Temp, Carga, TPS) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider">
            Grandezas Críticas em Tempo Real (Frequência Prioritária ≥5 Hz)
          </h2>
          <span className="text-[11px] text-[#9AA7B4] font-mono">
            Efetiva: {telemetry.effectiveFreqHz > 0 ? `${telemetry.effectiveFreqHz} Hz` : '--'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {priorityPids.map((pid) => {
            const def = PID_DEFINITIONS[pid]
            const live = telemetry.currentValues[pid]
            const formatted =
              live?.decoded !== undefined && def ? def.format(live.decoded) : undefined
            return (
              <GaugeCard
                key={pid}
                pid={pid}
                label={def?.name || pid}
                shortName={def?.shortName || pid}
                value={live?.decoded}
                formattedValue={formatted}
                unit={def?.unit}
                quality={
                  live?.quality ||
                  (telemetry.connectionState === 'CONECTADO' ? 'OK' : 'NO_RESPONSE')
                }
                sparkline={live?.sparkline || []}
                isPriority={true}
                accentColor={colorMap[pid] || '#FFB300'}
              />
            )
          })}
        </div>
      </div>

      {/* Grid de Medidores Secundários */}
      <div>
        <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
          Telemetria Complementar (Frequência Normal ≥1 Hz)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {secondaryPids.map((pid) => {
            const def = PID_DEFINITIONS[pid]
            const live = telemetry.currentValues[pid]
            const formatted =
              live?.decoded !== undefined && def ? def.format(live.decoded) : undefined
            return (
              <GaugeCard
                key={pid}
                pid={pid}
                label={def?.name || pid}
                shortName={def?.shortName || pid}
                value={live?.decoded}
                formattedValue={formatted}
                unit={def?.unit}
                quality={
                  live?.quality ||
                  (telemetry.connectionState === 'CONECTADO' ? 'OK' : 'NO_RESPONSE')
                }
                sparkline={live?.sparkline || []}
                isPriority={false}
                accentColor={colorMap[pid] || '#9AA7B4'}
              />
            )
          })}
        </div>
      </div>

      {/* Mini Live Chart */}
      <MiniLiveChart data={recentHistory} />

      {/* Botão Flutuante de Marcar Sintoma */}
      <SymptomMarkerButton />
    </div>
  )
}
