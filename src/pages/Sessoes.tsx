import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { SessionModel, EventModel, DtcModel, VehicleModel } from '@/types/obd'
import { vehicleService } from '@/services/vehicles'
import { ExporterService } from '@/lib/obd/exporter-service'
import { Button } from '@/components/ui/button'
import {
  PlayCircle,
  ShieldCheck,
  RefreshCw,
  Car,
  Clock,
  AlertTriangle,
  Layers,
  Printer,
  FileDown,
} from 'lucide-react'

export default function Sessoes() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<SessionModel[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionModel | null>(null)
  const [vehicleRecord, setVehicleRecord] = useState<VehicleModel | null>(null)
  const [sessionEvents, setSessionEvents] = useState<EventModel[]>([])
  const [sessionDtcs, setSessionDtcs] = useState<DtcModel[]>([])
  const [sampleCount, setSampleCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  // Carrega sessões
  const fetchSessions = async () => {
    try {
      setLoading(true)
      const records = await pb.collection('sessions').getFullList<SessionModel>({
        sort: '-started_at',
      })
      setSessions(records)
      if (records.length > 0 && !selectedSession) {
        loadSessionDetails(records[0])
      }
    } catch (err) {
      console.warn('Erro ao buscar sessões do backend:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSessionDetails = async (sess: SessionModel) => {
    setSelectedSession(sess)
    if (!sess.id) return

    if (sess.vehicle) {
      try {
        const v = await vehicleService.getById(sess.vehicle)
        setVehicleRecord(v)
      } catch (_) {
        setVehicleRecord(null)
      }
    } else {
      setVehicleRecord(null)
    }

    try {
      // Busca eventos vinculados
      const evs = await pb.collection('events').getFullList<EventModel>({
        filter: `session = "${sess.id}"`,
        sort: 'ts_mono_offset_ms',
      })
      setSessionEvents(evs)

      // Busca DTCs vinculados
      const dtcs = await pb.collection('dtcs').getFullList<DtcModel>({
        filter: `session = "${sess.id}"`,
      })
      setSessionDtcs(dtcs)

      // Conta amostras brutas persistidas
      const samplesRes = await pb.collection('raw_samples').getList(1, 1, {
        filter: `session = "${sess.id}"`,
      })
      setSampleCount(samplesRes.totalItems)
    } catch (e) {
      console.warn('Erro ao carregar detalhes da sessão:', e)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, [])

  // Inscrição em tempo real para novas sessões
  useRealtime<any>('sessions', () => {
    fetchSessions()
  })

  return (
    <div className="space-y-6">
      {/* Header com Nota de Integridade */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Layers className="w-5 h-5 text-[#FFB300]" />
            <span>Histórico de Sessões de Teste</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Registro de rodagens, PIDs mapeados, eventos de sintomas e anomalias capturadas.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800 px-2.5 py-1 rounded">
            <ShieldCheck className="w-4 h-4" />
            <span>Dados brutos são imutáveis (append-only)</span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchSessions}
            className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Sessões (Coluna Esquerda) */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider">
            Sessões Gravadas ({sessions.length})
          </h2>

          {loading ? (
            <div className="text-xs text-[#9AA7B4] p-4 bg-[#131A22] rounded border border-[#263340]">
              Carregando sessões...
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-xs text-[#9AA7B4] p-6 bg-[#131A22] rounded border border-[#263340] text-center">
              Nenhuma sessão registrada ainda. Inicie um teste no Painel Live.
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const isSelected = selectedSession?.id === s.id
                return (
                  <div
                    key={s.id || s.session_id}
                    onClick={() => loadSessionDetails(s)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#1A232E] border-[#FFB300] ring-1 ring-[#FFB300]'
                        : 'bg-[#131A22] border-[#263340] hover:border-gray-600 hover:bg-[#1A232E]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-white truncate max-w-[180px]">
                        {s.vehicle_name || 'Veículo Não Informado'}
                      </span>
                      <div className="flex items-center space-x-1.5">
                        {/* Badge de Origem: HARDWARE_REAL vs SIMULADOR */}
                        {s.origin === 'HARDWARE_REAL' || s.adapter_type !== 'SIMULADOR' ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-700 uppercase tracking-wider">
                            HARDWARE_REAL
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 uppercase tracking-wider">
                            SIMULADOR
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            s.status === 'ATIVO'
                              ? 'bg-emerald-950 text-[#2ECC71] border border-emerald-800'
                              : s.status === 'INTERROMPIDO'
                                ? 'bg-red-950 text-red-300 border border-red-800'
                                : 'bg-gray-800 text-gray-300'
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[#9AA7B4] truncate">
                      ID: {s.session_id}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-[#9AA7B4] mt-2 pt-2 border-t border-[#263340]/60">
                      <span>
                        {new Date(s.started_at).toLocaleDateString('pt-BR')}{' '}
                        {new Date(s.started_at).toLocaleTimeString('pt-BR')}
                      </span>
                      <span className="text-blue-400 font-mono text-[10px]">{s.adapter_type}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detalhes da Sessão Selecionada (Coluna Direita) */}
        <div className="lg:col-span-2">
          {selectedSession ? (
            <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-5">
              {/* Top Bar dos Detalhes */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#263340]">
                <div>
                  <div className="flex items-center space-x-2">
                    <Car className="w-5 h-5 text-[#FFB300]" />
                    <h2 className="text-base font-bold text-white">
                      {selectedSession.vehicle_name || 'Veículo Testado'}
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-[#9AA7B4]">
                    Identificador Único: {selectedSession.session_id}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      ExporterService.printDiagnosticReport({
                        session: selectedSession,
                        vehicle: vehicleRecord,
                        events: sessionEvents,
                        dtcs: sessionDtcs,
                        totalSamplesCount: sampleCount,
                      })
                    }
                    className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] text-xs"
                    title="Imprimir ou Salvar Relatório PDF"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    PDF
                  </Button>

                  <Button
                    onClick={() =>
                      navigate(
                        `/replay?session=${selectedSession.id || selectedSession.session_id}`,
                      )
                    }
                    className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs"
                  >
                    <PlayCircle className="w-4 h-4 mr-1.5 fill-current" />
                    Reproduzir no Replay
                  </Button>
                </div>
              </div>

              {/* Grid de Metadados */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                  <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                    Início:
                  </span>
                  <span className="font-mono text-white">
                    {new Date(selectedSession.started_at).toLocaleTimeString('pt-BR')}
                  </span>
                </div>
                <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                  <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                    Término:
                  </span>
                  <span className="font-mono text-white">
                    {selectedSession.ended_at
                      ? new Date(selectedSession.ended_at).toLocaleTimeString('pt-BR')
                      : 'Em andamento'}
                  </span>
                </div>
                <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                  <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                    Amostras Brutas:
                  </span>
                  <span className="font-mono text-[#2ECC71] font-bold">{sampleCount} amostras</span>
                </div>
                <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                  <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                    Origem / Transporte:
                  </span>
                  <div className="flex items-center space-x-1">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        selectedSession.origin === 'HARDWARE_REAL' ||
                        selectedSession.adapter_type !== 'SIMULADOR'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}
                    >
                      {selectedSession.origin === 'HARDWARE_REAL' ||
                      selectedSession.adapter_type !== 'SIMULADOR'
                        ? 'HARDWARE_REAL'
                        : 'SIMULADOR'}
                    </span>
                    <span className="font-mono text-blue-400 truncate text-[11px]">
                      {selectedSession.adapter_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* PIDs Descobertos */}
              <div>
                <h3 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
                  PIDs Diagnosticados e Suportados
                </h3>
                <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] flex flex-wrap gap-1.5">
                  {(selectedSession.pids_found || []).length > 0 ? (
                    (selectedSession.pids_found || []).map((p) => (
                      <span
                        key={p}
                        className="bg-[#1A232E] text-[#FFB300] px-2 py-0.5 rounded font-mono text-xs border border-[#263340]"
                      >
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#9AA7B4]">Nenhum PID registrado.</span>
                  )}
                </div>
              </div>

              {/* Eventos / Sintomas Marcados na Sessão (Caixa-Preta) */}
              <div>
                <h3 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
                  Eventos / Sintomas Marcados ({sessionEvents.length})
                </h3>
                {sessionEvents.length === 0 ? (
                  <div className="text-xs text-[#9AA7B4] bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    Nenhum sintoma marcado nesta sessão.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sessionEvents.map((ev) => (
                      <div
                        key={ev.id || ev.event_id}
                        className="bg-[#0B0F14] border border-red-900/40 p-3 rounded text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-red-400 uppercase tracking-wide">
                            {ev.event_type}
                          </span>
                          <span className="text-[10px] font-mono text-[#9AA7B4]">
                            T +{(ev.ts_mono_offset_ms / 1000).toFixed(1)}s (UTC:{' '}
                            {new Date(ev.ts_utc).toLocaleTimeString('pt-BR')})
                          </span>
                        </div>
                        {ev.description && <p className="text-gray-300 italic">{ev.description}</p>}
                        <div className="text-[10px] text-gray-500 pt-1">
                          Janela Caixa-Preta: -{ev.window_pre_ms / 1000}s a +
                          {ev.window_post_ms / 1000}s preservada.
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* DTCs Registrados */}
              <div>
                <h3 className="text-xs font-bold text-[#9AA7B4] uppercase tracking-wider mb-2">
                  Códigos de Falha Registrados (DTCs) ({sessionDtcs.length})
                </h3>
                {sessionDtcs.length === 0 ? (
                  <div className="text-xs text-[#9AA7B4] bg-[#0B0F14] p-3 rounded border border-[#263340]">
                    Nenhum código de falha detectado na sessão.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sessionDtcs.map((dtc) => (
                      <div
                        key={dtc.id || dtc.dtc_code}
                        className="bg-[#0B0F14] border border-amber-800/60 p-2.5 rounded text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-mono font-bold text-amber-400 text-sm block">
                            {dtc.dtc_code}
                          </span>
                          <span className="text-[10px] text-gray-400">Status: {dtc.status}</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${dtc.mil_on ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-gray-800 text-gray-300'}`}
                        >
                          MIL {dtc.mil_on ? 'ACESO' : 'APAGADO'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-[#131A22] border border-[#263340] rounded-lg p-10 text-center text-xs text-[#9AA7B4]">
              Selecione uma sessão à esquerda para inspecionar os metadados.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
