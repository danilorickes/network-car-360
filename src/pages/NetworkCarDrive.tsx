import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Car,
  Compass,
  Music,
  Bot,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  AlertTriangle,
  Play,
  Square,
  Plus,
  MapPin,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Moon,
  Sun,
  Award,
  Radio,
  Wifi,
  WifiOff,
  Info,
  Maximize2,
  Minimize2,
  Flag,
  Flame,
  Gauge,
  Thermometer,
  Zap,
  Activity,
  UserCheck,
  SlidersHorizontal,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { useToast } from '@/hooks/use-toast'
import { DrivingContextEstimator } from '@/lib/diagnostic/driving-context-estimator'
import { IndividualBaselineLearner } from '@/lib/diagnostic/individual-baseline-learner'
import { VehicleSafetyMonitor } from '@/lib/diagnostic/vehicle-safety-monitor'
import { TripSessionManager } from '@/lib/trip/trip-session-manager'
import {
  AssistantCopilotService,
  AssistantMessage,
} from '@/lib/assistant/assistant-copilot-service'
import {
  AssistantPeriodicBulletinService,
  BulletinContextInput,
} from '@/lib/assistant/assistant-periodic-bulletin-service'
import {
  loadAssistantIdentity,
  getAssistantDisplayName,
} from '@/lib/assistant/assistant-identity-store'
import { AssistantSettingsModal } from '@/components/assistant/AssistantSettingsModal'
import { TripCostPanel } from '@/components/trip/TripCostPanel'
import { TripFinishedSummaryModal } from '@/components/trip/TripFinishedSummaryModal'
import {
  TRAVEL_QUIZ_QUESTIONS,
  EXTERNAL_MEDIA_SHORTCUTS,
} from '@/lib/entertainment/travel-entertainment'
import {
  DrivingContextInfo,
  SafetyLevel,
  SafetyAlert,
  CopilotContext,
  TripSessionModel,
  TripDiaryEntryModel,
  NinaBulletinConfig,
  NinaBulletinPayload,
  AssistantIdentityConfig,
  FuelType,
  ConsumptionSourceType,
  TripCostSummaryReport,
} from '@/types/etapa6'

export const NetworkCarDrive: React.FC = () => {
  const { toast } = useToast()
  const { telemetry, selectedVehicle, markSymptom, activeScenario } = useTelemetry()

  // Navegação principal: CARRO | VIAGEM | DIVERSÃO | ASSISTENTE
  const [activeTab, setActiveTab] = useState<'CARRO' | 'VIAGEM' | 'DIVERSAO' | 'ASSISTENTE'>(
    'CARRO',
  )

  // Identidade Dinâmica da Assistente (E6.2)
  const [assistantIdentity, setAssistantIdentity] = useState<AssistantIdentityConfig>(() =>
    loadAssistantIdentity(selectedVehicle?.plate),
  )
  const [assistantModalOpen, setAssistantModalOpen] = useState(false)

  // Modos Automotivos
  const [isNightMode, setIsNightMode] = useState(true)
  const [isPassengerMode, setIsPassengerMode] = useState(false)
  const [isListeningVoice, setIsListeningVoice] = useState(false)
  const [isSpeakingVoice, setIsSpeakingVoice] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Gerenciadores locais mantidos intocados funcionalmente
  const contextEstimatorRef = useRef(new DrivingContextEstimator())
  const baselineLearnerRef = useRef<IndividualBaselineLearner | null>(null)
  const safetyMonitorRef = useRef(new VehicleSafetyMonitor())
  const tripManagerRef = useRef(new TripSessionManager())
  const assistantRef = useRef<AssistantCopilotService | null>(null)
  const bulletinServiceRef = useRef<AssistantPeriodicBulletinService | null>(null)

  // Estados dinâmicos de telemetria e contexto
  const [drivingContext, setDrivingContext] = useState<DrivingContextInfo>({
    type: 'DESCONHECIDO',
    label: 'Aguardando veículo...',
    confidence: 0,
    estimatedAtMonoMs: 0,
    description: 'Aguardando telemetria OBD',
    activeSinceUtc: new Date().toISOString(),
  })
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>('NORMAL')
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([])
  const [activeTrip, setActiveTrip] = useState<TripSessionModel | null>(null)
  const [diaryEntries, setDiaryEntries] = useState<TripDiaryEntryModel[]>([])
  const [finishedCostReport, setFinishedCostReport] = useState<TripCostSummaryReport | null>(null)
  const [showFinishedCostModal, setShowFinishedCostModal] = useState(false)
  const [tripHistoryList, setTripHistoryList] = useState<TripSessionModel[]>([])

  // Sincroniza viagem ativa e histórico do tripManager
  useEffect(() => {
    const current = tripManagerRef.current.getActiveTrip()
    if (current) {
      setActiveTrip(current)
      setDiaryEntries(tripManagerRef.current.getDiaryEntries())
    }
    const hist = tripManagerRef.current.getLocalTripHistory(selectedVehicle?.plate)
    setTripHistoryList(hist)
  }, [selectedVehicle?.plate])

  // Estados de Boletins e Ducking de Áudio
  const [bulletinConfig, setBulletinConfig] = useState<NinaBulletinConfig>({
    enabled: true,
    intervalOption: 20,
    effectiveMinutes: 20,
    detailLevel: 'NORMAL',
    totalBulletinsEmitted: 0,
  })
  const [recentBulletins, setRecentBulletins] = useState<NinaBulletinPayload[]>([])
  const [isAudioDucked, setIsAudioDucked] = useState<boolean>(false)

  // Estados da Assistente
  const [assistantInput, setAssistantInput] = useState('')
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([])
  const [isAssistantLoading, setIsAssistantLoading] = useState(false)

  // Quiz e Diário
  const [quizActive, setQuizActive] = useState(false)
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null)
  const [newDiaryTitle, setNewDiaryTitle] = useState('')
  const [newDiaryNotes, setNewDiaryNotes] = useState('')
  const [hasLocationConsent, setHasLocationConsent] = useState(false)
  const [symptomMarking, setSymptomMarking] = useState(false)

  // Identidade reativa à placa
  useEffect(() => {
    const plate = selectedVehicle?.plate || 'PADRAO'
    baselineLearnerRef.current = new IndividualBaselineLearner(plate)
    const activeIdentity = loadAssistantIdentity(plate)
    setAssistantIdentity(activeIdentity)

    if (assistantRef.current) {
      assistantRef.current.setVehiclePlate(plate)
      assistantRef.current.setIdentity(activeIdentity)
    }
    if (bulletinServiceRef.current) {
      bulletinServiceRef.current.setVehiclePlate(plate)
      bulletinServiceRef.current.setIdentity(activeIdentity)
      setBulletinConfig(bulletinServiceRef.current.getConfig())
    }
  }, [selectedVehicle?.plate])

  // Helper de fala com ducking de entretenimento
  const executeDuckingSpeech = (text: string, onDone?: () => void) => {
    setIsAudioDucked(true)
    assistantRef.current?.speak(text, () => {
      setIsAudioDucked(false)
      onDone?.()
    })
  }

  // Inicializa serviços de Assistente e Boletins
  useEffect(() => {
    const plate = selectedVehicle?.plate || 'PADRAO'
    const loadedIdentity = loadAssistantIdentity(plate)
    setAssistantIdentity(loadedIdentity)

    const bulletinService = new AssistantPeriodicBulletinService(
      plate,
      {
        onBulletinGenerated: (bulletin) => {
          setRecentBulletins((prev) => [bulletin, ...prev.slice(0, 9)])
          executeDuckingSpeech(bulletin.text)
          const msg: AssistantMessage = {
            id: `msg_bulletin_${Date.now()}`,
            role: 'assistant',
            content: `📢 [Boletim ${bulletin.detailLevel}] ${bulletin.text}`,
            timestamp: bulletin.timestampUtc,
          }
          setAssistantMessages((prev) => [...prev, msg])
        },
        onConfigChanged: (cfg) => {
          setBulletinConfig(cfg)
        },
      },
      loadedIdentity,
    )
    bulletinServiceRef.current = bulletinService
    setBulletinConfig(bulletinService.getConfig())

    const asst = new AssistantCopilotService(plate, loadedIdentity, {
      onListeningStateChange: (listening) => setIsListeningVoice(listening),
      onSpeakingStateChange: (speaking) => setIsSpeakingVoice(speaking),
      onSpeechRecognized: (text) => {
        const cmdRes = bulletinServiceRef.current?.parseVoiceCommand(text)
        if (cmdRes && cmdRes.handled) {
          executeDuckingSpeech(cmdRes.replyText)
          const cmdMsg: AssistantMessage = {
            id: `msg_cmd_${Date.now()}`,
            role: 'assistant',
            content: cmdRes.replyText,
            timestamp: new Date().toISOString(),
          }
          setAssistantMessages((prev) => [...prev, cmdMsg])
        } else {
          handleSendAssistantMessage(text)
        }
      },
    })
    assistantRef.current = asst
    setAssistantMessages(asst.getMessages())

    return () => {
      asst.stopListening()
      asst.stopSpeaking()
      bulletinService.destroy()
    }
  }, [])

  // Loop de Telemetria e Monitoramento de Segurança
  useEffect(() => {
    const rpm = telemetry.currentValues['0x0C']?.decoded
    const speed = telemetry.currentValues['0x0D']?.decoded
    const coolant = telemetry.currentValues['0x05']?.decoded
    const volt = telemetry.currentValues['0x42']?.decoded
    const stft = telemetry.currentValues['0x06']?.decoded
    const ltft = telemetry.currentValues['0x07']?.decoded
    const maf = telemetry.currentValues['0x10']?.decoded

    // 1. Atualiza Contexto de Condução
    if (rpm !== undefined) {
      contextEstimatorRef.current.updateSample({
        sample_id: 's_rpm',
        session_id: 'drive',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: performance.now(),
        pid: '0x0C',
        decoded_value: rpm,
        quality: 'OK',
      })
    }
    if (speed !== undefined) {
      contextEstimatorRef.current.updateSample({
        sample_id: 's_spd',
        session_id: 'drive',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: performance.now(),
        pid: '0x0D',
        decoded_value: speed,
        quality: 'OK',
      })
    }
    if (coolant !== undefined) {
      contextEstimatorRef.current.updateSample({
        sample_id: 's_ect',
        session_id: 'drive',
        ts_utc: new Date().toISOString(),
        ts_mono_offset_ms: performance.now(),
        pid: '0x05',
        decoded_value: coolant,
        quality: 'OK',
      })
    }

    const currentCtx = contextEstimatorRef.current.getCurrentContext()
    setDrivingContext(currentCtx)

    // 2. Baseline Learner
    if (baselineLearnerRef.current && currentCtx.type !== 'DESCONHECIDO') {
      if (stft !== undefined) {
        baselineLearnerRef.current.learnObservation(currentCtx.type, '0x06', stft, '%', 'STFT')
      }
      if (rpm !== undefined && speed === 0) {
        baselineLearnerRef.current.learnObservation(currentCtx.type, '0x0C', rpm, 'RPM', 'RPM')
      }
    }

    // 3. Avalia Segurança Determinística (Local)
    const commState =
      telemetry.connectionState === 'CONECTADO'
        ? 'CONECTADO'
        : telemetry.connectionState === 'RECONECTANDO' || telemetry.connectionState === 'CONECTANDO'
          ? 'RECONECTANDO'
          : 'FALHA'

    const safetyRes = safetyMonitorRef.current.evaluateSafety({
      coolantTemp: coolant,
      batteryVoltage: volt,
      rpm,
      speed,
      milOn: telemetry.milOn,
      dtcCodes: telemetry.dtcList.map((d) => d.dtc_code),
      communicationState: commState,
    })

    setSafetyLevel(safetyRes.overallLevel)
    setSafetyAlerts(safetyRes.alerts)

    // Prioridade absoluta de interrupção: ALERTA CRÍTICO > NAVEGAÇÃO > ASSISTENTE > ENTRETENIMENTO
    if (safetyRes.overallLevel === 'CRITICO') {
      assistantRef.current?.stopSpeaking()
      if (quizActive) setQuizActive(false)
    }

    // 3.1 Snapshot para Boletins
    const supportedList = Object.keys(telemetry.currentValues).filter(
      (k) => telemetry.currentValues[k]?.quality === 'OK',
    )
    const copilotSnapshot: CopilotContext = {
      vehicleName: selectedVehicle
        ? `${selectedVehicle.make} ${selectedVehicle.model}`
        : 'Veículo OBD',
      vehiclePlate: selectedVehicle?.plate || 'S/P',
      connectionStatus: telemetry.connectionState,
      transportType: telemetry.transportType,
      drivingContext: currentCtx.type,
      speedKmh: speed,
      rpm,
      coolantTemp: coolant,
      batteryVoltage: volt,
      stft,
      ltft,
      activeDtcs: telemetry.dtcList.map((d) => d.dtc_code),
      milOn: telemetry.milOn,
      safetyLevel: safetyRes.overallLevel,
      activeAlerts: safetyRes.alerts.map((a) => a.title),
      isTripActive: Boolean(tripManagerRef.current.getActiveTrip()),
      tripTitle: tripManagerRef.current.getActiveTrip()?.title,
      tripDuration: tripManagerRef.current.getActiveTrip()
        ? `${Math.floor(tripManagerRef.current.getActiveTrip()!.duration_seconds / 60)} min`
        : undefined,
      tripDistance: tripManagerRef.current.getActiveTrip()
        ? `${tripManagerRef.current.getActiveTrip()!.distance_km} km`
        : undefined,
    }

    const baselineInfo = baselineLearnerRef.current?.getBaseline(currentCtx.type)
    const hasSufficient = (baselineInfo?.samples_count || 0) >= 30

    bulletinServiceRef.current?.updateTelemetrySnapshot({
      copilotContext: copilotSnapshot,
      supportedPids: supportedList.length > 0 ? supportedList : ['0x0C', '0x0D', '0x05', '0x42'],
      hasSufficientBaseline: hasSufficient,
      baselineSampleCount: baselineInfo?.samples_count || 0,
    })

    // 4. Modo Viagem
    if (tripManagerRef.current.getActiveTrip()) {
      tripManagerRef.current.processTelemetry({
        speedKmh: speed,
        rpm,
        coolantTemp: coolant,
        batteryVoltage: volt,
        mafGps: maf,
      })
      setActiveTrip({ ...tripManagerRef.current.getActiveTrip()! })
    }
  }, [telemetry.currentValues, telemetry.connectionState, telemetry.milOn, telemetry.dtcList])

  // Valores de telemetria sem falsificação ("—" quando indisponível)
  const isConnected = telemetry.connectionState === 'CONECTADO'
  const isSimulated = telemetry.transportType === 'SIMULADOR'

  const rawSpeed = telemetry.currentValues['0x0D']?.decoded
  const speedQuality = telemetry.currentValues['0x0D']?.quality
  const hasSpeedPid = isConnected && rawSpeed !== undefined && speedQuality === 'OK'
  const displaySpeed = hasSpeedPid
    ? String(Math.round(rawSpeed))
    : speedQuality === 'UNSUPPORTED'
      ? 'NÃO SUPORTADO'
      : '—'

  const rawRpm = telemetry.currentValues['0x0C']?.decoded
  const rpmQuality = telemetry.currentValues['0x0C']?.quality
  const hasRpmPid = isConnected && rawRpm !== undefined && rpmQuality === 'OK'
  const displayRpm = hasRpmPid
    ? String(Math.round(rawRpm))
    : rpmQuality === 'UNSUPPORTED'
      ? 'NÃO SUPORTADO'
      : '—'

  const rawCoolant = telemetry.currentValues['0x05']?.decoded
  const coolantQuality = telemetry.currentValues['0x05']?.quality
  const hasCoolantPid = isConnected && rawCoolant !== undefined && coolantQuality === 'OK'
  const displayCoolant = hasCoolantPid
    ? String(Math.round(rawCoolant))
    : coolantQuality === 'UNSUPPORTED'
      ? 'NÃO SUPORTADO'
      : '—'

  const rawVolt = telemetry.currentValues['0x42']?.decoded
  const voltQuality = telemetry.currentValues['0x42']?.quality
  const hasVoltPid = isConnected && rawVolt !== undefined && voltQuality === 'OK'
  const displayVolt = hasVoltPid
    ? Number(rawVolt).toFixed(1)
    : voltQuality === 'UNSUPPORTED'
      ? 'NÃO SUPORTADO'
      : '—'

  const isVehicleMoving = (rawSpeed || 0) > 5

  // Ações de viagem (Custo Inteligente E6.5)
  const handleStartCostTrip = (params: {
    title: string
    origin: string
    destination: string
    fuelPricePerLiter: number
    fuelType: FuelType
    consumptionKml: number
    consumptionSource: ConsumptionSourceType
    estimatedDistanceKm?: number
    estimatedTolls?: number
  }) => {
    const newTrip = tripManagerRef.current.startTrip({
      title: params.title,
      origin: params.origin,
      destination: params.destination,
      vehiclePlate: selectedVehicle?.plate,
      vehicleId: selectedVehicle?.id,
      initialOdometerKm: selectedVehicle?.odometer_km,
      fuelPricePerLiter: params.fuelPricePerLiter,
      fuelType: params.fuelType,
      consumptionKml: params.consumptionKml,
      consumptionSource: params.consumptionSource,
      estimatedDistanceKm: params.estimatedDistanceKm,
      estimatedTolls: params.estimatedTolls,
    })
    setActiveTrip(newTrip)
    toast({
      title: 'Viagem Iniciada com Custo Inteligente',
      description: `${params.origin} → ${params.destination} • Preço: R$ ${params.fuelPricePerLiter.toFixed(2)}/L`,
    })
  }

  const handleEndCostTrip = () => {
    const finished = tripManagerRef.current.endTrip()
    if (finished) {
      if (finished.cost_summary_report) {
        setFinishedCostReport(finished.cost_summary_report)
        setShowFinishedCostModal(true)
      }
      setTripHistoryList(tripManagerRef.current.getLocalTripHistory(selectedVehicle?.plate))
      setActiveTrip(null)
      toast({
        title: 'Viagem Finalizada',
        description: `Total: R$ ${(finished.total_cost || 0).toFixed(2)} • Distância: ${finished.distance_km} km`,
      })
    }
  }

  const handleAddTollCost = (amount: number, name?: string) => {
    const toll = tripManagerRef.current.addToll(amount, name)
    if (toll) {
      setActiveTrip({ ...tripManagerRef.current.getActiveTrip()! })
      toast({
        title: 'Pedágio Adicionado',
        description: `${toll.name}: R$ ${toll.amount.toFixed(2)}`,
      })
    }
  }

  const handleUpdateFuelPrice = (price: number) => {
    tripManagerRef.current.updateFuelPrice(price)
    setActiveTrip({ ...tripManagerRef.current.getActiveTrip()! })
    toast({
      title: 'Preço Atualizado',
      description: `Novo preço do combustível: R$ ${price.toFixed(2)}/L`,
    })
  }

  const handleToggleTrip = () => {
    if (activeTrip && activeTrip.status === 'EM_ANDAMENTO') {
      handleEndCostTrip()
    } else {
      const newTrip = tripManagerRef.current.startTrip({
        title: `Viagem ${new Date().toLocaleDateString('pt-BR')}`,
        vehiclePlate: selectedVehicle?.plate,
        vehicleId: selectedVehicle?.id,
        initialOdometerKm: selectedVehicle?.odometer_km,
      })
      setActiveTrip(newTrip)
      toast({
        title: 'Viagem Iniciada',
        description: 'Gravando duração, distância, paradas e consumo estimado.',
      })
    }
  }

  const handleAddDiaryEntry = () => {
    if (!newDiaryTitle.trim()) return
    const entry = tripManagerRef.current.addDiaryEntry({
      entryType: 'PARADA',
      title: newDiaryTitle,
      notes: newDiaryNotes,
      hasLocationConsent,
      locationLabel: hasLocationConsent ? 'Ponto de Parada Autorizado' : undefined,
    })
    if (entry) {
      setDiaryEntries(tripManagerRef.current.getDiaryEntries())
      setNewDiaryTitle('')
      setNewDiaryNotes('')
      toast({
        title: 'Parada Registrada',
        description: entry.title,
      })
    }
  }

  // Marcar Sintoma pelo Motorista / Passageiro
  const handleMarkSymptomQuick = async (symptomType = 'SINTOMA_MOTORISTA') => {
    setSymptomMarking(true)
    try {
      const desc = `Sintoma marcado pelo botão rápido Network Car Drive (${drivingContext.type})`
      const res = await markSymptom(symptomType, desc)
      if (res) {
        toast({
          title: 'Sintoma Registrado no Black Box',
          description: 'Janela pré e pós capturada com sucesso para diagnóstico 360.',
        })
      }
    } finally {
      setSymptomMarking(false)
    }
  }

  // Enviar Mensagem à Assistente
  const handleSendAssistantMessage = async (textToSend?: string) => {
    const text = textToSend || assistantInput
    if (!text.trim() || !assistantRef.current) return

    setAssistantInput('')
    setIsAssistantLoading(true)

    const copilotContext: CopilotContext = {
      vehicleName: selectedVehicle
        ? `${selectedVehicle.make} ${selectedVehicle.model}`
        : 'Veículo OBD',
      vehiclePlate: selectedVehicle?.plate || 'S/P',
      connectionStatus: telemetry.connectionState,
      transportType: telemetry.transportType,
      drivingContext: drivingContext.type,
      speedKmh: telemetry.currentValues['0x0D']?.decoded,
      rpm: telemetry.currentValues['0x0C']?.decoded,
      coolantTemp: telemetry.currentValues['0x05']?.decoded,
      batteryVoltage: telemetry.currentValues['0x42']?.decoded,
      stft: telemetry.currentValues['0x06']?.decoded,
      ltft: telemetry.currentValues['0x07']?.decoded,
      activeDtcs: telemetry.dtcList.map((d) => d.dtc_code),
      milOn: telemetry.milOn,
      safetyLevel,
      activeAlerts: safetyAlerts.map((a) => a.title),
      isTripActive: Boolean(activeTrip),
      tripTitle: activeTrip?.title,
      tripDuration: activeTrip ? `${Math.floor(activeTrip.duration_seconds / 60)} min` : undefined,
      tripDistance: activeTrip ? `${activeTrip.distance_km} km` : undefined,
      assistantIdentity,
    }

    try {
      await assistantRef.current.sendMessage(text, copilotContext, true)
      setAssistantMessages(assistantRef.current.getMessages())
    } finally {
      setIsAssistantLoading(false)
    }
  }

  // Quiz
  const handleStartEntertainmentMode = () => {
    setQuizActive(true)
    setQuizQuestionIndex(0)
    setQuizScore(0)
    setQuizSelectedOption(null)
    setActiveTab('DIVERSAO')
    assistantRef.current?.speak(
      'Modo diversão ativado! Vamos jogar um quiz de viagem com perguntas automotivas.',
    )
  }

  const currentQuiz = TRAVEL_QUIZ_QUESTIONS[quizQuestionIndex]

  const handleAnswerQuiz = (index: number) => {
    setQuizSelectedOption(index)
    const isCorrect = index === currentQuiz.correctIndex
    if (isCorrect) {
      setQuizScore((prev) => prev + 10)
      assistantRef.current?.speak(`Correto! ${currentQuiz.explanation}`)
    } else {
      assistantRef.current?.speak(`Não foi dessa vez. ${currentQuiz.explanation}`)
    }

    setTimeout(() => {
      if (quizQuestionIndex < TRAVEL_QUIZ_QUESTIONS.length - 1) {
        setQuizQuestionIndex((p) => p + 1)
        setQuizSelectedOption(null)
      } else {
        setQuizActive(false)
        assistantRef.current?.speak(
          `Fim do quiz! Sua pontuação final foi de ${quizScore + (isCorrect ? 10 : 0)} pontos!`,
        )
      }
    }, 3200)
  }

  // Fullscreen toggle nativo automotivo
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  // Denominação dinâmica da aba ASSISTENTE (Requisito 2)
  const assistantTabLabel = getAssistantDisplayName(assistantIdentity, true)

  return (
    <div
      className={`h-screen h-[100dvh] w-screen overflow-hidden ${
        isNightMode ? 'bg-[#080B0F] text-[#F2F5F7]' : 'bg-[#101720] text-white'
      } flex flex-col font-sans select-none antialiased`}
    >
      {/* ============================================================== */}
      {/* 1. TOPO AUTOMOTIVO: CONEXÃO, VELOCIDADE, ECT, SEGURANÇA E CONTROLES */}
      {/* ============================================================== */}
      <header className="safe-area-pt safe-area-pl safe-area-pr bg-[#0E141C] border-b border-[#202B37] px-3 py-2 flex items-center justify-between gap-2 shrink-0">
        {/* Esquerda: Identidade & Conexão do Veículo */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          <div className="flex items-center space-x-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : telemetry.connectionState === 'CONECTANDO' ||
                      telemetry.connectionState === 'RECONECTANDO'
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-red-500'
              }`}
            />
            <span className="font-black text-xs sm:text-sm tracking-wider uppercase text-white font-mono">
              NETWORK CAR DRIVE
            </span>
          </div>

          {/* Badge de Estado da Conexão com o Veículo */}
          <div
            data-testid="badge-status-veiculo"
            className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono uppercase flex items-center space-x-1 border ${
              isConnected
                ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
                : telemetry.connectionState === 'CONECTANDO' ||
                    telemetry.connectionState === 'RECONECTANDO'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-700'
                  : 'bg-red-950/70 text-red-300 border-red-800'
            }`}
          >
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            <span>
              {isConnected
                ? 'VEÍCULO CONECTADO'
                : telemetry.connectionState === 'CONECTANDO'
                  ? 'OBD CONECTANDO'
                  : telemetry.connectionState === 'RECONECTANDO'
                    ? 'RECONECTANDO'
                    : 'VEÍCULO DESCONECTADO'}
            </span>
          </div>

          {/* Origem dos dados: DADOS REAIS vs DADOS SIMULADOS */}
          {isConnected && !isSimulated ? (
            <span
              data-testid="banner-dados-reais"
              className="hidden md:inline-flex text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 rounded tracking-wide"
            >
              DADOS REAIS • ELM327
            </span>
          ) : isSimulated ? (
            <span
              data-testid="banner-dados-simulados"
              className="hidden md:inline-flex text-[10px] font-mono font-bold bg-amber-500/20 text-[#FFB300] border border-amber-500/50 px-2 py-0.5 rounded tracking-wide animate-pulse"
            >
              DADOS SIMULADOS ({activeScenario})
            </span>
          ) : null}

          {/* Informações de Conexão Física (ELM327, ECU, Protocolo) */}
          <div className="hidden xl:flex items-center space-x-2 text-[10px] font-mono text-gray-400 bg-[#0B0F14] px-2 py-0.5 rounded border border-[#202B37]">
            <span>
              ELM327:{' '}
              <strong className={isConnected ? 'text-emerald-400' : 'text-red-400'}>
                {isConnected ? 'conectado' : 'desconectado'}
              </strong>
            </span>
            <span>•</span>
            <span>
              ECU:{' '}
              <strong className={isConnected ? 'text-emerald-400' : 'text-red-400'}>
                {isConnected ? 'conectada' : 'desconectada'}
              </strong>
            </span>
            <span>•</span>
            <span>
              Protocolo:{' '}
              <strong className="text-[#FFB300]">
                {isConnected
                  ? isSimulated
                    ? 'ISO 15765-4 CAN (11 bit)'
                    : 'ISO 15765-4 CAN (11 bit)'
                  : '—'}
              </strong>
            </span>
          </div>
        </div>

        {/* Centro: Telemetria Essencial de Leitura Rápida */}
        <div className="hidden lg:flex items-center space-x-4 font-mono text-xs">
          <div className="flex items-center space-x-1 text-gray-300">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-gray-400">VEL:</span>
            <strong className="text-cyan-300 text-sm">{displaySpeed}</strong>
            <span className="text-[10px] text-gray-400">km/h</span>
          </div>

          <div className="flex items-center space-x-1 text-gray-300">
            <Thermometer className="w-3.5 h-3.5 text-[#FFB300]" />
            <span className="text-gray-400">ECT:</span>
            <strong className="text-[#FFB300] text-sm">{displayCoolant}</strong>
            <span className="text-[10px] text-gray-400">°C</span>
          </div>

          <div className="flex items-center space-x-1 text-gray-300">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-gray-400">BAT:</span>
            <strong className="text-emerald-300 text-sm">{displayVolt}</strong>
            <span className="text-[10px] text-gray-400">V</span>
          </div>
        </div>

        {/* Direita: Condição Monitorada / Alerta e Modos */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          {/* Badge de Segurança Determinística */}
          <div
            className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider flex items-center space-x-1 border ${
              safetyLevel === 'CRITICO'
                ? 'bg-red-950 text-red-300 border-red-600 animate-pulse'
                : safetyLevel === 'ATENCAO'
                  ? 'bg-amber-950 text-[#FFB300] border-amber-700'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
            }`}
          >
            {safetyLevel === 'CRITICO' ? (
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="text-[11px]">{safetyLevel}</span>
          </div>

          {/* Alternador Modo Noturno */}
          <button
            type="button"
            onClick={() => setIsNightMode(!isNightMode)}
            className="btn-touch-automotive flex items-center justify-center p-2 rounded-lg bg-[#141C26] hover:bg-[#1E2836] border border-[#202B37] text-cyan-300"
            title="Alternar Modo Noturno / Estrada"
            aria-label="Alternar Modo Noturno"
          >
            {isNightMode ? (
              <Moon className="w-4 h-4 text-cyan-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {/* Alternador Modo Motorista / Passageiro */}
          <button
            type="button"
            onClick={() => setIsPassengerMode(!isPassengerMode)}
            className={`btn-touch-automotive px-2.5 py-1 rounded-lg border text-xs font-bold transition-all flex items-center space-x-1 ${
              isPassengerMode
                ? 'bg-purple-950/80 text-purple-200 border-purple-700'
                : 'bg-[#141C26] text-gray-300 border-[#202B37]'
            }`}
            title="Alternar perfil Motorista (minimalista) ou Passageiro (detalhado)"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isPassengerMode ? 'Passageiro' : 'Motorista'}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="hidden sm:flex btn-touch-automotive items-center justify-center p-2 rounded-lg bg-[#141C26] hover:bg-[#1E2836] border border-[#202B37] text-gray-400 hover:text-white"
            title="Tela Cheia Automotiva"
            aria-label="Alternar Tela Cheia"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Banner de Dados Simulados ou Reais em telas pequenas */}
      {isSimulated ? (
        <div className="md:hidden bg-amber-950/60 border-b border-amber-600/60 px-3 py-1 text-center text-[10px] font-mono text-[#FFB300] font-bold shrink-0">
          DADOS SIMULADOS ({activeScenario}) — AVALIAÇÃO VISUAL SEM HARDWARE REAL
        </div>
      ) : isConnected ? (
        <div className="md:hidden bg-emerald-950/60 border-b border-emerald-600/60 px-3 py-1 text-center text-[10px] font-mono text-emerald-300 font-bold shrink-0">
          DADOS REAIS • ELM327 BLUETOOTH
        </div>
      ) : null}

      {/* ============================================================== */}
      {/* 2. ALERTA CRÍTICO DETERMINÍSTICO (PRIORIDADE ABSOLUTA DE INTERRUPÇÃO) */}
      {/* CRÍTICO VEÍCULO > VIAGEM > ASSISTENTE > ENTRETENIMENTO           */}
      {/* ============================================================== */}
      {safetyLevel === 'CRITICO' && safetyAlerts.length > 0 && (
        <div
          data-testid="banner-alerta-critico-interrupcao"
          className="bg-red-950 border-b-2 border-red-600 px-4 py-2.5 text-white flex flex-col sm:flex-row items-center justify-between gap-2 shadow-2xl animate-pulse shrink-0 z-50"
        >
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="w-8 h-8 rounded-full bg-red-800/80 border border-red-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-black text-xs uppercase tracking-wider text-red-200 block">
                ALERTA DE SEGURANÇA PRIORITÁRIO DO VEÍCULO (NÃO DEPENDE DE NUVEM)
              </span>
              <p className="text-xs sm:text-sm font-bold text-white">{safetyAlerts[0].message}</p>
              <p className="text-[11px] text-amber-300 font-semibold mt-0.5">
                Ação Recomendada: {safetyAlerts[0].recommendedAction}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 w-full sm:w-auto justify-end">
            <Button
              size="sm"
              onClick={() => assistantRef.current?.speak(safetyAlerts[0].message)}
              className="btn-touch-automotive bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-3 rounded-xl"
            >
              <Volume2 className="w-4 h-4 mr-1.5" /> Ouvir Alerta
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. ÁREA PRINCIPAL HORIZONTAL COM REORGANIZAÇÃO RESPONSIVA     */}
      {/* Em telas widescreen (800x480, 1024x600, etc.) distribui em    */}
      {/* colunas ou linhas adaptativas sem estourar altura útil         */}
      {/* ============================================================== */}
      <main className="flex-1 safe-area-pl safe-area-pr p-2 sm:p-3 overflow-y-auto no-scrollbar flex flex-col min-h-0">
        {/* ========================= ABA: CARRO ========================= */}
        {activeTab === 'CARRO' && (
          <div className="flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full gap-2 sm:gap-3 min-h-0">
            {/* Grid Principal de Telemetria — Leitura Instantânea (Sem Números Inúteis) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 shrink-0">
              {/* Card 1: Velocidade */}
              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[92px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Velocidade
                  </span>
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                </div>
                <div className="flex items-baseline space-x-1 my-0.5">
                  <span className="text-3xl sm:text-4xl md:text-5xl font-black font-mono text-cyan-400 tracking-tight">
                    {displaySpeed}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-400 font-bold font-mono">
                    km/h
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-gray-400 font-mono truncate">
                  {hasSpeedPid
                    ? rawSpeed! > 80
                      ? 'Em Rodovia'
                      : rawSpeed! > 0
                        ? 'Tráfego Urbano'
                        : 'Veículo Parado'
                    : 'Aguardando telemetria'}
                </div>
              </div>

              {/* Card 2: Rotação do Motor */}
              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[92px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Giro do Motor
                  </span>
                  <Activity className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex items-baseline space-x-1 my-0.5">
                  <span className="text-3xl sm:text-4xl md:text-5xl font-black font-mono text-white tracking-tight">
                    {displayRpm}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-400 font-bold font-mono">
                    RPM
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-gray-400 font-mono truncate">
                  {hasRpmPid
                    ? rawRpm! > 1000
                      ? 'Motor em Operação'
                      : rawRpm! > 0
                        ? 'Marcha Lenta'
                        : 'Motor Desligado'
                    : 'Aguardando PID 0x0C'}
                </div>
              </div>

              {/* Card 3: Temperatura de Arrefecimento (ECT) */}
              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[92px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Arrefecimento
                  </span>
                  <Thermometer
                    className={`w-3.5 h-3.5 ${
                      hasCoolantPid && rawCoolant! >= 105 ? 'text-red-400' : 'text-[#FFB300]'
                    }`}
                  />
                </div>
                <div className="flex items-baseline space-x-1 my-0.5">
                  <span
                    className={`text-3xl sm:text-4xl md:text-5xl font-black font-mono tracking-tight ${
                      hasCoolantPid && rawCoolant! >= 105 ? 'text-red-400' : 'text-[#FFB300]'
                    }`}
                  >
                    {displayCoolant}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-400 font-bold font-mono">
                    °C
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-gray-400 font-mono truncate">
                  {hasCoolantPid
                    ? rawCoolant! < 70
                      ? 'Aquecendo'
                      : rawCoolant! <= 98
                        ? 'Faixa Nominal'
                        : 'Temp Elevada'
                    : 'Aguardando PID 0x05'}
                </div>
              </div>

              {/* Card 4: Tensão Elétrica */}
              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between min-h-[92px] sm:min-h-[110px]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Tensão Elétrica
                  </span>
                  <Zap className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="flex items-baseline space-x-1 my-0.5">
                  <span className="text-3xl sm:text-4xl md:text-5xl font-black font-mono text-emerald-400 tracking-tight">
                    {displayVolt}
                  </span>
                  <span className="text-[11px] sm:text-xs text-gray-400 font-bold font-mono">
                    V
                  </span>
                </div>
                <div className="text-[10px] sm:text-[11px] text-gray-400 font-mono truncate">
                  {hasVoltPid
                    ? rawVolt! >= 13.5
                      ? 'Alternador em Carga'
                      : rawVolt! >= 12.2
                        ? 'Tensão Nominal'
                        : 'Subtensão'
                    : 'Aguardando PID 0x42'}
                </div>
              </div>
            </div>

            {/* Banner de Condição Monitorada e Ações Rápidas do Motorista */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 sm:p-3.5 flex flex-col md:flex-row items-center justify-between gap-2.5">
              <div className="space-y-0.5 text-center md:text-left w-full md:w-auto">
                <div className="flex items-center justify-center md:justify-start space-x-2">
                  <span className="text-xs text-[#FFB300] font-bold uppercase tracking-wider">
                    Monitoramento Embarcado:
                  </span>
                  <span className="text-xs font-mono bg-[#1C2633] text-gray-300 px-2 py-0.5 rounded border border-[#2B394A]">
                    {drivingContext.label}
                  </span>
                </div>
                <p className="text-xs text-gray-300 font-medium">
                  {drivingContext.description} • Monitoramento determinístico local ativo sem
                  dependência de internet.
                </p>
              </div>

              {/* Botões de Ação por Toque Grande (Marcar Sintoma e Assistente) */}
              <div className="flex items-center space-x-2 sm:space-x-3 w-full md:w-auto justify-center shrink-0">
                <Button
                  size="lg"
                  onClick={() => handleMarkSymptomQuick('SINTOMA_MOTORISTA')}
                  disabled={symptomMarking}
                  className="btn-touch-automotive bg-[#1C2633] hover:bg-[#283647] border border-amber-500/50 text-[#FFB300] font-bold text-xs sm:text-sm px-4 rounded-xl shadow"
                >
                  <Flag className="w-4 h-4 mr-1.5 text-[#FFB300]" />
                  {symptomMarking ? 'Gravando...' : 'Marcar Sintoma'}
                </Button>

                <Button
                  size="lg"
                  onClick={() =>
                    handleSendAssistantMessage(
                      `${assistantIdentity.name || 'Assistente'}, como está o carro?`,
                    )
                  }
                  className="btn-touch-automotive bg-[#FFB300] hover:bg-[#e5a000] text-black font-extrabold text-xs sm:text-sm px-4 rounded-xl shadow"
                >
                  <Bot className="w-4 h-4 mr-1.5" />
                  Como está o carro?
                </Button>
              </div>
            </div>

            {/* Modo Passageiro: Informações Adicionais de Telemetria e Enlace */}
            {isPassengerMode && (
              <div className="bg-[#0E151E] border border-purple-800/40 rounded-xl p-2.5 sm:p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                  <span className="flex items-center space-x-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Painel Técnico do Passageiro / Co-Piloto</span>
                  </span>
                  <span className="text-[11px] font-mono text-gray-400">
                    Enlace: {telemetry.transportType} | Veículo:{' '}
                    {selectedVehicle?.plate || 'PADRÃO'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-[#121A24] p-2 rounded border border-[#202B37]">
                    <span className="text-[10px] text-gray-400 block">DTCs Ativos</span>
                    <strong className="text-[#FFB300]">
                      {telemetry.dtcList.length > 0
                        ? telemetry.dtcList.map((d) => d.dtc_code).join(', ')
                        : 'Nenhuma Falha'}
                    </strong>
                  </div>
                  <div className="bg-[#121A24] p-2 rounded border border-[#202B37]">
                    <span className="text-[10px] text-gray-400 block">Luz de Injeção</span>
                    <strong className={telemetry.milOn ? 'text-red-400' : 'text-emerald-400'}>
                      {telemetry.milOn ? 'MIL ACESA' : 'MIL Apagada'}
                    </strong>
                  </div>
                  <div className="bg-[#121A24] p-2 rounded border border-[#202B37]">
                    <span className="text-[10px] text-gray-400 block">Frequência OBD</span>
                    <strong className="text-white">
                      {telemetry.effectiveFreqHz > 0 ? `${telemetry.effectiveFreqHz} Hz` : '0 Hz'}
                    </strong>
                  </div>
                  <div className="bg-[#121A24] p-2 rounded border border-[#202B37]">
                    <span className="text-[10px] text-gray-400 block">Acesso Diagnóstico</span>
                    <Link
                      to="/replay"
                      className="text-cyan-400 underline flex items-center space-x-1"
                    >
                      <span>Abrir Caixa-Preta</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================= ABA: VIAGEM ========================= */}
        {activeTab === 'VIAGEM' && (
          <div className="flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full gap-2 sm:gap-3 min-h-0">
            {/* Painel Centralizado de Custo Inteligente de Viagem (OS-ME001-E6.5) */}
            <TripCostPanel
              activeTrip={activeTrip}
              vehiclePlate={selectedVehicle?.plate}
              isVehicleMoving={isVehicleMoving}
              isPassengerMode={isPassengerMode}
              isNightMode={isNightMode}
              onStartTrip={handleStartCostTrip}
              onEndTrip={handleEndCostTrip}
              onAddToll={handleAddTollCost}
              onUpdateFuelPrice={handleUpdateFuelPrice}
              tripHistory={tripHistoryList}
            />

            {/* Diário e Paradas: Durante movimento reduz elementos interativos */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 sm:p-3.5 space-y-2 flex-1 min-h-0 flex flex-col justify-between">
              <div className="flex items-center justify-between shrink-0">
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#FFB300]" />
                  <span>Diário e Paradas da Viagem</span>
                </h3>
                {isVehicleMoving && !isPassengerMode && (
                  <span className="text-[10px] sm:text-[11px] text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                    Modo Condução Ativo: Interações reduzidas
                  </span>
                )}
              </div>

              {/* Se o carro estiver em movimento e NÃO for modo passageiro, esconde formulário de texto */}
              {isVehicleMoving && !isPassengerMode ? (
                <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37] text-center space-y-1">
                  <p className="text-xs text-gray-300">
                    Veículo em movimento ({displaySpeed} km/h). Para segurança do motorista, utilize
                    comando de voz:
                  </p>
                  <p className="text-xs text-[#FFB300] font-mono font-bold">
                    &quot;{assistantIdentity.wakeWord || 'assistente'}, marca esse momento&quot;
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#0B0F14] p-2 rounded-lg border border-[#202B37] shrink-0">
                  <input
                    type="text"
                    placeholder="Nome da parada (ex: Posto / Café)..."
                    value={newDiaryTitle}
                    onChange={(e) => setNewDiaryTitle(e.target.value)}
                    className="bg-[#121A24] border border-[#202B37] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFB300]"
                  />
                  <input
                    type="text"
                    placeholder="Observação rápida..."
                    value={newDiaryNotes}
                    onChange={(e) => setNewDiaryNotes(e.target.value)}
                    className="bg-[#121A24] border border-[#202B37] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFB300]"
                  />
                  <div className="flex items-center space-x-2 justify-end">
                    <label className="text-[11px] text-gray-400 flex items-center space-x-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasLocationConsent}
                        onChange={(e) => setHasLocationConsent(e.target.checked)}
                        className="rounded"
                      />
                      <span>Consentir Local</span>
                    </label>
                    <Button
                      size="sm"
                      onClick={handleAddDiaryEntry}
                      className="btn-touch-automotive bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs h-8 px-4"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista dos últimos momentos registrados */}
              <div className="space-y-1 overflow-y-auto no-scrollbar max-h-24 flex-1">
                {diaryEntries.length === 0 ? (
                  <div className="text-center py-2 text-xs text-gray-400">
                    Nenhuma parada registrada nesta viagem.
                  </div>
                ) : (
                  diaryEntries.map((d, i) => (
                    <div
                      key={i}
                      className="bg-[#0B0F14] p-2 rounded-lg border border-[#202B37] text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white">{d.title}</span>
                        {d.notes && <p className="text-gray-400 text-[11px]">{d.notes}</p>}
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {new Date(d.timestamp_utc).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================= ABA: DIVERSÃO ========================= */}
        {activeTab === 'DIVERSAO' && (
          <div className="flex-1 flex flex-col justify-between max-w-6xl mx-auto w-full gap-2 sm:gap-3 min-h-0">
            {/* Banner de Entretenimento Seguro */}
            <div className="bg-gradient-to-r from-purple-950/60 to-blue-950/60 border border-purple-800/60 rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
              <div className="space-y-0.5 text-center sm:text-left">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-widest flex items-center justify-center sm:justify-start space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#FFB300]" />
                  <span>Central de Diversão & Jogos de Estrada</span>
                </span>
                <div className="text-base font-bold text-white">
                  Controles Grandes de Entretenimento com Prioridade Automotiva
                </div>
                <p className="text-xs text-gray-300">
                  Os alertas do veículo interrompem o áudio imediatamente em caso de anomalia.
                </p>
              </div>

              <Button
                size="lg"
                onClick={handleStartEntertainmentMode}
                className="btn-touch-automotive bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs sm:text-sm px-6 rounded-xl shadow-lg shrink-0"
              >
                <Flame className="w-4 h-4 mr-1.5" />
                Anima a Viagem!
              </Button>
            </div>

            {/* Aviso de Áudio Ducking Ativo */}
            {isAudioDucked && (
              <div className="bg-amber-950/70 border border-amber-600 rounded-xl p-2.5 text-xs text-amber-200 flex items-center justify-between animate-pulse shrink-0">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Áudio Ducking Ativo:</strong> Entretenimento temporariamente atenuado
                    para fala de boletim prioritário da assistente ({assistantTabLabel}).
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                  DUCKING ON
                </span>
              </div>
            )}

            {/* Quiz Ativo de Estrada com Botões Grandes de Toque */}
            {quizActive && (
              <div className="bg-[#121A24] border-2 border-purple-500 rounded-xl p-3 sm:p-3.5 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    Pergunta {quizQuestionIndex + 1} de {TRAVEL_QUIZ_QUESTIONS.length}
                  </span>
                  <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-white bg-purple-950 px-2.5 py-0.5 rounded border border-purple-800">
                    <Award className="w-3.5 h-3.5 text-[#FFB300]" />
                    <span>Placar: {quizScore} pts</span>
                  </div>
                </div>

                <div className="text-xs sm:text-sm font-bold text-white">
                  {currentQuiz.question}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {currentQuiz.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnswerQuiz(idx)}
                      disabled={quizSelectedOption !== null}
                      className={`btn-touch-automotive p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                        quizSelectedOption === idx
                          ? idx === currentQuiz.correctIndex
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-200 font-bold'
                            : 'bg-red-950 border-red-500 text-red-200 font-bold'
                          : 'bg-[#0B0F14] border-[#202B37] text-gray-200 hover:bg-[#1C2633]'
                      }`}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + idx)})</span>
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuizActive(false)}
                    className="text-xs text-gray-400 hover:text-white h-7 px-2"
                  >
                    Encerrar Quiz
                  </Button>
                </div>
              </div>
            )}

            {/* Atalhos Grandes para Players Automotivos */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 sm:p-3.5 space-y-2 flex-1">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Music className="w-4 h-4 text-cyan-400" />
                <span>Central de Áudio & Reprodutores</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {EXTERNAL_MEDIA_SHORTCUTS.map((media) => (
                  <a
                    key={media.name}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-touch-automotive bg-[#0B0F14] border border-[#202B37] rounded-xl p-2.5 hover:bg-[#1A232E] transition-all flex items-center justify-between group"
                  >
                    <div>
                      <span className="text-xs font-bold text-white group-hover:text-[#FFB300] block">
                        {media.name}
                      </span>
                      <span className="text-[11px] text-gray-400">{media.desc}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-white" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================= ABA: ASSISTENTE ========================= */}
        {activeTab === 'ASSISTENTE' && (
          <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full gap-2 sm:gap-3 min-h-0">
            {/* Topo da Assistente: Botão Grande de Voz e Configuração */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
              <div className="flex items-center space-x-3 text-center sm:text-left">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#FFB300]/20 border border-[#FFB300] flex items-center justify-center text-[#FFB300] shrink-0">
                  <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 justify-center sm:justify-start">
                    <span className="font-black text-sm sm:text-base text-white">
                      {getAssistantDisplayName(assistantIdentity)}
                    </span>
                    <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded font-mono font-bold">
                      {assistantIdentity.isCustomized ? 'PERSONALIZADA' : 'PADRÃO'}
                    </span>
                    <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-1.5 py-0.5 rounded font-mono">
                      {assistantIdentity.style}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                    Wake word: &quot;{assistantIdentity.wakeWord || assistantIdentity.name}&quot; •
                    Estado:{' '}
                    {isListeningVoice
                      ? 'Ouvindo microfone...'
                      : isSpeakingVoice
                        ? 'Falando boletim...'
                        : 'Em espera'}
                  </p>
                </div>
              </div>

              {/* Botão Gigante de Voz e Atalho "Minha Assistente" */}
              <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                <Button
                  size="lg"
                  onClick={() => {
                    if (isListeningVoice) {
                      assistantRef.current?.stopListening()
                    } else {
                      assistantRef.current?.startListening()
                    }
                  }}
                  className={`btn-touch-automotive text-xs sm:text-sm font-bold px-4 sm:px-5 rounded-xl shadow-lg transition-all ${
                    isListeningVoice
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                      : 'bg-[#FFB300] hover:bg-[#e5a000] text-black'
                  }`}
                >
                  {isListeningVoice ? (
                    <>
                      <MicOff className="w-4 h-4 mr-2" /> Ouvindo Agora...
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" /> Falar com {assistantTabLabel}
                    </>
                  )}
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setAssistantModalOpen(true)}
                  className="btn-touch-automotive text-xs border-[#2B394A] text-cyan-300 hover:text-white hover:bg-[#1C2633] px-3 rounded-xl"
                  title="Configurar Nome, Wake Word e Voz da Assistente"
                >
                  <Sparkles className="w-4 h-4 text-[#FFB300] sm:mr-1.5" />
                  <span className="hidden sm:inline">Minha Assistente</span>
                </Button>
              </div>
            </div>

            {/* Painel do Último Boletim */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-3 sm:p-3.5 space-y-2 shrink-0">
              <div className="flex items-center justify-between border-b border-[#202B37] pb-1.5">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-1.5">
                  <Volume2 className="w-4 h-4 text-[#FFB300]" />
                  <span>Último Boletim Emitido</span>
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  Frequência:{' '}
                  {bulletinConfig.enabled ? `${bulletinConfig.effectiveMinutes} min` : 'Desativado'}
                </span>
              </div>

              {recentBulletins.length > 0 ? (
                <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                    <span className="text-[#FFB300] font-bold">
                      [{recentBulletins[0].detailLevel}]
                    </span>
                    <span>
                      {new Date(recentBulletins[0].timestampUtc).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-200 font-medium">
                    {recentBulletins[0].text}
                  </p>
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => executeDuckingSpeech(recentBulletins[0].text)}
                      className="text-xs text-cyan-300 hover:text-white h-7 px-2"
                    >
                      <Volume2 className="w-3.5 h-3.5 mr-1" /> Repetir Voz
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-2.5 text-xs text-gray-400">
                  Nenhum boletim emitido ainda nesta sessão. Os boletins são anunciados
                  automaticamente ou sob comando.
                </div>
              )}
            </div>

            {/* Caixa de Mensagens / Diálogo por Toque */}
            <div className="flex-1 bg-[#0B0F14] border border-[#202B37] rounded-xl p-2.5 overflow-y-auto no-scrollbar space-y-1.5 min-h-[60px] max-h-36">
              {assistantMessages.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400">
                  Diga &quot;{assistantIdentity.wakeWord || 'assistente'}, como está o carro?&quot;
                  ou toque no botão acima.
                </div>
              ) : (
                assistantMessages.slice(-6).map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-1.5 text-xs ${
                        msg.role === 'user'
                          ? 'bg-[#FFB300] text-black font-semibold'
                          : 'bg-[#121A24] border border-[#202B37] text-gray-200'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input Rápido (em modo passageiro ou parado) */}
            {(!isVehicleMoving || isPassengerMode) && (
              <div className="flex items-center space-x-2 shrink-0">
                <input
                  type="text"
                  placeholder={`Digite um comando para ${assistantTabLabel}...`}
                  value={assistantInput}
                  disabled={isAssistantLoading}
                  onChange={(e) => setAssistantInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendAssistantMessage()}
                  className="flex-1 bg-[#121A24] border border-[#202B37] rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
                />
                <Button
                  size="sm"
                  disabled={isAssistantLoading || !assistantInput.trim()}
                  onClick={() => handleSendAssistantMessage()}
                  className="btn-touch-automotive bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold h-9 px-4 rounded-xl"
                >
                  Enviar
                </Button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* 4. BARRA DE NAVEGAÇÃO HORIZONTAL AUTOMOTIVA: CARRO | VIAGEM | DIVERSÃO | ASSISTENTE */}
      {/* ============================================================== */}
      <nav className="safe-area-pb safe-area-pl safe-area-pr bg-[#0E141C] border-t border-[#202B37] px-2 sm:px-4 py-1.5 flex items-center justify-around shrink-0 z-40">
        {/* Aba 1: CARRO */}
        <button
          type="button"
          onClick={() => setActiveTab('CARRO')}
          className={`btn-touch-automotive flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeTab === 'CARRO'
              ? 'bg-[#1C2633] text-[#FFB300] font-black border border-[#FFB300]/40 shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Car className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] sm:text-xs uppercase tracking-wider">CARRO</span>
        </button>

        {/* Aba 2: VIAGEM */}
        <button
          type="button"
          onClick={() => setActiveTab('VIAGEM')}
          className={`btn-touch-automotive flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeTab === 'VIAGEM'
              ? 'bg-[#1C2633] text-[#FFB300] font-black border border-[#FFB300]/40 shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] sm:text-xs uppercase tracking-wider">VIAGEM</span>
        </button>

        {/* Aba 3: DIVERSÃO */}
        <button
          type="button"
          onClick={() => setActiveTab('DIVERSAO')}
          className={`btn-touch-automotive flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeTab === 'DIVERSAO'
              ? 'bg-[#1C2633] text-[#FFB300] font-black border border-[#FFB300]/40 shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Music className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] sm:text-xs uppercase tracking-wider">DIVERSÃO</span>
        </button>

        {/* Aba 4: ASSISTENTE (Dinâmica: Assume nome personalizado como "LUNA" ou neutro "ASSISTENTE") */}
        <button
          type="button"
          onClick={() => setActiveTab('ASSISTENTE')}
          className={`btn-touch-automotive flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeTab === 'ASSISTENTE'
              ? 'bg-[#1C2633] text-[#FFB300] font-black border border-[#FFB300]/40 shadow'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Bot className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] sm:text-xs uppercase tracking-wider truncate max-w-[120px]">
            {assistantTabLabel}
          </span>
        </button>
      </nav>

      {/* Modal de Personalização Minha Assistente (E6.2) */}
      <AssistantSettingsModal
        open={assistantModalOpen}
        onOpenChange={setAssistantModalOpen}
        vehiclePlate={selectedVehicle?.plate}
        onIdentitySaved={(newIdentity) => {
          setAssistantIdentity(newIdentity)
          assistantRef.current?.setIdentity(newIdentity)
          bulletinServiceRef.current?.setIdentity(newIdentity)
          toast({
            title: 'Assistente Atualizada',
            description: `Identidade configurada para "${newIdentity.name}".`,
          })
        }}
      />

      {/* Modal de Resumo da Viagem com Custo (E6.5) */}
      <TripFinishedSummaryModal
        isOpen={showFinishedCostModal}
        report={finishedCostReport}
        onClose={() => setShowFinishedCostModal(false)}
      />
    </div>
  )
}
