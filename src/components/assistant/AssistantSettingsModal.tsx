import React, { useEffect, useState } from 'react'
import { AssistantIdentityConfig, AssistantStyle, AvailableTtsVoice } from '@/types/etapa6'
import {
  DEFAULT_ASSISTANT_IDENTITY,
  loadAssistantIdentity,
  saveAssistantIdentity,
  getAvailableTtsVoices,
  getAssistantDisplayName,
} from '@/lib/assistant/assistant-identity-store'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bot, Volume2, Mic, Sparkles, RotateCcw, Save, CheckCircle2 } from 'lucide-react'

interface AssistantSettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehiclePlate?: string
  onIdentitySaved?: (newIdentity: AssistantIdentityConfig) => void
}

export const AssistantSettingsModal: React.FC<AssistantSettingsModalProps> = ({
  open,
  onOpenChange,
  vehiclePlate,
  onIdentitySaved,
}) => {
  const [identity, setIdentity] = useState<AssistantIdentityConfig>(() =>
    loadAssistantIdentity(vehiclePlate),
  )
  const [availableVoices, setAvailableVoices] = useState<AvailableTtsVoice[]>([])
  const [testSpeaking, setTestSpeaking] = useState(false)

  // Recarrega identidade e vozes ao abrir o modal ou mudar o veículo
  useEffect(() => {
    if (open) {
      setIdentity(loadAssistantIdentity(vehiclePlate))
      getAvailableTtsVoices().then((voices) => {
        setAvailableVoices(voices)
      })
    }
  }, [open, vehiclePlate])

  const handleSave = () => {
    const saved = saveAssistantIdentity(identity, vehiclePlate)
    setIdentity(saved)
    onIdentitySaved?.(saved)
    onOpenChange(false)
  }

  const handleResetToNina = () => {
    const ninaDefault: AssistantIdentityConfig = {
      name: 'Nina',
      wakeWord: 'nina',
      style: 'AMIGAVEL',
      selectedVoiceUri: undefined,
      isCustomized: true, // Configurado explicitamente como Danilo usa
    }
    const saved = saveAssistantIdentity(ninaDefault, vehiclePlate)
    setIdentity(saved)
    onIdentitySaved?.(saved)
  }

  const handleResetToNeutral = () => {
    const neutral: AssistantIdentityConfig = {
      ...DEFAULT_ASSISTANT_IDENTITY,
      isCustomized: false,
    }
    const saved = saveAssistantIdentity(neutral, vehiclePlate)
    setIdentity(saved)
    onIdentitySaved?.(saved)
  }

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    synth.cancel()

    const nameToSay = identity.name.trim() || 'sua assistente'
    const textToSay =
      identity.style === 'OBJETIVO'
        ? `Olá! Sou ${nameToSay}. Telemetria veicular ativa.`
        : identity.style === 'TECNICO'
          ? `Olá! Sou ${nameToSay}. Monitoramento de enlace OBD e diagnósticos nominais.`
          : `Olá! Sou ${nameToSay}, sua copiloto inteligente no Network Car!`

    const utt = new SpeechSynthesisUtterance(textToSay)
    utt.lang = 'pt-BR'
    utt.rate = 1.05

    if (identity.selectedVoiceUri) {
      const v = synth.getVoices().find((x) => x.voiceURI === identity.selectedVoiceUri)
      if (v) utt.voice = v
    }

    utt.onstart = () => setTestSpeaking(true)
    utt.onend = () => setTestSpeaking(false)
    utt.onerror = () => setTestSpeaking(false)

    synth.speak(utt)
  }

  const displayName = getAssistantDisplayName(identity)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-[#121A24] border border-[#202B37] text-white">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center space-x-2 text-[#FFB300]">
            <Bot className="w-5 h-5" />
            <span>Configurar Minha Assistente (OS-ME001-E6.2)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-400">
            Personalize o nome, wake word de ativação, voz real do sistema e estilo de comunicação.
            A assistente adapta-se à sua escolha, enquanto a telemetria crítica permanece 100%
            independente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Identificação Ativa */}
          <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-mono block">
                Denominação Atual no Drive
              </span>
              <span className="text-sm font-bold text-white flex items-center space-x-1.5">
                <span>{displayName}</span>
                {identity.isCustomized ? (
                  <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded font-mono">
                    PERSONALIZADA
                  </span>
                ) : (
                  <span className="text-[10px] bg-gray-800 text-gray-300 border border-gray-700 px-1.5 py-0.2 rounded font-mono">
                    NEUTRO (ASSISTENTE)
                  </span>
                )}
              </span>
            </div>
            <div className="text-right text-[11px] text-gray-400 font-mono">
              Placa: <strong className="text-cyan-400">{vehiclePlate || 'PADRÃO'}</strong>
            </div>
          </div>

          {/* Nome e Wake Word */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="asst-name" className="text-xs text-gray-300 font-medium">
                Nome da Assistente:
              </Label>
              <Input
                id="asst-name"
                value={identity.name}
                placeholder="Ex.: Luna, Nina, Sofia, Jarvis..."
                onChange={(e) => {
                  const val = e.target.value
                  setIdentity((prev) => ({
                    ...prev,
                    name: val,
                    // Se o wake word estiver sincronizado ou vazio, atualiza junto
                    wakeWord:
                      prev.wakeWord === prev.name.toLowerCase() ? val.toLowerCase() : prev.wakeWord,
                  }))
                }}
                className="bg-[#0B0F14] border-[#202B37] text-white text-xs h-9"
              />
              <span className="text-[10px] text-gray-500">
                Nome livre exibido na interface e falado pela assistente.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="asst-wake"
                className="text-xs text-gray-300 font-medium flex items-center justify-between"
              >
                <span>Wake Word (Palavra de ativação):</span>
                <Mic className="w-3.5 h-3.5 text-[#FFB300]" />
              </Label>
              <Input
                id="asst-wake"
                value={identity.wakeWord}
                placeholder="Ex.: luna, nina, copiloto..."
                onChange={(e) =>
                  setIdentity((prev) => ({
                    ...prev,
                    wakeWord: e.target.value.toLowerCase(),
                  }))
                }
                className="bg-[#0B0F14] border-[#202B37] text-white text-xs h-9 font-mono"
              />
              <span className="text-[10px] text-cyan-400">
                Ex.: &quot;{identity.wakeWord || 'luna'}, como está o carro?&quot;
              </span>
            </div>
          </div>

          {/* Seletor de Vozes Reais do Dispositivo / Navegador */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="asst-voice"
                className="text-xs text-gray-300 font-medium flex items-center space-x-1.5"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Voz no Dispositivo (TTS Real):</span>
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={testSpeaking}
                onClick={handleTestVoice}
                className="text-[11px] h-6 px-2 border-[#202B37] text-cyan-300 hover:text-white"
              >
                {testSpeaking ? 'Testando...' : 'Testar Voz'}
              </Button>
            </div>

            {availableVoices.length === 0 ? (
              <div className="bg-[#0B0F14] border border-[#202B37] rounded-lg p-2.5 text-[11px] text-gray-400">
                Nenhuma voz externa detectada no sintetizador do navegador. A voz padrão pt-BR do
                sistema operacional será utilizada.
              </div>
            ) : (
              <select
                id="asst-voice"
                value={identity.selectedVoiceUri || ''}
                onChange={(e) =>
                  setIdentity((prev) => ({
                    ...prev,
                    selectedVoiceUri: e.target.value || undefined,
                  }))
                }
                className="w-full bg-[#0B0F14] border border-[#202B37] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
              >
                <option value="">Padrão do Sistema Operacional (Recomendado)</option>
                {availableVoices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang}) {v.default ? '— Padrão' : ''}
                  </option>
                ))}
              </select>
            )}
            <span className="text-[10px] text-gray-500 block">
              Lista apenas vozes estritamente instaladas no navegador ou SO. Independente do estilo.
            </span>
          </div>

          {/* Estilo de Comunicação (Objetivo / Amigável / Técnico) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-300 font-medium">Estilo de Resposta:</Label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  {
                    style: 'OBJETIVO',
                    label: 'Objetivo',
                    desc: 'Respostas ultra diretas e sem rodeios para condução ágil.',
                  },
                  {
                    style: 'AMIGAVEL',
                    label: 'Amigável',
                    desc: 'Tom acolhedor e próximo (estilo original do Danilo).',
                  },
                  {
                    style: 'TECNICO',
                    label: 'Técnico',
                    desc: 'Linguagem mecânica precisa com foco em parâmetros e ECU.',
                  },
                ] as { style: AssistantStyle; label: string; desc: string }[]
              ).map((item) => (
                <button
                  key={item.style}
                  type="button"
                  onClick={() =>
                    setIdentity((prev) => ({
                      ...prev,
                      style: item.style,
                    }))
                  }
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    identity.style === item.style
                      ? 'bg-[#1C2633] border-[#FFB300] text-white shadow'
                      : 'bg-[#0B0F14] border-[#202B37] text-gray-400 hover:bg-[#131A22]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-white">{item.label}</span>
                    {identity.style === item.style && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#FFB300]" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Atalhos Rápidos de Configuração Padrão */}
          <div className="pt-2 border-t border-[#202B37] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-gray-400">Predefinições rápidas:</span>
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetToNina}
                className="text-xs h-7 px-2 text-[#FFB300] hover:bg-[#1C2633]"
                title="Restaura a configuração Nina utilizada pelo Danilo"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Padrão Nina (Danilo)
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetToNeutral}
                className="text-xs h-7 px-2 text-gray-400 hover:text-white hover:bg-[#1C2633]"
                title="Restaura denominação neutra ASSISTENTE"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Denominação Neutra
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-[#202B37] pt-3 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-[#202B37] text-gray-300 hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Salvar Minha Assistente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
