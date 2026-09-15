import React, { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import {
  SessionModel,
  RawSampleModel,
  EventModel,
  DtcModel,
  VehicleModel,
  BlackBoxPackage,
} from '@/types/obd'
import { PID_DEFINITIONS } from '@/lib/obd/pid-decoder'
import { GaugeCard } from '@/components/live/GaugeCard'
import { MiniLiveChart } from '@/components/live/MiniLiveChart'
import { ReplayEngine } from '@/lib/obd/replay-engine'
import { BlackBoxBuilder, TemporalComparisonPoint } from '@/lib/obd/blackbox-builder'
import { ExporterService } from '@/lib/obd/exporter-service'
import { vehicleService } from '@/services/vehicles'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  FastForward,
  Flag,
  Layers,
  FileDown,
  Printer,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react'

export default function Replay() {
  const [searchParams] = useSearchParams()
  const sessionQueryId = searchParams.get('session')
  const eventQueryId = searchParams.get('event')

  const [availableSessions, setAvailableSessions] = useState<SessionModel[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessionQueryId || '')
  const [sessionRecord, setSessionRecord] = useState<SessionModel | null>(null)
  const [vehicleRecord, setVehicleRecord] = useState<VehicleModel | null>(null)
  const [samples, setSamples] = useState<RawSampleModel[]>([])
  const [events, setEvents] = useState<EventModel[]>([])
  const [dtcs, setDtcs] = useState<DtcModel[]>([])
  const [loading, setLoading] = useState(false)

  // Caixa-Preta do evento selecionado
  const [selectedEventId, setSelectedEventId] = useState<string | null>(eventQueryId || null)
  const [selectedBlackBox, setSelectedBlackBox] = useState<BlackBoxPackage | null>(null)
  const [temporalPoints, setTemporalPoints] = useState<TemporalComparisonPoint[]>([])
  const [activeTab, setActiveTab] = useState<'replay' | 'blackbox'>('replay')

  // Estados do Replay contínuo
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [currentProgressPct, setCurrentProgressPct] = useState<number>(0)
  const [currentOffsetMs, setCurrentOffsetMs] = useState<number>(0)
  const [totalDurationMs, setTotalDurationMs] = useState<number>(0)
  const [activeEventNotice, setActiveEventNotice] = useState<EventModel | null>(null)

  const [gaugeValues, setGaugeValues] = useState<
    Record<string, { decoded?: number; unit?: string; sparkline: number[] }>
  >({})
  const [chartHistory, setChartHistory] = useState<
    { time: string; rpm: number; speed: number; coolant: number }[]
  >([])

  const replayEngineRef = useRef<ReplayEngine | null>(null)

  const priorityPids = ['0x0C', '0x0D', '0x05', '0x04', '0x11']
  const secondaryPids = ['0x10', '0x0B', '0x42', '0x06', '0x07', '0x0E', '0x0F', '0x1F']

  const colorMap: Record<string, string> = {
    '0x0C': '#FFB300',
    '0x0D': '#26C6DA',
    '0x05': '#EF5350',
    '0x04': '#66BB6A',
    '0x11': '#AB47BC',
    '0x10': '#42A5F5',
    '0x0B': '#FF7043',
    '0x42': '#81C784',
    '0x06': '#EC407A',
    '0x07': '#F06292',
    '0x0E': '#FFA726',
    '0x0F': '#4DD0E1',
    '0x1F': '#B0BEC5',
  }

  // Carrega lista de sessões
  useEffect(() => {
    pb.collection('sessions')
      .getFullList<SessionModel>({ sort: '-started_at' })
      .then((records) => {
        setAvailableSessions(records)
        if (!selectedSessionId && records.length > 0) {
          setSelectedSessionId(records[0].id || records[0].session_id)
        }
      })
      .catch(() => {})
  }, [selectedSessionId])

  // Carrega dados da sessão selecionada
  useEffect(() => {
    if (!selectedSessionId) return

    setLoading(true)
    setIsPlaying(false)
    if (replayEngineRef.current) replayEngineRef.current.pause()

    const loadData = async () => {
      try {
        let sess: SessionModel | null = null
        try {
          sess = await pb.collection('sessions').getOne<SessionModel>(selectedSessionId)
        } catch {
          sess = await pb
            .collection('sessions')
            .getFirstListItem<SessionModel>(`session_id = "${selectedSessionId}"`)
        }

        if (!sess) return
        setSessionRecord(sess)

        // Carrega veículo associado se houver
        if (sess.vehicle) {
          const veh = await vehicleService.getById(sess.vehicle)
          setVehicleRecord(veh)
        } else {
          setVehicleRecord(null)
        }

        // Amostras brutas
        const rawList = await pb.collection('raw_samples').getFullList<RawSampleModel>({
          filter: `session = "${sess.id}"`,
          sort: 'ts_mono_offset_ms',
        })
        setSamples(rawList)

        // Eventos
        const evList = await pb.collection('events').getFullList<EventModel>({
          filter: `session = "${sess.id}"`,
          sort: 'ts_mono_offset_ms',
        })
        setEvents(evList)

        // DTCs
        const dtcList = await pb.collection('dtcs').getFullList<DtcModel>({
          filter: `session = "${sess.id}"`,
        })
        setDtcs(dtcList)

        // Se houver eventos, abre automaticamente a caixa-preta do primeiro ou do especificado na URL
        const targetEv = eventQueryId
          ? evList.find((e) => e.event_id === eventQueryId || e.id === eventQueryId)
          : evList[0]

        if (targetEv) {
          setSelectedEventId(targetEv.event_id)
          inspectEventBlackBox(targetEv, rawList, dtcList, sess)
        } else {
          setSelectedBlackBox(null)
          setTemporalPoints([])
        }

        initEngine(rawList, evList)
      } catch (err) {
        console.warn('Erro ao carregar dados do replay:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedSessionId, eventQueryId])

  const inspectEventBlackBox = (
    event: EventModel,
    sampleList: RawSampleModel[],
    dtcList: DtcModel[],
    sess: SessionModel,
  ) => {
    setSelectedEventId(event.event_id)
    const partition = BlackBoxBuilder.partitionWindow(sampleList, event)
    const points = BlackBoxBuilder.buildComparisonSeries(partition, 800)
    setTemporalPoints(points)

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples: sampleList,
      vehicle: vehicleRecord || {
        plate: 'N/A',
        make: sess.vehicle_name || 'Veículo',
        model: 'OBD-II',
      },
      dtcs: dtcList,
      communicationState: 'CONECTADO',
    })
    setSelectedBlackBox(pkg)
  }

  const initEngine = (sampleList: RawSampleModel[], eventList: EventModel[]) => {
    const engine = new ReplayEngine(sampleList, {
      onSample: (sample) => {
        setGaugeValues((prev) => {
          const cur = prev[sample.pid] || { sparkline: [] }
          const spark = [...cur.sparkline]
          if (sample.decoded_value !== undefined) {
            spark.push(sample.decoded_value)
            if (spark.length > 20) spark.shift()
          }
          return {
            ...prev,
            [sample.pid]: {
              decoded: sample.decoded_value,
              unit: sample.unit,
              sparkline: spark,
            },
          }
        })

        if (sample.pid === '0x0C' && sample.decoded_value !== undefined) {
          const timeLabel = `+${(sample.ts_mono_offset_ms / 1000).toFixed(1)}s`
          setChartHistory((prev) => {
            const next = [
              ...prev,
              {
                time: timeLabel,
                rpm: sample.decoded_value || 0,
                speed: gaugeValues['0x0D']?.decoded || 0,
                coolant: gaugeValues['0x05']?.decoded || 85,
              },
            ]
            if (next.length > 30) next.shift()
            return next
          })
        }

        const evAtInstant = eventList.find(
          (e) => Math.abs(e.ts_mono_offset_ms - sample.ts_mono_offset_ms) < 300,
        )
        if (evAtInstant) {
          setActiveEventNotice(evAtInstant)
        } else {
          setActiveEventNotice(null)
        }
      },
      onProgress: (currentMono, totalMono, pct) => {
        setCurrentOffsetMs(currentMono)
        setTotalDurationMs(totalMono)
        setCurrentProgressPct(pct)
      },
      onFinished: () => {
        setIsPlaying(false)
      },
    })

    engine.setSpeed(speed)
    replayEngineRef.current = engine
    setTotalDurationMs(engine.getTotalDurationMs())
  }

  const togglePlay = () => {
    if (!replayEngineRef.current) return
    if (isPlaying) {
      replayEngineRef.current.pause()
      setIsPlaying(false)
    } else {
      replayEngineRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed)
    if (replayEngineRef.current) replayEngineRef.current.setSpeed(newSpeed)
  }

  const handleSeek = (values: number[]) => {
    const val = values[0]
    setCurrentProgressPct(val)
    if (replayEngineRef.current) replayEngineRef.current.seek(val)
  }

  const handleRestart = () => {
    if (replayEngineRef.current) {
      replayEngineRef.current.seek(0)
      setChartHistory([])
      setGaugeValues({})
    }
  }

  const seekToEvent = (ev: EventModel) => {
    if (!replayEngineRef.current || totalDurationMs <= 0) return
    const pct = (ev.ts_mono_offset_ms / totalDurationMs) * 100
    replayEngineRef.current.seek(pct)
    setCurrentProgressPct(pct)
    inspectEventBlackBox(ev, samples, dtcs, sessionRecord!)
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Controles de Exportação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <FastForward className="w-5 h-5 text-[#FFB300]" />
            <span>Replay Determinístico & Caixa-Preta</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Requisitos 3, 4, 5 e 6: Comparação temporal ANTES → SINTOMA → DEPOIS e exportação
            multiformato.
          </p>
        </div>

        {/* Seletor de Sessão e Botões de Exportação */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="bg-[#131A22] border border-[#263340] text-xs text-white rounded px-3 py-1.5 focus:ring-1 focus:ring-[#FFB300]"
          >
            {availableSessions.map((s) => (
              <option key={s.id || s.session_id} value={s.id || s.session_id}>
                {s.vehicle_name || 'Sessão'} ({s.session_id.slice(0, 14)}...)
              </option>
            ))}
          </select>

          {sessionRecord && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  ExporterService.exportSessionJson({
                    session: sessionRecord,
                    vehicle: vehicleRecord,
                    samples,
                    events,
                    dtcs,
                  })
                }
                className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] text-xs"
                title="Exportar JSON Técnico Completo"
              >
                <FileDown className="w-3.5 h-3.5 mr-1" />
                JSON
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  ExporterService.exportTelemetryCsv(
                    samples,
                    `telemetria_${sessionRecord.session_id}`,
                  )
                }
                className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] text-xs"
                title="Exportar CSV da Telemetria Bruta"
              >
                <FileDown className="w-3.5 h-3.5 mr-1" />
                CSV
              </Button>

              <Button
                size="sm"
                onClick={() =>
                  ExporterService.printDiagnosticReport({
                    session: sessionRecord,
                    vehicle: vehicleRecord,
                    events,
                    dtcs,
                    packages: selectedBlackBox ? [selectedBlackBox] : [],
                    totalSamplesCount: samples.length,
                  })
                }
                className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs shadow"
                title="Imprimir ou Salvar PDF Legível para Cliente / Oficina"
              >
                <Printer className="w-3.5 h-3.5 mr-1" />
                PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs: Replay Contínuo vs. Caixa-Preta do Sintoma */}
      <div className="flex items-center space-x-2 border-b border-[#263340] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('replay')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 ${
            activeTab === 'replay'
              ? 'bg-[#FFB300] text-black shadow'
              : 'text-[#9AA7B4] hover:text-white hover:bg-[#131A22]'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Reprodução Contínua (Replay 1x–10x)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blackbox')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center space-x-2 ${
            activeTab === 'blackbox'
              ? 'bg-[#FFB300] text-black shadow'
              : 'text-[#9AA7B4] hover:text-white hover:bg-[#131A22]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Caixa-Preta do Sintoma (Antes → Durante → Depois)</span>
          {events.length > 0 && (
            <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-1">
              {events.length}
            </span>
          )}
        </button>
      </div>

      {/* Seção 1: REPLAY CONTÍNUO */}
      {activeTab === 'replay' && (
        <div className="space-y-6">
          {/* Painel de Controle de Reprodução */}
          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <Button
                  size="sm"
                  onClick={togglePlay}
                  disabled={samples.length === 0}
                  className={`${
                    isPlaying
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold'
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 mr-1.5 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 mr-1.5 fill-current" />
                  )}
                  {isPlaying ? 'PAUSAR' : 'REPRODUZIR'}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRestart}
                  className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]"
                >
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Reiniciar
                </Button>

                <div className="font-mono text-xs text-white pl-2">
                  <span className="text-[#FFB300] font-bold">
                    {(currentOffsetMs / 1000).toFixed(1)}s
                  </span>
                  <span className="text-[#9AA7B4]"> / {(totalDurationMs / 1000).toFixed(1)}s</span>
                </div>
              </div>

              {/* Seletor de Velocidade */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-[#9AA7B4] font-medium">Velocidade:</span>
                <div className="inline-flex rounded-md p-0.5 bg-[#0B0F14] border border-[#263340]">
                  {[1, 2, 5, 10].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleSpeedChange(v)}
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded transition-colors ${
                        speed === v
                          ? 'bg-[#FFB300] text-black shadow'
                          : 'text-[#9AA7B4] hover:text-white'
                      }`}
                    >
                      {v}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Scrubber com Marcadores dos Sintomas */}
            <div className="relative pt-2">
              <Slider
                value={[currentProgressPct]}
                max={100}
                step={0.5}
                onValueChange={handleSeek}
                className="cursor-pointer"
              />

              <div className="relative w-full h-2 mt-1">
                {events.map((ev) => {
                  const leftPct =
                    totalDurationMs > 0 ? (ev.ts_mono_offset_ms / totalDurationMs) * 100 : 0
                  return (
                    <div
                      key={ev.id || ev.event_id}
                      style={{ left: `${Math.min(99, Math.max(1, leftPct))}%` }}
                      onClick={() => seekToEvent(ev)}
                      className="absolute -top-3 -translate-x-1/2 flex flex-col items-center group cursor-pointer"
                      title={`Pular para: ${ev.event_type} (+${(ev.ts_mono_offset_ms / 1000).toFixed(1)}s)`}
                    >
                      <Flag className="w-3.5 h-3.5 text-red-500 fill-current" />
                      <span className="hidden group-hover:block absolute bottom-4 bg-red-950 text-red-200 text-[10px] px-1.5 py-0.5 rounded border border-red-800 whitespace-nowrap z-30 font-bold">
                        {ev.event_type} (+{(ev.ts_mono_offset_ms / 1000).toFixed(1)}s)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Notificação ao cruzar sintoma */}
            {activeEventNotice && (
              <div className="bg-red-950/70 border-l-4 border-red-500 p-2.5 rounded text-xs flex items-center justify-between text-white animate-pulse">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <span>
                    <strong>SINTOMA NESTE INSTANTE:</strong>{' '}
                    {activeEventNotice.event_type.toUpperCase()}
                    {activeEventNotice.description ? ` — "${activeEventNotice.description}"` : ''}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    inspectEventBlackBox(activeEventNotice, samples, dtcs, sessionRecord!)
                    setActiveTab('blackbox')
                  }}
                  className="bg-red-700 hover:bg-red-600 text-white text-[11px] h-6 px-2"
                >
                  Abrir Caixa-Preta
                </Button>
              </div>
            )}
          </div>

          {/* Medidores Prioritários */}
          <div>
            <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
              Medidores Prioritários Reproduzidos (≥5 Hz)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {priorityPids.map((pid) => {
                const def = PID_DEFINITIONS[pid]
                const live = gaugeValues[pid]
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
                    quality={live?.decoded !== undefined ? 'OK' : 'NO_RESPONSE'}
                    sparkline={live?.sparkline || []}
                    isPriority={true}
                    accentColor={colorMap[pid] || '#FFB300'}
                  />
                )
              })}
            </div>
          </div>

          {/* Medidores Secundários */}
          <div>
            <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
              Telemetria Complementar Reproduzida
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
              {secondaryPids.map((pid) => {
                const def = PID_DEFINITIONS[pid]
                const live = gaugeValues[pid]
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
                    quality={live?.decoded !== undefined ? 'OK' : 'NO_RESPONSE'}
                    sparkline={live?.sparkline || []}
                    isPriority={false}
                    accentColor={colorMap[pid] || '#9AA7B4'}
                  />
                )
              })}
            </div>
          </div>

          {/* Mini Gráfico */}
          <MiniLiveChart data={chartHistory} />
        </div>
      )}

      {/* Seção 2: CAIXA-PRETA DO SINTOMA & COMPARAÇÃO TEMPORAL */}
      {activeTab === 'blackbox' && (
        <div className="space-y-6">
          {events.length === 0 ? (
            <div className="bg-[#131A22] border border-[#263340] rounded-lg p-10 text-center text-xs text-[#9AA7B4]">
              Nenhum sintoma marcado nesta sessão de teste. Marque uma ocorrência na pista pelo
              Painel Live para gerar caixas-pretas.
            </div>
          ) : (
            <>
              {/* Seletor de Sintoma / Ocorrência Múltipla (Requisito 5) */}
              <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4">
                <span className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider block mb-2">
                  Selecione o Sintoma Marcado ({events.length} Ocorrências na Sessão):
                </span>
                <div className="flex flex-wrap gap-2">
                  {events.map((ev, index) => {
                    const isSelected = selectedEventId === ev.event_id
                    return (
                      <button
                        key={ev.id || ev.event_id}
                        type="button"
                        onClick={() => inspectEventBlackBox(ev, samples, dtcs, sessionRecord!)}
                        className={`px-3 py-2 rounded text-xs font-bold text-left transition-all border ${
                          isSelected
                            ? 'bg-red-950 text-red-200 border-red-500 ring-1 ring-red-500'
                            : 'bg-[#0B0F14] text-gray-300 border-[#263340] hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center space-x-1.5">
                          <Flag className="w-3.5 h-3.5 text-red-400" />
                          <span className="uppercase">
                            #{index + 1} {ev.event_type}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[#9AA7B4] mt-0.5">
                          T +{(ev.ts_mono_offset_ms / 1000).toFixed(1)}s •{' '}
                          {new Date(ev.ts_utc).toLocaleTimeString('pt-BR')}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedBlackBox && (
                <div className="space-y-6">
                  {/* Resumo do Pacote Diagnóstico Caixa-Preta */}
                  <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263340]">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="bg-red-950 text-red-300 font-bold px-2 py-0.5 rounded text-xs border border-red-800 uppercase">
                            Caixa-Preta: {selectedBlackBox.event_type}
                          </span>
                          <span className="text-xs font-mono text-[#9AA7B4]">
                            ID: {selectedBlackBox.event_id}
                          </span>
                        </div>
                        <p className="text-xs text-gray-300 mt-1 italic">
                          "{selectedBlackBox.description || 'Sem descrição livre informada.'}"
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const partition = BlackBoxBuilder.partitionWindow(
                              samples,
                              events.find((e) => e.event_id === selectedBlackBox.event_id)!,
                            )
                            const allWin = [
                              ...partition.samplesBefore,
                              ...partition.samplesAtEvent,
                              ...partition.samplesAfter,
                            ]
                            ExporterService.exportEventJson({
                              event: events.find((e) => e.event_id === selectedBlackBox.event_id)!,
                              pkg: selectedBlackBox,
                              samplesInWindow: allWin,
                            })
                          }}
                          className="border-[#263340] text-xs text-[#9AA7B4] hover:text-white"
                        >
                          <FileDown className="w-3.5 h-3.5 mr-1" /> Exportar Pacote JSON
                        </Button>
                      </div>
                    </div>

                    {/* Metadados da Janela */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                        <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                          Janela Temporal:
                        </span>
                        <span className="font-mono text-white">
                          -{selectedBlackBox.window_pre_ms / 1000}s a +
                          {selectedBlackBox.window_post_ms / 1000}s
                        </span>
                      </div>
                      <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                        <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                          Amostras na Janela:
                        </span>
                        <span className="font-mono text-emerald-400 font-bold">
                          {selectedBlackBox.sample_quality_summary.totalSamples} (
                          {selectedBlackBox.sample_quality_summary.okPercentage}% OK)
                        </span>
                      </div>
                      <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                        <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                          Comunicação no Evento:
                        </span>
                        <span className="font-mono text-blue-400">
                          {selectedBlackBox.communication_state}
                        </span>
                      </div>
                      <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
                        <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                          DTCs Ativos na Janela:
                        </span>
                        <span className="font-mono text-amber-400 font-bold">
                          {selectedBlackBox.dtcs_context.length} códigos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* REQUISITO 4 — COMPARAÇÃO TEMPORAL: ANTES -> MOMENTO DO SINTOMA -> DEPOIS */}
                  <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#263340] pb-3">
                      <div>
                        <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                          <Layers className="w-4 h-4 text-[#FFB300]" />
                          <span>Comparação Temporal Simultânea Multi-Parâmetro (Requisito 4)</span>
                        </h2>
                        <p className="text-xs text-[#9AA7B4]">
                          Permite ver relações temporais diretas (ex.: Acelerador ↑ → Carga ↑ → RPM
                          deveria ↑ → RPM caiu).
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 text-[11px] font-mono">
                        <span className="px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                          ANTES (-30s)
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                        <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 font-bold">
                          MOMENTO SINTOMA
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-gray-500" />
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          DEPOIS (+30s)
                        </span>
                      </div>
                    </div>

                    {/* Tabela Comparativa de Médias Antes vs. Momento vs. Depois */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-[#0B0F14] text-[#9AA7B4] border-b border-[#263340]">
                            <th className="p-2.5">Parâmetro Analisado</th>
                            <th className="p-2.5 text-blue-300">ANTES (Média -30s)</th>
                            <th className="p-2.5 text-red-400 font-bold">MOMENTO DO SINTOMA</th>
                            <th className="p-2.5 text-emerald-300">DEPOIS (Média +30s)</th>
                            <th className="p-2.5">Faixa Global (Mín — Máx)</th>
                            <th className="p-2.5">Unidade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#263340]">
                          {Object.values(selectedBlackBox.window_stats).map((stat) => (
                            <tr key={stat.pid} className="hover:bg-[#1A232E]/50">
                              <td className="p-2.5 font-medium text-white">
                                {stat.paramName}{' '}
                                <span className="font-mono text-[10px] text-gray-500">
                                  ({stat.pid})
                                </span>
                              </td>
                              <td className="p-2.5 font-mono text-blue-300">
                                {stat.beforeAvg !== undefined ? stat.beforeAvg : '--'}
                              </td>
                              <td className="p-2.5 font-mono text-red-400 font-bold bg-red-950/20">
                                {stat.atEventValue !== undefined ? stat.atEventValue : '--'}
                              </td>
                              <td className="p-2.5 font-mono text-emerald-300">
                                {stat.afterAvg !== undefined ? stat.afterAvg : '--'}
                              </td>
                              <td className="p-2.5 font-mono text-gray-400">
                                {stat.min} — {stat.max}
                              </td>
                              <td className="p-2.5 font-mono text-gray-400">{stat.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* REQUISITO 7 — PREPARAÇÃO PARA IA (DiagnosticEvidence / Fatos Objetivos) */}
                  <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-3">
                    <div className="flex items-center space-x-2 text-sm font-bold text-white border-b border-[#263340] pb-2">
                      <Sparkles className="w-4 h-4 text-[#FFB300]" />
                      <span>
                        Fatos Objetivos Observados (DiagnosticEvidence • Preparação para IA)
                      </span>
                    </div>

                    <div className="text-xs text-[#9AA7B4] bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                      <strong className="text-white">Regra de Segurança Epistemológica:</strong>{' '}
                      Fatos estritamente objetivos extraídos da telemetria da janela. Nenhuma
                      hipótese de defeito ou diagnóstico é atribuído como causa nesta etapa.
                    </div>

                    <div className="space-y-2 pt-1">
                      {selectedBlackBox.facts.map((fact) => (
                        <div
                          key={fact.fact_id}
                          className="bg-[#0B0F14] border border-[#263340] p-3 rounded text-xs flex items-start space-x-2"
                        >
                          <span className="w-2 h-2 rounded-full bg-[#FFB300] shrink-0 mt-1.5" />
                          <div className="flex-1">
                            <span className="font-bold text-gray-300 font-mono text-[11px] block">
                              [{fact.category}] {fact.parameter}:
                            </span>
                            <span className="text-white text-xs">{fact.statement}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
