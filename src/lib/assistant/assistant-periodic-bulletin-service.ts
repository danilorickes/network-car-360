import pb from '@/lib/pocketbase/client'
import {
  NinaBulletinConfig,
  NinaBulletinPayload,
  BulletinDetailLevel,
  BulletinIntervalOption,
  CopilotContext,
  DrivingContextType,
  SafetyLevel,
  AssistantIdentityConfig,
} from '@/types/etapa6'
import {
  loadAssistantIdentity,
  DEFAULT_ASSISTANT_IDENTITY,
  getAssistantDisplayName,
} from './assistant-identity-store'

export interface AssistantBulletinServiceEvents {
  onBulletinGenerated?: (bulletin: NinaBulletinPayload) => void
  onConfigChanged?: (config: NinaBulletinConfig) => void
  onDuckingStart?: () => void
  onDuckingEnd?: () => void
}

// Aliás de compatibilidade retroativa
export type NinaBulletinServiceEvents = AssistantBulletinServiceEvents

export interface BulletinContextInput {
  copilotContext: CopilotContext
  // Conjunto de PIDs suportados na conexão atual (ex.: ['0x0C', '0x0D', '0x05', '0x42'])
  supportedPids: string[]
  // Baseline individual ou estatísticas aprendidas se houver
  hasSufficientBaseline?: boolean
  baselineSampleCount?: number
  // Contexto de condução anterior para detecção de mudanças
  previousContext?: DrivingContextType
}

const STORAGE_KEY_PREFIX = 'nc_nina_bulletin_config_'

/**
 * AssistantPeriodicBulletinService:
 * Orquestrador dos Boletins Periódicos por Voz do Network Car (generalizado).
 * Suporta nome e wake word configurados dinamicamente via AssistantIdentityConfig.
 */
export class AssistantPeriodicBulletinService {
  private config: NinaBulletinConfig = {
    enabled: true,
    intervalOption: 20,
    effectiveMinutes: 20,
    detailLevel: 'NORMAL',
    totalBulletinsEmitted: 0,
  }

  private events: AssistantBulletinServiceEvents = {}
  private timerId: any = null
  private lastSnapshot: BulletinContextInput | null = null
  private lastEmittedAtMonoMs: number = 0
  private currentVehiclePlate: string = 'PADRAO'
  private identity: AssistantIdentityConfig = { ...DEFAULT_ASSISTANT_IDENTITY }

  constructor(
    vehiclePlate?: string,
    events?: AssistantBulletinServiceEvents,
    identity?: AssistantIdentityConfig,
  ) {
    if (events) this.events = events
    if (vehiclePlate) this.currentVehiclePlate = vehiclePlate
    if (identity) {
      this.identity = { ...identity }
    } else {
      this.identity = loadAssistantIdentity(this.currentVehiclePlate)
    }
    this.loadPersistedConfig(this.currentVehiclePlate)
  }

  setEvents(events: AssistantBulletinServiceEvents) {
    this.events = { ...this.events, ...events }
  }

  setIdentity(identity: AssistantIdentityConfig) {
    this.identity = { ...identity }
  }

  getIdentity(): AssistantIdentityConfig {
    return { ...this.identity }
  }

  setVehiclePlate(plate: string) {
    if (this.currentVehiclePlate !== plate) {
      this.currentVehiclePlate = plate || 'PADRAO'
      this.identity = loadAssistantIdentity(this.currentVehiclePlate)
      this.loadPersistedConfig(this.currentVehiclePlate)
      this.restartTimer()
    }
  }

  getConfig(): NinaBulletinConfig {
    return { ...this.config }
  }

  /**
   * Atualiza a configuração dos boletins e persiste por usuário/veículo.
   */
  updateConfig(updates: Partial<NinaBulletinConfig>): NinaBulletinConfig {
    const next: NinaBulletinConfig = {
      ...this.config,
      ...updates,
    }

    // Calcula os minutos efetivos
    if (next.intervalOption === 'DESATIVADO') {
      next.enabled = false
      next.effectiveMinutes = 0
    } else if (next.intervalOption === 'PERSONALIZADO') {
      const custom = Math.max(1, Math.min(180, Number(next.customMinutes) || 15))
      next.customMinutes = custom
      next.effectiveMinutes = custom
      next.enabled = true
    } else {
      next.effectiveMinutes = Number(next.intervalOption) || 20
      next.enabled = true
    }

    this.config = next
    this.persistConfig(this.currentVehiclePlate, this.config)
    this.events.onConfigChanged?.(this.config)
    this.restartTimer()
    return { ...this.config }
  }

  /**
   * Persistência multioficina e por usuário/veículo.
   */
  private getStorageKey(vehiclePlate: string): string {
    const authUser = pb.authStore.model
    const workshopId = authUser?.workshop_id || 'ws_default'
    const userId = authUser?.id || 'anon'
    return `${STORAGE_KEY_PREFIX}${workshopId}_${userId}_${vehiclePlate.toUpperCase().trim()}`
  }

  private loadPersistedConfig(vehiclePlate: string) {
    if (typeof localStorage === 'undefined') return
    try {
      const key = this.getStorageKey(vehiclePlate)
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        this.config = {
          enabled: parsed.enabled ?? true,
          intervalOption: parsed.intervalOption ?? 20,
          customMinutes: parsed.customMinutes,
          effectiveMinutes: parsed.effectiveMinutes ?? 20,
          detailLevel: parsed.detailLevel ?? 'NORMAL',
          totalBulletinsEmitted: parsed.totalBulletinsEmitted ?? 0,
          lastBulletinUtc: parsed.lastBulletinUtc,
        }
      }
    } catch {
      /* ignore storage parse err */
    }
  }

  private persistConfig(vehiclePlate: string, config: NinaBulletinConfig) {
    if (typeof localStorage === 'undefined') return
    try {
      const key = this.getStorageKey(vehiclePlate)
      localStorage.setItem(key, JSON.stringify(config))
    } catch {
      /* ignore storage write err */
    }
  }

  /**
   * Gera o boletim determinístico com base estritamente nos PIDs disponíveis,
   * aplicando regra de linguagem segura, anti-repetição e níveis de detalhe.
   * Utiliza dinamicamente o nome da assistente configurada (ex: Nina, Luna, ou Assistente).
   */
  generateBulletin(input: BulletinContextInput, isScheduledTrigger = false): NinaBulletinPayload {
    const { copilotContext, supportedPids, hasSufficientBaseline, baselineSampleCount } = input
    const supportedSet = new Set(supportedPids.map((p) => p.toLowerCase().trim()))

    const isPidAvailable = (pidHex: string) => supportedSet.has(pidHex.toLowerCase().trim())

    // Identidade ativa: usa o nome da assistente (ou Nina se legado/padrão)
    const assistantName = this.identity.name || 'Nina'

    // 1. Detectar mudanças relevantes desde o último snapshot (Anti-repetição)
    const changes: string[] = []
    let isShortUpdate = false

    if (this.lastSnapshot) {
      const prevCtx = this.lastSnapshot.copilotContext.drivingContext
      const curCtx = copilotContext.drivingContext
      if (prevCtx !== curCtx) {
        changes.push(`Regime de condução mudou de ${prevCtx} para ${curCtx}`)
      }

      const prevAlerts = this.lastSnapshot.copilotContext.activeAlerts || []
      const curAlerts = copilotContext.activeAlerts || []
      if (curAlerts.length > prevAlerts.length) {
        const newOnes = curAlerts.filter((a) => !prevAlerts.includes(a))
        if (newOnes.length > 0) {
          changes.push(`Novos alertas: ${newOnes.join(', ')}`)
        }
      }

      // Mudança significativa de temperatura se disponível
      if (
        isPidAvailable('0x05') &&
        copilotContext.coolantTemp !== undefined &&
        this.lastSnapshot.copilotContext.coolantTemp !== undefined
      ) {
        const diff = Math.abs(
          copilotContext.coolantTemp - this.lastSnapshot.copilotContext.coolantTemp,
        )
        if (diff >= 7) {
          changes.push(
            `Variação de arrefecimento: ${copilotContext.coolantTemp} °C (delta ${diff.toFixed(0)} °C)`,
          )
        }
      }

      // Se nada relevante mudou e é um boletim de ciclo periódico agendado
      if (changes.length === 0 && isScheduledTrigger) {
        isShortUpdate = true
      }
    }

    // 2. Construção das sentenças respeitando regras determinísticas E6
    const sentences: string[] = []

    // Abertura com o nome dinâmico da assistente
    if (isShortUpdate) {
      sentences.push(
        `Boletim ${assistantName}: Parâmetros estáveis e sem alterações relevantes desde o último boletim.`,
      )
    } else {
      sentences.push(
        changes.length > 0
          ? `Boletim ${assistantName}: ${changes.join('. ')}.`
          : `Boletim periódico da ${assistantName}.`,
      )
    }

    // Regime de Condução
    if (!isShortUpdate || this.config.detailLevel === 'DETALHADO') {
      sentences.push(`Regime atual: ${copilotContext.drivingContext}.`)
    }

    // Grandezas Vitais conforme disponibilidade de PID
    // PID 0x05 - Temperatura do Líquido de Arrefecimento
    if (isPidAvailable('0x05')) {
      if (copilotContext.coolantTemp !== undefined) {
        sentences.push(`Temperatura do motor em ${copilotContext.coolantTemp} graus.`)
      }
    } else {
      // Quando PID for indisponível e detalhe for NORMAL ou DETALHADO, explicita indisponibilidade
      if (this.config.detailLevel !== 'RESUMIDO') {
        sentences.push(
          'Temperatura do motor: esse dado não está disponível neste veículo ou conexão.',
        )
      }
    }

    // PID 0x0D - Velocidade
    if (isPidAvailable('0x0D')) {
      if (copilotContext.speedKmh !== undefined && this.config.detailLevel !== 'RESUMIDO') {
        sentences.push(`Velocidade em ${copilotContext.speedKmh} km/h.`)
      }
    } else if (this.config.detailLevel === 'DETALHADO') {
      sentences.push('Velocidade OBD: esse dado não está disponível neste veículo ou conexão.')
    }

    // PID 0x42 - Tensão Elétrica
    if (isPidAvailable('0x42')) {
      if (copilotContext.batteryVoltage !== undefined && this.config.detailLevel !== 'RESUMIDO') {
        sentences.push(`Tensão da bateria em ${copilotContext.batteryVoltage} volts.`)
      }
    } else if (this.config.detailLevel === 'DETALHADO') {
      sentences.push('Tensão elétrica: esse dado não está disponível neste veículo ou conexão.')
    }

    // Regra de Baseline Seguro E6:
    // NUNCA afirmar comportamento esperado sem baseline suficiente
    if (this.config.detailLevel === 'DETALHADO' || !isShortUpdate) {
      if (!hasSufficientBaseline) {
        sentences.push(
          'Baseline individual ainda em fase de aprendizado estatístico; comportamento de referência não consolidado.',
        )
      } else {
        sentences.push(
          `Baseline individual consolidado com ${baselineSampleCount || 'múltiplas'} amostras para este veículo.`,
        )
      }
    }

    // Status de Alertas / Segurança Determinístico
    if (copilotContext.activeAlerts && copilotContext.activeAlerts.length > 0) {
      sentences.push(`Atenção para: ${copilotContext.activeAlerts.join('. ')}.`)
    } else if (!isShortUpdate) {
      sentences.push('Nenhum alerta de segurança ativo.')
    }

    // Nível RESUMIDO: se solicitado, encurta para as primeiras sentenças essenciais
    let text = sentences.join(' ')
    if (this.config.detailLevel === 'RESUMIDO' && sentences.length > 2) {
      text = sentences.slice(0, 2).join(' ')
    }

    const payload: NinaBulletinPayload = {
      id: `bulletin_${Date.now()}`,
      timestampUtc: new Date().toISOString(),
      detailLevel: this.config.detailLevel,
      text,
      isShortUpdate,
      significantChanges: changes,
      telemetrySnapshot: {
        speedKmh: copilotContext.speedKmh,
        rpm: copilotContext.rpm,
        coolantTemp: copilotContext.coolantTemp,
        batteryVoltage: copilotContext.batteryVoltage,
        stft: copilotContext.stft,
        ltft: copilotContext.ltft,
        drivingContext: copilotContext.drivingContext,
        safetyLevel: copilotContext.safetyLevel,
      },
    }

    // Atualiza rastreamento
    this.lastSnapshot = input
    this.lastEmittedAtMonoMs = performance.now()
    this.config.lastBulletinUtc = payload.timestampUtc
    this.config.totalBulletinsEmitted += 1
    this.persistConfig(this.currentVehiclePlate, this.config)

    this.events.onBulletinGenerated?.(payload)
    return payload
  }

  /**
   * Reinicia o temporizador baseado na configuração ativa.
   */
  private restartTimer() {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }

    if (!this.config.enabled || this.config.effectiveMinutes <= 0) {
      return
    }

    const intervalMs = this.config.effectiveMinutes * 60 * 1000
    this.timerId = setInterval(() => {
      this.handleTimerTick()
    }, intervalMs)
  }

  private handleTimerTick() {
    if (!this.config.enabled || !this.lastSnapshot) return
    // Dispara geração do boletim periódico agendado
    this.generateBulletin(this.lastSnapshot, true)
  }

  /**
   * Alimenta os dados de telemetria mais recentes para o serviço.
   */
  updateTelemetrySnapshot(input: BulletinContextInput) {
    this.lastSnapshot = input
  }

  /**
   * Processa comandos de voz específicos dos boletins:
   * - "{WakeWord}, me avisa a cada 20 minutos" (e outros números)
   * - "{WakeWord}, deixa os boletins mais detalhados" / "mais resumidos"
   * - "{WakeWord}, desativa os boletins"
   * Se o usuário configurou Luna, "Luna..." ativa e "Nina..." deixa de ativar.
   * Se o usuário ainda estiver com o padrão Nina, "Nina..." ativa normalmente.
   */
  parseVoiceCommand(transcript: string): { handled: boolean; replyText: string } | null {
    if (!transcript) return null
    const raw = transcript.toLowerCase().trim()
    const activeWake = (this.identity.wakeWord || this.identity.name || 'nina').toLowerCase().trim()

    // Valida se o comando inicia ou referencia a wake word configurada
    const prefixRegex = new RegExp(`^${activeWake}[,\\.\\s]+(.*)$`, 'i')
    const match = raw.match(prefixRegex)
    if (!match) {
      // Se não começar com o wake word configurado, não trata
      return null
    }

    const clean = match[1].trim()

    // 1. "desativa os boletins" / "desativar boletins" / "desligar boletins"
    if (
      clean.includes('desativa os boletins') ||
      clean.includes('desativar boletins') ||
      clean.includes('desliga os boletins') ||
      clean.includes('cancelar boletins') ||
      clean.includes('para os boletins') ||
      clean.includes('parar os boletins')
    ) {
      this.updateConfig({ intervalOption: 'DESATIVADO' })
      return {
        handled: true,
        replyText: 'Boletins periódicos desativados. Alertas de segurança continuam ativos.',
      }
    }

    // 2. "me avisa a cada X minutos" / "boletim a cada X minutos" / "aviso a cada X minutos"
    const intervalMatch = clean.match(
      /(?:me\s+avisa|aviso|boletim|boletins|lembrete)\s+a\s+cada\s+(\d+)\s*minutos?/i,
    )
    if (intervalMatch && intervalMatch[1]) {
      const minutes = parseInt(intervalMatch[1], 10)
      if (!isNaN(minutes) && minutes > 0) {
        if ([5, 10, 20, 30, 60].includes(minutes)) {
          this.updateConfig({
            intervalOption: minutes as BulletinIntervalOption,
          })
        } else {
          this.updateConfig({
            intervalOption: 'PERSONALIZADO',
            customMinutes: minutes,
          })
        }
        return {
          handled: true,
          replyText: `Entendido! Emitirei boletins por voz a cada ${minutes} minutos.`,
        }
      }
    }

    // 3. "deixa os boletins mais detalhados" / "boletim detalhado"
    if (
      clean.includes('mais detalhados') ||
      clean.includes('mais detalhado') ||
      clean.includes('boletim detalhado') ||
      clean.includes('nível detalhado')
    ) {
      this.updateConfig({ detailLevel: 'DETALHADO' })
      return {
        handled: true,
        replyText: 'Configuração atualizada: boletins configurados no nível detalhado.',
      }
    }

    // 4. "deixa os boletins mais resumidos" / "boletim resumido" / "boletim curto"
    if (
      clean.includes('mais resumidos') ||
      clean.includes('mais resumido') ||
      clean.includes('boletim resumido') ||
      clean.includes('boletim curto') ||
      clean.includes('nível resumido')
    ) {
      this.updateConfig({ detailLevel: 'RESUMIDO' })
      return {
        handled: true,
        replyText: 'Configuração atualizada: boletins configurados no nível resumido.',
      }
    }

    // 5. "boletins normais" / "detalhe normal"
    if (clean.includes('boletins normais') || clean.includes('nível normal')) {
      this.updateConfig({ detailLevel: 'NORMAL' })
      return {
        handled: true,
        replyText: 'Configuração atualizada: boletins configurados no nível normal.',
      }
    }

    return null
  }

  destroy() {
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }
}

/**
 * NinaPeriodicBulletinService:
 * Mantido com nome e assinatura originais para retrocompatibilidade completa com E6.1.
 */
export class NinaPeriodicBulletinService extends AssistantPeriodicBulletinService {
  constructor(vehiclePlate?: string, events?: AssistantBulletinServiceEvents) {
    super(vehiclePlate, events, { ...DEFAULT_ASSISTANT_IDENTITY, isCustomized: true })
  }
}
