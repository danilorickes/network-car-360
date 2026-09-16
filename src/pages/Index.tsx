import React from 'react'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { PID_DEFINITIONS } from '@/lib/obd/pid-decoder'
import { Link } from 'react-router-dom'
import { ConnectionControlPanel } from '@/components/live/ConnectionControlPanel'
import { GaugeCard } from '@/components/live/GaugeCard'
import { SymptomMarkerButton } from '@/components/live/SymptomMarkerButton'
import { MiniLiveChart } from '@/components/live/MiniLiveChart'
import {
  AlertTriangle,
  CheckCircle2,
  Car,
  Compass,
  Music,
  Bot,
  ChevronRight,
  Gauge,
} from 'lucide-react'
import {
  loadAssistantIdentity,
  getAssistantDisplayName,
} from '@/lib/assistant/assistant-identity-store'

export default function Index() {
  const { telemetry, recentHistory, selectedVehicle } = useTelemetry()
  const assistantIdentity = React.useMemo(
    () => loadAssistantIdentity(selectedVehicle?.plate),
    [selectedVehicle?.plate],
  )
  const assistantTabName = getAssistantDisplayName(assistantIdentity, true)

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

      {/* Item C OS-ME001-E6.3.1: Atalho em Destaque para o Modo Condução Network Car Drive (E6.3) */}
      <div
        data-testid="card-drive-shortcut"
        className="bg-gradient-to-r from-[#111A24] via-[#162230] to-[#111A24] border-2 border-[#FFB300]/60 hover:border-[#FFB300] rounded-xl p-4 sm:p-5 shadow-xl transition-all relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFB300]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-[#FFB300] text-black font-extrabold text-[11px] px-2.5 py-0.5 rounded uppercase tracking-wider font-mono">
                Experiência Embarcada E6.3
              </span>
              <span className="text-cyan-400 font-mono text-xs font-semibold bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded">
                Touch Automotivo • Widescreen
              </span>
              {telemetry.connectionState === 'CONECTADO' &&
              telemetry.transportType !== 'SIMULADOR' ? (
                <span className="text-emerald-400 font-mono text-[11px] font-bold bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded">
                  DADOS REAIS • ELM327 CONECTADO
                </span>
              ) : telemetry.transportType === 'SIMULADOR' ? (
                <span className="text-amber-400 font-mono text-[11px] font-bold bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded">
                  DADOS SIMULADOS DISPONÍVEIS
                </span>
              ) : null}
            </div>

            <div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center space-x-2">
                <Car className="w-6 h-6 text-[#FFB300]" />
                <span>Modo Condução Network Car Drive</span>
              </h2>
              <p className="text-xs text-[#9AA7B4] max-w-2xl mt-0.5">
                Interface automotiva fullscreen dedicada para multimídias Android, tablets e uso em
                trânsito com 4 áreas especializadas e segurança determinística sem nuvem:
              </p>
            </div>

            {/* 4 Áreas da Interface E6.3 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
              <div className="bg-[#0B0F14]/80 border border-[#263340] rounded-lg px-2.5 py-1.5 flex items-center space-x-2">
                <Gauge className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-gray-200 font-bold truncate">CARRO</span>
              </div>
              <div className="bg-[#0B0F14]/80 border border-[#263340] rounded-lg px-2.5 py-1.5 flex items-center space-x-2">
                <Compass className="w-3.5 h-3.5 text-[#FFB300] shrink-0" />
                <span className="text-gray-200 font-bold truncate">VIAGEM</span>
              </div>
              <div className="bg-[#0B0F14]/80 border border-[#263340] rounded-lg px-2.5 py-1.5 flex items-center space-x-2">
                <Music className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="text-gray-200 font-bold truncate">DIVERSÃO</span>
              </div>
              <div className="bg-[#0B0F14]/80 border border-[#263340] rounded-lg px-2.5 py-1.5 flex items-center space-x-2">
                <Bot className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-gray-200 font-bold truncate">{assistantTabName}</span>
              </div>
            </div>
          </div>

          {/* Botão Touch Grande para /network-car-drive */}
          <Link
            to="/network-car-drive"
            className="w-full lg:w-auto shrink-0 bg-[#FFB300] hover:bg-[#e5a000] text-black font-black text-sm sm:text-base px-6 py-3.5 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-[#FFB300]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Car className="w-5 h-5 fill-current" />
            <span>Abrir Network Car Drive</span>
            <ChevronRight className="w-5 h-5 stroke-[3]" />
          </Link>
        </div>
      </div>

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
