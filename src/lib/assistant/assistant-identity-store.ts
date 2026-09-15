import pb from '@/lib/pocketbase/client'
import { AssistantIdentityConfig, AvailableTtsVoice } from '@/types/etapa6'

export const DEFAULT_ASSISTANT_IDENTITY: AssistantIdentityConfig = {
  name: 'Nina', // Configuração padrão atual utilizada pelo Danilo
  wakeWord: 'nina',
  style: 'AMIGAVEL',
  isCustomized: false, // Antes da personalização do usuário, a interface exibe a denominação neutra "ASSISTENTE"
}

const STORAGE_KEY_PREFIX = 'nc_assistant_identity_'

/**
 * Retorna a chave de armazenamento isolada por oficina, usuário e placa do veículo.
 * Mantém isolamento multitenant estrito idêntico ao dos boletins e telemetria.
 */
export function getAssistantStorageKey(vehiclePlate: string): string {
  const authUser = pb.authStore.model
  const workshopId = authUser?.workshop_id || 'ws_default'
  const userId = authUser?.id || 'anon'
  const cleanPlate = (vehiclePlate || 'PADRAO').toUpperCase().trim()
  return `${STORAGE_KEY_PREFIX}${workshopId}_${userId}_${cleanPlate}`
}

/**
 * Carrega a identidade do assistente para o veículo/usuário especificado.
 */
export function loadAssistantIdentity(vehiclePlate?: string): AssistantIdentityConfig {
  if (typeof localStorage === 'undefined') {
    return { ...DEFAULT_ASSISTANT_IDENTITY }
  }
  try {
    const key = getAssistantStorageKey(vehiclePlate || 'PADRAO')
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        name: parsed.name?.trim() || DEFAULT_ASSISTANT_IDENTITY.name,
        wakeWord: (
          parsed.wakeWord?.trim() ||
          parsed.name?.trim() ||
          DEFAULT_ASSISTANT_IDENTITY.wakeWord
        ).toLowerCase(),
        selectedVoiceUri: parsed.selectedVoiceUri || undefined,
        style: ['OBJETIVO', 'AMIGAVEL', 'TECNICO'].includes(parsed.style)
          ? parsed.style
          : 'AMIGAVEL',
        isCustomized: Boolean(parsed.isCustomized),
        updatedAtUtc: parsed.updatedAtUtc,
      }
    }
  } catch {
    /* ignore storage error */
  }
  return { ...DEFAULT_ASSISTANT_IDENTITY }
}

/**
 * Persiste a identidade do assistente isolada por oficina, usuário e placa do veículo.
 */
export function saveAssistantIdentity(
  identity: Partial<AssistantIdentityConfig>,
  vehiclePlate?: string,
): AssistantIdentityConfig {
  const current = loadAssistantIdentity(vehiclePlate)
  const cleanName = identity.name !== undefined ? identity.name.trim() : current.name
  const cleanWakeWord =
    identity.wakeWord !== undefined
      ? identity.wakeWord.trim().toLowerCase()
      : identity.name
        ? identity.name.trim().toLowerCase()
        : current.wakeWord

  const updated: AssistantIdentityConfig = {
    ...current,
    ...identity,
    name: cleanName || DEFAULT_ASSISTANT_IDENTITY.name,
    wakeWord: cleanWakeWord || DEFAULT_ASSISTANT_IDENTITY.wakeWord,
    isCustomized: true, // Uma vez salvo pelo usuário, passa a ser personalizado
    updatedAtUtc: new Date().toISOString(),
  }

  if (typeof localStorage !== 'undefined') {
    try {
      const key = getAssistantStorageKey(vehiclePlate || 'PADRAO')
      localStorage.setItem(key, JSON.stringify(updated))
    } catch {
      /* ignore storage error */
    }
  }

  return updated
}

/**
 * Obtém a denominação para exibição na interface:
 * Antes da personalização (isCustomized === false): "ASSISTENTE" (denominação neutra)
 * Após personalização: Nome escolhido dinamicamente (ex.: "LUNA", "CARRO | VIAGEM | DIVERSÃO | LUNA")
 */
export function getAssistantDisplayName(
  identity: AssistantIdentityConfig,
  uppercase = false,
): string {
  const name = identity.isCustomized && identity.name.trim() ? identity.name.trim() : 'Assistente'
  return uppercase ? name.toUpperCase() : name
}

/**
 * Lista vozes estritamente reais disponíveis no navegador / dispositivo via SpeechSynthesis.
 * NUNCA inventa vozes inexistentes.
 */
export function getAvailableTtsVoices(): Promise<AvailableTtsVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([])
      return
    }

    const synth = window.speechSynthesis
    const getVoices = () => {
      const rawVoices = synth.getVoices() || []
      const mapped: AvailableTtsVoice[] = rawVoices.map((v) => ({
        voiceURI: v.voiceURI,
        name: v.name,
        lang: v.lang,
        default: v.default,
        localService: (v as any).localService,
      }))
      resolve(mapped)
    }

    const initial = synth.getVoices()
    if (initial && initial.length > 0) {
      getVoices()
    } else {
      // Alguns navegadores carregam vozes de forma assíncrona
      const onVoicesChanged = () => {
        synth.removeEventListener('voiceschanged', onVoicesChanged)
        getVoices()
      }
      synth.addEventListener('voiceschanged', onVoicesChanged)
      // Timeout de segurança se o evento não disparar
      setTimeout(() => {
        getVoices()
      }, 500)
    }
  })
}
