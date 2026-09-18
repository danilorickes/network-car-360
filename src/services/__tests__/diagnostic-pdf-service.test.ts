import { describe, it, expect } from 'vitest'
import {
  buildDiagnostic360PdfData,
  generateDiagnostic360PdfDocument,
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
    app_version: '0.0.43-homologacao-e6.6.1',
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
})
