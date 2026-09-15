import React, { useState, useEffect, useRef } from 'react'
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
  Camera,
  MapPin,
  Sparkles,
  Radio,
  ExternalLink,
  ShieldCheck,
  Moon,
  Sun,
  Flame,
  Award,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { useToast } from '@/hooks/use-toast'
import { DrivingContextEstimator } from '@/lib/diagnostic/driving-context-estimator'
import { IndividualBaselineLearner } from '@/lib/diagnostic/individual-baseline-learner'
import { VehicleSafetyMonitor } from '@/lib/diagnostic/vehicle-safety-monitor'
import { TripSessionManager } from '@/lib/trip/trip-session-manager'
import { NinaCopilotService, NinaMessage } from '@/lib/nina/nina-copilot-service'
import {
  NinaPeriodicBulletinService,
  BulletinContextInput,
} from '@/lib/nina/nina-periodic-bulletin-service'
import {
  TRAVEL_QUIZ_QUESTIONS,
  EXTERNAL_MEDIA_SHORTCUTS,
  TravelQuizQuestion,
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
  BulletinIntervalOption,
  BulletinDetailLevel,
} from '@/types/etapa6'

export const NetworkCarDrive: React.FC = () => {
  const { toast } = useToast()
  const { telemetry, selectedVehicle, connectTransport, disconnectTransport } = useTelemetry()

  // Abas principais do Network Car Drive: CARRO | VIAGEM | ENTRETENIMENTO | NINA
  const [activeTab, setActiveTab] = useState<'CARRO' | 'VIAGEM' | 'ENTRETENIMENTO' | 'NINA'>(
    'CARRO',
  )

  // Modos de Condução e Interface Automotiva
  const [isNightMode, setIsNightMode] = useState(true)
  const [isPassengerMode, setIsPassengerMode] = useState(false)
  const [voiceVolume, setVoiceVolume] = useState(1.0)
  const [isListeningVoice, setIsListeningVoice] = useState(false)
  const [isSpeakingVoice, setIsSpeakingVoice] = useState(false)

  // Gerenciadores locais
  const contextEstimatorRef = useRef(new DrivingContextEstimator())
  const baselineLearnerRef = useRef<IndividualBaselineLearner | null>(null)
  const safetyMonitorRef = useRef(new VehicleSafetyMonitor())
  const tripManagerRef = useRef(new TripSessionManager())
  const ninaRef = useRef<NinaCopilotService | null>(null)
  const bulletinServiceRef = useRef<NinaPeriodicBulletinService | null>(null)

  // Estados dinâmicos de monitoramento contínuo
  const [drivingContext, setDrivingContext] = useState<DrivingContextInfo>({
    type: 'DESCONHECIDO',
    label: 'Identificando...',
    confidence: 50,
    estimatedAtMonoMs: 0,
    description: 'Aguardando telemetria',
    activeSinceUtc: new Date().toISOString(),
  })
  const [safetyLevel, setSafetyLevel] = useState<SafetyLevel>('NORMAL')
  const [safetyAlerts, setSafetyAlerts] = useState<SafetyAlert[]>([])
  const [activeTrip, setActiveTrip] = useState<TripSessionModel | null>(null)
  const [diaryEntries, setDiaryEntries] = useState<TripDiaryEntryModel[]>([])

  // NC-E6.1-VOICE: Estados de Boletins Periódicos da Nina
  const [bulletinConfig, setBulletinConfig] = useState<NinaBulletinConfig>({
    enabled: true,
    intervalOption: 20,
    effectiveMinutes: 20,
    detailLevel: 'NORMAL',
    totalBulletinsEmitted: 0,
  })
  const [recentBulletins, setRecentBulletins] = useState<NinaBulletinPayload[]>([])
  const [customMinutesInput, setCustomMinutesInput] = useState<string>('15')
  const [isAudioDucked, setIsAudioDucked] = useState<boolean>(false)

  // Estados da Nina
  const [ninaInput, setNinaInput] = useState('')
  const [ninaMessages, setNinaMessages] = useState<NinaMessage[]>([])
  const [isNinaLoading, setIsNinaLoading] = useState(false)

  // Estados dos Jogos de Viagem
  const [quizActive, setQuizActive] = useState(false)
  const [quizQuestionIndex, setQuizQuestionIndex] = useState(0)
  const [quizScore, setQuizScore] = useState(0)
  const [quizSelectedOption, setQuizSelectedOption] = useState<number | null>(null)

  // Diário: Adição Rápida
  const [newDiaryTitle, setNewDiaryTitle] = useState('')
  const [newDiaryNotes, setNewDiaryNotes] = useState('')
  const [hasLocationConsent, setHasLocationConsent] = useState(false)

  // Inicializa Baseline Learner e BulletinService para o veículo selecionado
  useEffect(() => {
    const plate = selectedVehicle?.plate || 'PADRAO'
    baselineLearnerRef.current = new IndividualBaselineLearner(plate)

    if (bulletinServiceRef.current) {
      bulletinServiceRef.current.setVehiclePlate(plate)
      setBulletinConfig(bulletinServiceRef.current.getConfig())
    }
  }, [selectedVehicle?.plate])

  // Ducking helper: reduz / interrompe entretenimento enquanto a Nina fala e devolve controle depois
  const executeDuckingSpeech = (text: string, onDone?: () => void) => {
    setIsAudioDucked(true)
    ninaRef.current?.speak(text, () => {
      setIsAudioDucked(false)
      onDone?.()
    })
  }

  // Inicializa Nina Service e Bulletin Service
  useEffect(() => {
    const plate = selectedVehicle?.plate || 'PADRAO'
    const bulletinService = new NinaPeriodicBulletinService(plate, {
      onBulletinGenerated: (bulletin) => {
        setRecentBulletins((prev) => [bulletin, ...prev.slice(0, 9)])
        // Executa fala do boletim com Ducking de áudio
        executeDuckingSpeech(bulletin.text)
        // Adiciona à lista de mensagens da Nina
        const msg: NinaMessage = {
          id: `msg_bulletin_${Date.now()}`,
          role: 'assistant',
          content: `📢 [Boletim ${bulletin.detailLevel}] ${bulletin.text}`,
          timestamp: bulletin.timestampUtc,
        }
        setNinaMessages((prev) => [...prev, msg])
      },
      onConfigChanged: (cfg) => {
        setBulletinConfig(cfg)
      },
    })
    bulletinServiceRef.current = bulletinService
    setBulletinConfig(bulletinService.getConfig())

    const nina = new NinaCopilotService({
      onListeningStateChange: (listening) => setIsListeningVoice(listening),
      onSpeakingStateChange: (speaking) => setIsSpeakingVoice(speaking),
      onSpeechRecognized: (text) => {
        // Tenta primeiro interpretar como comando de boletim
        const cmdRes = bulletinServiceRef.current?.parseVoiceCommand(text)
        if (cmdRes && cmdRes.handled) {
          executeDuckingSpeech(cmdRes.replyText)
          const cmdMsg: NinaMessage = {
            id: `msg_cmd_${Date.now()}`,
            role: 'assistant',
            content: cmdRes.replyText,
            timestamp: new Date().toISOString(),
          }
          setNinaMessages((prev) => [...prev, cmdMsg])
        } else {
          // Encaminha comando geral à Nina
          handleSendNinaMessage(text)
        }
      },
    })
    ninaRef.current = nina
    setNinaMessages(nina.getMessages())

    return () => {
      nina.stopListening()
      nina.stopSpeaking()
      bulletinService.destroy()
    }
  }, [])

  // Loop de Telemetria e Monitoramento Contínuo
  useEffect(() => {
    const rpm = telemetry.currentValues['0x0C']?.decoded
    const speed = telemetry.currentValues['0x0D']?.decoded
    const coolant = telemetry.currentValues['0x05']?.decoded
    const volt = telemetry.currentValues['0x42']?.decoded
    const tps = telemetry.currentValues['0x11']?.decoded
    const load = telemetry.currentValues['0x04']?.decoded
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

    // 2. Aprende Baseline Individual por Contexto
    if (baselineLearnerRef.current && currentCtx.type !== 'DESCONHECIDO') {
      if (stft !== undefined) {
        baselineLearnerRef.current.learnObservation(currentCtx.type, '0x06', stft, '%', 'STFT')
      }
      if (rpm !== undefined && speed === 0) {
        baselineLearnerRef.current.learnObservation(currentCtx.type, '0x0C', rpm, 'RPM', 'RPM')
      }
    }

    // 3. Avalia Segurança Local Determinística (VehicleSafetyMonitor)
    const safetyRes = safetyMonitorRef.current.evaluateSafety({
      coolantTemp: coolant,
      batteryVoltage: volt,
      rpm,
      speed,
      milOn: telemetry.milOn,
      dtcCodes: telemetry.dtcList.map((d) => d.dtc_code),
      communicationState:
        telemetry.connectionState === 'CONECTADO'
          ? 'CONECTADO'
          : telemetry.connectionState === 'RECONECTANDO'
            ? 'RECONECTANDO'
            : 'FALHA',
    })

    setSafetyLevel(safetyRes.overallLevel)
    setSafetyAlerts(safetyRes.alerts)

    // Prioridade de segurança máxima: se houver alerta crítico, interrompe voz ou quiz
    // E alerta crítico independe do temporizador de boletins (sempre emitido)
    if (safetyRes.overallLevel === 'CRITICO') {
      ninaRef.current?.stopSpeaking()
      if (quizActive) setQuizActive(false)
    }

    // 3.1 Alimenta o Snapshot do BulletinService
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

    // 4. Alimenta Viagem Ativa se houver
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

  // Iniciar / Encerrar Viagem
  const handleToggleTrip = () => {
    if (activeTrip && activeTrip.status === 'EM_ANDAMENTO') {
      const finished = tripManagerRef.current.endTrip()
      setActiveTrip(null)
      toast({
        title: 'Viagem Finalizada!',
        description: `Distância: ${finished?.distance_km} km | Duração: ${Math.floor((finished?.duration_seconds || 0) / 60)} min.`,
      })
    } else {
      const newTrip = tripManagerRef.current.startTrip({
        title: `Viagem ${new Date().toLocaleDateString('pt-BR')}`,
        vehiclePlate: selectedVehicle?.plate,
        vehicleId: selectedVehicle?.id,
        initialOdometerKm: selectedVehicle?.odometer_km,
      })
      setActiveTrip(newTrip)
      toast({
        title: 'Modo Viagem Ativado',
        description: 'Métricas, telemetria resumida e paradas sendo registradas.',
      })
    }
  }

  // Adicionar Parada / Diário
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
        title: 'Momento Salvo no Diário',
        description: entry.title,
      })
    }
  }

  // Interação com Nina Copiloto
  const handleSendNinaMessage = async (textToSend?: string) => {
    const text = textToSend || ninaInput
    if (!text.trim() || !ninaRef.current) return

    setNinaInput('')
    setIsNinaLoading(true)

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
    }

    try {
      await ninaRef.current.sendMessage(text, copilotContext, true)
      setNinaMessages(ninaRef.current.getMessages())
    } finally {
      setIsNinaLoading(false)
    }
  }

  // Ação de voz "Nina, Anima a viagem"
  const handleStartEntertainmentMode = () => {
    setQuizActive(true)
    setQuizQuestionIndex(0)
    setQuizScore(0)
    setQuizSelectedOption(null)
    setActiveTab('ENTRETENIMENTO')
    ninaRef.current?.speak(
      'Modo diversão ativado! Vamos jogar um quiz de viagem com perguntas automotivas e de estrada.',
    )
  }

  const currentQuiz = TRAVEL_QUIZ_QUESTIONS[quizQuestionIndex]

  const handleAnswerQuiz = (index: number) => {
    setQuizSelectedOption(index)
    const isCorrect = index === currentQuiz.correctIndex
    if (isCorrect) {
      setQuizScore((prev) => prev + 10)
      ninaRef.current?.speak(`Correto! ${currentQuiz.explanation}`)
    } else {
      ninaRef.current?.speak(`Não foi dessa vez. ${currentQuiz.explanation}`)
    }

    setTimeout(() => {
      if (quizQuestionIndex < TRAVEL_QUIZ_QUESTIONS.length - 1) {
        setQuizQuestionIndex((p) => p + 1)
        setQuizSelectedOption(null)
      } else {
        setQuizActive(false)
        ninaRef.current?.speak(
          `Fim do quiz! Sua pontuação final foi de ${quizScore + (isCorrect ? 10 : 0)} pontos! Parabéns.`,
        )
      }
    }, 3500)
  }

  return (
    <div
      className={`min-h-screen ${
        isNightMode ? 'bg-[#080B0F] text-[#F2F5F7]' : 'bg-[#101720] text-white'
      } flex flex-col font-sans select-none transition-colors duration-300`}
    >
      {/* Barra de Topo Automotiva com Indicador de Segurança Determinístico */}
      <header className="bg-[#0E141C] border-b border-[#202B37] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FFB300] animate-pulse" />
            <span className="font-black text-sm tracking-widest text-white uppercase">
              Network Car Drive
            </span>
          </div>

          <span className="text-xs bg-[#1C2633] text-gray-300 font-mono px-2 py-0.5 rounded border border-[#2B394A]">
            {drivingContext.label}
          </span>
        </div>

        {/* Nível de Segurança (Local / Determinístico) */}
        <div className="flex items-center space-x-3">
          <div
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 border ${
              safetyLevel === 'CRITICO'
                ? 'bg-red-950 text-red-400 border-red-700 animate-pulse'
                : safetyLevel === 'ATENCAO'
                  ? 'bg-amber-950 text-[#FFB300] border-amber-700'
                  : 'bg-emerald-950 text-emerald-400 border-emerald-800'
            }`}
          >
            {safetyLevel === 'CRITICO' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5" />
            )}
            <span>SEGURANÇA: {safetyLevel}</span>
          </div>

          {/* Botão Modo Noturno / Estrada */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsNightMode(!isNightMode)}
            className="text-gray-400 hover:text-white p-1.5 h-8 w-8"
            title="Alternar Modo Noturno / Estrada"
          >
            {isNightMode ? <Moon className="w-4 h-4 text-cyan-400" /> : <Sun className="w-4 h-4" />}
          </Button>

          {/* Botão Perfil Passageiro vs Motorista */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsPassengerMode(!isPassengerMode)}
            className={`text-xs px-2.5 h-8 border ${
              isPassengerMode
                ? 'bg-purple-950/80 text-purple-300 border-purple-700'
                : 'bg-[#1C2633] text-gray-400 border-[#2B394A]'
            }`}
          >
            {isPassengerMode ? 'Modo Passageiro' : 'Modo Motorista'}
          </Button>
        </div>
      </header>

      {/* Alertas Críticos de Alta Prioridade (Interrompe tudo) */}
      {safetyLevel === 'CRITICO' && safetyAlerts.length > 0 && (
        <div className="bg-red-950 border-b-2 border-red-600 p-4 text-white flex items-center justify-between shadow-lg animate-pulse">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-8 h-8 text-red-400 shrink-0" />
            <div>
              <span className="font-black text-sm uppercase tracking-wide block">
                ALERTA DE SEGURANÇA PRIORITÁRIO DO VEÍCULO
              </span>
              <p className="text-xs text-red-200 mt-0.5">{safetyAlerts[0].message}</p>
              <p className="text-xs text-amber-300 font-semibold mt-1">
                Ação Recomendada: {safetyAlerts[0].recommendedAction}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => ninaRef.current?.speak(safetyAlerts[0].message)}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
          >
            Ouvir Nina
          </Button>
        </div>
      )}

      {/* Corpo Principal com as 4 Grandes Áreas: CARRO | VIAGEM | ENTRETENIMENTO | NINA */}
      <main className="flex-1 p-3 md:p-6 overflow-y-auto">
        {/* ======================= ABA: CARRO ======================= */}
        {activeTab === 'CARRO' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Grandes Indicadores do Motorista */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 flex flex-col justify-between h-32">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Velocidade
                </span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-4xl md:text-5xl font-black font-mono text-cyan-400">
                    {telemetry.currentValues['0x0D']?.decoded || 0}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">km/h</span>
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  {drivingContext.type === 'ESTRADA' ? 'Rodovia' : 'Urbano'}
                </div>
              </div>

              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 flex flex-col justify-between h-32">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Giro do Motor
                </span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-4xl md:text-5xl font-black font-mono text-white">
                    {telemetry.currentValues['0x0C']?.decoded || 0}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">RPM</span>
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  Lenta: ~{drivingContext.type.includes('LENTA') ? 'Estável' : 'Operando'}
                </div>
              </div>

              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 flex flex-col justify-between h-32">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Arrefecimento (ECT)
                </span>
                <div className="flex items-baseline space-x-1">
                  <span
                    className={`text-4xl md:text-5xl font-black font-mono ${
                      (telemetry.currentValues['0x05']?.decoded || 85) >= 105
                        ? 'text-red-400'
                        : 'text-[#FFB300]'
                    }`}
                  >
                    {telemetry.currentValues['0x05']?.decoded || '--'}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">°C</span>
                </div>
                <div className="text-[11px] text-gray-400 font-mono">Faixa Nominal: 85 - 95 °C</div>
              </div>

              <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 flex flex-col justify-between h-32">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Tensão Elétrica
                </span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-4xl md:text-5xl font-black font-mono text-emerald-400">
                    {telemetry.currentValues['0x42']?.decoded || '14.1'}
                  </span>
                  <span className="text-xs text-gray-400 font-bold">V</span>
                </div>
                <div className="text-[11px] text-gray-400 font-mono">Alternador em carga</div>
              </div>
            </div>

            {/* Painel do Modo Motorista Simples (Alto Contraste) */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <span className="text-xs text-[#FFB300] font-bold uppercase tracking-widest block">
                  Status de Condução Ativa
                </span>
                <div className="text-lg md:text-xl font-bold text-white">
                  Motor:{' '}
                  <span className="text-emerald-400">
                    {safetyLevel === 'NORMAL' ? 'Normal' : safetyLevel}
                  </span>{' '}
                  • OBD:{' '}
                  <span className="text-cyan-400">
                    {telemetry.connectionState === 'CONECTADO' ? 'Conectado' : 'Aguardando'}
                  </span>{' '}
                  • Monitoramento:{' '}
                  <span className="text-emerald-400">Ativo 100% Local (Sem Nuvem)</span>
                </div>
                <p className="text-xs text-gray-400">{drivingContext.description}</p>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  size="lg"
                  onClick={() => handleSendNinaMessage('Nina, como está o carro?')}
                  className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-extrabold text-sm shadow-lg px-6 h-12 rounded-xl"
                >
                  <Bot className="w-5 h-5 mr-2" />
                  Nina, como está o carro?
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ======================= ABA: VIAGEM ======================= */}
        {activeTab === 'VIAGEM' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Controle da Viagem */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-[#FFB300] uppercase tracking-wider block mb-1">
                  Sessão do Modo Viagem
                </span>
                <div className="text-xl font-black text-white">
                  {activeTrip ? activeTrip.title : 'Nenhuma viagem iniciada'}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {activeTrip
                    ? `Iniciada às ${new Date(activeTrip.started_at).toLocaleTimeString('pt-BR')} • Paradas: ${activeTrip.stop_count}`
                    : 'Inicie a viagem para registrar duração, distância, paradas e consumo estimado.'}
                </div>
              </div>

              <Button
                size="lg"
                onClick={handleToggleTrip}
                className={`font-black tracking-wider text-sm h-12 px-6 rounded-xl shadow-lg ${
                  activeTrip
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-[#2ECC71] hover:bg-[#27ae60] text-black'
                }`}
              >
                {activeTrip ? (
                  <>
                    <Square className="w-4 h-4 mr-2 fill-current" />
                    FINALIZAR VIAGEM
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2 fill-current" />
                    INICIAR VIAGEM
                  </>
                )}
              </Button>
            </div>

            {/* Estatísticas da Viagem */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0B0F14] border border-[#202B37] rounded-lg p-3">
                <span className="text-[11px] text-gray-400 block">Distância Percorrida</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-bold font-mono text-white">
                    {activeTrip ? activeTrip.distance_km : 0}
                  </span>
                  <span className="text-xs text-gray-400">km (medido)</span>
                </div>
              </div>

              <div className="bg-[#0B0F14] border border-[#202B37] rounded-lg p-3">
                <span className="text-[11px] text-gray-400 block">Tempo em Movimento</span>
                <div className="text-2xl font-bold font-mono text-cyan-400">
                  {activeTrip ? `${Math.floor(activeTrip.duration_seconds / 60)} min` : '0 min'}
                </div>
              </div>

              <div className="bg-[#0B0F14] border border-[#202B37] rounded-lg p-3">
                <span className="text-[11px] text-gray-400 block">Velocidade Média</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-bold font-mono text-white">
                    {activeTrip ? activeTrip.avg_speed_kmh : 0}
                  </span>
                  <span className="text-xs text-gray-400">km/h</span>
                </div>
              </div>

              <div className="bg-[#0B0F14] border border-[#202B37] rounded-lg p-3">
                <span className="text-[11px] text-gray-400 block">Consumo Estimado</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-2xl font-bold font-mono text-[#FFB300]">
                    {activeTrip ? activeTrip.estimated_fuel_liters : 0}
                  </span>
                  <span className="text-xs text-gray-400">L (estimado)</span>
                </div>
              </div>
            </div>

            {/* Diário de Bordo da Viagem */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-[#FFB300]" />
                  <span>Diário de Bordo & Momentos da Viagem</span>
                </h3>
              </div>

              {/* Formulário de Adição Rápida */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-[#0B0F14] p-3 rounded-lg border border-[#202B37]">
                <input
                  type="text"
                  placeholder="Nome do local / momento (ex: Parada Café Graal)"
                  value={newDiaryTitle}
                  onChange={(e) => setNewDiaryTitle(e.target.value)}
                  className="bg-[#121A24] border border-[#202B37] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#FFB300]"
                />
                <input
                  type="text"
                  placeholder="Comentário ou observação curta..."
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
                    className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs h-8"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Salvar
                  </Button>
                </div>
              </div>

              {/* Lista de Momentos Salvos */}
              <div className="space-y-2">
                {diaryEntries.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-400">
                    Nenhum momento registrado ainda nesta viagem. Use o comando &quot;Nina, marca
                    esse momento&quot; ou o formulário acima.
                  </div>
                ) : (
                  diaryEntries.map((d, i) => (
                    <div
                      key={i}
                      className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37] text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-white">{d.title}</span>
                        {d.notes && <p className="text-gray-400 text-[11px]">{d.notes}</p>}
                        {d.has_location_consent && (
                          <span className="text-[10px] text-emerald-400 mt-0.5 block">
                            ✓ Ponto geográfico autorizado
                          </span>
                        )}
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

        {/* ======================= ABA: ENTRETENIMENTO ======================= */}
        {activeTab === 'ENTRETENIMENTO' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            {/* Banner Diversão / Jogos de Estrada */}
            <div className="bg-gradient-to-r from-purple-950/60 to-blue-950/60 border border-purple-800/60 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold text-purple-300 uppercase tracking-widest flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-[#FFB300]" />
                  <span>Modo Diversão Nina</span>
                </span>
                <div className="text-lg font-bold text-white">
                  Jogos de Viagem Por Voz para Motorista e Passageiros
                </div>
                <p className="text-xs text-gray-300">
                  Participe sem tirar as mãos do volante nem os olhos da pista! A Nina faz perguntas
                  e pontua por voz.
                </p>
              </div>

              <Button
                size="lg"
                onClick={handleStartEntertainmentMode}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-11 px-6 rounded-xl shadow-lg"
              >
                <Flame className="w-4 h-4 mr-1.5" />
                Nina, anima a viagem!
              </Button>
            </div>

            {/* Quiz Interativo Ativo */}
            {quizActive && (
              <div className="bg-[#121A24] border-2 border-purple-500 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                    Pergunta {quizQuestionIndex + 1} de {TRAVEL_QUIZ_QUESTIONS.length}
                  </span>
                  <div className="flex items-center space-x-2 text-xs font-mono font-bold text-white bg-purple-950 px-2.5 py-1 rounded border border-purple-800">
                    <Award className="w-3.5 h-3.5 text-[#FFB300]" />
                    <span>Placar: {quizScore} pts</span>
                  </div>
                </div>

                <div className="text-base font-bold text-white">{currentQuiz.question}</div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {currentQuiz.options.map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAnswerQuiz(idx)}
                      disabled={quizSelectedOption !== null}
                      className={`p-3 rounded-lg border text-left text-xs font-medium transition-all ${
                        quizSelectedOption === idx
                          ? idx === currentQuiz.correctIndex
                            ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                            : 'bg-red-950 border-red-500 text-red-200'
                          : 'bg-[#0B0F14] border-[#202B37] text-gray-300 hover:bg-[#1C2633]'
                      }`}
                    >
                      <span className="font-bold mr-2">{String.fromCharCode(65 + idx)})</span>
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setQuizActive(false)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Encerrar Quiz
                  </Button>
                </div>
              </div>
            )}

            {/* Status do Ducking de Áudio */}
            {isAudioDucked && (
              <div className="bg-amber-950/60 border border-amber-600/70 rounded-xl p-3 text-xs text-amber-200 flex items-center justify-between animate-pulse">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-amber-400" />
                  <span>
                    <strong>Áudio Ducking Ativo:</strong> Entretenimento atenuado temporariamente
                    para boletim prioritário de voz da Nina.
                  </span>
                </div>
                <span className="text-[10px] font-mono bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/40">
                  DUCKING ON
                </span>
              </div>
            )}

            {/* Atalhos para Players de Música Externos */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <Music className="w-4 h-4 text-cyan-400" />
                <span>Central de Áudio & Streaming</span>
              </h3>
              <p className="text-xs text-gray-400">
                Integração com reprodutores instalados no dispositivo ou navegadores (com atenuação
                automática / ducking ao falar boletim):
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {EXTERNAL_MEDIA_SHORTCUTS.map((media) => (
                  <a
                    key={media.name}
                    href={media.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#0B0F14] border border-[#202B37] rounded-lg p-3 hover:bg-[#1A232E] transition-all flex items-center justify-between group"
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

        {/* ======================= ABA: NINA COPILOTO ======================= */}
        {activeTab === 'NINA' && (
          <div className="space-y-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-180px)]">
            {/* Header da Nina */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#FFB300]/20 border border-[#FFB300] flex items-center justify-center text-[#FFB300]">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-white text-sm">Nina Copiloto Inteligente</span>
                    <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
                      NATIVE AGENT
                    </span>
                    <span className="text-[10px] bg-[#FFB300]/20 text-[#FFB300] border border-[#FFB300]/40 px-1.5 py-0.5 rounded font-mono font-bold">
                      E6.1 VOICE
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Contexto real do veículo • Wake word &quot;Nina...&quot; • Alertas locais
                    prioritários
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={() => {
                    if (isListeningVoice) {
                      ninaRef.current?.stopListening()
                    } else {
                      ninaRef.current?.startListening()
                    }
                  }}
                  className={`text-xs h-8 ${
                    isListeningVoice
                      ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                      : 'bg-[#1C2633] text-gray-300 hover:text-white border border-[#2B394A]'
                  }`}
                >
                  {isListeningVoice ? (
                    <>
                      <MicOff className="w-3.5 h-3.5 mr-1" /> Ouvindo...
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5 mr-1" /> Ativar Microfone
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* NC-E6.1-VOICE: PAINEL DE CONTROLE DOS BOLETINS PERIÓDICOS (PT-BR / BOTÕES GRANDES) */}
            <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#202B37] pb-2">
                <div className="flex items-center space-x-2">
                  <Volume2 className="w-4 h-4 text-[#FFB300]" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Boletins Periódicos por Voz da Nina
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-gray-400">
                    Status:{' '}
                    <strong
                      className={bulletinConfig.enabled ? 'text-emerald-400' : 'text-gray-500'}
                    >
                      {bulletinConfig.enabled
                        ? `A cada ${bulletinConfig.effectiveMinutes} min`
                        : 'Desativado'}
                    </strong>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (bulletinServiceRef.current) {
                        const supportedList = Object.keys(telemetry.currentValues).filter(
                          (k) => telemetry.currentValues[k]?.quality === 'OK',
                        )
                        const b = bulletinServiceRef.current.generateBulletin({
                          copilotContext: {
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
                          },
                          supportedPids:
                            supportedList.length > 0
                              ? supportedList
                              : ['0x0C', '0x0D', '0x05', '0x42'],
                          hasSufficientBaseline: true,
                        })
                        executeDuckingSpeech(b.text)
                        toast({
                          title: 'Boletim Emitido Manualmente',
                          description: b.text,
                        })
                      }
                    }}
                    className="border-[#2B394A] text-xs h-7 px-2.5 text-gray-300 hover:text-white"
                  >
                    Ouvir Agora
                  </Button>
                </div>
              </div>

              {/* Seletor de Intervalos (Grandes Botões) */}
              <div>
                <span className="text-[11px] text-gray-400 uppercase font-semibold block mb-1.5">
                  Frequência dos Boletins por Voz:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-7 gap-1.5">
                  {(
                    ['DESATIVADO', 5, 10, 20, 30, 60, 'PERSONALIZADO'] as BulletinIntervalOption[]
                  ).map((opt) => (
                    <button
                      key={String(opt)}
                      type="button"
                      onClick={() => {
                        if (opt === 'PERSONALIZADO') {
                          const val = parseInt(customMinutesInput, 10) || 15
                          bulletinServiceRef.current?.updateConfig({
                            intervalOption: 'PERSONALIZADO',
                            customMinutes: val,
                          })
                        } else {
                          bulletinServiceRef.current?.updateConfig({
                            intervalOption: opt,
                          })
                        }
                      }}
                      className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all border ${
                        bulletinConfig.intervalOption === opt
                          ? 'bg-[#FFB300] text-black border-[#FFB300] shadow'
                          : 'bg-[#0B0F14] text-gray-300 border-[#202B37] hover:bg-[#1C2633]'
                      }`}
                    >
                      {opt === 'DESATIVADO'
                        ? 'Desativado'
                        : opt === 'PERSONALIZADO'
                          ? 'Livre'
                          : `${opt} min`}
                    </button>
                  ))}
                </div>

                {/* Campo para Intervalo Personalizado */}
                {bulletinConfig.intervalOption === 'PERSONALIZADO' && (
                  <div className="mt-2 flex items-center space-x-2 bg-[#0B0F14] p-2 rounded-lg border border-[#202B37]">
                    <span className="text-xs text-gray-400">Minutos personalizados:</span>
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={customMinutesInput}
                      onChange={(e) => {
                        setCustomMinutesInput(e.target.value)
                        const val = parseInt(e.target.value, 10)
                        if (val > 0) {
                          bulletinServiceRef.current?.updateConfig({
                            intervalOption: 'PERSONALIZADO',
                            customMinutes: val,
                          })
                        }
                      }}
                      className="bg-[#121A24] border border-[#202B37] rounded px-2 py-1 text-xs text-white w-20 text-center font-mono focus:outline-none focus:border-[#FFB300]"
                    />
                    <span className="text-xs text-gray-400">minutos (1 a 180 min)</span>
                  </div>
                )}
              </div>

              {/* Seletor de Nível de Detalhe (RESUMIDO / NORMAL / DETALHADO) */}
              <div>
                <span className="text-[11px] text-gray-400 uppercase font-semibold block mb-1.5">
                  Nível de Detalhe:
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['RESUMIDO', 'NORMAL', 'DETALHADO'] as BulletinDetailLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        bulletinServiceRef.current?.updateConfig({
                          detailLevel: lvl,
                        })
                      }}
                      className={`py-2 px-2 text-center rounded-lg text-xs font-bold transition-all border ${
                        bulletinConfig.detailLevel === lvl
                          ? 'bg-cyan-500 text-black border-cyan-400 shadow'
                          : 'bg-[#0B0F14] text-gray-300 border-[#202B37] hover:bg-[#1C2633]'
                      }`}
                    >
                      {lvl === 'RESUMIDO' ? 'Resumido' : lvl === 'NORMAL' ? 'Normal' : 'Detalhado'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dica de Comandos de Voz da Nina */}
              <div className="bg-[#0B0F14] p-2.5 rounded-lg border border-[#202B37] text-[11px] text-gray-400 flex flex-wrap items-center justify-between gap-1">
                <span>Comandos de voz aceitos:</span>
                <span className="text-[#FFB300] font-mono">
                  &quot;Nina, me avisa a cada 20 minutos&quot;
                </span>
                <span className="text-cyan-400 font-mono">
                  &quot;Nina, deixa os boletins mais detalhados&quot;
                </span>
                <span className="text-red-400 font-mono">
                  &quot;Nina, desativa os boletins&quot;
                </span>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 bg-[#0B0F14] border border-[#202B37] rounded-xl p-4 overflow-y-auto space-y-3">
              {ninaMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2 text-xs text-gray-400">
                  <Bot className="w-8 h-8 text-[#FFB300]" />
                  <p className="font-semibold text-white">Olá! Eu sou a Nina, sua copiloto.</p>
                  <p className="max-w-md">
                    Experimente perguntar por voz ou texto:
                    <br />
                    <span className="text-[#FFB300] font-mono">
                      &quot;Nina, como está o carro?&quot;
                    </span>
                    <br />
                    <span className="text-cyan-400 font-mono">
                      &quot;Nina, aconteceu alguma coisa diferente?&quot;
                    </span>
                    <br />
                    <span className="text-purple-400 font-mono">
                      &quot;Nina, anima a viagem!&quot;
                    </span>
                  </p>
                </div>
              ) : (
                ninaMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs ${
                        msg.role === 'user'
                          ? 'bg-[#FFB300] text-black font-medium'
                          : 'bg-[#121A24] border border-[#202B37] text-gray-200'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-gray-400 px-1 mt-0.5 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Converse com a Nina ou digite um comando..."
                value={ninaInput}
                disabled={isNinaLoading}
                onChange={(e) => setNinaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendNinaMessage()}
                className="flex-1 bg-[#121A24] border border-[#202B37] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFB300]"
              />
              <Button
                size="sm"
                disabled={isNinaLoading || !ninaInput.trim()}
                onClick={() => handleSendNinaMessage()}
                className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold h-10 px-4 rounded-xl"
              >
                Enviar
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Barra Inferior com Grandes Botões Automotivos (Drive Interface) */}
      <nav className="bg-[#0E141C] border-t border-[#202B37] px-4 py-2 flex items-center justify-around">
        <button
          type="button"
          onClick={() => setActiveTab('CARRO')}
          className={`flex flex-col items-center justify-center py-2 px-6 rounded-xl transition-all ${
            activeTab === 'CARRO'
              ? 'bg-[#1C2633] text-[#FFB300] font-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Car className="w-5 h-5 mb-1" />
          <span className="text-xs uppercase tracking-wider">CARRO</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('VIAGEM')}
          className={`flex flex-col items-center justify-center py-2 px-6 rounded-xl transition-all ${
            activeTab === 'VIAGEM'
              ? 'bg-[#1C2633] text-[#FFB300] font-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Compass className="w-5 h-5 mb-1" />
          <span className="text-xs uppercase tracking-wider">VIAGEM</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ENTRETENIMENTO')}
          className={`flex flex-col items-center justify-center py-2 px-6 rounded-xl transition-all ${
            activeTab === 'ENTRETENIMENTO'
              ? 'bg-[#1C2633] text-[#FFB300] font-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Music className="w-5 h-5 mb-1" />
          <span className="text-xs uppercase tracking-wider">DIVERSÃO</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('NINA')}
          className={`flex flex-col items-center justify-center py-2 px-6 rounded-xl transition-all ${
            activeTab === 'NINA'
              ? 'bg-[#1C2633] text-[#FFB300] font-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Bot className="w-5 h-5 mb-1" />
          <span className="text-xs uppercase tracking-wider">NINA</span>
        </button>
      </nav>
    </div>
  )
}
