import React, { useState } from 'react'
import { loadAppConfig, saveAppConfig, DEFAULT_CONFIG } from '@/lib/config-store'
import { AppConfig } from '@/types/obd'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { SIMULATOR_SCENARIOS, SimulatorScenario } from '@/lib/obd/transports/simulated-transport'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Settings,
  Save,
  RotateCcw,
  Cpu,
  Radio,
  Activity,
  Clock,
  Bluetooth,
  Database,
  HelpCircle,
  Layers,
} from 'lucide-react'
import { detectPlatformCapabilities } from '@/lib/obd/platform-detector'
import { AssistantIdentityConfig, AssistantStyle, AvailableTtsVoice } from '@/types/etapa6'
import {
  DEFAULT_ASSISTANT_IDENTITY,
  loadAssistantIdentity,
  saveAssistantIdentity,
  getAvailableTtsVoices,
  getAssistantDisplayName,
} from '@/lib/assistant/assistant-identity-store'
import { getDriveStartupPreference, setDriveStartupPreference } from '@/lib/drive-startup-pref'
import {
  Bot,
  Sparkles,
  Volume2,
  Mic,
  CheckCircle2,
  Car,
  Compass,
  Smartphone,
  Info,
} from 'lucide-react'
import { APP_VERSION, APP_BUILD_LABEL, APP_HOMOLOGATION_CODENAME } from '@/lib/version'

export default function Configuracoes() {
  const { activeScenario, setActiveScenario, selectedVehicle } = useTelemetry()
  const { toast } = useToast()
  const [config, setConfig] = useState<AppConfig>(loadAppConfig())
  const platform = detectPlatformCapabilities()

  // OS-ME001-E6.3.1: Preferência "Iniciar diretamente no Network Car Drive"
  const [driveStartupEnabled, setDriveStartupEnabled] = useState<boolean>(() =>
    getDriveStartupPreference(),
  )

  // OS-ME001-E6.2: Identidade da Assistente Personalizável por Veículo / Usuário / Oficina
  const [assistantIdentity, setAssistantIdentity] = useState<AssistantIdentityConfig>(() =>
    loadAssistantIdentity(selectedVehicle?.plate),
  )
  const [availableVoices, setAvailableVoices] = useState<AvailableTtsVoice[]>([])
  const [testSpeaking, setTestSpeaking] = useState(false)

  React.useEffect(() => {
    setAssistantIdentity(loadAssistantIdentity(selectedVehicle?.plate))
    getAvailableTtsVoices().then((voices) => setAvailableVoices(voices))
  }, [selectedVehicle?.plate])

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const synth = window.speechSynthesis
    synth.cancel()

    const nameToSay = assistantIdentity.name.trim() || 'sua assistente'
    const textToSay =
      assistantIdentity.style === 'OBJETIVO'
        ? `Olá! Sou ${nameToSay}. Telemetria veicular pronta.`
        : assistantIdentity.style === 'TECNICO'
          ? `Olá! Sou ${nameToSay}. Diagnóstico local e baselines estatísticos em operação nominal.`
          : `Olá! Sou ${nameToSay}, sua copiloto inteligente no Network Car!`

    const utt = new SpeechSynthesisUtterance(textToSay)
    utt.lang = 'pt-BR'
    utt.rate = 1.05

    if (assistantIdentity.selectedVoiceUri) {
      const v = synth.getVoices().find((x) => x.voiceURI === assistantIdentity.selectedVoiceUri)
      if (v) utt.voice = v
    }

    utt.onstart = () => setTestSpeaking(true)
    utt.onend = () => setTestSpeaking(false)
    utt.onerror = () => setTestSpeaking(false)

    synth.speak(utt)
  }

  const handleChange = (key: keyof AppConfig, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSave = () => {
    saveAppConfig(config)
    saveAssistantIdentity(assistantIdentity, selectedVehicle?.plate)
    setDriveStartupPreference(driveStartupEnabled)
    toast({
      title: 'Configurações Salvas',
      description:
        'Parâmetros operacionais, assistente e preferência de inicialização Drive salvos com sucesso.',
    })
  }

  const handleReset = () => {
    setConfig({ ...DEFAULT_CONFIG })
    saveAppConfig(DEFAULT_CONFIG)
    toast({
      title: 'Valores Padrão Restaurados',
      description: 'Configurações redefinidas para os parâmetros originais.',
    })
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <Settings className="w-5 h-5 text-[#FFB300]" />
            <span>Configurações Operacionais da Telemetria</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Parâmetros de transporte, frequências de amostragem, janelas de caixa-preta e emulação
            veicular.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="border-[#263340] text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Restaurar Padrões
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs"
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Salvar Alterações
          </Button>
        </div>
      </div>

      {/* OS-ME001-E6.3.1: Preferência de Inicialização no Network Car Drive */}
      <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#263340] pb-3">
          <div className="flex items-center space-x-2">
            <Car className="w-5 h-5 text-[#FFB300]" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Inicialização Automotiva (OS-ME001-E6.3.1)</span>
                {driveStartupEnabled && (
                  <span className="text-[10px] bg-amber-950 text-[#FFB300] border border-amber-800 px-1.5 py-0.2 rounded font-mono font-normal">
                    DRIVE DIRETO ATIVO
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#9AA7B4]">
                Ideal para centrais multimídia Android e tablets fixados no painel do veículo.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0B0F14] border border-[#263340] rounded-xl p-4">
          <div className="space-y-1">
            <span className="font-bold text-sm text-white flex items-center space-x-2">
              <span>Iniciar diretamente no Network Car Drive</span>
              <Compass className="w-4 h-4 text-cyan-400" />
            </span>
            <p className="text-xs text-gray-400 max-w-xl">
              Quando habilitado, após o login ou ao recarregar a aplicação, o sistema abre
              diretamente na interface automotivafullscreen (/network-car-drive) em vez do Painel
              Live técnico. Persistido por usuário e oficina.
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={driveStartupEnabled}
              onClick={() => {
                const next = !driveStartupEnabled
                setDriveStartupEnabled(next)
                setDriveStartupPreference(next)
                toast({
                  title: next ? 'Inicialização Drive Ativada' : 'Inicialização Padrão Restaurada',
                  description: next
                    ? 'Próximos logins e aberturas direcionarão para o Network Car Drive.'
                    : 'Aberturas direcionarão para o Painel Live.',
                })
              }}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                driveStartupEnabled ? 'bg-[#FFB300]' : 'bg-[#263340]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                  driveStartupEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-xs font-mono font-bold text-white min-w-[50px]">
              {driveStartupEnabled ? 'ATIVO' : 'INATIVO'}
            </span>
          </div>
        </div>
      </div>

      {/* OS-ME001-E6.2: Seção MINHA ASSISTENTE PERSONALIZÁVEL */}
      <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#263340] pb-3">
          <div className="flex items-center space-x-2">
            <Bot className="w-5 h-5 text-[#FFB300]" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Minha Assistente (OS-ME001-E6.2)</span>
                {assistantIdentity.isCustomized ? (
                  <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-1.5 py-0.2 rounded font-mono font-normal">
                    PERSONALIZADA
                  </span>
                ) : (
                  <span className="text-[10px] bg-gray-800 text-gray-300 border border-gray-700 px-1.5 py-0.2 rounded font-mono font-normal">
                    NEUTRO (ASSISTENTE)
                  </span>
                )}
              </h2>
              <p className="text-xs text-[#9AA7B4]">
                Configure nome, wake word de ativação, voz real TTS e estilo de resposta por
                condutor e veículo.
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-400 font-mono">
            Placa vinculada:{' '}
            <strong className="text-cyan-400">{selectedVehicle?.plate || 'PADRÃO'}</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Nome e Wake Word */}
          <div className="space-y-3">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">Nome da Assistente:</label>
              <Input
                value={assistantIdentity.name}
                placeholder="Ex.: Luna, Nina, Sofia, Jarvis..."
                onChange={(e) => {
                  const val = e.target.value
                  setAssistantIdentity((prev) => ({
                    ...prev,
                    name: val,
                    wakeWord:
                      prev.wakeWord === prev.name.toLowerCase() ? val.toLowerCase() : prev.wakeWord,
                    isCustomized: true,
                  }))
                }}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Nome livre exibido na interface ({getAssistantDisplayName(assistantIdentity)}).
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium flex items-center justify-between">
                <span>Wake Word (Palavra de ativação por voz):</span>
                <Mic className="w-3.5 h-3.5 text-[#FFB300]" />
              </label>
              <Input
                value={assistantIdentity.wakeWord}
                placeholder="Ex.: luna, nina, copiloto..."
                onChange={(e) =>
                  setAssistantIdentity((prev) => ({
                    ...prev,
                    wakeWord: e.target.value.toLowerCase(),
                    isCustomized: true,
                  }))
                }
                className="bg-[#0B0F14] border-[#263340] text-white font-mono"
              />
              <span className="text-[10px] text-cyan-400">
                Ex.: &quot;{assistantIdentity.wakeWord || 'luna'}, como está o carro?&quot;
              </span>
            </div>
          </div>

          {/* Voz Real do Dispositivo / Navegador */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[#9AA7B4] font-medium flex items-center space-x-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Voz do Dispositivo (SpeechSynthesis):</span>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={testSpeaking}
                  onClick={handleTestVoice}
                  className="text-[11px] h-6 px-2 border-[#263340] text-cyan-300 hover:text-white"
                >
                  {testSpeaking ? 'Testando...' : 'Testar Voz'}
                </Button>
              </div>

              {availableVoices.length === 0 ? (
                <div className="bg-[#0B0F14] border border-[#263340] rounded p-2 text-[11px] text-gray-400">
                  Nenhuma voz TTS externa detectada no sintetizador. O sistema operacional usará a
                  voz padrão pt-BR instalada.
                </div>
              ) : (
                <select
                  value={assistantIdentity.selectedVoiceUri || ''}
                  onChange={(e) =>
                    setAssistantIdentity((prev) => ({
                      ...prev,
                      selectedVoiceUri: e.target.value || undefined,
                      isCustomized: true,
                    }))
                  }
                  className="w-full bg-[#0B0F14] border border-[#263340] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
                >
                  <option value="">Padrão do Sistema Operacional (Recomendado)</option>
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang}) {v.default ? '— Padrão' : ''}
                    </option>
                  ))}
                </select>
              )}
              <span className="text-[10px] text-gray-500 block mt-1">
                Apenas vozes reais presentes no dispositivo. Independente de nome e estilo.
              </span>
            </div>

            {/* Estilo de Resposta */}
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">Estilo de Resposta:</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { style: 'OBJETIVO', label: 'Objetivo', desc: 'Curto e direto' },
                    { style: 'AMIGAVEL', label: 'Amigável', desc: 'Acolhedor (Danilo)' },
                    { style: 'TECNICO', label: 'Técnico', desc: 'Foco em ECU/sensores' },
                  ] as { style: AssistantStyle; label: string; desc: string }[]
                ).map((item) => (
                  <button
                    key={item.style}
                    type="button"
                    onClick={() =>
                      setAssistantIdentity((prev) => ({
                        ...prev,
                        style: item.style,
                        isCustomized: true,
                      }))
                    }
                    className={`p-2 rounded border text-left transition-all ${
                      assistantIdentity.style === item.style
                        ? 'bg-[#1C2633] border-[#FFB300] text-white'
                        : 'bg-[#0B0F14] border-[#263340] text-gray-400 hover:bg-[#151D28]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-xs text-white">{item.label}</span>
                      {assistantIdentity.style === item.style && (
                        <CheckCircle2 className="w-3 h-3 text-[#FFB300]" />
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400 block">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Atalhos Rápidos */}
        <div className="pt-2 border-t border-[#263340] flex items-center justify-between text-[11px]">
          <span className="text-gray-400">Predefinições de identidade:</span>
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const ninaSaved = saveAssistantIdentity(
                  {
                    name: 'Nina',
                    wakeWord: 'nina',
                    style: 'AMIGAVEL',
                    selectedVoiceUri: undefined,
                  },
                  selectedVehicle?.plate,
                )
                setAssistantIdentity(ninaSaved)
                toast({
                  title: 'Padrão Nina Aplicado',
                  description: 'Configuração utilizada originalmente pelo Danilo restaurada.',
                })
              }}
              className="text-xs h-7 px-2 text-[#FFB300] hover:bg-[#1C2633]"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Padrão Nina (Danilo)
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                const neutro = saveAssistantIdentity(
                  { ...DEFAULT_ASSISTANT_IDENTITY, isCustomized: false },
                  selectedVehicle?.plate,
                )
                setAssistantIdentity(neutro)
                toast({
                  title: 'Denominação Neutra',
                  description: 'Assistente restaurada para a denominação padrão neutra.',
                })
              }}
              className="text-xs h-7 px-2 text-gray-400 hover:text-white hover:bg-[#1C2633]"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Denominação Neutra
            </Button>
          </div>
        </div>
      </div>

      {/* Seletor de Cenário do Simulador (Requisito 8 da OS-ME001-E2) */}
      <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-[#263340] pb-2">
          <Layers className="w-4 h-4 text-[#FFB300]" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Simulador de Testes — Cenários Reproduzíveis (OS-ME001-E2 Requisito 8)
          </h2>
        </div>
        <p className="text-xs text-[#9AA7B4]">
          Escolha o comportamento veicular simulado para validar a Caixa-Preta e a telemetria sem
          veículo físico.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#9AA7B4] mb-1">
              Cenário Ativo do Simulador:
            </label>
            <Select value={activeScenario} onValueChange={(val: any) => setActiveScenario(val)}>
              <SelectTrigger className="bg-[#0B0F14] border-[#263340] text-sm text-white">
                <SelectValue placeholder="Selecione o cenário" />
              </SelectTrigger>
              <SelectContent className="bg-[#131A22] border-[#263340] text-white">
                {SIMULATOR_SCENARIOS.map((sc) => (
                  <SelectItem key={sc.id} value={sc.id}>
                    {sc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] text-xs space-y-1">
            <span className="text-[#FFB300] font-bold block">
              Descrição & Comportamento Esperado:
            </span>
            <p className="text-gray-300">
              {SIMULATOR_SCENARIOS.find((s) => s.id === activeScenario)?.description}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seção 1: Transporte Serial e Bluetooth ELM327 */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#FFB300] font-bold text-sm">
              <Radio className="w-4 h-4" />
              <span>Transporte Físico (ELM327 USB & Bluetooth BLE)</span>
            </div>
            <span className="text-[10px] bg-purple-950/60 border border-purple-800 text-purple-300 px-2 py-0.5 rounded">
              NC-01
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Baud Rate Serial Padrão (bps):
              </label>
              <Input
                type="number"
                value={config.baudRate}
                onChange={(e) => handleChange('baudRate', parseInt(e.target.value) || 38400)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Padrão OBD-II ELM327: 38400 ou 115200
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Porta Serial / Identificador Sugerido:
              </label>
              <Input
                value={config.serialPort}
                onChange={(e) => handleChange('serialPort', e.target.value)}
                placeholder="Ex.: COM3 ou /dev/ttyUSB0"
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Identificador configurável fora do código
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Tentativas Automáticas de Reconexão:
              </label>
              <Input
                type="number"
                value={config.reconnectAttempts}
                onChange={(e) => handleChange('reconnectAttempts', parseInt(e.target.value) || 3)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
            </div>

            {/* Guia técnico de transporte Android/Bluetooth */}
            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-2 mt-2">
              <div className="flex items-center space-x-1.5 text-cyan-400 font-semibold text-[11px]">
                <Bluetooth className="w-3.5 h-3.5" />
                <span>Estratégia Bluetooth Android / Multimídia (NC-01):</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                Navegadores web não suportam diretamente o perfil <em>Bluetooth Clássico SPP</em>{' '}
                (Serial Port Profile) nativamente por limitações de segurança da especificação W3C.
                Para uso em Android e multimídias:
              </p>
              <ul className="list-disc list-inside text-[10px] text-gray-400 space-y-1">
                <li>
                  <strong className="text-white">Opção 1 (Nativa):</strong> Adaptador ELM327 BLE
                  4.0+ (ex.: Vgate iCar Pro BLE4, Veepeak BLE) via Web Bluetooth API.
                </li>
                <li>
                  <strong className="text-white">Opção 2 (Bluetooth Clássico SPP):</strong>{' '}
                  Pareamento no SO Android + cabo USB-OTG ou aplicativo bridge intermediário local
                  WebSocket/Proxy OBD.
                </li>
                <li>
                  <strong className="text-white">Opção 3 (Desktop USB):</strong> Web Serial API no
                  Google Chrome ou MS Edge.
                </li>
              </ul>
              <div className="text-[10px] text-cyan-300 bg-cyan-950/30 p-1.5 rounded border border-cyan-800/40">
                Detecção atual:{' '}
                <strong>{platform.isAndroid ? 'Dispositivo Android' : 'Desktop/Outro'}</strong> |
                Web Serial: <strong>{platform.hasWebSerial ? 'Sim' : 'Não'}</strong> | Web
                Bluetooth: <strong>{platform.hasWebBluetooth ? 'Sim' : 'Não'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Seção 2: Frequências de Coleta */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 text-[#2ECC71] font-bold text-sm">
            <Activity className="w-4 h-4" />
            <span>Frequências de Coleta (Scheduler)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Frequência Prioritária Alvo (Hz):
              </label>
              <Input
                type="number"
                value={config.priorityFreqHz}
                onChange={(e) => handleChange('priorityFreqHz', parseFloat(e.target.value) || 5)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF03: ≥5 Hz para RPM, Velocidade, Temp, Carga e TPS
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Frequência Secundária Alvo (Hz):
              </label>
              <Input
                type="number"
                value={config.secondaryFreqHz}
                onChange={(e) => handleChange('secondaryFreqHz', parseFloat(e.target.value) || 1)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF03: ≥1 Hz para os demais PIDs
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Intervalo de Varredura DTC Periódica (ms):
              </label>
              <Input
                type="number"
                value={config.dtcIntervalMs}
                onChange={(e) => handleChange('dtcIntervalMs', parseInt(e.target.value) || 60000)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Varredura de Modo 03/07 sem emitir Modo 04
              </span>
            </div>
          </div>
        </div>

        {/* Seção 3: Parâmetros da Caixa-Preta e Persistência Offline */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#E53935] font-bold text-sm">
              <Clock className="w-4 h-4" />
              <span>Janelas da Caixa-Preta & Persistência (NC-02/NC-03)</span>
            </div>
            <span className="text-[10px] bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded">
              IndexedDB Ativo
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Janela Pré-Evento (ms):
              </label>
              <Input
                type="number"
                value={config.windowPreMs}
                onChange={(e) => handleChange('windowPreMs', parseInt(e.target.value) || 30000)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF06: Padrão 30.000 ms (30 segundos anteriores)
              </span>
            </div>

            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Janela Pós-Evento (ms):
              </label>
              <Input
                type="number"
                value={config.windowPostMs}
                onChange={(e) => handleChange('windowPostMs', parseInt(e.target.value) || 30000)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Exigência RF06: Padrão 30.000 ms (30 segundos posteriores)
              </span>
            </div>

            <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340] flex items-start space-x-2">
              <Database className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-[11px] text-gray-300 space-y-1">
                <span className="font-semibold text-white">
                  Persistência Offline Verdadeira (NC-02/NC-03):
                </span>
                <p className="text-gray-400">
                  Amostras são gravadas de forma append-only no IndexedDB do navegador antes do
                  envio ao PocketBase. Em caso de queda de rede ou encerramento da aba, os dados são
                  preservados e reidratados automaticamente na reabertura.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Seção 4: Parâmetros do Simulador Veicular */}
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-sm">
            <Cpu className="w-4 h-4" />
            <span>Parâmetros Dinâmicos do Simulador</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#9AA7B4] mb-1 font-medium">
                Veículo Inicial de Validação (Metadado):
              </label>
              <Input
                value={config.defaultVehicleName}
                onChange={(e) => handleChange('defaultVehicleName', e.target.value)}
                className="bg-[#0B0F14] border-[#263340] text-white"
              />
              <span className="text-[10px] text-gray-500">
                Metadado injetável, nunca hardcoded no núcleo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">RPM Marcha Lenta:</label>
                <Input
                  type="number"
                  value={config.simulatorIdleRpm}
                  onChange={(e) =>
                    handleChange('simulatorIdleRpm', parseInt(e.target.value) || 850)
                  }
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
              <div>
                <label className="block text-[#9AA7B4] mb-1 font-medium">RPM Cruzeiro:</label>
                <Input
                  type="number"
                  value={config.simulatorCruiseRpm}
                  onChange={(e) =>
                    handleChange('simulatorCruiseRpm', parseInt(e.target.value) || 2100)
                  }
                  className="bg-[#0B0F14] border-[#263340] text-white"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Seção 5: Sobre a Aplicação & Informações de Versão */}
      <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#263340] pb-3">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5 text-[#FFB300]" />
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <span>Sobre o App & Versão do Sistema</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                  v{APP_VERSION}
                </span>
              </h2>
              <p className="text-xs text-[#9AA7B4]">
                Identificação e proveniência do build instalado (sincronizado com package.json e
                APK).
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-1">
            <span className="text-[#9AA7B4] text-[11px] block font-medium">Versão Oficial:</span>
            <div className="font-mono text-base font-bold text-[#FFB300]">v{APP_VERSION}</div>
            <span className="text-[10px] text-gray-400">Fonte: package.json</span>
          </div>

          <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-1">
            <span className="text-[#9AA7B4] text-[11px] block font-medium">
              Canal de Homologação:
            </span>
            <div className="font-mono text-sm font-bold text-white">
              {APP_HOMOLOGATION_CODENAME}
            </div>
            <span className="text-[10px] text-cyan-400">Hardware & Telemetria</span>
          </div>

          <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-1">
            <span className="text-[#9AA7B4] text-[11px] block font-medium">
              Ambiente em Execução:
            </span>
            <div className="font-mono text-sm font-bold text-emerald-400">
              {platform.isAndroid ? 'Android (Container / APK)' : 'Navegador Web / Desktop'}
            </div>
            <span className="text-[10px] text-gray-400">
              {platform.hasWebBluetooth ? 'BT BLE OK' : 'Sem BLE Direto'} •{' '}
              {platform.hasWebSerial ? 'Serial OK' : 'Sem Serial Direto'}
            </span>
          </div>
        </div>

        <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] text-[11px] text-gray-300 flex items-start space-x-2">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white">
              Como verificar se seu APK está atualizado:
            </span>
            <p className="text-gray-400">
              Se esta tela ou o rodapé do menu lateral exibir qualquer versão anterior a{' '}
              <strong className="text-white font-mono">v{APP_VERSION}</strong> (como a antiga
              0.0.21), o dispositivo está executando um build defasado. Baixe o artefato mais
              recente no GitHub Actions nomeado com a versão correspondente.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
