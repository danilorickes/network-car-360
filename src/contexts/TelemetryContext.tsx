import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import {
  TelemetryState,
  AdapterType,
  AppConfig,
  SampleQuality,
  RawSampleModel,
  EventModel,
  DtcModel,
} from '@/types/obd'
import { OBDTransport } from '@/lib/obd/transports/obd-transport'
import { SimulatedTransport, SimulatorScenario } from '@/lib/obd/transports/simulated-transport'
import { RealSerialTransport } from '@/lib/obd/transports/real-serial-transport'
import { BluetoothTransport } from '@/lib/obd/transports/bluetooth-transport'
import { SamplerScheduler } from '@/lib/obd/sampler-scheduler'
import { RawRecorder } from '@/lib/obd/raw-recorder'
import { EventMarker } from '@/lib/obd/event-marker'
import { DtcService } from '@/lib/obd/dtc-service'
import { loadAppConfig } from '@/lib/config-store'
import { offlineStorage } from '@/lib/obd/offline-storage'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'

interface TelemetryContextType {
  telemetry: TelemetryState
  config: AppConfig
  activeScenario: SimulatorScenario
  setActiveScenario: (s: SimulatorScenario) => void
  setTransportType: (type: AdapterType) => void
  connectTransport: () => Promise<boolean>
  disconnectTransport: () => Promise<void>
  startSession: (vehicleName?: string) => Promise<boolean>
  endSession: () => Promise<void>
  markSymptom: (type: any, description: string) => Promise<EventModel | null>
  simulateCommunicationDrop: () => void
  simulateReconnect: () => void
  readDtcsManual: () => Promise<void>
  recentHistory: { time: string; rpm: number; speed: number; coolant: number }[]
  bufferedSamples: RawSampleModel[]
  sessionEvents: EventModel[]
}

const initialTelemetry: TelemetryState = {
  currentValues: {},
  connectionState: 'DESCONECTADO',
  transportType: 'SIMULADOR',
  sessionState: 'IDLE',
  durationMs: 0,
  effectiveFreqHz: 0,
  targetFreqHz: 5,
  totalSamples: 0,
  totalEvents: 0,
  dtcList: [],
  milOn: false,
  discoveredPids: [],
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined)

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast()
  const [telemetry, setTelemetry] = useState<TelemetryState>(initialTelemetry)
  const [config, setConfig] = useState<AppConfig>(loadAppConfig())
  const [activeScenario, setActiveScenarioState] = useState<SimulatorScenario>('NORMAL')
  const [recentHistory, setRecentHistory] = useState<
    { time: string; rpm: number; speed: number; coolant: number }[]
  >([])
  const [sessionEvents, setSessionEvents] = useState<EventModel[]>([])

  // Referências para instâncias de baixo nível
  const transportRef = useRef<OBDTransport | null>(null)
  const samplerRef = useRef<SamplerScheduler | null>(null)
  const recorderRef = useRef<RawRecorder | null>(null)
  const eventMarkerRef = useRef<EventMarker | null>(null)
  const dtcServiceRef = useRef<DtcService | null>(null)

  const activeSessionUniqueIdRef = useRef<string | null>(null)
  const dbSessionIdRef = useRef<string | null>(null)
  const sessionMonoStartRef = useRef<number>(0)
  const dtcTimerRef = useRef<any>(null)
  const durationTimerRef = useRef<any>(null)

  // Instancia transporte padrão (Simulador) e inicializa verificação offline
  useEffect(() => {
    const sim = new SimulatedTransport(activeScenario)
    sim.on('statusChange', (status, msg) => {
      setTelemetry((prev) => ({
        ...prev,
        connectionState: status,
        lastError: status === 'FALHA' ? msg : undefined,
      }))
    })
    transportRef.current = sim

    // NC-02: Instancia recorder e reidrata amostras pendentes do IndexedDB na inicialização
    const rec = new RawRecorder()
    recorderRef.current = rec
    rec.rehydratePendingQueue().then((rehydratedCount) => {
      if (rehydratedCount > 0) {
        toast({
          title: 'Dados Offline Recuperados (NC-02)',
          description: `${rehydratedCount} amostra(s) pendente(s) reidratada(s) do IndexedDB para sincronização.`,
        })
      }
    })

    return () => {
      sim.disconnect().catch(() => {})
      rec.destroy()
    }
  }, [])

  const setActiveScenario = (scenario: SimulatorScenario) => {
    setActiveScenarioState(scenario)
    if (transportRef.current instanceof SimulatedTransport) {
      transportRef.current.setScenario(scenario)
    }
  }

  const setTransportType = useCallback(
    (type: AdapterType) => {
      if (telemetry.sessionState === 'TESTE ATIVO') {
        toast({
          title: 'Atenção',
          description: 'Não é possível trocar o transporte com teste em andamento.',
          variant: 'destructive',
        })
        return
      }

      if (transportRef.current) {
        transportRef.current.disconnect().catch(() => {})
      }

      if (type === 'SIMULADOR') {
        const sim = new SimulatedTransport(activeScenario)
        sim.on('statusChange', (status, msg) => {
          setTelemetry((prev) => ({
            ...prev,
            connectionState: status,
            lastError: status === 'FALHA' ? msg : undefined,
          }))
        })
        transportRef.current = sim
      } else if (type === 'OBD REAL BLUETOOTH') {
        const bt = new BluetoothTransport()
        bt.on('statusChange', (status, msg) => {
          setTelemetry((prev) => ({
            ...prev,
            connectionState: status,
            lastError: status === 'FALHA' ? msg : undefined,
          }))
        })
        transportRef.current = bt
      } else {
        const real = new RealSerialTransport(config.baudRate, config.reconnectAttempts)
        real.on('statusChange', (status, msg) => {
          setTelemetry((prev) => ({
            ...prev,
            connectionState: status,
            lastError: status === 'FALHA' ? msg : undefined,
          }))
        })
        transportRef.current = real
      }

      setTelemetry((prev) => ({
        ...prev,
        transportType: type,
        connectionState: 'DESCONECTADO',
      }))
    },
    [telemetry.sessionState, activeScenario, config.baudRate, config.reconnectAttempts, toast],
  )

  const connectTransport = async (): Promise<boolean> => {
    if (!transportRef.current) return false
    try {
      const ok = await transportRef.current.connect()
      return ok
    } catch (err: any) {
      toast({
        title: 'Erro de Conexão',
        description: err?.message || 'Falha ao conectar transporte OBD',
        variant: 'destructive',
      })
      return false
    }
  }

  const disconnectTransport = async (): Promise<void> => {
    if (transportRef.current) {
      await transportRef.current.disconnect()
    }
  }

  // Simulação de perda e recuperação de comunicação
  const simulateCommunicationDrop = () => {
    if (transportRef.current instanceof SimulatedTransport) {
      transportRef.current.simulateCommunicationLoss()
      toast({
        title: 'Falha Provocada',
        description: 'Perda de sinal com o adaptador gerada para teste de resiliência.',
        variant: 'destructive',
      })
    }
  }

  const simulateReconnect = () => {
    if (transportRef.current instanceof SimulatedTransport) {
      transportRef.current.simulateReconnect()
      toast({
        title: 'Reconexão',
        description: 'Sinal restabelecido com o simulador.',
      })
    }
  }

  const readDtcsManual = async () => {
    if (dtcServiceRef.current) {
      const res = await dtcServiceRef.current.readDtcs()
      setTelemetry((prev) => ({
        ...prev,
        dtcList: res.dtcs,
        milOn: res.milOn,
      }))
      toast({
        title: 'Varredura DTC Concluída',
        description: `${res.dtcs.length} falha(s) identificada(s). MIL: ${res.milOn ? 'ACESO' : 'APAGADO'}`,
      })
    }
  }

  const startSession = async (vehicleName?: string): Promise<boolean> => {
    if (!transportRef.current || !transportRef.current.isConnected()) {
      toast({
        title: 'Conexão Necessária',
        description: 'Conecte o adaptador antes de iniciar a sessão de teste.',
        variant: 'destructive',
      })
      return false
    }

    const sessionUid = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    activeSessionUniqueIdRef.current = sessionUid
    sessionMonoStartRef.current = performance.now()

    const veh = vehicleName || config.defaultVehicleName
    const adapterType = telemetry.transportType
    const transportDetail =
      adapterType === 'SIMULADOR'
        ? `Simulador (${activeScenario})`
        : adapterType === 'OBD REAL BLUETOOTH'
          ? 'Web Bluetooth — ELM327 BLE (AGUARDANDO VALIDAÇÃO EM HARDWARE REAL)'
          : 'Web Serial — ELM327 USB (AGUARDANDO VALIDAÇÃO EM HARDWARE REAL)'

    // Cria registro de sessão no PocketBase
    let pbSessId: string | null = null
    try {
      const record = await pb.collection('sessions').create({
        session_id: sessionUid,
        vehicle_name: veh,
        adapter_type: adapterType,
        transport_detail: transportDetail,
        vin: '9BFBJ55E6L8104921',
        protocol: 'ISO 15765-4 (CAN 11/500)',
        pids_found: [],
        started_at: new Date().toISOString(),
        status: 'ATIVO',
      })
      pbSessId = record.id
      dbSessionIdRef.current = record.id
    } catch (e) {
      console.warn(
        'Backend indisponível para criação imediata da sessão, operando com buffer local:',
        e,
      )
    }

    // Inicializa subsistemas
    let recorder = recorderRef.current
    if (!recorder) {
      recorder = new RawRecorder(pbSessId || undefined)
      recorderRef.current = recorder
    } else if (pbSessId) {
      recorder.setDbSessionId(pbSessId)
    }

    const eventMarker = new EventMarker(
      sessionUid,
      sessionMonoStartRef.current,
      pbSessId || undefined,
    )
    eventMarkerRef.current = eventMarker

    const dtcService = new DtcService(transportRef.current, sessionUid, pbSessId || undefined)
    dtcServiceRef.current = dtcService

    const sampler = new SamplerScheduler(
      transportRef.current,
      recorder,
      sessionMonoStartRef.current,
      config.priorityFreqHz,
      config.secondaryFreqHz,
    )
    samplerRef.current = sampler

    // Descoberta inicial de PIDs
    const discovered = await sampler.discoverSupportedPids()
    if (pbSessId) {
      pb.collection('sessions')
        .update(pbSessId, { pids_found: discovered })
        .catch(() => {})
    }

    // Leitura inicial de DTCs
    const dtcResult = await dtcService.readDtcs()

    // Eventos do sampler
    sampler.on('frequencyUpdate', (eff, tgt) => {
      setTelemetry((prev) => ({
        ...prev,
        effectiveFreqHz: eff,
        targetFreqHz: tgt,
      }))
    })

    sampler.on('sample', (sample: RawSampleModel) => {
      setTelemetry((prev) => {
        const cur = { ...(prev.currentValues[sample.pid] || {}) }
        const spark = [...(cur.sparkline || [])]
        if (sample.decoded_value !== undefined) {
          spark.push(sample.decoded_value)
          if (spark.length > 20) spark.shift()
        }

        const updatedValues = {
          ...prev.currentValues,
          [sample.pid]: {
            decoded: sample.decoded_value,
            raw: sample.raw_value,
            unit: sample.unit,
            quality: sample.quality,
            lastUpdatedUtc: sample.ts_utc,
            sparkline: spark,
          },
        }

        return {
          ...prev,
          currentValues: updatedValues,
          totalSamples: prev.totalSamples + 1,
        }
      })

      // Atualiza mini chart (RPM, velocidade, temp)
      if (sample.pid === '0x0C' && sample.decoded_value !== undefined) {
        setRecentHistory((prev) => {
          const nowStr = new Date().toLocaleTimeString('pt-BR', {
            minute: '2-digit',
            second: '2-digit',
          })
          const curRpm = sample.decoded_value || 0
          const curSpeed = telemetry.currentValues['0x0D']?.decoded || 0
          const curTemp = telemetry.currentValues['0x05']?.decoded || 85
          const next = [...prev, { time: nowStr, rpm: curRpm, speed: curSpeed, coolant: curTemp }]
          if (next.length > 30) next.shift()
          return next
        })
      }
    })

    sampler.start()

    // Loop de leitura periódica de DTC
    if (dtcTimerRef.current) clearInterval(dtcTimerRef.current)
    dtcTimerRef.current = setInterval(() => {
      dtcService.readDtcs().then((res) => {
        setTelemetry((prev) => ({
          ...prev,
          dtcList: res.dtcs,
          milOn: res.milOn,
        }))
      })
    }, config.dtcIntervalMs)

    // Timer de duração da sessão
    if (durationTimerRef.current) clearInterval(durationTimerRef.current)
    durationTimerRef.current = setInterval(() => {
      const dur = Math.round(performance.now() - sessionMonoStartRef.current)
      setTelemetry((prev) => ({ ...prev, durationMs: dur }))
    }, 500)

    setTelemetry((prev) => ({
      ...prev,
      sessionState: 'TESTE ATIVO',
      activeSessionId: sessionUid,
      discoveredPids: discovered,
      dtcList: dtcResult.dtcs,
      milOn: dtcResult.milOn,
      totalSamples: 0,
      totalEvents: 0,
    }))
    setSessionEvents([])

    toast({
      title: 'TESTE INICIADO',
      description: `Sessão ${sessionUid} ativa para ${veh}. Coleta em andamento.`,
    })

    return true
  }

  const endSession = async (): Promise<void> => {
    if (samplerRef.current) {
      samplerRef.current.stop()
    }
    if (dtcTimerRef.current) {
      clearInterval(dtcTimerRef.current)
      dtcTimerRef.current = null
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current)
      durationTimerRef.current = null
    }

    const pbId = dbSessionIdRef.current
    if (pbId) {
      try {
        await pb.collection('sessions').update(pbId, {
          ended_at: new Date().toISOString(),
          status: 'ENCERRADO',
        })
      } catch (e) {
        console.warn('Erro ao atualizar encerramento no PocketBase:', e)
      }
    }

    setTelemetry((prev) => ({
      ...prev,
      sessionState: 'ENCERRADO',
    }))

    toast({
      title: 'TESTE ENCERRADO',
      description: 'Sessão finalizada. Dados brutos persistidos com sucesso (append-only).',
    })
  }

  const markSymptom = async (type: any, description: string): Promise<EventModel | null> => {
    if (!eventMarkerRef.current || telemetry.sessionState !== 'TESTE ATIVO') {
      toast({
        title: 'Atenção',
        description: 'Inicie um teste para poder marcar sintomas.',
        variant: 'destructive',
      })
      return null
    }

    try {
      const ev = await eventMarkerRef.current.markSymptom(
        type,
        description,
        config.windowPreMs,
        config.windowPostMs,
      )
      setSessionEvents((prev) => [...prev, ev])
      setTelemetry((prev) => ({
        ...prev,
        totalEvents: prev.totalEvents + 1,
      }))

      toast({
        title: 'SINTOMA REGISTRADO',
        description: `Evento "${type}" gravado com janela temporal de ±${config.windowPreMs / 1000}s.`,
      })

      return ev
    } catch {
      return null
    }
  }

  return (
    <TelemetryContext.Provider
      value={{
        telemetry,
        config,
        activeScenario,
        setActiveScenario,
        setTransportType,
        connectTransport,
        disconnectTransport,
        startSession,
        endSession,
        markSymptom,
        simulateCommunicationDrop,
        simulateReconnect,
        readDtcsManual,
        recentHistory,
        bufferedSamples: recorderRef.current?.getSamplesCopy() || [],
        sessionEvents,
      }}
    >
      {children}
    </TelemetryContext.Provider>
  )
}

export function useTelemetry() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider')
  return ctx
}
