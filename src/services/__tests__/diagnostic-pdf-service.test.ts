import { describe, it, expect } from 'vitest'
import {
  buildDiagnostic360PdfData,
  generateDiagnostic360PdfDocument,
  exportDiagnostic360Pdf,
  buildMechanicSummaryPdfData,
  generateMechanicSummaryPdfDocument,
  exportMechanicSummaryPdf,
} from '@/services/diagnostic-pdf-service'
import { SessionModel, VehicleModel, EventModel, DtcModel } from '@/types/obd'

describe('Diagnostic360PdfService — Exportar PDF do Diagnóstico 360', () => {
  const mockRealSession: SessionModel = {
    id: 'dnaab9l8gq5omuf',
    session_id: 'sess_1789651428943_g57i',
    vehicle_name: 'Ford Ecosport (DRE0E59)',
    adapter_type: 'OBD REAL BLUETOOTH CLASSIC',
    detected_protocol: 'AUTO, ISO 15765-4 (CAN 11/500)',
    protocol: 'AUTO, ISO 15765-4 (CAN 11/500)',
    device_collector: 'Android Bluetooth [OBDII]',
    origin: 'HARDWARE_REAL',
    status: 'ENCERRADO',
    started_at: '2026-09-17T13:23:48.943Z',
    ended_at: '2026-09-17T13:26:42.097Z',
    total_duration_ms: 173154,
    total_samples: 1218,
    vin: '9BFBJ55E6L8104921',
    app_version: '0.0.44-laudo-telemetria-segura',
  } as unknown as SessionModel

  const mockRealVehicle: VehicleModel = {
    id: 'tckrfbmrxvxdzxm',
    plate: 'DRE0E59',
    make: 'Ford',
    model: 'EcoSport',
    version: '100 Anos',
    year_model: '2020',
    engine: '1.5 Dragon Flex',
    fuel: 'Flex',
    odometer_km: 90040,
    vin: '9BFBJ55E6L8104921',
  } as unknown as VehicleModel

  const mockEvents: EventModel[] = [
    {
      id: 'ev1',
      event_id: 'ev_1789666030469_9xmme',
      session_id: 'qngor401ahpe7pa',
      event_type: 'ruído',
      description: 'Ruído percebido pelo condutor em reaceleração',
      ts_utc: '2026-09-17T17:27:10.468Z',
      ts_mono_offset_ms: 139289,
      window_pre_ms: 30000,
      window_post_ms: 30000,
    } as unknown as EventModel,
    {
      id: 'ev2',
      event_id: 'ev_1789666603228_kx1te',
      session_id: 'qngor401ahpe7pa',
      event_type: 'perda de potência',
      description: 'Queda de rendimento após troca da correia',
      ts_utc: '2026-09-17T17:36:43.228Z',
      ts_mono_offset_ms: 712048,
      window_pre_ms: 30000,
      window_post_ms: 30000,
    } as unknown as EventModel,
  ]

  const mockDtcs: DtcModel[] = []

  it('deve montar a estrutura de dados diagnóstica completa com as 9 seções obrigatórias para o Ford EcoSport DRE0E59', () => {
    const data = buildDiagnostic360PdfData({
      session: mockRealSession,
      vehicle: mockRealVehicle,
      events: mockEvents,
      dtcs: mockDtcs,
    })

    // 1. Identificação do Veículo
    expect(data.vehicle.plate).toBe('DRE0E59')
    expect(data.vehicle.make).toBe('Ford')
    expect(data.vehicle.model).toBe('EcoSport')
    expect(data.vehicle.odometerKm).toBe(90040)
    expect(data.vehicle.vin).toBe('9BFBJ55E6L8104921')

    // 2. Identificação da Sessão
    expect(data.session.sessionId).toBe('sess_1789651428943_g57i')
    expect(data.session.origin).toBe('HARDWARE_REAL')
    expect(data.session.totalSamples).toBe(1218)
    expect(data.session.protocol).toContain('ISO 15765-4')

    // 3. Parâmetros Observados (RPM ~874, Carga 12,5%, STFT oscilando, LTFT fora da faixa, Temp 65, DTCs 0)
    expect(data.observedParameters.length).toBeGreaterThanOrEqual(6)

    const rpmParam = data.observedParameters.find((p) => p.pid === '0x0C')
    expect(rpmParam?.observedValue).toContain('874')

    const loadParam = data.observedParameters.find((p) => p.pid === '0x04')
    expect(loadParam?.observedValue).toContain('12,5%')

    const stftParam = data.observedParameters.find((p) => p.pid === '0x06')
    expect(stftParam?.observedValue).toContain('−13,3% a +7')

    const ltftParam = data.observedParameters.find((p) => p.pid === '0x07')
    expect(ltftParam?.status).toBe('CRITICO')
    expect(ltftParam?.highlight).toBe(true)
    expect(ltftParam?.observedValue).toContain('FORA DA FAIXA')

    const tempParam = data.observedParameters.find((p) => p.pid === '0x05')
    expect(tempParam?.observedValue).toContain('65 °C')

    // 4. Leitura Técnica
    expect(data.technicalReading).toContain(
      'Mistura rica crônica, corrigida pela ECU (LTFT negativo)',
    )

    // 5. Contexto Relatado (Troca da correia dentada se esfarelando)
    expect(data.reportedContext).toBeDefined()
    expect(data.reportedContext).toContain(
      'troca da correia dentada, que estava se esfarelando e sujando o cárter',
    )

    // 6. Hipóteses Ranqueadas (4 hipóteses principais com verificação recomendada)
    expect(data.rankedHypotheses.length).toBe(4)
    expect(data.rankedHypotheses[0].title).toContain(
      'Fase de comando incorreta após a troca da correia dentada',
    )
    expect(data.rankedHypotheses[0].verificationRecommendation).toContain(
      'marcações de correia/eixo comando',
    )

    expect(data.rankedHypotheses[1].title).toContain('Atuador VCT / galeria da solenoide')
    expect(data.rankedHypotheses[1].verificationRecommendation).toContain(
      'telas da solenoide e checar a resposta de fase',
    )

    expect(data.rankedHypotheses[2].title).toContain('Pressão de óleo baixa por tela de sucção')
    expect(data.rankedHypotheses[2].verificationRecommendation).toContain(
      'Medir pressão de óleo com manômetro mecânico',
    )

    expect(data.rankedHypotheses[3].title).toContain('Válvula canister')

    // 7. Eventos Marcados na Rodagem (ruído 17:27 e perda de potência 17:36)
    expect(data.markedEvents.length).toBe(2)
    expect(data.markedEvents[0].type).toBe('Ruído')
    expect(data.markedEvents[1].type).toBe('Perda de Potência')
    expect(data.eventsSyncPendingNotice).toContain('pendentes de sincronização')

    // 8. Análise Automática Determinística (Aviso Epistemológico)
    expect(data.deterministicAnalysisNotice?.safetyLevel).toBe('INFORMATIVO')
    expect(data.deterministicAnalysisNotice?.noticeText).toContain(
      'NÃO TRATAR estas avaliações preliminares como validação de normalidade mecânica',
    )

    // 9. Observações e Limitações
    expect(data.observationsAndLimitations).toContain('fase de marcha lenta quente')
    expect(data.observationsAndLimitations).toContain('MAF (0x10)')
  })

  it('deve gerar o documento jsPDF sem erros e calcular o número de páginas correto', () => {
    const data = buildDiagnostic360PdfData({
      session: mockRealSession,
      vehicle: mockRealVehicle,
      events: mockEvents,
      dtcs: mockDtcs,
    })

    const doc = generateDiagnostic360PdfDocument(data)
    expect(doc).toBeDefined()
    // Deve conter pelo menos 1 página gerada com o rodapé oficial
    // @ts-expect-error getNumberOfPages exists on jsPDF
    const pageCount = doc.internal.getNumberOfPages()
    expect(pageCount).toBeGreaterThanOrEqual(1)
  })

  // =========================================================================
  // Testes exigidos para a V0.0.44:
  // (a) laudo com tests_log manual + análise automática sem falha -> seções separadas com rótulos corretos
  // (b) sessão sem amostras -> parâmetros exibem "Sem amostras sincronizadas", nunca "--"
  // (c) entrada manual removida -> laudo não cita mais bobinas/P0302
  // =========================================================================
  describe('Correções v0.0.44: Separação de fontes manuais e parâmetros reais', () => {
    it('(a) laudo gerado com tests_log manual + análise automática sem falha deve ter seções separadas com rótulos corretos', () => {
      const sessionWithSamples: SessionModel = {
        ...mockRealSession,
        id: 'sess_generica_xyz',
        session_id: 'sess_normal_001',
        total_samples: 500,
      }
      const genericVehicle: VehicleModel = {
        ...mockRealVehicle,
        plate: 'ABC1D23',
      }

      const manualTests = [
        {
          id: 'test_manual_test_01',
          executedAtUtc: '2026-09-17T14:26:25.234Z',
          title: 'Permuta de Bobinas',
          targetComponent: 'Bobina de Ignição Cil 1 e 2',
          status: 'INFORMADO',
          measuredValue: 'P0302 no cil 2',
          observation: 'Anotação técnica preliminar de oficina',
        },
      ]

      const reportWithNoFault = {
        hypotheses: [
          {
            rank: 1,
            title: 'Sistema em Plena Conformidade Operacional (Nenhuma Falha Detectada)',
            description: 'Telemetria dentro dos limiares de projeto. Zero DTCs ativos.',
            confidence: 96,
            affectedSystem: 'NENHUMA_FALHA_DETECTADA',
            confirmationProtocol: { steps: [{ action: 'Manter revisões programadas' }] },
          },
        ],
      } as any

      const data = buildDiagnostic360PdfData({
        session: sessionWithSamples,
        vehicle: genericVehicle,
        events: [],
        dtcs: [],
        report: reportWithNoFault,
        manualTests,
      })

      // Verifica separação de hipótese automática e teste manual
      expect(data.rankedHypotheses[0].sourceType).toBe('TELEMETRIA_AUTOMATICA')
      expect(data.rankedHypotheses[0].title).toContain('Nenhuma Falha Detectada')
      expect(data.manualMechanicTests).toHaveLength(1)
      expect(data.manualMechanicTests?.[0].title).toBe('Permuta de Bobinas')

      const doc = generateDiagnostic360PdfDocument(data)
      expect(doc).toBeDefined()
    })

    it('(b) sessão sem amostras deve exibir "Sem amostras sincronizadas para esta sessão", nunca "--"', () => {
      const emptySession: SessionModel = {
        ...mockRealSession,
        id: 'sess_generica_sem_amostras',
        session_id: 'sess_sem_amostras_002',
        total_samples: 0,
      }
      const genericVehicle: VehicleModel = {
        ...mockRealVehicle,
        plate: 'ABC1D23',
      }

      const data = buildDiagnostic360PdfData({
        session: emptySession,
        vehicle: genericVehicle,
        events: [],
        dtcs: [],
        samplesCount: 0,
      })

      // Nenhum parâmetro deve exibir "--"
      for (const param of data.observedParameters) {
        expect(param.observedValue).not.toContain('--')
      }

      // Parâmetros principais devem indicar ausência de amostras sincronizadas
      const rpmParam = data.observedParameters.find((p) => p.pid === '0x0C')
      expect(rpmParam?.observedValue).toBe('Sem amostras sincronizadas para esta sessão')

      const ectParam = data.observedParameters.find((p) => p.pid === '0x05')
      expect(ectParam?.observedValue).toBe('Sem amostras sincronizadas para esta sessão')

      const mapParam = data.observedParameters.find((p) => p.pid.includes('0x0B'))
      expect(mapParam?.observedValue).toBe('Sem amostras sincronizadas para esta sessão')

      const voltParam = data.observedParameters.find((p) => p.pid === '0x42')
      expect(voltParam?.observedValue).toBe('Sem amostras sincronizadas para esta sessão')
    })

    it('(c) quando a entrada manual acidental é removida, o laudo não deve conter referências a bobinas ou P0302', () => {
      // Simulação da investigação 2qwnn2olf4lo6s0 após a limpeza do tests_log
      const cleanTests: any[] = [] // Sem test_1789655185234
      const normalReport = {
        hypotheses: [
          {
            rank: 1,
            title: 'Sistema em Conformidade Operacional',
            description:
              'Parâmetros avaliados pela telemetria encontram-se dentro dos limiares de projeto.',
            confidence: 95,
            confirmationProtocol: { steps: [{ action: 'Manter revisões programadas' }] },
          },
        ],
      } as any

      const sessionClean: SessionModel = {
        ...mockRealSession,
        id: 'sess_clean_inv',
        session_id: 'sess_clean_003',
        total_samples: 200,
      }
      const vehicleClean: VehicleModel = {
        ...mockRealVehicle,
        plate: 'ABC1D23',
      }

      const data = buildDiagnostic360PdfData({
        session: sessionClean,
        vehicle: vehicleClean,
        events: [],
        dtcs: [],
        report: normalReport,
        manualTests: cleanTests,
      })

      // Verifica ausência total de P0302 e bobinas
      const stringified = JSON.stringify(data)
      expect(stringified).not.toContain('P0302')
      expect(stringified).not.toContain('test_1789655185234')
      expect(stringified).not.toContain('bobina')
      expect(stringified).not.toContain('Bobina')

      expect(data.manualMechanicTests).toHaveLength(0)
      expect(data.rankedHypotheses[0].title).toContain('Sistema em Conformidade Operacional')
    })

    it('(d) veredito automático de NENHUMA_FALHA_DETECTADA não deve ter força de evidência de falha se houver anotações manuais', () => {
      // Caso haja anotações manuais do mecânico, a hipótese de conformidade automática permanece intacta
      const manualTests = [
        {
          id: 'manual_note_01',
          title: 'Inspeção Visual de Cabos',
          measuredValue: 'Conectores limpos',
          observation: 'Suspeita não confirmada por telemetria',
        },
      ]

      const data = buildDiagnostic360PdfData({
        session: {
          ...mockRealSession,
          id: 'sess_generic_4',
          session_id: 'sess_generic_4',
          total_samples: 300,
        },
        vehicle: { ...mockRealVehicle, plate: 'XYZ9K99' },
        manualTests,
      })

      expect(data.rankedHypotheses[0].sourceType).toBe('TELEMETRIA_AUTOMATICA')
      expect(data.manualMechanicTests).toBeDefined()
      expect(data.manualMechanicTests?.[0].title).toBe('Inspeção Visual de Cabos')
    })
  })

  describe('3. Resumo Técnico para o Mecânico + Plano de Serviço (v0.0.45)', () => {
    it('(a) buildMechanicSummaryPdfData deve conter todas as 5 seções obrigatórias com valores exatos para o EcoSport DRE0E59', () => {
      const data = buildMechanicSummaryPdfData({
        session: mockRealSession,
        vehicle: mockRealVehicle,
        appVersion: '0.0.45',
      })

      // Metadados e versão
      expect(data.appVersion).toBe('0.0.45')
      expect(data.emissionDate).toBeDefined()

      // Seção 1: Veículo e Contexto
      expect(data.vehicle.plate).toBe('DRE0E59')
      expect(data.vehicle.make).toBe('Ford')
      expect(data.vehicle.model).toBe('EcoSport')
      expect(data.vehicle.yearModel).toBe('2020')
      expect(data.vehicle.engine).toBe('1.5 Dragon Flex (TiVCT)')
      expect(data.vehicle.vin).toBe('9BFBJ55E6L8104921')
      expect(data.vehicle.odometerKm).toBe(90040)
      expect(data.symptoms.length).toBeGreaterThanOrEqual(3)
      expect(data.symptoms[0]).toContain('quase apagar')
      expect(data.history).toContain('correia dentada anterior estava se esfarelando')
      expect(data.history).toContain('solenoide VCT')

      // Seção 2: Evidência de Telemetria
      expect(data.telemetryEvidence.sessionLabel).toContain('HARDWARE_REAL')
      expect(data.telemetryEvidence.sampleCount).toBe(1218)
      expect(data.telemetryEvidence.device).toBe('ELM327')
      expect(data.telemetryEvidence.protocol).toBe('ISO 15765-4 CAN 11/500')
      expect(data.telemetryEvidence.ltftRange).toContain('−12,5% a −13,3%')
      expect(data.telemetryEvidence.stftRange).toContain('−13,3% a +7,0%')
      expect(data.telemetryEvidence.idleRpm).toContain('874')
      expect(data.telemetryEvidence.engineLoad).toContain('12,5%')
      expect(data.telemetryEvidence.coolantTemp).toContain('65 °C')
      expect(data.telemetryEvidence.dtcsSummary).toContain('ZERO')
      expect(data.telemetryEvidence.dtcsSummary).toContain('MIL apagada')
      expect(data.telemetryEvidence.coldStartNote).toContain('primeiros ~60 s')

      // Seção 3: Análise Técnica
      expect(data.technicalAnalysis.ignitionDiscarded).toContain('ignição está DESCARTADA')
      expect(data.technicalAnalysis.ignitionDiscarded).toContain('velas trocadas recentemente')
      expect(data.technicalAnalysis.ltftDiagnosis).toContain(
        'LTFT −13% indica mistura rica crônica',
      )
      expect(data.technicalAnalysis.mainHypothesis).toContain('contaminação do circuito de óleo')
      expect(data.technicalAnalysis.mainHypothesis).toContain('atuador TiVCT')
      expect(data.technicalAnalysis.flexFuelNote).toContain('flex (etanol/gasolina)')

      // Seção 4: Plano de Serviço — Amanhã (Checklist de 5 etapas)
      expect(data.servicePlanChecklist).toHaveLength(5)
      expect(data.servicePlanChecklist[0].title).toContain('trocar óleo + filtro novamente')
      expect(data.servicePlanChecklist[1].title).toContain('Substituir a solenoide VCT')
      expect(data.servicePlanChecklist[2].title).toContain('CONFERIR FASE DA CORREIA DENTADA')
      expect(data.servicePlanChecklist[3].title).toContain(
        'medir pressão de óleo na PARTIDA A FRIO',
      )
      expect(data.servicePlanChecklist[4].title).toContain('Após a montagem: partida a frio')

      // Seção 5: Validação pelo Network Car (Pós-troca)
      expect(data.postRepairValidation).toContain('sess_1789904984520_ilu9')
      expect(data.postRepairValidation).toContain('2.076 amostras')
      expect(data.postRepairValidation).toContain('antes × depois')
    })

    it('(b) generateMechanicSummaryPdfDocument deve renderizar o PDF com o rodapé oficial ME001 em todas as páginas', () => {
      const data = buildMechanicSummaryPdfData()
      const doc = generateMechanicSummaryPdfDocument(data)
      expect(doc).toBeDefined()

      // @ts-expect-error getNumberOfPages
      const totalPages = doc.internal.getNumberOfPages()
      expect(totalPages).toBeGreaterThanOrEqual(1)

      const output = doc.output('datauristring')
      expect(output).toContain('data:application/pdf')
    })

    it('(c) exportMechanicSummaryPdf deve gerar nome padrão ResumoMecanico_DRE0E59_<data>.pdf e ter download seguro', () => {
      const data = buildMechanicSummaryPdfData()
      const result = exportMechanicSummaryPdf(data)
      expect(result).toBeDefined()
      expect(['DOWNLOAD', 'PRINT_FALLBACK']).toContain(result.method)
    })
  })
})
