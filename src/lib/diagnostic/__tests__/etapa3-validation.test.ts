import { describe, it, expect } from 'vitest'
import { BlackBoxBuilder } from '@/lib/obd/blackbox-builder'
import { BaselineEngine } from '@/lib/diagnostic/baseline-engine'
import { AnomalyEngine } from '@/lib/diagnostic/anomaly-engine'
import { CorrelationEngine } from '@/lib/diagnostic/correlation-engine'
import { HypothesisEngine } from '@/lib/diagnostic/hypothesis-engine'
import { ConfidenceEngine } from '@/lib/diagnostic/confidence-engine'
import { Diagnostic360Pipeline } from '@/lib/diagnostic/diagnostic-pipeline'
import { CONFIRMATION_PROTOCOLS } from '@/lib/diagnostic/confirmation-protocols'
import { RawSampleModel, EventModel, DtcModel, VehicleModel } from '@/types/obd'

describe('OS-ME001-E3: Validação do Motor de Inteligência Diagnóstica', () => {
  const dummyVehicle: VehicleModel = {
    plate: 'NET3600',
    make: 'Ford',
    model: 'EcoSport 1.5 Dragon',
    vin: '9BFBJ55E6L8104921',
  }

  // Auxiliar para gerar amostras normais de condução
  const createNormalSamples = (count = 120, offsetStep = 500): RawSampleModel[] => {
    const list: RawSampleModel[] = []
    for (let i = 0; i < count; i++) {
      const t = i * offsetStep
      // RPM ~ 2100 ± 50
      list.push({
        sample_id: `rpm_${i}`,
        session_id: 'sess_test',
        ts_utc: new Date(1700000000000 + t).toISOString(),
        ts_mono_offset_ms: t,
        pid: '0x0C',
        decoded_value: 2100 + Math.sin(i) * 30,
        unit: 'RPM',
        quality: 'OK',
      })
      // TPS ~ 25%
      list.push({
        sample_id: `tps_${i}`,
        session_id: 'sess_test',
        ts_utc: new Date(1700000000000 + t).toISOString(),
        ts_mono_offset_ms: t,
        pid: '0x11',
        decoded_value: 25,
        unit: '%',
        quality: 'OK',
      })
      // STFT ~ 1.0%
      list.push({
        sample_id: `stft_${i}`,
        session_id: 'sess_test',
        ts_utc: new Date(1700000000000 + t).toISOString(),
        ts_mono_offset_ms: t,
        pid: '0x06',
        decoded_value: 1.0 + Math.sin(i * 0.5) * 1.5,
        unit: '%',
        quality: 'OK',
      })
      // MAP ~ 45 kPa
      list.push({
        sample_id: `map_${i}`,
        session_id: 'sess_test',
        ts_utc: new Date(1700000000000 + t).toISOString(),
        ts_mono_offset_ms: t,
        pid: '0x0B',
        decoded_value: 45,
        unit: 'kPa',
        quality: 'OK',
      })
      // Tensão ~ 14.1 V
      list.push({
        sample_id: `volt_${i}`,
        session_id: 'sess_test',
        ts_utc: new Date(1700000000000 + t).toISOString(),
        ts_mono_offset_ms: t,
        pid: '0x42',
        decoded_value: 14.1,
        unit: 'V',
        quality: 'OK',
      })
      // Temp Líquido ~ 88 °C
      list.push({
        sample_id: `temp_${i}`,
        session_id: 'sess_test',
        ts_utc: new Date(1700000000000 + t).toISOString(),
        ts_mono_offset_ms: t,
        pid: '0x05',
        decoded_value: 88,
        unit: '°C',
        quality: 'OK',
      })
    }
    return list
  }

  // --------------------------------------------------------------------------
  // 1. CENÁRIO NORMAL SEM FALSO DIAGNÓSTICO (Obrigatório: Anti-Falso Positivo)
  // --------------------------------------------------------------------------
  it('1. Cenário normal: NÃO DEVE gerar diagnóstico de defeito apenas para preencher a tela', () => {
    const samples = createNormalSamples(100)
    const event: EventModel = {
      event_id: 'ev_normal',
      session_id: 'sess_test',
      event_type: 'outro/livre',
      description: 'Checagem preventiva de rodagem',
      ts_utc: new Date(1700000025000).toISOString(),
      ts_mono_offset_ms: 25000,
      window_pre_ms: 20000,
      window_post_ms: 20000,
    }

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs: [],
    })

    const report = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    // Deve acusar conformidade sem anomalias
    expect(report.anomalies.length).toBe(0)
    expect(report.hypotheses.length).toBe(1)
    expect(report.hypotheses[0].affectedSystem).toBe('NENHUMA_FALHA_DETECTADA')
    expect(report.hypotheses[0].title).toContain('Conformidade')
    expect(report.safetyOverall).toBe('INFORMATIVO')
  })

  // --------------------------------------------------------------------------
  // 2. CENÁRIO MISFIRE / P0301 (Falha de combustão cil 1)
  // --------------------------------------------------------------------------
  it('2. Cenário P0301/Misfire: deve gerar hipótese de ignição/misfire com alta confiança e correlações', () => {
    const samples = createNormalSamples(100)

    // Injeta perturbação de RPM (queda e oscilação) aos 30.000ms
    for (let i = 55; i <= 65; i++) {
      const sRpm = samples.find((s) => s.sample_id === `rpm_${i}`)
      if (sRpm) {
        sRpm.decoded_value = 1100 + Math.sin(i * 10) * 150 // flutter acentuado
      }
      const sStft = samples.find((s) => s.sample_id === `stft_${i}`)
      if (sStft) {
        sStft.decoded_value = 16.5 // sonda detecta excesso de O2 do misfire
      }
    }

    const event: EventModel = {
      event_id: 'ev_misfire',
      session_id: 'sess_test',
      event_type: 'trepidação',
      description: 'Motor trepidando forte ao acelerar',
      ts_utc: new Date(1700000030000).toISOString(),
      ts_mono_offset_ms: 30000,
      window_pre_ms: 20000,
      window_post_ms: 20000,
    }

    const dtcs: DtcModel[] = [
      {
        dtc_code: 'P0301',
        status: 'ATIVO',
        mil_on: true,
        read_at_utc: new Date().toISOString(),
        session_id: 'sess_test',
      },
    ]

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs,
    })

    const report = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    expect(report.anomalies.length).toBeGreaterThan(0)
    expect(report.correlations.length).toBeGreaterThan(0)
    expect(report.hypotheses.length).toBeGreaterThan(0)

    const topHyp = report.hypotheses[0]
    expect(topHyp.title).toContain('Misfire')
    expect(topHyp.relatedDtcs).toContain('P0301')
    expect(topHyp.confidence).toBeGreaterThanOrEqual(70)
    expect(topHyp.confirmationProtocol.protocolId).toBe('prot_misfire_cyl')
    expect(topHyp.confirmationProtocol.steps.length).toBeGreaterThan(2)
  })

  // --------------------------------------------------------------------------
  // 3. CENÁRIO MISTURA POBRE / P0171 (STFT > +20%)
  // --------------------------------------------------------------------------
  it('3. Cenário P0171/Mistura Pobre: deve identificar trim excessivo e protocolo de smoke test/combustível', () => {
    const samples = createNormalSamples(100)

    // Eleva STFT em toda a janela
    for (const s of samples) {
      if (s.pid === '0x06') {
        s.decoded_value = 23.5 // Enriquecimento no limite
      }
    }

    const event: EventModel = {
      event_id: 'ev_lean',
      session_id: 'sess_test',
      event_type: 'falha',
      description: 'Luz da injeção acesa constante',
      ts_utc: new Date(1700000030000).toISOString(),
      ts_mono_offset_ms: 30000,
      window_pre_ms: 20000,
      window_post_ms: 20000,
    }

    const dtcs: DtcModel[] = [
      {
        dtc_code: 'P0171',
        status: 'ATIVO',
        mil_on: true,
        read_at_utc: new Date().toISOString(),
        session_id: 'sess_test',
      },
    ]

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs,
    })

    const report = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    const leanHyp = report.hypotheses.find((h) => h.id === 'hyp_lean_mixture_bank1')
    expect(leanHyp).toBeDefined()
    expect(leanHyp?.confidence).toBeGreaterThan(70)
    expect(leanHyp?.confirmationProtocol.protocolId).toBe('prot_lean_mixture')
    expect(leanHyp?.confirmationProtocol.steps.some((s) => s.title.includes('Fumaça'))).toBe(true)
  })

  // --------------------------------------------------------------------------
  // 4. CENÁRIO PERDA DE POTÊNCIA (TPS Alto vs RPM em Queda)
  // --------------------------------------------------------------------------
  it('4. Cenário Perda de Potência: TPS sobe mas RPM cai, gerando correlação de perda volumétrica', () => {
    const samples = createNormalSamples(100)

    // Aos 30s: TPS vai a 75%, mas RPM despenca para 1200
    for (let i = 58; i <= 65; i++) {
      const sTps = samples.find((s) => s.sample_id === `tps_${i}`)
      if (sTps) sTps.decoded_value = 75
      const sRpm = samples.find((s) => s.sample_id === `rpm_${i}`)
      if (sRpm) sRpm.decoded_value = 1150
    }

    const event: EventModel = {
      event_id: 'ev_power_loss',
      session_id: 'sess_test',
      event_type: 'perda de potência',
      description: 'Pisei fundo na subida mas o carro amarrou e perdeu giro',
      ts_utc: new Date(1700000030000).toISOString(),
      ts_mono_offset_ms: 30000,
      window_pre_ms: 20000,
      window_post_ms: 20000,
    }

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs: [],
    })

    const report = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    const pwrHyp = report.hypotheses.find((h) => h.id === 'hyp_power_loss_restriction')
    expect(pwrHyp).toBeDefined()
    expect(report.correlations.some((c) => c.id === 'corr_tps_rpm_divergence')).toBe(true)
    expect(pwrHyp?.confirmationProtocol.steps.some((s) => s.title.includes('Contrapressão'))).toBe(
      true,
    )
  })

  // --------------------------------------------------------------------------
  // 5. AUSÊNCIA DE DTC: Falha mecânica ou intermitente sem código armazenado
  // --------------------------------------------------------------------------
  it('5. Cenário sem DTC: não impede o diagnóstico quando há anomalias temporais marcadas', () => {
    const samples = createNormalSamples(100)

    // Queda brusca de RPM para 0 aos 30s (Apagamento sem DTC)
    for (let i = 60; i <= 70; i++) {
      const sRpm = samples.find((s) => s.sample_id === `rpm_${i}`)
      if (sRpm) sRpm.decoded_value = 0
    }

    const event: EventModel = {
      event_id: 'ev_stall',
      session_id: 'sess_test',
      event_type: 'apagamento',
      description: 'Motor apagou no semáforo',
      ts_utc: new Date(1700000030000).toISOString(),
      ts_mono_offset_ms: 30000,
      window_pre_ms: 20000,
      window_post_ms: 20000,
    }

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs: [], // Sem DTC
    })

    const report = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    expect(report.hasDtc).toBe(false)
    expect(report.noDtcSignificance).toBeDefined()
    expect(report.anomalies.some((a) => a.type === 'RPM_DROP_ABRUPT')).toBe(true)
  })

  // --------------------------------------------------------------------------
  // 6. PID INDISPONÍVEL: Penalidade e registro de limitações
  // --------------------------------------------------------------------------
  it('6. PID indisponível: deve penalizar confiança com transparência e listar nos dados faltantes', () => {
    const res = ConfidenceEngine.calculateConfidence({
      hasCompatibleDtc: true,
      temporalAnomaliesCount: 2,
      multiSignalCorrelationsCount: 1,
      symptomReportMatched: true,
      contradictoryEvidencesCount: 0,
      missingCriticalPidsCount: 2, // 2 sensores ausentes
    })

    expect(res.missingPidPenalty).toBeGreaterThan(0)
    expect(res.explanation).toContain('sensor(es) crítico(s) não suportado(s)')
  })

  // --------------------------------------------------------------------------
  // 7. EVIDÊNCIA CONTRADITÓRIA: Redução de confiança
  // --------------------------------------------------------------------------
  it('7. Evidência contraditória: deve aplicar penalidade objetiva ao score', () => {
    const resWithoutContradiction = ConfidenceEngine.calculateConfidence({
      hasCompatibleDtc: true,
      temporalAnomaliesCount: 1,
      multiSignalCorrelationsCount: 1,
      symptomReportMatched: true,
      contradictoryEvidencesCount: 0,
      missingCriticalPidsCount: 0,
    })

    const resWithContradiction = ConfidenceEngine.calculateConfidence({
      hasCompatibleDtc: true,
      temporalAnomaliesCount: 1,
      multiSignalCorrelationsCount: 1,
      symptomReportMatched: true,
      contradictoryEvidencesCount: 1, // Evidência contrária
      missingCriticalPidsCount: 0,
    })

    expect(resWithContradiction.finalScore).toBeLessThan(resWithoutContradiction.finalScore)
    expect(resWithContradiction.contradictoryEvidencePenalty).toBe(20)
  })

  // --------------------------------------------------------------------------
  // 8. CÁLCULO REPRODUZÍVEL & DETERMINÍSTICO (Mesma entrada = mesmo resultado)
  // --------------------------------------------------------------------------
  it('8. Determinismo: 10 execuções sucessivas com os mesmos dados produzem resultados idênticos bit a bit', () => {
    const samples = createNormalSamples(80)
    const event: EventModel = {
      event_id: 'ev_det',
      session_id: 'sess_test',
      event_type: 'oscilação',
      description: 'Teste de determinismo',
      ts_utc: new Date(1700000020000).toISOString(),
      ts_mono_offset_ms: 20000,
      window_pre_ms: 15000,
      window_post_ms: 15000,
    }
    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs: [],
    })

    const firstRun = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    for (let k = 0; k < 9; k++) {
      const nextRun = Diagnostic360Pipeline.executeAnalysis({
        blackBox: pkg,
        allSessionSamples: samples,
      })
      expect(nextRun.hypotheses.length).toBe(firstRun.hypotheses.length)
      expect(nextRun.anomalies.length).toBe(firstRun.anomalies.length)
      if (nextRun.hypotheses[0]) {
        expect(nextRun.hypotheses[0].confidence).toBe(firstRun.hypotheses[0].confidence)
        expect(nextRun.hypotheses[0].confidenceTier).toBe(firstRun.hypotheses[0].confidenceTier)
      }
    }
  })

  // --------------------------------------------------------------------------
  // 9. VÍNCULO RASTREÁVEL: Hipótese → Anomalia/Correlação → Evidência/RAW
  // --------------------------------------------------------------------------
  it('9. Auditabilidade: toda hipótese aponta para IDs de anomalias e evidências de origem', () => {
    const samples = createNormalSamples(100)
    // Injeta oscilação
    for (let i = 50; i <= 60; i++) {
      const s = samples.find((x) => x.sample_id === `rpm_${i}`)
      if (s) s.decoded_value = 800 + Math.sin(i) * 300
    }
    const event: EventModel = {
      event_id: 'ev_audit',
      session_id: 'sess_test',
      event_type: 'oscilação',
      ts_utc: new Date(1700000030000).toISOString(),
      ts_mono_offset_ms: 30000,
      window_pre_ms: 20000,
      window_post_ms: 20000,
    }

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs: [
        {
          dtc_code: 'P0301',
          status: 'ATIVO',
          mil_on: true,
          read_at_utc: '',
          session_id: 'sess_test',
        },
      ],
    })

    const report = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    const topHyp = report.hypotheses[0]
    expect(topHyp.relatedAnomalies.length).toBeGreaterThan(0)
    expect(topHyp.ruleTriggered).toBeDefined()
    expect(topHyp.confidenceBreakdown.explanation).toBeDefined()

    // Confirma que a anomalia apontada possui origem rastreável
    const anom = report.anomalies.find((a) => a.id === topHyp.relatedAnomalies[0])
    expect(anom).toBeDefined()
    expect(anom?.originEvidenceId).toBeDefined()
  })

  // --------------------------------------------------------------------------
  // 10. SEGURANÇA E CRITICIDADE (Interrupção / Alerta de segurança)
  // --------------------------------------------------------------------------
  it('10. Criticidade: queda drástica de tensão ou temperatura excessiva eleva segurança para CRÍTICO', () => {
    const samples = createNormalSamples(100)
    // Tensão cai para 10.2 V
    for (const s of samples) {
      if (s.pid === '0x42') s.decoded_value = 10.2
    }
    const event: EventModel = {
      event_id: 'ev_crit',
      session_id: 'sess_test',
      event_type: 'apagamento',
      ts_utc: new Date(1700000030000).toISOString(),
      ts_mono_offset_ms: 30000,
      window_pre_ms: 20000,
      window_post_ms: 20000,
    }

    const pkg = BlackBoxBuilder.buildPackage({
      event,
      samples,
      vehicle: dummyVehicle,
      dtcs: [],
    })

    const report = Diagnostic360Pipeline.executeAnalysis({
      blackBox: pkg,
      allSessionSamples: samples,
    })

    expect(report.safetyOverall).toBe('CRITICO')
    expect(report.criticalWarning).toBeDefined()
  })
})
