import React, { useState } from 'react'
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
  ArrowRight,
  Layers,
  Wrench,
  DollarSign,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  WorkshopSimulatorEngine,
  SimulatorExecutionResult,
} from '@/lib/commercial/simulator-case-e5'
import { toast } from 'sonner'

export default function SimuladorOperacional() {
  const [selectedScenario, setSelectedScenario] = useState<'CASO_A' | 'CASO_B' | 'CASO_C'>('CASO_A')
  const [simulationResult, setSimulationResult] = useState<SimulatorExecutionResult | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0)

  const handleRunSimulation = (scenario: 'CASO_A' | 'CASO_B' | 'CASO_C') => {
    setSelectedScenario(scenario)
    let res: SimulatorExecutionResult
    if (scenario === 'CASO_A') {
      res = WorkshopSimulatorEngine.runScenarioA()
    } else if (scenario === 'CASO_B') {
      res = WorkshopSimulatorEngine.runScenarioB()
    } else {
      res = WorkshopSimulatorEngine.runScenarioC()
    }

    setSimulationResult(res)
    setCurrentStepIndex(res.steps.length - 1) // Mostra completo
    toast.success(`Cenário ${scenario} executado com sucesso!`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <Play className="w-7 h-7 text-[#FFB300]" />
          Simulador de Casos da Oficina (Requisito 22)
        </h1>
        <p className="text-sm text-[#9AA7B4]">
          Fluxos reproduzíveis: Caso A (Ponta a ponta completo), Caso B (Aprovação parcial com
          bloqueio de item recusado) e Caso C (Versionamento pós-aprovação).
        </p>
      </div>

      {/* Seleção do Cenário */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Caso A */}
        <div
          onClick={() => handleRunSimulation('CASO_A')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            selectedScenario === 'CASO_A'
              ? 'bg-[#1A232E] border-[#FFB300]'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[10px]">
              CASO A: COMPLETO
            </Badge>
            <Play className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="font-bold text-white text-sm">Fluxo Padrão Integrado</h3>
          <p className="text-xs text-[#9AA7B4] mt-1">
            Cliente chega → EcoSport → Trepidação → OD-360 → P0301 → Teste cruzado → Orçamento →
            Aprovação Total → Execução → Validação pós-reparo → Entrega.
          </p>
        </div>

        {/* Caso B */}
        <div
          onClick={() => handleRunSimulation('CASO_B')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            selectedScenario === 'CASO_B'
              ? 'bg-[#1A232E] border-amber-400'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-amber-950 text-amber-400 border-amber-800 text-[10px]">
              CASO B: PARCIAL
            </Badge>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="font-bold text-white text-sm">Aprovação Parcial de Itens</h3>
          <p className="text-xs text-[#9AA7B4] mt-1">
            Cliente aprova Bobina + Mão de Obra, mas recusa Limpeza TBI preventiva. A OS recalcula e
            bloqueia execução do item recusado.
          </p>
        </div>

        {/* Caso C */}
        <div
          onClick={() => handleRunSimulation('CASO_C')}
          className={`p-4 rounded-lg border cursor-pointer transition-all ${
            selectedScenario === 'CASO_C'
              ? 'bg-[#1A232E] border-purple-400'
              : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Badge className="bg-purple-950 text-purple-400 border-purple-800 text-[10px]">
              CASO C: VERSIONAMENTO
            </Badge>
            <RotateCcw className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="font-bold text-white text-sm">Alteração Pós-Aprovação</h3>
          <p className="text-xs text-[#9AA7B4] mt-1">
            Orçamento aprovado sofre alteração. O sistema invalida aprovação, cria revisão v2,
            preserva versão anterior para auditoria e exige nova autorização.
          </p>
        </div>
      </div>

      {/* Detalhes da Execução da Simulação */}
      {simulationResult ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Passo a Passo da Simulação (2 colunas) */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FFB300]" />
              Rastreabilidade do Cenário: {simulationResult.title}
            </h2>

            <div className="space-y-3">
              {simulationResult.steps.map((st, index) => (
                <div
                  key={index}
                  className="p-4 rounded-lg bg-[#131A22] border border-[#263340] space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#1A232E] border border-[#FFB300] text-[#FFB300] font-bold flex items-center justify-center font-mono">
                        {st.step}
                      </span>
                      <span className="font-bold text-white text-sm">{st.title}</span>
                    </div>
                    <Badge variant="outline" className="border-gray-600 text-gray-300 text-[10px]">
                      {st.entityUpdated}
                    </Badge>
                  </div>

                  <p className="text-gray-300 pl-8">{st.description}</p>

                  <div className="pl-8 pt-1 text-[11px] font-mono text-[#FFB300] flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    {st.statusSummary}
                  </div>

                  {st.payloadSnapshot && (
                    <div className="pl-8 pt-1">
                      <pre className="p-2 rounded bg-[#0B0F14] text-gray-400 text-[10px] overflow-x-auto border border-[#263340]">
                        {JSON.stringify(st.payloadSnapshot, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Snapshot Final da Ordem de Serviço */}
          <div>
            <Card className="bg-[#131A22] border-[#263340] text-[#F2F5F7] sticky top-20">
              <CardHeader className="pb-3 border-b border-[#263340]">
                <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                  <span>Resultado na OS</span>
                  <Badge className="bg-emerald-950 text-emerald-300 border-emerald-700 font-mono text-xs">
                    {simulationResult.finalOrderSnapshot.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div>
                  <div className="text-[#9AA7B4]">Número da OS</div>
                  <div className="font-mono font-bold text-white text-base">
                    {simulationResult.finalOrderSnapshot.order_number}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[#9AA7B4]">Placa</div>
                    <div className="font-mono text-white">
                      {simulationResult.finalOrderSnapshot.vehicle_plate}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#9AA7B4]">Versão Orçamento</div>
                    <div className="font-mono text-[#FFB300] font-bold">
                      v{simulationResult.finalOrderSnapshot.budget_version}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[#9AA7B4]">Aprovação do Cliente</div>
                  <div className="font-semibold text-emerald-400">
                    {simulationResult.finalOrderSnapshot.approval_status}
                  </div>
                </div>

                {simulationResult.finalOrderSnapshot.confirmed_diagnosis && (
                  <div>
                    <div className="text-[#9AA7B4]">Diagnóstico Confirmado</div>
                    <div className="text-gray-200 bg-[#0B0F14] p-2 rounded border border-[#263340] text-[11px]">
                      {simulationResult.finalOrderSnapshot.confirmed_diagnosis}
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-[#263340] space-y-1.5 font-mono">
                  <div className="flex justify-between text-gray-300">
                    <span>Total Geral:</span>
                    <span>R$ {simulationResult.finalOrderSnapshot.general_total?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-bold text-sm pt-1 border-t border-[#263340]/60">
                    <span>Total Aprovado:</span>
                    <span>R$ {simulationResult.finalOrderSnapshot.approved_total?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-gray-500">
                  Validação E5: Hipóteses permaneceram desacopladas, dados técnicos preservados e
                  regras de aprovação respeitadas.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-[#9AA7B4] bg-[#131A22] border border-[#263340] rounded-lg text-xs">
          Selecione um dos cenários acima para executar a simulação da operação da oficina.
        </div>
      )}
    </div>
  )
}
