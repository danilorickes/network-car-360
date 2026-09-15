import React, { useState, useEffect } from 'react'
import {
  Car,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Bot,
  Compass,
  Sparkles,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { SimulatedTransport } from '@/lib/obd/transports/simulated-transport'

interface DriveSimulationStep {
  id: string
  title: string
  context: string
  speedKmh: number
  rpm: number
  coolantTemp: number
  stft: number
  description: string
  anomalyExpected?: string
  safetyExpected: 'NORMAL' | 'ATENCAO' | 'CRITICO'
}

const SIMULATOR_DRIVE_SCENARIO_ANOMALY: DriveSimulationStep[] = [
  {
    id: 's1',
    title: '1. Saída de Casa / Cidade',
    context: 'TRANSITO_URBANO',
    speedKmh: 35,
    rpm: 1800,
    coolantTemp: 75,
    stft: 2.0,
    description: 'Veículo em percurso urbano com trocas de marchas normais.',
    safetyExpected: 'NORMAL',
  },
  {
    id: 's2',
    title: '2. Parada em Semáforo',
    context: 'MARCHA_LENTA_QUENTE',
    speedKmh: 0,
    rpm: 780,
    coolantTemp: 88,
    stft: 1.5,
    description: 'Marcha lenta estabilizada característica do motor.',
    safetyExpected: 'NORMAL',
  },
  {
    id: 's3',
    title: '3. Acesso à Rodovia / Aceleração',
    context: 'ACELERACAO',
    speedKmh: 75,
    rpm: 2900,
    coolantTemp: 90,
    stft: 3.5,
    description: 'Entrando na rodovia em velocidade de fluxo.',
    safetyExpected: 'NORMAL',
  },
  {
    id: 's4',
    title: '4. Velocidade de Cruzeiro na Estrada',
    context: 'ESTRADA',
    speedKmh: 100,
    rpm: 2400,
    coolantTemp: 91,
    stft: 1.8,
    description: 'Viagem estabilizada a 100 km/h.',
    safetyExpected: 'NORMAL',
  },
  {
    id: 's5',
    title: '5. Ocorrência de Anomalia Térmica (Subida de Serra)',
    context: 'CARGA_ELEVADA',
    speedKmh: 85,
    rpm: 3200,
    coolantTemp: 112,
    stft: 14.5,
    description: 'Termostato trava parcialmente ou ventoinha falha. Temperatura sobe para 112 °C.',
    anomalyExpected: 'Superaquecimento Crítico (ECT >= 110 °C)',
    safetyExpected: 'CRITICO',
  },
  {
    id: 's6',
    title: '6. Detecção da Caixa-Preta & Alerta da Nina',
    context: 'DESACELERACAO',
    speedKmh: 40,
    rpm: 1400,
    coolantTemp: 110,
    stft: 8.0,
    description:
      'Caixa-Preta dispara automaticamente. O monitor de segurança prioritário alerta o motorista.',
    safetyExpected: 'CRITICO',
  },
  {
    id: 's7',
    title: '7. Parada Segura no Acostamento & Resumo',
    context: 'PARADA_PROLONGADA',
    speedKmh: 0,
    rpm: 0,
    coolantTemp: 102,
    stft: 0,
    description: 'Veículo imobilizado com segurança. Nina exibe relatório de viagem e diagnóstico.',
    safetyExpected: 'NORMAL',
  },
]

const SIMULATOR_DRIVE_SCENARIO_NORMAL: DriveSimulationStep[] = [
  {
    id: 'n1',
    title: '1. Saída e Cidade',
    context: 'TRANSITO_URBANO',
    speedKmh: 40,
    rpm: 1900,
    coolantTemp: 82,
    stft: 1.0,
    description: 'Deslocamento urbano normal.',
    safetyExpected: 'NORMAL',
  },
  {
    id: 'n2',
    title: '2. Rodovia Estabilizada',
    context: 'ESTRADA',
    speedKmh: 95,
    rpm: 2300,
    coolantTemp: 89,
    stft: 0.5,
    description: 'Cruzeiro contínuo sem variações anormais.',
    safetyExpected: 'NORMAL',
  },
  {
    id: 'n3',
    title: '3. Chegada e Destino',
    context: 'MARCHA_LENTA_QUENTE',
    speedKmh: 0,
    rpm: 800,
    coolantTemp: 90,
    stft: 0.0,
    description: 'Viagem finalizada com êxito sem falsos alarmes.',
    safetyExpected: 'NORMAL',
  },
]

export const SimuladorDrive: React.FC = () => {
  const { toast } = useToast()
  const [selectedScenarioType, setSelectedScenarioType] = useState<'ANOMALIA' | 'NORMAL'>(
    'ANOMALIA',
  )
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [blackBoxTriggered, setBlackBoxTriggered] = useState(false)
  const [ninaLog, setNinaLog] = useState<string[]>([])

  const currentScenario =
    selectedScenarioType === 'ANOMALIA'
      ? SIMULATOR_DRIVE_SCENARIO_ANOMALY
      : SIMULATOR_DRIVE_SCENARIO_NORMAL

  const activeStep = currentScenario[currentStepIndex]

  useEffect(() => {
    let timer: any = null
    if (isPlaying) {
      timer = setInterval(() => {
        setCurrentStepIndex((prev) => {
          if (prev < currentScenario.length - 1) {
            const nextIdx = prev + 1
            const nextStep = currentScenario[nextIdx]

            // Se for passo de anomalia, ativa Caixa-Preta automática
            if (nextStep.safetyExpected === 'CRITICO') {
              setBlackBoxTriggered(true)
              setNinaLog((old) => [
                ...old,
                `[AUTO CAIXA-PRETA]: Anomalia detectada (${nextStep.anomalyExpected}). Pacote gerado com dados RAW imutáveis.`,
                `[NINA COPILOTO]: "Atenção motorista! Temperatura excessiva de ${nextStep.coolantTemp} °C detectada. Recomendo parar com segurança no acostamento."`,
              ])
            }
            return nextIdx
          } else {
            setIsPlaying(false)
            toast({
              title: 'Cenário de Condução Concluído',
              description: 'Resumo da viagem e métricas finais prontas para análise.',
            })
            return prev
          }
        })
      }, 3500)
    }
    return () => clearInterval(timer)
  }, [isPlaying, currentScenario, toast])

  const handleReset = () => {
    setIsPlaying(false)
    setCurrentStepIndex(0)
    setBlackBoxTriggered(false)
    setNinaLog([])
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 text-[#F2F5F7]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263340]">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Simulador Drive — Condução & Viagem
            </h1>
            <span className="text-xs bg-blue-950 text-blue-400 border border-blue-700 px-2 py-0.5 rounded font-mono font-bold">
              OS-ME001-E6 SIMULATOR
            </span>
          </div>
          <p className="text-xs text-[#9AA7B4] mt-1">
            Simula a jornada automotiva completa: Cidade → Estrada → Anomalia → Caixa-Preta
            Automática → Nina Explica → Encerramento.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={() => {
              handleReset()
              setSelectedScenarioType(selectedScenarioType === 'ANOMALIA' ? 'NORMAL' : 'ANOMALIA')
            }}
            variant="outline"
            className="border-[#263340] text-gray-300 hover:text-white text-xs"
          >
            Cenário: {selectedScenarioType === 'ANOMALIA' ? 'Com Anomalia' : 'Viagem 100% Normal'}
          </Button>

          <Button
            size="sm"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`text-xs font-bold ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-[#2ECC71] hover:bg-[#27ae60] text-black'
            }`}
          >
            {isPlaying ? 'Pausar Simulação' : 'Executar Simulação'}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleReset}
            className="text-gray-400 hover:text-white p-2"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Grid Principal do Simulador */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel do Veículo Virtual em Movimento */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFB300] uppercase tracking-wider">
                Etapa {currentStepIndex + 1} de {currentScenario.length}
              </span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                  activeStep.safetyExpected === 'CRITICO'
                    ? 'bg-red-950 text-red-400 border-red-700 animate-pulse'
                    : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                }`}
              >
                {activeStep.safetyExpected === 'CRITICO' ? 'ALERTA CRÍTICO' : 'NORMAL'}
              </span>
            </div>

            <div className="text-xl font-bold text-white">{activeStep.title}</div>
            <p className="text-xs text-gray-300">{activeStep.description}</p>

            {/* Mostradores da Condução */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37]">
                <span className="text-[10px] text-gray-400 block">Velocidade</span>
                <span className="text-3xl font-black font-mono text-cyan-400">
                  {activeStep.speedKmh}
                </span>
                <span className="text-[10px] text-gray-400 font-bold block">km/h</span>
              </div>

              <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37]">
                <span className="text-[10px] text-gray-400 block">RPM Motor</span>
                <span className="text-3xl font-black font-mono text-white">{activeStep.rpm}</span>
                <span className="text-[10px] text-gray-400 font-bold block">RPM</span>
              </div>

              <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37]">
                <span className="text-[10px] text-gray-400 block">ECT Arrefecimento</span>
                <span
                  className={`text-3xl font-black font-mono ${
                    activeStep.coolantTemp >= 110 ? 'text-red-400' : 'text-[#FFB300]'
                  }`}
                >
                  {activeStep.coolantTemp}
                </span>
                <span className="text-[10px] text-gray-400 font-bold block">°C</span>
              </div>

              <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37]">
                <span className="text-[10px] text-gray-400 block">Ajuste STFT</span>
                <span className="text-3xl font-black font-mono text-emerald-400">
                  {activeStep.stft}%
                </span>
                <span className="text-[10px] text-gray-400 font-bold block">Trim</span>
              </div>
            </div>

            {/* Aviso de Caixa-Preta Automática */}
            {blackBoxTriggered && (
              <div className="bg-red-950/70 border border-red-700 p-3.5 rounded-lg text-xs text-red-200 flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white block">
                    CAIXA-PRETA AUTOMÁTICA DISPARADA:
                  </span>
                  <p className="text-[11px] text-red-200">
                    O sistema capturou automaticamente o período pré-evento, momento do sintoma e
                    pós-evento com dados brutos imutáveis e contexto do motor.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Painel Nina Copiloto & Diagnóstico Integrado */}
        <div className="space-y-4">
          <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Bot className="w-4 h-4 text-[#FFB300]" />
              <span>Intervenção Nina Copiloto</span>
            </h3>

            <div className="bg-[#0B0F14] p-3 rounded-lg border border-[#202B37] min-h-[220px] text-xs space-y-2 font-mono">
              {ninaLog.length === 0 ? (
                <div className="text-gray-500 text-center py-12 text-[11px]">
                  Aguardando eventos da condução...
                </div>
              ) : (
                ninaLog.map((log, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded ${
                      log.includes('CRÍTICO') || log.includes('Anomalia')
                        ? 'bg-red-950/60 text-red-200 border border-red-800'
                        : 'bg-[#1A232E] text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#121A24] border border-[#202B37] rounded-xl p-4 text-xs text-gray-300 space-y-2">
            <span className="font-bold text-white block">Regra de Validação NC-06:</span>
            <p className="text-gray-400 leading-relaxed">
              No cenário &quot;Viagem Normal&quot;, o sistema NÃO PODE gerar falso positivo ou
              diagnóstico precipitado. Apenas anomalias com sustentação estatística dispararão
              eventos de segurança.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
