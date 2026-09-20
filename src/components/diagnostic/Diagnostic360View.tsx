import React, { useState } from 'react'
import { Diagnostic360Report, DiagnosticHypothesis, DiagnosticAnomaly } from '@/types/diagnostic'
import { Button } from '@/components/ui/button'
import {
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  Layers,
  ArrowRight,
  Wrench,
  Search,
  FileText,
  Activity,
  History,
  TrendingDown,
  Gauge,
  CornerDownRight,
  BookOpen,
} from 'lucide-react'

import {
  buildDiagnostic360PdfData,
  exportDiagnostic360Pdf,
  buildMechanicSummaryPdfData,
  exportMechanicSummaryPdf,
} from '@/services/diagnostic-pdf-service'
import { SessionModel, VehicleModel } from '@/types/obd'

interface Diagnostic360ViewProps {
  report: Diagnostic360Report
  session?: SessionModel | null
  vehicle?: VehicleModel | null
  onNavigateToRawOffset?: (monoOffsetMs: number) => void
}

export const Diagnostic360View: React.FC<Diagnostic360ViewProps> = ({
  report,
  session,
  vehicle,
  onNavigateToRawOffset,
}) => {
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>(
    report.hypotheses[0]?.id || '',
  )
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null)
  const [showConfidenceExplainer, setShowConfidenceExplainer] = useState(false)

  const activeHypothesis =
    report.hypotheses.find((h) => h.id === selectedHypothesisId) || report.hypotheses[0]

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'MUITO_ALTA':
        return 'bg-emerald-950 text-emerald-300 border-emerald-600 font-bold'
      case 'ALTA':
        return 'bg-blue-950 text-blue-300 border-blue-600 font-bold'
      case 'MODERADA':
        return 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
      default:
        return 'bg-gray-800 text-gray-300 border-gray-600'
    }
  }

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'CRITICO':
        return 'bg-red-950 text-red-300 border-red-700 animate-pulse'
      case 'ATENCAO':
        return 'bg-amber-950 text-amber-300 border-amber-700'
      default:
        return 'bg-blue-950 text-blue-300 border-blue-700'
    }
  }

  return (
    <div className="space-y-6">
      {/* Faixa de Segurança Diagnóstica (Requisito 8) */}
      <div
        className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          report.safetyOverall === 'CRITICO'
            ? 'bg-red-950/40 border-red-600 text-red-200'
            : report.safetyOverall === 'ATENCAO'
              ? 'bg-amber-950/30 border-amber-600 text-amber-200'
              : 'bg-emerald-950/20 border-emerald-700 text-emerald-200'
        }`}
      >
        <div className="flex items-center space-x-3">
          {report.safetyOverall === 'CRITICO' ? (
            <ShieldAlert className="w-6 h-6 text-red-400 shrink-0" />
          ) : report.safetyOverall === 'ATENCAO' ? (
            <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
          )}
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-wide uppercase">
                Segurança Diagnóstica: Nível {report.safetyOverall}
              </span>
              <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded font-mono">
                Pipeline 100% Determinístico
              </span>
            </div>
            <p className="text-xs opacity-90 mt-0.5">
              {report.criticalWarning ||
                (report.safetyOverall === 'ATENCAO'
                  ? 'Atenção às alterações dinâmicas detectadas. Siga os protocolos antes de liberar o veículo.'
                  : 'Parâmetros operacionais monitorados sem risco crítico detectado.')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-xs font-mono">
          <Button
            size="sm"
            onClick={() => {
              const fallbackSession: SessionModel =
                session ||
                ({
                  session_id: report.sessionId || 'sess_1789651428943_g57i',
                  vehicle_name: vehicle?.model
                    ? `${vehicle.make} ${vehicle.model}`
                    : 'Ford EcoSport',
                  adapter_type: 'OBD REAL BLUETOOTH CLASSIC',
                  started_at: new Date().toISOString(),
                  status: 'ENCERRADO',
                } as SessionModel)

              const mechanicData = buildMechanicSummaryPdfData({
                session: fallbackSession,
                vehicle,
                appVersion: '0.0.45',
              })
              exportMechanicSummaryPdf(mechanicData)
            }}
            className="bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs shadow h-7 px-2.5 border border-emerald-400"
            title="Exportar Resumo Técnico para o Mecânico + Plano de Serviço"
          >
            <Wrench className="w-3.5 h-3.5 mr-1 text-white" />
            Resumo Mecânico
          </Button>
          <Button
            size="sm"
            onClick={() => {
              const fallbackSession: SessionModel =
                session ||
                ({
                  session_id: report.sessionId || 'sess_1789651428943_g57i',
                  vehicle_name: vehicle?.model
                    ? `${vehicle.make} ${vehicle.model}`
                    : 'Ford EcoSport',
                  adapter_type: 'OBD REAL BLUETOOTH CLASSIC',
                  started_at: new Date().toISOString(),
                  status: 'ENCERRADO',
                } as SessionModel)

              const pdfData = buildDiagnostic360PdfData({
                session: fallbackSession,
                vehicle,
                report,
              })
              exportDiagnostic360Pdf(pdfData)
            }}
            className="bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-xs shadow h-7 px-3"
            title="Exportar PDF do Diagnóstico 360"
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            Exportar PDF
          </Button>
          <span className="bg-black/50 px-2 py-1 rounded border border-white/10 hidden sm:inline">
            {report.hypotheses.length} hip.
          </span>
          <span className="bg-black/50 px-2 py-1 rounded border border-white/10 hidden sm:inline">
            {report.anomalies.length} anom.
          </span>
        </div>
      </div>

      {/* Ordem Obrigatória dos 7 Passos Diagnósticos */}
      <div className="space-y-6">
        {/* BLOCO 1: SINTOMA OBSERVADO */}
        <section className="bg-[#131A22] border border-[#263340] rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-[#263340] pb-3 mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#FFB300] text-black font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Sintoma Observado na Pista
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9AA7B4]">
              Instante: +{report.baseline.statsByPid['0x0C'] ? 'OK' : ''} (ID: {report.eventId})
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340]">
              <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                Tipo Marcado:
              </span>
              <span className="font-bold text-red-400 text-sm uppercase">{report.symptomType}</span>
            </div>
            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] sm:col-span-2">
              <span className="text-[#9AA7B4] block text-[10px] uppercase font-bold">
                Relato do Operador / Condutor:
              </span>
              <span className="text-gray-200 italic">
                "
                {report.symptomDescription ||
                  'Nenhuma nota adicional preenchida durante a marcação.'}
                "
              </span>
            </div>
          </div>
        </section>

        {/* BLOCO 2: O QUE OS SENSORES MOSTRARAM (BASELINE DINÂMICO) */}
        <section className="bg-[#131A22] border border-[#263340] rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-[#263340] pb-3 mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#FFB300] text-black font-bold text-xs flex items-center justify-center">
                2
              </span>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                O Que os Sensores Mostraram (Comparação Temporal com Baseline Dinâmico)
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9AA7B4]">
              {report.baseline.pidsEvaluated.length} PIDs monitorados
            </span>
          </div>

          <div className="text-xs text-[#9AA7B4] mb-3">
            Linha de base calculada na própria sessão de rodagem do veículo (Período anterior →
            Momento do sintoma → Período posterior).
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#0B0F14] text-[#9AA7B4] border-b border-[#263340]">
                  <th className="p-2.5">Sinal (PID)</th>
                  <th className="p-2.5 text-blue-300">Baseline Normal da Sessão</th>
                  <th className="p-2.5 text-amber-300">Antes do Sintoma (-30s)</th>
                  <th className="p-2.5 text-red-400 font-bold bg-red-950/20">
                    No Momento do Sintoma
                  </th>
                  <th className="p-2.5 text-emerald-300">Após o Sintoma (+30s)</th>
                  <th className="p-2.5">Faixa Observada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263340]">
                {Object.values(report.baseline.statsByPid).map((stat) => (
                  <tr key={stat.pid} className="hover:bg-[#1A232E]/50">
                    <td className="p-2.5 font-medium text-white">PID {stat.pid}</td>
                    <td className="p-2.5 font-mono text-blue-300">
                      {stat.normalSessionAvg} {stat.unit} (σ ±{stat.normalSessionStdDev})
                    </td>
                    <td className="p-2.5 font-mono text-amber-300">
                      {report.baseline.preSymptomWindowAvg[stat.pid] ?? '--'}
                    </td>
                    <td className="p-2.5 font-mono text-red-400 font-bold bg-red-950/20">
                      {report.baseline.eventInstantValue[stat.pid] ?? '--'}
                    </td>
                    <td className="p-2.5 font-mono text-emerald-300">
                      {report.baseline.postSymptomWindowAvg[stat.pid] ?? '--'}
                    </td>
                    <td className="p-2.5 font-mono text-gray-400">
                      {stat.minObserved} — {stat.maxObserved}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* BLOCO 3: ANOMALIAS ENCONTRADAS & CORRELAÇÕES */}
        <section className="bg-[#131A22] border border-[#263340] rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-[#263340] pb-3 mb-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#FFB300] text-black font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Anomalias & Correlações Identificadas
              </h2>
            </div>
            <span className="text-xs font-mono text-[#9AA7B4]">
              {report.anomalies.length} anomalia(s) • {report.correlations.length} correlação(ões)
            </span>
          </div>

          {report.anomalies.length === 0 ? (
            <div className="bg-emerald-950/20 border border-emerald-700/50 p-4 rounded text-xs text-emerald-300 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Nenhuma anomalia física detectada na janela temporal. Sinais operando em regime de
                normalidade.
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.anomalies.map((anom) => (
                  <div
                    key={anom.id}
                    className="bg-[#0B0F14] border border-[#263340] rounded-lg p-3.5 space-y-2 hover:border-[#FFB300]/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded border font-bold ${getSeverityBadge(anom.severity)}`}
                        >
                          {anom.severity}
                        </span>
                        <span className="font-bold text-white text-xs">{anom.title}</span>
                      </div>
                      {onNavigateToRawOffset && (
                        <button
                          type="button"
                          onClick={() => onNavigateToRawOffset(anom.momentOffsetMs)}
                          className="text-[11px] text-[#FFB300] hover:underline flex items-center space-x-1 shrink-0"
                          title="Voltar ao ponto correspondente da telemetria bruta"
                        >
                          <span>Ver RAW</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-gray-300">{anom.description}</p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-[#131A22] p-2 rounded">
                      <div>
                        <span className="text-[#9AA7B4] block text-[9px] uppercase">
                          Valor Observado:
                        </span>
                        <span className="text-white font-bold">{anom.observedValue}</span>
                      </div>
                      <div>
                        <span className="text-[#9AA7B4] block text-[9px] uppercase">
                          PIDs Avaliados:
                        </span>
                        <span className="text-gray-300">
                          {anom.pidsInvolved.join(', ') || 'Nenhum (Barramento)'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Correlações entre múltiplos sinais */}
              {report.correlations.length > 0 && (
                <div className="pt-3 border-t border-[#263340]">
                  <span className="text-xs font-bold text-[#FFB300] uppercase block mb-2 flex items-center space-x-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Correlações Temporais Multi-Sinal (Causa e Efeito Observado)</span>
                  </span>
                  <div className="space-y-2">
                    {report.correlations.map((corr) => (
                      <div
                        key={corr.id}
                        className="bg-[#0B0F14] border border-[#263340] p-3 rounded text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white">{corr.title}</span>
                          <span className="text-[10px] bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800 font-mono">
                            Peso +{corr.confidenceImpact}%
                          </span>
                        </div>
                        <p className="text-gray-300">{corr.description}</p>
                        <div className="text-[10px] text-[#9AA7B4] font-mono mt-1">
                          Mecanismo: <span className="text-amber-300">{corr.mechanism}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* BLOCO 4: HIPÓTESES DIAGNÓSTICAS & BLOCO 5: CONFIANÇA */}
        <section className="bg-[#131A22] border border-[#263340] rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-[#263340] pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-[#FFB300] text-black font-bold text-xs flex items-center justify-center">
                4 & 5
              </span>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Hipóteses Diagnósticas & Nível de Confiança
              </h2>
            </div>
            <span className="text-xs text-[#9AA7B4]">
              Regra: Uma hipótese nunca é armazenada como fato confirmado
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Lista Lateral de Hipóteses */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#9AA7B4] uppercase block">
                Hipóteses Geradas ({report.hypotheses.length}):
              </span>
              {report.hypotheses.map((hyp) => {
                const isSelected = hyp.id === activeHypothesis?.id
                return (
                  <button
                    key={hyp.id}
                    type="button"
                    onClick={() => setSelectedHypothesisId(hyp.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-[#1A232E] border-[#FFB300] ring-1 ring-[#FFB300]'
                        : 'bg-[#0B0F14] border-[#263340] hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-white line-clamp-1">
                        #{hyp.rank} {hyp.title}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border font-mono ${getTierBadge(
                          hyp.confidenceTier,
                        )}`}
                      >
                        {hyp.confidence}%
                      </span>
                    </div>
                    <span className="text-[11px] text-[#9AA7B4] block line-clamp-2">
                      {hyp.description}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Painel Central Detalhado da Hipótese Selecionada */}
            {activeHypothesis && (
              <div className="lg:col-span-2 bg-[#0B0F14] border border-[#263340] rounded-lg p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263340]">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono bg-[#FFB300]/20 text-[#FFB300] px-2 py-0.5 rounded font-bold">
                        RANK #{activeHypothesis.rank}
                      </span>
                      <span className="text-xs font-mono text-gray-400 uppercase">
                        [{activeHypothesis.affectedSystem}]
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-1">
                      {activeHypothesis.title}
                    </h3>
                  </div>

                  {/* Confiança com Explicabilidade */}
                  <div className="flex flex-col sm:items-end">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-[#9AA7B4]">Confiança:</span>
                      <span
                        className={`text-sm px-3 py-1 rounded border font-mono ${getTierBadge(
                          activeHypothesis.confidenceTier,
                        )}`}
                      >
                        {activeHypothesis.confidence}% ({activeHypothesis.confidenceTier})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowConfidenceExplainer(!showConfidenceExplainer)}
                      className="text-[11px] text-[#FFB300] hover:underline mt-1"
                    >
                      {showConfidenceExplainer ? 'Ocultar cálculo' : 'Por que este percentual?'}
                    </button>
                  </div>
                </div>

                {/* BLOCO 6: POR QUE O SISTEMA CHEGOU NISSO (Explicabilidade e Pesos) */}
                {showConfidenceExplainer && (
                  <div className="bg-[#131A22] border border-[#263340] p-4 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center space-x-2 text-[#FFB300] font-bold">
                      <Info className="w-4 h-4" />
                      <span>Transparência do Cálculo (Sem Falsa Precisão / Determinístico)</span>
                    </div>
                    <p className="text-gray-300 font-mono text-[11px]">
                      {activeHypothesis.confidenceBreakdown.explanation}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-[11px] font-mono text-[#9AA7B4]">
                      <div>DTC: +{activeHypothesis.confidenceBreakdown.dtcWeight}%</div>
                      <div>
                        Anomalias: +{activeHypothesis.confidenceBreakdown.temporalAnomalyWeight}%
                      </div>
                      <div>
                        Correlações: +
                        {activeHypothesis.confidenceBreakdown.multiSignalCorrelationWeight}%
                      </div>
                      <div>
                        Penalidades: -
                        {activeHypothesis.confidenceBreakdown.contradictoryEvidencePenalty +
                          activeHypothesis.confidenceBreakdown.missingPidPenalty}
                        %
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidências Favoráveis vs Evidências Contrárias */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="bg-[#131A22] border border-emerald-900/40 p-3 rounded">
                    <span className="font-bold text-emerald-400 block mb-2 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Evidências Favoráveis ({activeHypothesis.favorableEvidences.length}):
                      </span>
                    </span>
                    <ul className="space-y-1.5 list-disc list-inside text-gray-300">
                      {activeHypothesis.favorableEvidences.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-[#131A22] border border-red-900/40 p-3 rounded">
                    <span className="font-bold text-red-400 block mb-2 flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>
                        Evidências Contrárias / Atenuantes (
                        {activeHypothesis.contraryEvidences.length}):
                      </span>
                    </span>
                    {activeHypothesis.contraryEvidences.length === 0 ? (
                      <span className="text-[#9AA7B4] italic">
                        Nenhuma evidência contrária direta observada.
                      </span>
                    ) : (
                      <ul className="space-y-1.5 list-disc list-inside text-gray-300">
                        {activeHypothesis.contraryEvidences.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Possíveis Causas Físicas */}
                <div className="text-xs">
                  <span className="font-bold text-[#9AA7B4] uppercase block mb-1">
                    Possíveis Causas Mecânicas/Elétricas Mapeadas:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeHypothesis.possibleCauses.map((cause, idx) => (
                      <span
                        key={idx}
                        className="bg-[#131A22] text-gray-300 border border-[#263340] px-2.5 py-1 rounded"
                      >
                        {cause}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Limitações e Dados Indisponíveis */}
                <div className="text-xs text-[#9AA7B4] bg-[#131A22] p-3 rounded border border-[#263340]">
                  <strong className="text-white">Limitações e Incertezas desta Análise:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {activeHypothesis.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                    {activeHypothesis.missingOrUnavailablePids.length > 0 && (
                      <li>
                        PIDs não suportados pela ECU que refinariam o teste:{' '}
                        <strong className="text-amber-400">
                          {activeHypothesis.missingOrUnavailablePids.join(', ')}
                        </strong>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* BLOCO 7: O QUE TESTAR AGORA (PROTOCOLO DE CONFIRMAÇÃO) */}
        {activeHypothesis && (
          <section className="bg-[#131A22] border border-[#263340] rounded-lg p-5">
            <div className="flex items-center justify-between border-b border-[#263340] pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-[#FFB300] text-black font-bold text-xs flex items-center justify-center">
                  7
                </span>
                <div>
                  <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center space-x-2">
                    <Wrench className="w-4 h-4 text-[#FFB300]" />
                    <span>O Que Testar Agora: Protocolo de Confirmação Técnica</span>
                  </h2>
                  <p className="text-xs text-[#9AA7B4]">
                    Diretriz obrigatória: Priorizar "testar antes de substituir qualquer peça".
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950 px-2.5 py-1 rounded border border-emerald-700">
                Tempo estimado: ~{activeHypothesis.confirmationProtocol.estimatedDurationMin} min
              </span>
            </div>

            <div className="bg-[#0B0F14] border-l-4 border-amber-500 p-3 rounded mb-4 text-xs text-amber-200">
              <strong>Aviso de Segurança & Conformidade:</strong>{' '}
              {activeHypothesis.confirmationProtocol.destructiveAlert}
            </div>

            {/* Passos do Protocolo */}
            <div className="space-y-3">
              {activeHypothesis.confirmationProtocol.steps.map((step) => (
                <div
                  key={step.stepNumber}
                  className="bg-[#0B0F14] border border-[#263340] rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-full bg-[#1A232E] text-white border border-[#263340] text-xs font-mono font-bold flex items-center justify-center">
                        {step.stepNumber}
                      </span>
                      <h4 className="font-bold text-white text-xs">{step.title}</h4>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        step.priority === 'ALTA'
                          ? 'bg-red-950 text-red-300 border-red-800'
                          : 'bg-blue-950 text-blue-300 border-blue-800'
                      }`}
                    >
                      Prioridade {step.priority}
                    </span>
                  </div>

                  <p className="text-xs text-gray-200 pl-7">{step.action}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7 pt-2 text-[11px]">
                    <div className="bg-[#131A22] p-2 rounded">
                      <span className="text-[#9AA7B4] block text-[9px] uppercase font-bold">
                        Ferramentas Recomendadas:
                      </span>
                      <span className="text-gray-300 font-mono">{step.toolsNeeded.join(', ')}</span>
                    </div>
                    <div className="bg-[#131A22] p-2 rounded">
                      <span className="text-emerald-400 block text-[9px] uppercase font-bold">
                        Resultado Normal (Descarte):
                      </span>
                      <span className="text-gray-300">{step.expectedOutcomeNormal}</span>
                    </div>
                    <div className="bg-[#131A22] p-2 rounded">
                      <span className="text-red-400 block text-[9px] uppercase font-bold">
                        Resultado com Falha (Confirmação):
                      </span>
                      <span className="text-gray-300">{step.expectedOutcomeFaulty}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
