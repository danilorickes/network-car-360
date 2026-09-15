import pb from '@/lib/pocketbase/client'
import { CopilotContext } from '@/types/etapa6'

export interface NinaMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  fallbackMode?: boolean
}

export interface VoiceEngineEvents {
  onListeningStateChange?: (isListening: boolean) => void
  onSpeechRecognized?: (transcript: string) => void
  onSpeakingStateChange?: (isSpeaking: boolean) => void
}

/**
 * NinaCopilotService:
 * Orquestrador da Copiloto Inteligente Nina.
 *
 * Princípios mandatórios:
 * 1. A Nina NUNCA inventa telemetria: se o PID for indisponível responde "esse dado não está disponível neste veículo/conexão".
 * 2. Alertas críticos são determinísticos (VehicleSafetyMonitor local); a Nina apenas explica.
 * 3. Prioridade de segurança: CRÍTICO DO VEÍCULO > NAVEGAÇÃO > NINA > ENTRETENIMENTO.
 * 4. Wake word "Nina..." e integração nativa com Skip Cloud ($ai.agent('nina-copiloto')).
 * 5. STT (Speech-to-Text) e TTS (Text-to-Speech) desacoplados via Web Speech API no navegador.
 */
export class NinaCopilotService {
  private conversationId: string | null = null
  private messages: NinaMessage[] = []
  private recognition: any = null
  private synth: SpeechSynthesis | null = null
  private isListening = false
  private events: VoiceEngineEvents = {}

  constructor(events?: VoiceEngineEvents) {
    if (events) this.events = events
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

  private handleVoiceTranscript(transcript: string) {
    this.events.onSpeechRecognized?.(transcript)
    const lower = transcript.toLowerCase()

    // Detecta Wake Word "Nina..." ou comando direto
    if (lower.startsWith('nina') || lower.includes('nina,')) {
      const cleanCmd = transcript.replace(/^nina[,.\s]*/i, '').trim()
      if (cleanCmd.length > 2) {
        // Envia comando para processamento com contexto
        this.events.onSpeechRecognized?.(cleanCmd)
      }
    }
  }

  /**
   * Envia pergunta ou comando para a Nina com contexto estruturado
   */
  async sendMessage(
    userText: string,
    context: CopilotContext,
    speakResponse = false,
  ): Promise<NinaMessage> {
    const userMsg: NinaMessage = {
      id: `msg_user_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: new Date().toISOString(),
    }
    this.messages.push(userMsg)

    // Resposta determinística imediata para comandos de alta prioridade ou offline
    const isOnline = navigator.onLine && pb.authStore.isValid

    // Comandos locais pré-processados para resposta instantânea
    const lower = userText.toLowerCase()

    if (
      lower.includes('como está o carro') ||
      lower.includes('status do carro') ||
      lower.includes('saúde do carro')
    ) {
      let reply = ''
      if (context.connectionStatus !== 'CONECTADO') {
        reply =
          'O adaptador OBD não está conectado no momento. Ligue a ignição e conecte o adaptador para eu consultar os parâmetros do motor.'
      } else if (context.safetyLevel === 'CRITICO') {
        reply = `ATENÇÃO PRIORITÁRIA: Há um alerta crítico ativo! ${context.activeAlerts.join('. ')}. Recomendo parar o carro em local seguro com urgência.`
      } else if (context.safetyLevel === 'ATENCAO') {
        reply = `O motor está funcionando em regime de ${context.drivingContext}. Há pontos de atenção: ${context.activeAlerts.join('. ')}. Demais parâmetros seguem em monitoramento.`
      } else {
        const speedTxt = context.speedKmh !== undefined ? `${context.speedKmh} km/h` : ''
        const tempTxt =
          context.coolantTemp !== undefined ? `Arrefecimento em ${context.coolantTemp} °C` : ''
        reply = `Tudo funcionando normalmente com o veículo! Regime atual: ${context.drivingContext}. ${tempTxt}. ${speedTxt ? `Velocidade: ${speedTxt}.` : ''} Monitoramento ativo.`
      }

      const assistantMsg: NinaMessage = {
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
        reply = `Identifiquei o seguinte no veículo: ${context.activeAlerts.join('; ')}.`
      } else if (context.milOn) {
        reply =
          'A luz de injeção MIL acendeu no painel, mas os parâmetros vitais de temperatura e tensão permanecem estáveis.'
      } else {
        reply =
          'Nenhuma anomalia detectada. A telemetria e o comportamento estão perfeitamente alinhados com o histórico deste veículo.'
      }

      const assistantMsg: NinaMessage = {
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
        reply =
          'Nenhuma viagem está ativa no momento. Você pode tocar em INICIAR VIAGEM na aba Viagem.'
      } else {
        reply = `Nossa viagem "${context.tripTitle || ''}" está ativa há ${context.tripDuration || 'pouco tempo'}, com cerca de ${context.tripDistance || '0 km'} percorridos. O veículo segue saudável.`
      }

      const assistantMsg: NinaMessage = {
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
      const offlineReply =
        'Estou em modo local offline. Os sensores vitais e o monitor de segurança continuam ativos no dispositivo. ' +
        (context.safetyLevel === 'CRITICO'
          ? 'ALERTA: Há parâmetros críticos em advertência!'
          : 'Tudo em ordem nos parâmetros locais.')

      const assistantMsg: NinaMessage = {
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

    // Chamada ao backend PocketBase pb_hooks com agente nativo Skip Cloud
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
          context,
        }),
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()
      if (data.conversation_id) {
        this.conversationId = data.conversation_id
      }

      const assistantMsg: NinaMessage = {
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
      const fallbackMsg: NinaMessage = {
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

  getMessages(): NinaMessage[] {
    return [...this.messages]
  }

  clearHistory() {
    this.messages = []
    this.conversationId = null
  }
}
