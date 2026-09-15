import React, { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { SessionModel, RawSampleModel, EventModel, DtcModel } from '@/types/obd'
import { PID_DEFINITIONS } from '@/lib/obd/pid-decoder'
import { GaugeCard } from '@/components/live/GaugeCard'
import { MiniLiveChart } from '@/components/live/MiniLiveChart'
import { ReplayEngine } from '@/lib/obd/replay-engine'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Play, Pause, RotateCcw, AlertTriangle, FastForward, Flag } from 'lucide-react'

export default function Replay() {
  const [searchParams] = useSearchParams()
  const sessionQueryId = searchParams.get('session')

  const [availableSessions, setAvailableSessions] = useState<SessionModel[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState<string>(sessionQueryId || '')
  const [samples, setSamples] = useState<RawSampleModel[]>([])
  const [events, setEvents] = useState<EventModel[]>([])
  const [dtcs, setDtcs] = useState<DtcModel[]>([])
  const [loading, setLoading] = useState(false)

  // Estados do Replay
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<number>(1)
  const [currentProgressPct, setCurrentProgressPct] = useState<number>(0)
  const [currentOffsetMs, setCurrentOffsetMs] = useState<number>(0)
  const [totalDurationMs, setTotalDurationMs] = useState<number>(0)
  const [activeEventNotice, setActiveEventNotice] = useState<EventModel | null>(null)

  // Mesma estrutura de estado do Live Dashboard (Requisito Arquitetural Inegociável)
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

  // Carrega lista de sessões disponíveis
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
    if (replayEngineRef.current) {
      replayEngineRef.current.pause()
    }

    // Busca sessão por id ou por session_id
    const loadData = async () => {
      try {
        let sessRecord: SessionModel | null = null
        try {
          sessRecord = await pb.collection('sessions').getOne<SessionModel>(selectedSessionId)
        } catch {
          sessRecord = await pb
            .collection('sessions')
            .getFirstListItem<SessionModel>(`session_id = "${selectedSessionId}"`)
        }

        if (!sessRecord) return

        // Amostras brutas
        const rawList = await pb.collection('raw_samples').getFullList<RawSampleModel>({
          filter: `session = "${sessRecord.id}"`,
          sort: 'ts_mono_offset_ms',
        })
        setSamples(rawList)

        // Eventos
        const evList = await pb.collection('events').getFullList<EventModel>({
          filter: `session = "${sessRecord.id}"`,
          sort: 'ts_mono_offset_ms',
        })
        setEvents(evList)

        // DTCs
        const dtcList = await pb.collection('dtcs').getFullList<DtcModel>({
          filter: `session = "${sessRecord.id}"`,
        })
        setDtcs(dtcList)

        // Inicializa o motor de replay
        initEngine(rawList, evList)
      } catch (err) {
        console.warn('Erro ao carregar dados do replay:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [selectedSessionId])

  const initEngine = (sampleList: RawSampleModel[], eventList: EventModel[]) => {
    const engine = new ReplayEngine(sampleList, {
      onSample: (sample) => {
        // Atualiza Medidores com o mesmo modelo do Live
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

        // Atualiza Gráfico Live quando sample for RPM
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

        // Verifica se cursor temporal cruza um evento de sintoma marcado
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
    if (replayEngineRef.current) {
      replayEngineRef.current.setSpeed(newSpeed)
    }
  }

  const handleSeek = (values: number[]) => {
    const val = values[0]
    setCurrentProgressPct(val)
    if (replayEngineRef.current) {
      replayEngineRef.current.seek(val)
    }
  }

  const handleRestart = () => {
    if (replayEngineRef.current) {
      replayEngineRef.current.seek(0)
      setChartHistory([])
      setGaugeValues({})
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Seletor de Sessão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <FastForward className="w-5 h-5 text-[#FFB300]" />
            <span>Replay de Sessão Gravada</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Reprodução determinística com velocidade configurável (1x, 2x, 5x, 10x) alimentando o
            painel pelo mesmo modelo do Live.
          </p>
        </div>

        {/* Seletor de Sessão */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-[#9AA7B4] font-medium">Sessão:</span>
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
        </div>
      </div>

      {/* Painel de Controle de Reprodução (Scrubber, Play, Pause, Velocidades) */}
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

          {/* Seletor de Velocidade (1x, 2x, 5x, 10x) */}
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

        {/* Barra Scrubber com Marcadores de Evento */}
        <div className="relative pt-2">
          <Slider
            value={[currentProgressPct]}
            max={100}
            step={0.5}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />

          {/* Marcadores visuais dos eventos no scrubber */}
          <div className="relative w-full h-2 mt-1">
            {events.map((ev) => {
              const leftPct =
                totalDurationMs > 0 ? (ev.ts_mono_offset_ms / totalDurationMs) * 100 : 0
              return (
                <div
                  key={ev.id || ev.event_id}
                  style={{ left: `${Math.min(99, Math.max(1, leftPct))}%` }}
                  className="absolute -top-3 -translate-x-1/2 flex flex-col items-center group cursor-pointer"
                  title={`Sintoma: ${ev.event_type} (+${(ev.ts_mono_offset_ms / 1000).toFixed(1)}s)`}
                >
                  <Flag className="w-3.5 h-3.5 text-red-500 fill-current" />
                  <span className="hidden group-hover:block absolute bottom-4 bg-red-950 text-red-200 text-[10px] px-1.5 py-0.5 rounded border border-red-800 whitespace-nowrap z-30 font-bold">
                    {ev.event_type}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Notificação no instante exato do sintoma */}
        {activeEventNotice && (
          <div className="bg-red-950/70 border-l-4 border-red-500 p-2.5 rounded text-xs flex items-center justify-between text-white animate-pulse">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>
                <strong>SINTOMA DETECTADO NESTE INSTANTE:</strong>{' '}
                {activeEventNotice.event_type.toUpperCase()}
                {activeEventNotice.description ? ` — "${activeEventNotice.description}"` : ''}
              </span>
            </div>
            <span className="text-[10px] font-mono text-red-300">Caixa-Preta ±30s</span>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-center p-8 bg-[#131A22] rounded border border-[#263340] text-xs text-[#9AA7B4]">
          Carregando telemetria bruta da sessão...
        </div>
      )}

      {/* Mesmos Medidores Prioritários do Live Dashboard */}
      <div>
        <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
          Medidores Prioritários Reproduzidos
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
          Telemetria Secundária Reproduzida
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

      {/* Mini Chart do Replay */}
      <MiniLiveChart data={chartHistory} />
    </div>
  )
}
