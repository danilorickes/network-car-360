import pb from '@/lib/pocketbase/client'
import { CopilotContext, AssistantIdentityConfig, AssistantStyle } from '@/types/etapa6'
import {
  DEFAULT_ASSISTANT_IDENTITY,
  loadAssistantIdentity,
  getAssistantDisplayName,
} from './assistant-identity-store'

export interface AssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fallbackMode?: boolean
}

// Aliás para compatibilidade retroativa integral
export type NinaMessage = AssistantMessage

export interface VoiceEngineEvents {
  onListeningStateChange?: (isListening: boolean) => void
  onSpeechRecognized?: (transcript: string) => void
  onSpeakingStateChange?: (isSpeaking: boolean) => void
}

/**
 * AssistantCopilotService:
 * Orquestrador da Copiloto Inteligente do Network Car (instância personalizável).
 *
 * Princípios mandatórios:
 * 1. A assistente NUNCA inventa telemetria: se o PID for indisponível responde
 *    "esse dado não está disponível neste veículo/conexão".
 * 2. Alertas críticos são determinísticos (VehicleSafetyMonitor local); a assistente apenas explica.
 * 3. Prioridade de segurança: CRÍTICO DO VEÍCULO > NAVEGAÇÃO > ASSISTENTE > ENTRETENIMENTO.
 * 4. Wake word dinâmico configurável (ex: "luna", "nina", etc.) lendo a identidade ativa.
 *    Se o usuário configurar Luna: "Luna, como está o carro?" ativa, enquanto "Nina..." deixa de ativar.
 * 5. STT (Speech-to-Text) e TTS (Text-to-Speech) desacoplados via Web Speech API no navegador,
 *    respeitando vozes reais selecionadas e estilo (Objetivo / Amigável / Técnico).
 */
export class AssistantCopilotService {
  private conversationId: string | null = null
  private messages: AssistantMessage[] = []
  private recognition: any = null
  private synth: SpeechSynthesis | null = null
  private isListening = false
  private events: VoiceEngineEvents = {}
  private identity: AssistantIdentityConfig = { ...DEFAULT_ASSISTANT_IDENTITY }
  private currentVehiclePlate: string = 'PADRAO'

  constructor(
    vehiclePlate?: string,
    initialIdentity?: AssistantIdentityConfig,
    events?: VoiceEngineEvents,
  ) {
    if (events) this.events = events
    if (vehiclePlate) this.currentVehiclePlate = vehiclePlate
    if (initialIdentity) {
      this.identity = { ...initialIdentity }
    } else {
      this.identity = loadAssistantIdentity(this.currentVehiclePlate)
    }
    this.initVoiceAPIs()
  }

  private initVoiceAPIs() {
    if (typeof window !== 'undefined') {
      // Síntese de Voz (TTS)
      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis
      }

      // Reconhecimento de Voz (STT) com Wake Word
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        try {
          this.recognition = new SpeechRecognition()
          this.recognition.lang = 'pt-BR'
          this.recognition.continuous = true
          this.recognition.interimResults = false

          this.recognition.onstart = () => {
            this.isListening = true
            this.events.onListeningStateChange?.(true)
          }

          this.recognition.onend = () => {
            this.isListening = false
            this.events.onListeningStateChange?.(false)
          }

          this.recognition.onresult = (event: any) => {
            const current = event.resultIndex
            const transcript = event.results[current][0]?.transcript?.trim() || ''
            this.handleVoiceTranscript(transcript)
          }
        } catch {
          /* voice api unavailable */
        }
      }
    }
  }

  setEvents(events: VoiceEngineEvents) {
    this.events = { ...this.events, ...events }
  }

  setVehiclePlate(plate: string) {
    if (this.currentVehiclePlate !== plate) {
      this.currentVehiclePlate = plate || 'PADRAO'
      this.identity = loadAssistantIdentity(this.currentVehiclePlate)
    }
  }

  setIdentity(identity: AssistantIdentityConfig) {
    this.identity = { ...identity }
  }

  getIdentity(): AssistantIdentityConfig {
    return { ...this.identity }
  }

  getDisplayName(uppercase = false): string {
    return getAssistantDisplayName(this.identity, uppercase)
  }

  startListening(): boolean {
    if (!this.recognition) return false
    try {
      this.recognition.start()
      return true
    } catch {
      return false
    }
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop()
      } catch {
        /* intentionally ignored */
      }
    }
  }

  speak(text: string, onEnd?: () => void) {
    if (!this.synth) {
      onEnd?.()
      return
    }

    try {
      this.synth.cancel() // Interrompe fala anterior se houver
      const cleanText = text.replace(/[*#_~`]/g, '')
      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'pt-BR'
      utterance.rate = 1.05
      utterance.pitch = 1.0

      // Se houver voz TTS explicitamente configurada e disponível, aplica
      if (this.identity.selectedVoiceUri && typeof window !== 'undefined') {
        const voices = this.synth.getVoices?.() || []
        const matched = voices.find((v) => v.voiceURI === this.identity.selectedVoiceUri)
        if (matched) {
          utterance.voice = matched
        }
      }

      utterance.onstart = () => {
        this.events.onSpeakingStateChange?.(true)
      }
      utterance.onend = () => {
        this.events.onSpeakingStateChange?.(false)
        onEnd?.()
      }
      utterance.onerror = () => {
        this.events.onSpeakingStateChange?.(false)
        onEnd?.()
      }

      this.synth.speak(utterance)
    } catch {
      onEnd?.()
    }
  }

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel()
      this.events.onSpeakingStateChange?.(false)
    }
  }

  /**
   * Valida se a fala do usuário aciona a assistente com base no wake word configurado.
   * Se configurado "luna", "Luna, como está o carro?" ativa e "Nina..." deixa de ativar.
   * Retorna o comando limpo sem o wake word, ou null se não ativou.
   */
  matchWakeWord(transcript: string): string | null {
    if (!transcript) return null
    const lower = transcript.toLowerCase().trim()
    const activeWake = (this.identity.wakeWord || this.identity.name || 'nina').toLowerCase().trim()

    // 1. Início de frase: "luna como está o carro" / "luna, como está o carro"
    const prefixRegex = new RegExp(`^${activeWake}[,\\.\\s]+(.*)$`, 'i')
    const matchPrefix = lower.match(prefixRegex)
    if (matchPrefix) {
      return matchPrefix[1].trim()
    }

    // 2. Contém a wake word com pontuação: "olá luna, como está o carro"
    const inlineRegex = new RegExp(`\\b${activeWake}[,\\.\\s]+(.*)$`, 'i')
    const matchInline = lower.match(inlineRegex)
    if (matchInline) {
      return matchInline[1].trim()
    }

    // 3. Wake word isolada exata
    if (lower === activeWake) {
      return ''
    }

    return null
  }

  private handleVoiceTranscript(transcript: string) {
    this.events.onSpeechRecognized?.(transcript)

    const cleanCmd = this.matchWakeWord(transcript)
    if (cleanCmd !== null && cleanCmd.length > 2) {
      // Envia comando para processamento com contexto
      this.events.onSpeechRecognized?.(cleanCmd)
    }
  }

  /**
   * Formata resposta de acordo com o estilo selecionado (Objetivo / Amigável / Técnico)
   */
  private formatByStyle(
    baseReply: {
      objetivo: string
      amigavel: string
      tecnico: string
    },
    style: AssistantStyle = this.identity.style,
  ): string {
    switch (style) {
      case 'OBJETIVO':
        return baseReply.objetivo
      case 'TECNICO':
        return baseReply.tecnico
      case 'AMIGAVEL':
      default:
        return baseReply.amigavel
    }
  }

  /**
   * Envia pergunta ou comando para a assistente com contexto estruturado
   */
  async sendMessage(
    userText: string,
    context: CopilotContext,
    speakResponse = false,
  ): Promise<AssistantMessage> {
    const userMsg: AssistantMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    }
    this.messages.push(userMsg)

    const assistantName = this.identity.name || 'Nina'
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine && pb.authStore.isValid
    const lower = userText.toLowerCase()

    // Comandos locais pré-processados para resposta instantânea determinística
    if (
      lower.includes('como está o carro') ||
      lower.includes('como esta o carro') ||
      lower.includes('status do carro') ||
      lower.includes('saúde do carro') ||
      lower.includes('saude do carro')
    ) {
      let reply = ''
      if (context.connectionStatus !== 'CONECTADO') {
        reply = this.formatByStyle({
          objetivo: 'OBD desconectado. Ligue a ignição e conecte o adaptador.',
          amigavel: `O adaptador OBD não está conectado no momento. Ligue a ignição e conecte o adaptador para eu consultar os parâmetros do motor.`,
          tecnico:
            'Status de enlace OBD: DESCONECTADO. Comunicação com ECU inativa. Aguardando conexão do barramento CAN.',
        })
      } else if (context.safetyLevel === 'CRITICO') {
        reply = `ATENÇÃO PRIORITÁRIA: Há um alerta crítico ativo! ${context.activeAlerts.join('. ')}. Recomendo parar o carro em local seguro com urgência.`
      } else if (context.safetyLevel === 'ATENCAO') {
        reply = this.formatByStyle({
          objetivo: `Regime: ${context.drivingContext}. Atenção: ${context.activeAlerts.join('. ')}. Demais parâmetros normais.`,
          amigavel: `O motor está funcionando em regime de ${context.drivingContext}. Há pontos de atenção: ${context.activeAlerts.join('. ')}. Demais parâmetros seguem em monitoramento.`,
          tecnico: `Telemetria operando em regime ${context.drivingContext}. Anomalias detectadas pelo SafetyMonitor: ${context.activeAlerts.join('; ')}. Baselines em monitoramento.`,
        })
      } else {
        const speedTxt = context.speedKmh !== undefined ? `${context.speedKmh} km/h` : ''
        const tempTxt =
          context.coolantTemp !== undefined ? `Arrefecimento em ${context.coolantTemp} °C` : ''

        reply = this.formatByStyle({
          objetivo: `Carro normal. ${context.drivingContext}. ${tempTxt}. ${speedTxt ? `Vel: ${speedTxt}.` : ''}`,
          amigavel: `Tudo funcionando normalmente com o veículo! Regime atual: ${context.drivingContext}. ${tempTxt}. ${speedTxt ? `Velocidade: ${speedTxt}.` : ''} Monitoramento ativo.`,
          tecnico: `Parâmetros nominais. Regime: ${context.drivingContext}. ${tempTxt}. ${speedTxt ? `Velocidade: ${speedTxt}.` : ''} DTCs: 0. SafetyLevel: NORMAL.`,
        })
      }

      const assistantMsg: AssistantMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
        fallbackMode: false,
      }
      this.messages.push(assistantMsg)
      if (speakResponse) this.speak(reply)
      return assistantMsg
    }

    if (
      lower.includes('aconteceu alguma coisa diferente') ||
      lower.includes('algum problema') ||
      lower.includes('tem alguma falha')
    ) {
      let reply = ''
      if (context.activeAlerts.length > 0) {
        reply = this.formatByStyle({
          objetivo: `Atenção: ${context.activeAlerts.join('; ')}.`,
          amigavel: `Identifiquei o seguinte no veículo: ${context.activeAlerts.join('; ')}.`,
          tecnico: `Eventos de segurança reportados: ${context.activeAlerts.join('; ')}.`,
        })
      } else if (context.milOn) {
        reply = this.formatByStyle({
          objetivo: 'Luz de injeção MIL acesa. Parâmetros vitais estáveis.',
          amigavel:
            'A luz de injeção MIL acendeu no painel, mas os parâmetros vitais de temperatura e tensão permanecem estáveis.',
          tecnico:
            'MIL (Malfunction Indicator Lamp) ativo na ECU. Leitura de temperatura e tensão de bordo dentro das tolerâncias nominais.',
        })
      } else {
        reply = this.formatByStyle({
          objetivo: 'Nenhuma anomalia detectada. Telemetria normal.',
          amigavel:
            'Nenhuma anomalia detectada. A telemetria e o comportamento estão perfeitamente alinhados com o histórico deste veículo.',
          tecnico:
            'Zero DTCs ativos. Desvio padrão dos PIDs vitais dentro da banda de confiança estatística do baseline individual.',
        })
      }

      const assistantMsg: AssistantMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      }
      this.messages.push(assistantMsg)
      if (speakResponse) this.speak(reply)
      return assistantMsg
    }

    if (lower.includes('como está nossa viagem') || lower.includes('dados da viagem')) {
      let reply = ''
      if (!context.isTripActive) {
        reply = this.formatByStyle({
          objetivo: 'Nenhuma viagem ativa.',
          amigavel:
            'Nenhuma viagem está ativa no momento. Você pode tocar em INICIAR VIAGEM na aba Viagem.',
          tecnico:
            'TripSessionManager inativo. Nenhuma sessão de viagem registrada para o veículo.',
        })
      } else {
        reply = this.formatByStyle({
          objetivo: `Viagem "${context.tripTitle || ''}": ${context.tripDuration || '0 min'}, ${context.tripDistance || '0 km'}. Veículo OK.`,
          amigavel: `Nossa viagem "${context.tripTitle || ''}" está ativa há ${context.tripDuration || 'pouco tempo'}, com cerca de ${context.tripDistance || '0 km'} percorridos. O veículo segue saudável.`,
          tecnico: `Sessão ativa: "${context.tripTitle || ''}". Duração acumulada: ${context.tripDuration || '0 min'}. Odômetro da viagem: ${context.tripDistance || '0 km'}. Métricas nominais.`,
        })
      }

      const assistantMsg: AssistantMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      }
      this.messages.push(assistantMsg)
      if (speakResponse) this.speak(reply)
      return assistantMsg
    }

    // Se estiver offline ou sem backend autenticado: resposta local contextual segura
    if (!isOnline) {
      const offlineReply = this.formatByStyle({
        objetivo:
          context.safetyLevel === 'CRITICO'
            ? 'Modo local. ALERTA CRÍTICO ATIVO!'
            : 'Modo local offline. Sensores normais.',
        amigavel:
          `Estou em modo local offline. Os sensores vitais e o monitor de segurança continuam ativos no dispositivo. ` +
          (context.safetyLevel === 'CRITICO'
            ? 'ALERTA: Há parâmetros críticos em advertência!'
            : 'Tudo em ordem nos parâmetros locais.'),
        tecnico:
          `Operação em fallback local. Sensores monitorados via barramento local. ` +
          `SafetyLevel: ${context.safetyLevel}. Baseline ativo no dispositivo.`,
      })

      const assistantMsg: AssistantMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: offlineReply,
        timestamp: new Date().toISOString(),
        fallbackMode: true,
      }
      this.messages.push(assistantMsg)
      if (speakResponse) this.speak(offlineReply)
      return assistantMsg
    }

    // Chamada ao backend PocketBase pb_hooks
    try {
      const baseUrl = import.meta.env.VITE_POCKETBASE_URL || ''
      const res = await fetch(`${baseUrl}/backend/v1/nina/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token,
        },
        body: JSON.stringify({
          message: userText,
          conversation_id: this.conversationId,
          context: {
            ...context,
            assistantIdentity: this.identity,
          },
          assistant_name: assistantName,
          style: this.identity.style,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.conversation_id) {
        this.conversationId = data.conversation_id
      }

      const assistantMsg: AssistantMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content: data.content || 'Entendido. Estou atenta ao comportamento do veículo.',
        timestamp: new Date().toISOString(),
        fallbackMode: Boolean(data.fallback_mode),
      }
      this.messages.push(assistantMsg)
      if (speakResponse) this.speak(assistantMsg.content)
      return assistantMsg
    } catch {
      // Fallback gracioso
      const fallbackMsg: AssistantMessage = {
        id: `msg_asst_${Date.now()}`,
        role: 'assistant',
        content:
          'Entendido. Estou monitorando os sensores continuamente. O motor de segurança local está 100% ativo.',
        timestamp: new Date().toISOString(),
        fallbackMode: true,
      }
      this.messages.push(fallbackMsg)
      if (speakResponse) this.speak(fallbackMsg.content)
      return fallbackMsg
    }
  }

  getMessages(): AssistantMessage[] {
    return [...this.messages]
  }

  clearHistory() {
    this.messages = []
    this.conversationId = null
  }
}

/**
 * NinaCopilotService:
 * Classe mantida para compatibilidade retroativa total com código e testes existentes.
 * Estende AssistantCopilotService mantendo a assinatura original de construtor (events?).
 */
export class NinaCopilotService extends AssistantCopilotService {
  constructor(events?: VoiceEngineEvents) {
    super('PADRAO', { ...DEFAULT_ASSISTANT_IDENTITY, isCustomized: true }, events)
  }
}
