import React, { useState } from 'react'
import {
  DiagnosticInvestigationModel,
  InvestigationHypothesisNode,
  ExecutedConfirmationTest,
  RepairIntervention,
  PostRepairValidation,
  TimelineEntry,
  ConfirmationTestStatus,
  HypothesisInvestigationStatus,
} from '@/types/investigation'
import { MultifourceConfidenceEngine } from '@/lib/diagnostic/multifource-confidence-engine'
import { VehicleHistoryComparison } from '@/types/investigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  FileText,
  UserCheck,
  Wrench,
  Search,
  Activity,
  History,
  GitCommit,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Printer,
  Sparkles,
  Layers,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ArrowDownUp,
  XCircle,
  HelpCircle,
  Car,
  ChevronRight,
  PlusCircle,
  RotateCcw,
} from 'lucide-react'

interface Diagnostic360InvestigationViewProps {
  investigation: DiagnosticInvestigationModel
  historyComparison?: VehicleHistoryComparison | null
  onSaveInvestigation: (updated: DiagnosticInvestigationModel) => Promise<void>
  onPrintReport: () => void
}

export const Diagnostic360InvestigationView: React.FC<Diagnostic360InvestigationViewProps> = ({
  investigation,
  historyComparison,
  onSaveInvestigation,
  onPrintReport,
}) => {
  const { toast } = useToast()
  const [data, setData] = useState<DiagnosticInvestigationModel>(investigation)
  const [activeTab, setActiveTab] = useState<
    'complaint_eval' | 'tree_and_tests' | 'history_comparison' | 'intervention_retest' | 'timeline'
  >('tree_and_tests')

  // Estado para executar teste de confirmação
  const [selectedHypothesisNodeId, setSelectedHypothesisNodeId] = useState<string>(
    data.hypotheses_tree[0]?.hypothesis.id || '',
  )
  const [testResponsible, setTestResponsible] = useState<string>('Theo (Diagnosta)')
  const [testStatus, setTestStatus] = useState<ConfirmationTestStatus>('POSITIVO')
  const [testMeasuredVal, setTestMeasuredVal] = useState<string>('P0302 no cil 2')
  const [testObservation, setTestObservation] = useState<string>(
    'Após troca das bobinas 1 e 2, a falha de ignição migrou para o cilindro 2 (DTC P0302). Evidência definitiva de bobina 1 avariada.',
  )

  // Estado para confirmação de defeito / reparo
  const [confirmCriteria, setConfirmCriteria] = useState<string>(
    'Migração da falha de P0301 para P0302 após troca cruzada física 1↔2, comprovando falha interna de isolamento na bobina original do cil 1.',
  )

  // Estado para intervenção
  const [interventionPart, setInterventionPart] = useState<string>(
    'Bobina de ignição individual (Cilindro 1) substituída por nova original',
  )
  const [retestOutcome, setRetestOutcome] = useState<
    'FALHA_NAO_REPRODUZIDA' | 'FALHA_PERMANECE' | 'RESULTADO_INCONCLUSIVO'
  >('FALHA_NAO_REPRODUZIDA')

  const activeNode =
    data.hypotheses_tree.find((n) => n.hypothesis.id === selectedHypothesisNodeId) ||
    data.hypotheses_tree[0]

  // Ação: Registrar Resultado de Teste de Confirmação (Req 7, 8)
  const handleApplyTestResult = async () => {
    if (!activeNode) return

    const newTest: ExecutedConfirmationTest = {
      id: `test_${Date.now()}`,
      testCode: `TEST-${Math.floor(100 + Math.random() * 900)}`,
      title: activeNode.hypothesis.confirmationProtocol.title,
      targetHypothesisId: activeNode.hypothesis.id,
      targetComponent:
        activeNode.hypothesis.confirmationProtocol.steps[0]?.targetComponent || 'Componente',
      status: testStatus,
      responsible: testResponsible,
      measuredValue: testMeasuredVal,
      measuredUnit: 'DTC / Aferição',
      observation: testObservation,
      executedAtUtc: new Date().toISOString(),
    }

    const updatedNode = MultifourceConfidenceEngine.recalculateAfterTest({
      node: activeNode,
      test: newTest,
    })

    const updatedTree = data.hypotheses_tree.map((n) =>
      n.hypothesis.id === updatedNode.hypothesis.id ? updatedNode : n,
    )

    const updatedTestsLog = [...data.tests_log, newTest]

    // Adiciona evento na Timeline
    const newTimelineEntry: TimelineEntry = {
      id: `tl_${Date.now()}`,
      timestampUtc: new Date().toISOString(),
      category: 'TESTE_CONFIRMACAO',
      title: `Teste Realizado: ${newTest.title}`,
      description: `Resultado [${newTest.status}]: ${newTest.observation || 'Sem observações'}. Confiança recalculada para ${updatedNode.currentConfidence}%.`,
      actor: testResponsible,
      badgeText: newTest.status,
      severity:
        newTest.status === 'POSITIVO'
          ? 'SUCCESS'
          : newTest.status === 'NEGATIVO'
            ? 'ALERT'
            : 'WARNING',
    }

    const updatedInvestigation: DiagnosticInvestigationModel = {
      ...data,
      hypotheses_tree: updatedTree,
      tests_log: updatedTestsLog,
      timeline: [...data.timeline, newTimelineEntry],
      status: 'TESTES_PENDENTES',
    }

    setData(updatedInvestigation)
    await onSaveInvestigation(updatedInvestigation)

    toast({
      title: 'Teste de Confirmação Registrado',
      description: `Status: ${testStatus}. Confiança da hipótese recalculada para ${updatedNode.currentConfidence}%.`,
    })
  }

  // Ação: Confirmar Hipótese como Diagnóstico Comprovado (Req 9)
  const handleConfirmHypothesis = async () => {
    if (!activeNode) return

    const updatedNode = MultifourceConfidenceEngine.confirmHypothesis({
      node: activeNode,
      confirmationCriteria: confirmCriteria,
      technicianName: testResponsible,
    })

    const updatedTree = data.hypotheses_tree.map((n) =>
      n.hypothesis.id === updatedNode.hypothesis.id ? updatedNode : n,
    )

    const newTimelineEntry: TimelineEntry = {
      id: `tl_${Date.now()}`,
      timestampUtc: new Date().toISOString(),
      category: 'CONFIRMACAO_DEFEITO',
      title: `Diagnóstico Confirmado: ${updatedNode.hypothesis.title}`,
      description: `Critério técnico auditável registrado: "${confirmCriteria}". Pronto para intervenção de reparo.`,
      actor: testResponsible,
      badgeText: 'DIAGNÓSTICO CONFIRMADO',
      severity: 'SUCCESS',
    }

    const updatedInvestigation: DiagnosticInvestigationModel = {
      ...data,
      hypotheses_tree: updatedTree,
      timeline: [...data.timeline, newTimelineEntry],
      status: 'REPARO_PENDENTE',
      final_conclusion: `Defeito confirmado em bancada/teste: ${updatedNode.hypothesis.title}. Causa raiz: ${confirmCriteria}`,
    }

    setData(updatedInvestigation)
    await onSaveInvestigation(updatedInvestigation)

    toast({
      title: 'Diagnóstico Confirmado com Sucesso',
      description: 'Critério registrado no prontuário. Fase alterada para Reparo Pendente.',
    })
  }

  // Ação: Registrar Intervenção e Validação Pós-Reparo (Req 10)
  const handleRegisterInterventionAndRetest = async () => {
    const intervention: RepairIntervention = {
      id: `int_${Date.now()}`,
      title: 'Substituição de Componente Defeituoso',
      description: interventionPart,
      replacedParts: [
        {
          partName: 'Bobina de Ignição Cilindro 1',
          partNumber: 'GN1G-12A366-AB (Ford FoMoCo)',
          replacedQuantity: 1,
        },
      ],
      responsibleTechnician: testResponsible,
      serviceDateUtc: new Date().toISOString(),
      notes:
        'Substituição concluída com torque correto (10 Nm) e aplicação de graxa dielétrica na bota.',
    }

    const postRepair: PostRepairValidation = {
      retestSessionId: `retest_sess_${Date.now()}`,
      retestSessionUid: `retest_ecosport_pos_reparo`,
      executedAtUtc: new Date().toISOString(),
      outcome: retestOutcome,
      beforeDtcList: ['P0301 (ATIVO)'],
      afterDtcList: retestOutcome === 'FALHA_NAO_REPRODUZIDA' ? [] : ['P0301'],
      beforeSymptomObserved: 'Trepidação acentuada sob carga, corte cíclico de torque',
      afterSymptomObserved:
        retestOutcome === 'FALHA_NAO_REPRODUZIDA'
          ? 'Motor liso, aceleração progressiva, sem flutter de RPM ou hesitação'
          : 'Falha permaneceu ativa',
      parameterComparison: [
        {
          parameter: 'RPM Flutuação Lenta',
          beforeValue: '±95 RPM (Instável)',
          afterValue: '±12 RPM (Estável)',
          normalized: true,
        },
        {
          parameter: 'STFT Ajuste de Combustível',
          beforeValue: '+18.5% (Enriquecimento)',
          afterValue: '+1.8% (Estequiométrico)',
          normalized: true,
        },
        {
          parameter: 'Lâmpada MIL da Injeção',
          beforeValue: 'ACESO (Check Engine)',
          afterValue: 'APAGADO (Em conformidade)',
          normalized: true,
        },
      ],
      technicianVerdict:
        retestOutcome === 'FALHA_NAO_REPRODUZIDA'
          ? 'Falha não reproduzida em teste dinâmico de 15 minutos sob plena carga. Eficácia da intervenção comprovada.'
          : 'A falha persiste após a intervenção. Investigar vela ou compressão mecânica.',
    }

    const newTimelineEntries: TimelineEntry[] = [
      {
        id: `tl_${Date.now()}_1`,
        timestampUtc: new Date().toISOString(),
        category: 'INTERVENCAO_REPARO',
        title: `Intervenção Realizada: ${intervention.description}`,
        description: `Responsável: ${intervention.responsibleTechnician}. Peça substituída: Bobina FoMoCo.`,
        actor: testResponsible,
        badgeText: 'Reparo Físico',
        severity: 'INFO',
      },
      {
        id: `tl_${Date.now()}_2`,
        timestampUtc: new Date(Date.now() + 1000).toISOString(),
        category: 'RETESTE_VALIDACAO',
        title: `Reteste Pós-Reparo: ${retestOutcome === 'FALHA_NAO_REPRODUZIDA' ? 'Falha Não Reproduzida' : 'Falha Permanece'}`,
        description: postRepair.technicianVerdict,
        actor: testResponsible,
        badgeText: retestOutcome,
        severity: retestOutcome === 'FALHA_NAO_REPRODUZIDA' ? 'SUCCESS' : 'ALERT',
      },
    ]

    const updatedInvestigation: DiagnosticInvestigationModel = {
      ...data,
      intervention,
      post_repair_validation: postRepair,
      timeline: [...data.timeline, ...newTimelineEntries],
      status: retestOutcome === 'FALHA_NAO_REPRODUZIDA' ? 'CONCLUIDA' : 'VALIDACAO_POS_REPARO',
    }

    setData(updatedInvestigation)
    await onSaveInvestigation(updatedInvestigation)

    toast({
      title: 'Intervenção e Validação Registradas',
      description: `Reteste concluído: ${postRepair.outcome}. Status da OS atualizado para ${updatedInvestigation.status}.`,
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Banner da Ordem de Diagnóstico 360 */}
      <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#263340] pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold bg-[#FFB300] text-black px-2.5 py-0.5 rounded">
                ORDEM DE DIAGNÓSTICO 360
              </span>
              <span className="text-sm font-mono text-white font-bold">
                {data.investigation_number}
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded border uppercase ${
                  data.status === 'CONCLUIDA'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                    : data.status === 'REPARO_PENDENTE'
                      ? 'bg-blue-950 text-blue-300 border-blue-600'
                      : 'bg-amber-950 text-amber-300 border-amber-600'
                }`}
              >
                {data.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-[#9AA7B4] mt-2">
              <span className="flex items-center space-x-1 text-white font-medium">
                <Car className="w-3.5 h-3.5 text-[#FFB300]" />
                <span>
                  {data.vehicle_model || 'Veículo'} (Placa:{' '}
                  <strong className="text-white">{data.vehicle_plate}</strong>)
                </span>
              </span>
              <span>•</span>
              <span>
                Odômetro:{' '}
                {data.odometer_km ? `${data.odometer_km.toLocaleString('pt-BR')} km` : '--'}
              </span>
              <span>•</span>
              <span>
                Criada em:{' '}
                {data.created ? new Date(data.created).toLocaleDateString('pt-BR') : 'Hoje'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onPrintReport}
              className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs shadow border-none"
            >
              <Printer className="w-3.5 h-3.5 mr-1" />
              Imprimir Relatório 360 (PDF)
            </Button>
          </div>
        </div>

        {/* Abas da Investigação */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          <button
            type="button"
            onClick={() => setActiveTab('tree_and_tests')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'tree_and_tests'
                ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5" />
            <span>Árvore de Investigação & Testes ({data.hypotheses_tree.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('complaint_eval')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'complaint_eval'
                ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Queixa do Cliente & Avaliação Mecânica</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history_comparison')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'history_comparison'
                ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Histórico do Mesmo Veículo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('intervention_retest')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'intervention_retest'
                ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Intervenção & Reteste Pós-Reparo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
              activeTab === 'timeline'
                ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Linha do Tempo / Prontuário ({data.timeline.length})</span>
          </button>
        </div>
      </div>

      {/* ABA 1: ÁRVORE DE INVESTIGAÇÃO & TESTES DE CONFIRMAÇÃO (Req 7, 8, 9) */}
      {activeTab === 'tree_and_tests' && (
        <div className="space-y-6">
          {/* Princípio Epistemológico Destacado (Req 9) */}
          <div className="bg-[#0B0F14] border-l-4 border-[#FFB300] p-3 rounded text-xs text-[#9AA7B4] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-[#FFB300] shrink-0" />
              <span>
                <strong>Regra Arquitetural Obrigatória:</strong> Não confundir Hipótese com
                Diagnóstico. Uma hipótese só assume status CONFIRMADA mediante registro explícito de
                critério técnico e validação experimental física.
              </span>
            </div>
            <span className="text-[10px] font-mono text-gray-400">OS-ME001-E4</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1: Árvore Visual de Hipóteses */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-white uppercase tracking-wider block">
                Árvore de Hipóteses Diagnósticas
              </span>

              {data.hypotheses_tree.map((node, idx) => {
                const isSelected = node.hypothesis.id === activeNode?.hypothesis.id
                return (
                  <div
                    key={node.hypothesis.id}
                    onClick={() => setSelectedHypothesisNodeId(node.hypothesis.id)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#1A232E] border-[#FFB300] shadow-md'
                        : 'bg-[#131A22] border-[#263340] hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-[#FFB300]">
                          #{idx + 1}
                        </span>
                        <span className="font-bold text-xs text-white line-clamp-1">
                          {node.hypothesis.title}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                          node.status === 'CONFIRMADA'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                            : node.status === 'DESCARTADA'
                              ? 'bg-red-950 text-red-300 border-red-700'
                              : node.status === 'FORTALECIDA'
                                ? 'bg-blue-950 text-blue-300 border-blue-600'
                                : 'bg-gray-800 text-gray-300 border-gray-600'
                        }`}
                      >
                        {node.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#9AA7B4] line-clamp-2 mb-3">
                      {node.hypothesis.description}
                    </p>

                    {/* Barra de Confiança Recalculada */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="text-gray-400">Confiança Recalculada:</span>
                        <strong
                          className={
                            node.currentConfidence >= 75
                              ? 'text-emerald-400'
                              : node.currentConfidence >= 50
                                ? 'text-amber-400'
                                : 'text-red-400'
                          }
                        >
                          {node.currentConfidence}%
                          {node.confidenceDelta !== 0 && (
                            <span className="text-[10px] ml-1">
                              (
                              {node.confidenceDelta > 0
                                ? `+${node.confidenceDelta}`
                                : node.confidenceDelta}
                              %)
                            </span>
                          )}
                        </strong>
                      </div>
                      <div className="w-full h-1.5 bg-[#0B0F14] rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            node.currentConfidence >= 75
                              ? 'bg-[#2ECC71]'
                              : node.currentConfidence >= 50
                                ? 'bg-[#FFB300]'
                                : 'bg-[#E53935]'
                          }`}
                          style={{ width: `${node.currentConfidence}%` }}
                        />
                      </div>
                    </div>

                    {/* Indicador de testes associados */}
                    <div className="text-[10px] text-gray-400 font-mono mt-2 pt-2 border-t border-[#263340]/60 flex items-center justify-between">
                      <span>{node.testsAssociated.length} teste(s) executado(s)</span>
                      {node.status === 'CONFIRMADA' && (
                        <span className="text-emerald-400 font-bold flex items-center">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Confirmada
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Colunas 2 e 3: Painel da Hipótese Ativa, Protocolo e Execução de Teste */}
            {activeNode && (
              <div className="lg:col-span-2 space-y-5 bg-[#131A22] border border-[#263340] rounded-lg p-5">
                {/* Cabeçalho da Hipótese Selecionada */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#263340] pb-4">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono bg-[#FFB300]/20 text-[#FFB300] px-2 py-0.5 rounded font-bold">
                        SISTEMA: {activeNode.hypothesis.affectedSystem}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold border ${
                          activeNode.status === 'CONFIRMADA'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                            : 'bg-blue-950 text-blue-300 border-blue-600'
                        }`}
                      >
                        STATUS: {activeNode.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">
                      {activeNode.hypothesis.title}
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-[#9AA7B4] block">Confiança Auditável:</span>
                    <span className="text-xl font-bold font-mono text-[#FFB300]">
                      {activeNode.currentConfidence}%
                    </span>
                  </div>
                </div>

                {/* Evidências Fatoradas & Limitações */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-1.5">
                    <span className="font-bold text-emerald-400 flex items-center">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Evidências Favoráveis ({activeNode.hypothesis.favorableEvidences.length})
                    </span>
                    <ul className="list-disc pl-4 text-gray-300 space-y-1">
                      {activeNode.hypothesis.favorableEvidences.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-1.5">
                    <span className="font-bold text-amber-400 flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      Evidências Contrárias / Limitações
                    </span>
                    <ul className="list-disc pl-4 text-gray-300 space-y-1">
                      {activeNode.hypothesis.contraryEvidences.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                      {activeNode.hypothesis.limitations.map((lim, i) => (
                        <li key={i} className="text-gray-400 italic">
                          {lim}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Protocolo de Teste de Confirmação Recomendado (Req 8) */}
                <div className="bg-[#0B0F14] border border-[#263340] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-[#263340] pb-2">
                    <span className="font-bold text-white text-xs uppercase flex items-center space-x-1.5">
                      <Wrench className="w-4 h-4 text-[#FFB300]" />
                      <span>
                        Protocolo Recomendado: {activeNode.hypothesis.confirmationProtocol.title}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">
                      Est. ~{activeNode.hypothesis.confirmationProtocol.estimatedDurationMin} min
                    </span>
                  </div>

                  <p className="text-xs text-gray-300">
                    <strong>Objetivo:</strong>{' '}
                    {activeNode.hypothesis.confirmationProtocol.objective}
                  </p>

                  <div className="space-y-2">
                    {activeNode.hypothesis.confirmationProtocol.steps.map((st) => (
                      <div
                        key={st.stepNumber}
                        className="bg-[#131A22] p-2.5 rounded border border-[#263340] text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-white">
                            Passo {st.stepNumber}: {st.title}
                          </strong>
                          <span className="text-[10px] text-gray-400 font-mono">
                            Alvo: {st.targetComponent}
                          </span>
                        </div>
                        <p className="text-gray-300">{st.action}</p>
                        <div className="text-[11px] text-[#9AA7B4] flex flex-wrap gap-2 pt-1 font-mono">
                          <span>Ferramentas: {st.toolsNeeded.join(', ')}</span>
                          <span>•</span>
                          <span className="text-emerald-300">
                            Esperado Normal: {st.expectedOutcomeNormal}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* FORMULÁRIO OPERACIONAL: REGISTRAR RESULTADO DO TESTE (Req 8) */}
                  <div className="mt-4 pt-4 border-t border-[#263340] bg-[#131A22] p-3 rounded-lg space-y-3">
                    <span className="font-bold text-[#FFB300] text-xs uppercase block">
                      Registrar Execução do Teste no Sistema
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] text-[#9AA7B4] block mb-1">
                          Responsável Técnico:
                        </label>
                        <input
                          type="text"
                          value={testResponsible}
                          onChange={(e) => setTestResponsible(e.target.value)}
                          className="w-full bg-[#0B0F14] border border-[#263340] text-xs text-white p-2 rounded"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] text-[#9AA7B4] block mb-1">
                          Resultado do Teste:
                        </label>
                        <select
                          value={testStatus}
                          onChange={(e) => setTestStatus(e.target.value as ConfirmationTestStatus)}
                          className="w-full bg-[#0B0F14] border border-[#263340] text-xs text-white p-2 rounded"
                        >
                          <option value="POSITIVO">POSITIVO (Fortalece hipótese +18%)</option>
                          <option value="NEGATIVO">NEGATIVO (Enfraquece hipótese -35%)</option>
                          <option value="INCONCLUSIVO">INCONCLUSIVO (-5%)</option>
                          <option value="EM_EXECUCAO">EM EXECUÇÃO</option>
                          <option value="NAO_REALIZADO">NÃO REALIZADO</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] text-[#9AA7B4] block mb-1">
                          Valor Medido / Evidência:
                        </label>
                        <input
                          type="text"
                          value={testMeasuredVal}
                          onChange={(e) => setTestMeasuredVal(e.target.value)}
                          placeholder="Ex: P0302 / 1.2 Ohms / 3.8 bar"
                          className="w-full bg-[#0B0F14] border border-[#263340] text-xs text-white p-2 rounded"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#9AA7B4] block mb-1">
                        Observações Técnicas / Comportamento Observado:
                      </label>
                      <textarea
                        rows={2}
                        value={testObservation}
                        onChange={(e) => setTestObservation(e.target.value)}
                        className="w-full bg-[#0B0F14] border border-[#263340] text-xs text-white p-2 rounded"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleApplyTestResult}
                        className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs"
                      >
                        <PlusCircle className="w-3.5 h-3.5 mr-1" />
                        Salvar Teste & Recalcular Confiança
                      </Button>
                    </div>
                  </div>
                </div>

                {/* FORMULÁRIO DE CONFIRMAÇÃO DO DIAGNÓSTICO (Req 9) */}
                {activeNode.status !== 'CONFIRMADA' && (
                  <div className="bg-emerald-950/20 border border-emerald-700/50 rounded-lg p-4 space-y-3">
                    <span className="font-bold text-emerald-400 text-xs uppercase flex items-center">
                      <ShieldCheck className="w-4 h-4 mr-1.5" />
                      Confirmar Hipótese como Diagnóstico Final Comprovado
                    </span>
                    <p className="text-xs text-[#9AA7B4]">
                      A confirmação exige critério técnico registrado no prontuário. Nunca confirme
                      sem evidência experimental comprovada.
                    </p>

                    <div>
                      <label className="text-[11px] text-gray-300 block mb-1 font-semibold">
                        Critério de Confirmação Registrado:
                      </label>
                      <input
                        type="text"
                        value={confirmCriteria}
                        onChange={(e) => setConfirmCriteria(e.target.value)}
                        className="w-full bg-[#0B0F14] border border-[#263340] text-xs text-white p-2 rounded"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleConfirmHypothesis}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Confirmar Diagnóstico Oficial
                      </Button>
                    </div>
                  </div>
                )}

                {/* LOG AUDITÁVEL DE RECÁLCULOS (Req 7, 14) */}
                <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] space-y-1.5">
                  <span className="font-bold text-[#FFB300] text-[11px] uppercase tracking-wider block">
                    Trilha de Auditoria Matemática & Recálculos da Confiança
                  </span>
                  <div className="space-y-1 font-mono text-[11px] text-gray-300">
                    {activeNode.recalculationAuditLog.map((log, i) => (
                      <div key={i} className="flex items-start space-x-1.5">
                        <ChevronRight className="w-3 h-3 text-[#FFB300] shrink-0 mt-0.5" />
                        <span>{log}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 2: QUEIXA DO CLIENTE & AVALIAÇÃO MECÂNICA (Req 2, 3) */}
      {activeTab === 'complaint_eval' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Queixa do Cliente (Req 2) */}
          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#263340] pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-sm">Queixa Estruturada do Cliente</h3>
              </div>
              <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded uppercase font-bold">
                Relato Subjetivo
              </span>
            </div>

            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
              <span className="text-[10px] text-[#9AA7B4] uppercase block font-bold mb-1">
                Descrição Livre do Condutor:
              </span>
              <p className="text-xs text-white italic">"{data.client_complaint.description}"</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                <span className="text-[#9AA7B4] block text-[10px]">Quando Ocorre:</span>
                <strong className="text-white">{data.client_complaint.whenOccurs}</strong>
              </div>
              <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                <span className="text-[#9AA7B4] block text-[10px]">Estado do Motor:</span>
                <strong className="text-white">{data.client_complaint.engineState}</strong>
              </div>
              <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                <span className="text-[#9AA7B4] block text-[10px]">Movimento:</span>
                <strong className="text-white">{data.client_complaint.movementState}</strong>
              </div>
              <div className="bg-[#0B0F14] p-2.5 rounded border border-[#263340]">
                <span className="text-[#9AA7B4] block text-[10px]">Regime:</span>
                <strong className="text-white">{data.client_complaint.accelerationState}</strong>
              </div>
            </div>

            <div>
              <span className="text-[11px] text-[#9AA7B4] block mb-2 font-bold uppercase">
                Sintomas Assinalados pelo Cliente:
              </span>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {data.client_complaint.symptomsSelected.checkEngineLight && (
                  <span className="bg-amber-950 text-amber-300 border border-amber-700 px-2 py-1 rounded">
                    Luz de Injeção
                  </span>
                )}
                {data.client_complaint.symptomsSelected.vibration && (
                  <span className="bg-red-950 text-red-300 border border-red-700 px-2 py-1 rounded">
                    Trepidação
                  </span>
                )}
                {data.client_complaint.symptomsSelected.powerLoss && (
                  <span className="bg-amber-950 text-amber-300 border border-amber-700 px-2 py-1 rounded">
                    Perda de Potência
                  </span>
                )}
                {data.client_complaint.symptomsSelected.noise && (
                  <span className="bg-gray-800 text-gray-200 px-2 py-1 rounded">Ruído</span>
                )}
              </div>
            </div>
          </div>

          {/* Avaliação do Mecânico (Req 3) */}
          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#263340] pb-3">
              <div className="flex items-center space-x-2">
                <Wrench className="w-5 h-5 text-[#FFB300]" />
                <h3 className="font-bold text-white text-sm">Constatação Técnica do Mecânico</h3>
              </div>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded uppercase font-bold">
                Constatação Técnica
              </span>
            </div>

            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
              <span className="text-[10px] text-[#9AA7B4] uppercase block font-bold mb-1">
                "O que eu observei no veículo?":
              </span>
              <p className="text-xs text-white leading-relaxed">
                {data.mechanic_evaluation.freeNotes}
              </p>
            </div>

            <div>
              <span className="text-[11px] text-[#9AA7B4] block mb-2 font-bold uppercase">
                Campos Estruturados de Inspeção:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div
                  className={`p-2 rounded border flex items-center justify-between ${
                    data.mechanic_evaluation.roughIdle
                      ? 'bg-red-950/40 text-red-300 border-red-800'
                      : 'bg-[#0B0F14] text-gray-400 border-[#263340]'
                  }`}
                >
                  <span>Lenta irregular</span>
                  <span>{data.mechanic_evaluation.roughIdle ? 'SIM' : 'NÃO'}</span>
                </div>
                <div
                  className={`p-2 rounded border flex items-center justify-between ${
                    data.mechanic_evaluation.misfireUnderLoad
                      ? 'bg-red-950/40 text-red-300 border-red-800'
                      : 'bg-[#0B0F14] text-gray-400 border-[#263340]'
                  }`}
                >
                  <span>Falha sob carga</span>
                  <span>{data.mechanic_evaluation.misfireUnderLoad ? 'SIM' : 'NÃO'}</span>
                </div>
                <div
                  className={`p-2 rounded border flex items-center justify-between ${
                    data.mechanic_evaluation.vibrationFelt
                      ? 'bg-red-950/40 text-red-300 border-red-800'
                      : 'bg-[#0B0F14] text-gray-400 border-[#263340]'
                  }`}
                >
                  <span>Vibração mecânica</span>
                  <span>{data.mechanic_evaluation.vibrationFelt ? 'SIM' : 'NÃO'}</span>
                </div>
                <div
                  className={`p-2 rounded border flex items-center justify-between ${
                    data.mechanic_evaluation.powerLossObserved
                      ? 'bg-red-950/40 text-red-300 border-red-800'
                      : 'bg-[#0B0F14] text-gray-400 border-[#263340]'
                  }`}
                >
                  <span>Perda de potência</span>
                  <span>{data.mechanic_evaluation.powerLossObserved ? 'SIM' : 'NÃO'}</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#9AA7B4] pt-2 border-t border-[#263340]">
              Examinado por:{' '}
              <strong className="text-white">{data.mechanic_evaluation.technicianName}</strong>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: HISTÓRICO DO MESMO VEÍCULO (Req 5) */}
      {activeTab === 'history_comparison' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-[#263340] pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <History className="w-5 h-5 text-[#FFB300]" />
                <span>
                  Comparação Temporal com Histórico do Mesmo Veículo ({data.vehicle_plate})
                </span>
              </h3>
              <p className="text-xs text-[#9AA7B4]">
                Regra: Veículos diferentes nunca são misturados como baseline individual.
              </p>
            </div>
            <span className="text-xs font-mono bg-[#0B0F14] px-2.5 py-1 rounded text-white border border-[#263340]">
              Placa: {data.vehicle_plate}
            </span>
          </div>

          {historyComparison ? (
            <div className="space-y-4">
              <div className="bg-[#0B0F14] border border-[#263340] p-4 rounded-lg space-y-2">
                <span className="text-xs font-bold text-[#FFB300] uppercase block">
                  Resumo Comparativo de Baseline:
                </span>
                <p className="text-xs text-gray-200">{historyComparison.comparisonSummary}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="bg-[#0B0F14] border border-[#263340] p-3 rounded space-y-1">
                  <span className="text-gray-400 font-bold block">
                    Ajuste de Combustível (STFT):
                  </span>
                  <p className="text-gray-200">{historyComparison.stftComparisonNote}</p>
                </div>

                <div className="bg-[#0B0F14] border border-[#263340] p-3 rounded space-y-1">
                  <span className="text-gray-400 font-bold block">
                    Tensão Elétrica (Alternador):
                  </span>
                  <p className="text-gray-200">{historyComparison.voltageComparisonNote}</p>
                </div>
              </div>

              <div className="bg-[#0B0F14] border border-[#263340] p-3 rounded space-y-2">
                <span className="text-xs font-bold text-white uppercase block">
                  Rastreamento de Recorrência de Códigos DTC:
                </span>
                <div className="space-y-1 text-xs font-mono">
                  {historyComparison.dtcRecurrenceNotes.map((note, i) => (
                    <div key={i} className="text-amber-300">
                      • {note}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0B0F14] p-6 rounded text-center text-xs text-gray-400">
              Carregando histórico ou veículo sem sessões pregressas cadastradas.
            </div>
          )}
        </div>
      )}

      {/* ABA 4: INTERVENÇÃO & RETESTE PÓS-REPARO (Req 10) */}
      {activeTab === 'intervention_retest' && (
        <div className="space-y-6">
          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
            <h3 className="font-bold text-white text-sm flex items-center space-x-2 border-b border-[#263340] pb-3">
              <Wrench className="w-5 h-5 text-[#FFB300]" />
              <span>Registrar Intervenção de Reparo Mecânico</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#9AA7B4] block mb-1">
                  Intervenção Executada no Veículo:
                </label>
                <input
                  type="text"
                  value={interventionPart}
                  onChange={(e) => setInterventionPart(e.target.value)}
                  className="w-full bg-[#0B0F14] border border-[#263340] text-xs text-white p-2.5 rounded"
                  placeholder="Ex: Bobina do cilindro 1 substituída"
                />
              </div>

              <div>
                <label className="text-xs text-[#9AA7B4] block mb-1">
                  Resultado do Reteste Pós-Reparo:
                </label>
                <select
                  value={retestOutcome}
                  onChange={(e) => setRetestOutcome(e.target.value as any)}
                  className="w-full bg-[#0B0F14] border border-[#263340] text-xs text-white p-2.5 rounded"
                >
                  <option value="FALHA_NAO_REPRODUZIDA">
                    FALHA NÃO REPRODUZIDA (Sucesso / Sanada)
                  </option>
                  <option value="FALHA_PERMANECE">FALHA PERMANECE (Reparo não resolveu)</option>
                  <option value="RESULTADO_INCONCLUSIVO">RESULTADO INCONCLUSIVO</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleRegisterInterventionAndRetest}
                className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Salvar Intervenção & Validar Pós-Reparo
              </Button>
            </div>
          </div>

          {/* Comparação Antes x Depois se houver validação registrada (Req 10) */}
          {data.post_repair_validation && (
            <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-[#263340] pb-3">
                <span className="font-bold text-white text-xs uppercase flex items-center space-x-2">
                  <ArrowDownUp className="w-4 h-4 text-emerald-400" />
                  <span>Matriz Comparativa: Antes do Reparo ↔ Depois do Reparo</span>
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold ${
                    data.post_repair_validation.outcome === 'FALHA_NAO_REPRODUZIDA'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : 'bg-red-950 text-red-300 border border-red-700'
                  }`}
                >
                  {data.post_repair_validation.outcome}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-[#0B0F14] text-[#9AA7B4] border-b border-[#263340]">
                      <th className="p-2.5">Grandeza / Item</th>
                      <th className="p-2.5 text-red-400">Antes do Reparo</th>
                      <th className="p-2.5 text-emerald-400">Depois do Reparo</th>
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#263340]">
                    {data.post_repair_validation.parameterComparison.map((p, idx) => (
                      <tr key={idx} className="hover:bg-[#1A232E]/50">
                        <td className="p-2.5 font-medium text-white">{p.parameter}</td>
                        <td className="p-2.5 font-mono text-red-400">{p.beforeValue}</td>
                        <td className="p-2.5 font-mono text-emerald-300 font-bold">
                          {p.afterValue}
                        </td>
                        <td className="p-2.5">
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700">
                            Normalizado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] text-xs">
                <span className="text-gray-400 block font-bold mb-1">Veredito do Diagnosta:</span>
                <p className="text-white">{data.post_repair_validation.technicianVerdict}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ABA 5: LINHA DO TEMPO DO PRONTUÁRIO TÉCNICO (Req 11) */}
      {activeTab === 'timeline' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#263340] pb-3">
            <div>
              <h3 className="font-bold text-white text-sm flex items-center space-x-2">
                <Clock className="w-5 h-5 text-[#FFB300]" />
                <span>Linha do Tempo Auditável do Prontuário Técnico</span>
              </h3>
              <p className="text-xs text-[#9AA7B4]">
                Queixa → Diagnóstico → Teste → Intervenção → Reteste → Conclusão
              </p>
            </div>
            <span className="text-xs font-mono text-gray-400">
              {data.timeline.length} evento(s) encadeado(s)
            </span>
          </div>

          <div className="space-y-3 relative pl-4 border-l-2 border-[#263340] ml-2">
            {data.timeline.map((entry) => (
              <div key={entry.id} className="relative group">
                <span className="absolute -left-[23px] top-1.5 w-3 h-3 rounded-full bg-[#FFB300] ring-4 ring-[#131A22]" />
                <div className="bg-[#0B0F14] border border-[#263340] rounded-lg p-3.5 space-y-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-white">{entry.title}</span>
                      {entry.badgeText && (
                        <span className="text-[10px] bg-[#1A232E] text-[#FFB300] px-2 py-0.5 rounded border border-[#263340] font-mono">
                          {entry.badgeText}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-gray-400">
                      {new Date(entry.timestampUtc).toLocaleTimeString('pt-BR')} • {entry.actor}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300">{entry.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
