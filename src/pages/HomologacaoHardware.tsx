import React, { useState, useEffect } from 'react'
import {
  Car,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  RotateCcw,
  FileText,
  ShieldAlert,
  Cpu,
  Layers,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { ECOSPORT_2020_HOMOLOGATION_PROFILE } from '@/lib/obd/ecosport-profile'
import { EcoSportValidationStep } from '@/types/etapa6'
import { useTelemetry } from '@/contexts/TelemetryContext'

export const HomologacaoHardware: React.FC = () => {
  const { toast } = useToast()
  const { telemetry } = useTelemetry()
  const [profile, setProfile] = useState(ECOSPORT_2020_HOMOLOGATION_PROFILE)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [reportGenerated, setReportGenerated] = useState<any | null>(null)

  const activeStep = profile.steps[currentStepIndex]

  const handleApproveStep = (stepId: string) => {
    setProfile((prev) => ({
      ...prev,
      steps: prev.steps.map((st) =>
        st.id === stepId
          ? {
              ...st,
              status: 'APROVADO',
              measuredData: {
                rpm: telemetry.currentValues['0x0C']?.decoded || 0,
                speed: telemetry.currentValues['0x0D']?.decoded || 0,
                coolant: telemetry.currentValues['0x05']?.decoded || 85,
                timestamp: new Date().toISOString(),
              },
            }
          : st,
      ),
    }))

    if (currentStepIndex < profile.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1)
    }

    toast({
      title: 'Etapa Validada',
      description: `Etapa "${activeStep.title}" validada no checklist físico.`,
    })
  }

  const handleFailStep = (stepId: string) => {
    setProfile((prev) => ({
      ...prev,
      steps: prev.steps.map((st) => (st.id === stepId ? { ...st, status: 'REPROVADO' } : st)),
    }))
    toast({
      title: 'Etapa Reprovada',
      description: 'Critério de homologação não atendido.',
      variant: 'destructive',
    })
  }

  const handleGenerateReport = () => {
    const approvedCount = profile.steps.filter((s) => s.status === 'APROVADO').length
    const rep = {
      profileId: profile.profileId,
      vehicle: profile.vehicleName,
      engine: profile.engineType,
      protocol: profile.protocolExpected,
      generatedAt: new Date().toISOString(),
      testedSteps: profile.steps,
      approvedCount,
      totalSteps: profile.steps.length,
      overallConclusion:
        approvedCount === profile.steps.length
          ? 'HOMOLOGADO EM CAMPO — COMPATIBILIDADE CONFIRMADA'
          : 'E6.6 — NÃO HOMOLOGADA EM HARDWARE REAL',
      hardwareNotice:
        'Nenhum hardware ou veículo é homologado pelo software sem teste físico completo com motor em funcionamento.',
    }
    setReportGenerated(rep)
    toast({
      title: 'Relatório de Homologação Gerado',
      description: `Status: ${rep.overallConclusion}`,
    })
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6 text-[#F2F5F7]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#263340]">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Homologação de Hardware OBD Real
            </h1>
            <span className="text-xs bg-red-950/60 text-red-300 border border-red-800 px-2 py-0.5 rounded font-mono font-bold">
              E6.6 — NÃO HOMOLOGADA EM HARDWARE REAL
            </span>
          </div>
          <p className="text-xs text-[#9AA7B4] mt-1">
            Roteiro guiado de campo e homologação do primeiro veículo piloto: Ford EcoSport 2020 1.5
            Dragon 3 Cilindros.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            onClick={handleGenerateReport}
            className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-semibold text-xs"
          >
            <FileText className="w-4 h-4 mr-1.5" />
            Gerar Relatório de Homologação
          </Button>
        </div>
      </div>

      {/* Regra de Ouro da Homologação */}
      <div className="bg-amber-950/40 border border-amber-800/80 p-3.5 rounded-lg text-xs text-amber-200 flex items-start space-x-3">
        <ShieldAlert className="w-5 h-5 text-[#FFB300] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-white block mb-0.5">
            Princípio de Homologação NC-01 / OS-ME001-E6:
          </span>
          <p className="text-amber-200/90 leading-relaxed">
            Nenhum hardware (adaptador ELM327, BLE, USB ou multimídia) pode ser marcado como
            &quot;COMPATÍVEL&quot; sem a execução física completa deste checklist guiado no veículo
            real. Testes em simulador validam a arquitetura de software, mas não substituem o teste
            de bancada e campo.
          </p>
        </div>
      </div>

      {/* Grid Principal: Checklist Guiado à Esquerda, Telemetria e Status à Direita */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Passos do Checklist Guiado */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#FFB300]" />
            <span>Roteiro de 9 Etapas de Validação de Campo:</span>
          </h2>

          <div className="space-y-2">
            {profile.steps.map((step, idx) => {
              const isCurrent = idx === currentStepIndex
              return (
                <div
                  key={step.id}
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`p-4 rounded-lg border transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#1A232E] border-[#FFB300] shadow-md ring-1 ring-[#FFB300]/40'
                      : step.status === 'APROVADO'
                        ? 'bg-[#0B0F14] border-emerald-800/60 text-gray-300'
                        : step.status === 'REPROVADO'
                          ? 'bg-[#0B0F14] border-red-800/60 text-gray-300'
                          : 'bg-[#131A22] border-[#263340] text-gray-400 hover:bg-[#1A232E]/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center space-x-2">
                      <span>{step.title}</span>
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                        step.status === 'APROVADO'
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-700'
                          : step.status === 'REPROVADO'
                            ? 'bg-red-950 text-red-400 border-red-700'
                            : 'bg-[#0B0F14] text-gray-400 border-[#263340]'
                      }`}
                    >
                      {step.status}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 mt-1">{step.description}</p>

                  <div className="mt-2 text-[11px] text-gray-400 bg-[#0B0F14] p-2 rounded border border-[#263340]/60 space-y-1">
                    <div>
                      <strong className="text-[#FFB300]">Alvo:</strong> {step.targetState}
                    </div>
                    <div>
                      <strong className="text-cyan-400">Critério:</strong> {step.validationCriteria}
                    </div>
                    {step.measuredData && (
                      <div className="text-emerald-400 font-mono mt-1 pt-1 border-t border-[#263340]">
                        ✓ Medido: RPM {step.measuredData.rpm} | Speed {step.measuredData.speed} km/h
                        | ECT {step.measuredData.coolant} °C
                      </div>
                    )}
                  </div>

                  {isCurrent && (
                    <div className="flex items-center justify-end space-x-2 mt-3 pt-2 border-t border-[#263340]">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleFailStep(step.id)
                        }}
                        className="border-red-800 text-red-400 hover:bg-red-950 text-xs h-7"
                      >
                        Reprovar Etapa
                      </Button>
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleApproveStep(step.id)
                        }}
                        className="bg-[#2ECC71] hover:bg-[#27ae60] text-black font-bold text-xs h-7"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Validar & Avançar
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Painel Lateral: Perfil do EcoSport e Telemetria em Tempo Real */}
        <div className="space-y-4">
          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Car className="w-4 h-4 text-[#FFB300]" />
              <span>Perfil do Veículo de Validação</span>
            </h3>
            <div className="text-xs space-y-1.5 font-mono text-gray-300">
              <div>
                Veículo: <strong className="text-white">{profile.vehicleName}</strong>
              </div>
              <div>
                Motorização: <span className="text-[#FFB300]">{profile.engineType}</span>
              </div>
              <div>
                Protocolo: <span className="text-cyan-400">{profile.protocolExpected}</span>
              </div>
              <div>
                Tomada OBD: <span>Padrão SAE J1962 (sob a coluna de direção)</span>
              </div>
              <div>
                Conexão Atual: <span className="text-white">{telemetry.transportType}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span>Telemetria em Tempo Real</span>
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0B0F14] p-2 rounded border border-[#263340]">
                <span className="text-gray-400 block text-[10px]">RPM do Motor</span>
                <span className="text-lg font-bold font-mono text-white">
                  {telemetry.currentValues['0x0C']?.decoded || 0}
                </span>
              </div>
              <div className="bg-[#0B0F14] p-2 rounded border border-[#263340]">
                <span className="text-gray-400 block text-[10px]">Velocidade</span>
                <span className="text-lg font-bold font-mono text-cyan-400">
                  {telemetry.currentValues['0x0D']?.decoded || 0} km/h
                </span>
              </div>
              <div className="bg-[#0B0F14] p-2 rounded border border-[#263340]">
                <span className="text-gray-400 block text-[10px]">Arrefecimento (ECT)</span>
                <span className="text-lg font-bold font-mono text-[#FFB300]">
                  {telemetry.currentValues['0x05']?.decoded || '--'} °C
                </span>
              </div>
              <div className="bg-[#0B0F14] p-2 rounded border border-[#263340]">
                <span className="text-gray-400 block text-[10px]">Ajuste STFT</span>
                <span className="text-lg font-bold font-mono text-emerald-400">
                  {telemetry.currentValues['0x06']?.decoded || 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Relatório Gerado (Visualização Compacta) */}
          {reportGenerated && (
            <div className="bg-[#0B0F14] border border-emerald-800 rounded-lg p-4 space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Relatório Oficial Emitido</span>
              </div>
              <div className="font-mono text-gray-300 text-[11px] space-y-1">
                <div>
                  Conclusão: <strong>{reportGenerated.overallConclusion}</strong>
                </div>
                <div>
                  Progresso: {reportGenerated.approvedCount} de {reportGenerated.totalSteps} etapas
                  validadas
                </div>
                <div>Emissão: {new Date(reportGenerated.generatedAt).toLocaleString('pt-BR')}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
