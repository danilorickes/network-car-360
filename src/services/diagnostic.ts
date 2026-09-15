import pb from '@/lib/pocketbase/client'
import { Diagnostic360Report } from '@/types/diagnostic'

export interface DiagnosticAnalysisModel {
  id?: string
  session?: string
  event?: string
  session_id: string
  event_id: string
  symptom_type?: string
  safety_level: 'INFORMATIVO' | 'ATENCAO' | 'CRITICO'
  hypotheses_count: number
  top_hypothesis_title?: string
  top_hypothesis_confidence?: number
  report_json: Diagnostic360Report
  created?: string
  updated?: string
}

export const diagnosticService = {
  /**
   * Salva o relatório do Diagnóstico 360 no PocketBase
   */
  async saveReport(
    report: Diagnostic360Report,
    pbSessionId?: string,
    pbEventId?: string,
  ): Promise<DiagnosticAnalysisModel> {
    const topHyp = report.hypotheses[0]
    const data = {
      session: pbSessionId || null,
      event: pbEventId || null,
      session_id: report.sessionId,
      event_id: report.eventId,
      symptom_type: report.symptomType,
      safety_level: report.safetyOverall,
      hypotheses_count: report.hypotheses.length,
      top_hypothesis_title: topHyp ? topHyp.title : 'Em conformidade',
      top_hypothesis_confidence: topHyp ? topHyp.confidence : 95,
      report_json: report,
    }

    try {
      const record = await pb
        .collection('diagnostic_analyses')
        .create<DiagnosticAnalysisModel>(data)
      return record
    } catch (e) {
      console.warn('Persistência remota do diagnóstico indisponível, mantendo em memória local:', e)
      return {
        id: `local_${report.reportId}`,
        ...data,
      } as DiagnosticAnalysisModel
    }
  },

  /**
   * Busca relatório persistido por event_id
   */
  async getByEventId(eventId: string): Promise<Diagnostic360Report | null> {
    try {
      const record = await pb
        .collection('diagnostic_analyses')
        .getFirstListItem<DiagnosticAnalysisModel>(`event_id = "${eventId}"`)
      return record.report_json || null
    } catch {
      return null
    }
  },

  /**
   * Lista todos os relatórios diagnósticos de uma sessão
   */
  async listBySession(sessionId: string): Promise<DiagnosticAnalysisModel[]> {
    try {
      const list = await pb.collection('diagnostic_analyses').getFullList<DiagnosticAnalysisModel>({
        filter: `session_id = "${sessionId}"`,
        sort: '-created',
      })
      return list
    } catch {
      return []
    }
  },
}
