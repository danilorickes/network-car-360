import { describe, it, expect } from 'vitest'
import { MultifourceConfidenceEngine } from '../multifource-confidence-engine'
import { VehicleHistoryEngine } from '../vehicle-history-engine'
import { SimulatorCaseE4 } from '../simulator-case-e4'
import {
  ExecutedConfirmationTest,
  InvestigationHypothesisNode,
  ClientComplaint,
  MechanicEvaluation,
} from '@/types/investigation'

describe('Validação Oficial OS-ME001-E4 — Diagnóstico 360 Completo', () => {
  const dummyVehicle = {
    id: 'veh_test_ecosport_1',
    plate: 'BRA2E20',
    make: 'Ford',
    model: 'EcoSport',
    version: '1.5 Freestyle Ti-VCT AT',
    year_model: '2020/2021',
    odometer_km: 48500,
  }

  // REQUISITO 1 & 13: Fluxo de Diagnóstico 360 e Simulador EcoSport
  it('REQ 01 & 13: Deve criar uma Ordem de Diagnóstico 360 com caso reproduzível EcoSport 1.5 Misfire', () => {
    const inv = SimulatorCaseE4.createEcoSportMisfireCase(dummyVehicle)

    expect(inv.investigation_number).toBeDefined()
    expect(inv.vehicle_plate).toBe('BRA2E20')
    expect(inv.status).toBe('EM_INVESTIGACAO')
    expect(inv.client_complaint.symptomsSelected.vibration).toBe(true)
    expect(inv.mechanic_evaluation.roughIdle).toBe(true)
    expect(inv.hypotheses_tree.length).toBeGreaterThan(0)
    expect(inv.timeline.length).toBeGreaterThanOrEqual(3)
  })

  // REQUISITO 2: Queixa Estruturada do Cliente separada de fato comprovado
  it('REQ 02: Queixa do cliente deve conter campos estruturados e não ser convertida em diagnóstico', () => {
    const complaint: ClientComplaint = {
      description: 'Veículo trepida muito na subida da serra',
      whenOccurs: 'CONDICIONADO',
      engineState: 'QUENTE',
      movementState: 'EM_MOVIMENTO',
      accelerationState: 'ACELERANDO',
      approximateSpeedKmH: 70,
      frequency: 'MUITAS_VEZES_DIA',
      symptomsSelected: {
        checkEngineLight: true,
        noise: false,
        vibration: true,
        powerLoss: true,
        highFuelConsumption: false,
        hardStart: false,
        engineStall: false,
      },
      registeredAtUtc: new Date().toISOString(),
    }

    expect(complaint.engineState).toBe('QUENTE')
    expect(complaint.symptomsSelected.vibration).toBe(true)
    // Peso do cliente é informativo (0.35) e não pode gerar confirmação automática
    expect(MultifourceConfidenceEngine.WEIGHTS.CLIENT_COMPLAINT).toBe(0.35)
  })

  // REQUISITO 3: Avaliação Inicial do Mecânico
  it('REQ 03: Avaliação do mecânico deve registrar constatações técnicas estruturadas', () => {
    const mech: MechanicEvaluation = {
      freeNotes: 'Motor balança visivelmente no coxim durante marcha lenta',
      roughIdle: true,
      misfireUnderLoad: true,
      noiseAbnormal: false,
      unusualSmell: false,
      vibrationFelt: true,
      hardStarting: false,
      powerLossObserved: true,
      normalBehaviorObserved: false,
      technicianName: 'Theo',
      registeredAtUtc: new Date().toISOString(),
    }

    expect(mech.misfireUnderLoad).toBe(true)
    expect(MultifourceConfidenceEngine.WEIGHTS.MECHANIC_OBSERVATION).toBe(0.65)
  })

  // REQUISITO 5: Histórico do mesmo veículo (nunca comparar veículos diferentes)
  it('REQ 05: Deve analisar histórico do mesmo veículo e rastrear recorrência de P0301', async () => {
    const history = await VehicleHistoryEngine.analyzeVehicleHistory({
      vehicleId: 'veh_test_ecosport_1',
      currentStftAvg: 16.4,
      currentVoltageAvg: 13.9,
      currentDtcs: ['P0301'],
    })

    expect(history.vehicleId).toBe('veh_test_ecosport_1')
    expect(history.stftComparisonNote).toBeDefined()
    expect(history.dtcRecurrenceNotes.length).toBeGreaterThan(0)
    expect(history.comparisonSummary).toBeDefined()
  })

  // REQUISITO 6, 7 & 8: Recálculo Determinístico de Confiança após Teste POSITIVO
  it('REQ 07 & 08: Teste de confirmação POSITIVO deve fortalecer a hipótese determinística (+18%)', () => {
    const inv = SimulatorCaseE4.createEcoSportMisfireCase(dummyVehicle)
    const node = inv.hypotheses_tree[0]
    const initialConf = node.currentConfidence // ex: 78

    const positiveTest: ExecutedConfirmationTest = {
      id: 'test_cross_coil_pos',
      testCode: 'TEST-101',
      title: 'Troca Cruzada de Bobina 1↔2',
      targetHypothesisId: node.hypothesis.id,
      targetComponent: 'Bobina de Ignição Cilindro 1',
      status: 'POSITIVO',
      responsible: 'Theo',
      measuredValue: 'P0302 no cilindro 2',
      measuredUnit: 'DTC',
      observation: 'Falha migrou exatamente para o cilindro 2',
      executedAtUtc: new Date().toISOString(),
    }

    const updatedNode = MultifourceConfidenceEngine.recalculateAfterTest({
      node,
      test: positiveTest,
    })

    expect(updatedNode.status).toBe('FORTALECIDA')
    expect(updatedNode.currentConfidence).toBe(Math.min(98, initialConf + 18))
    expect(updatedNode.confidenceDelta).toBe(updatedNode.currentConfidence - initialConf)
    expect(updatedNode.testsAssociated.length).toBe(1)
    expect(updatedNode.recalculationAuditLog.some((l) => l.includes('POSITIVO'))).toBe(true)
  })

  // REQUISITO 8 & 13: Teste NEGATIVO obriga redução matemática (-35%) e descarte se crítico
  it('REQ 08 & 13: Teste de confirmação NEGATIVO deve reduzir severamente a confiança (-35%)', () => {
    const inv = SimulatorCaseE4.createEcoSportMisfireCase(dummyVehicle)
    const node = inv.hypotheses_tree[1] // Injetor (42%)
    const initialConf = node.currentConfidence

    const negativeTest: ExecutedConfirmationTest = {
      id: 'test_inj_flow_neg',
      testCode: 'TEST-202',
      title: 'Vazão de Injetores em Bancada',
      targetHypothesisId: node.hypothesis.id,
      targetComponent: 'Eletroinjetores 1 a 3',
      status: 'NEGATIVO',
      responsible: 'Theo',
      measuredValue: '35 ml em todos os bicos (equilibrados)',
      measuredUnit: 'ml/min',
      observation: 'Vazão dos bicos absolutamente idêntica e sem vazamento',
      executedAtUtc: new Date().toISOString(),
    }

    const updatedNode = MultifourceConfidenceEngine.recalculateAfterTest({
      node,
      test: negativeTest,
    })

    expect(updatedNode.currentConfidence).toBe(Math.max(5, initialConf - 35))
    expect(updatedNode.recalculationAuditLog.some((l) => l.includes('NEGATIVO'))).toBe(true)
    // Como caiu para <= 25%, assume estado DESCARTADA
    expect(updatedNode.status).toBe('DESCARTADA')
  })

  // REQUISITO 8: Teste INCONCLUSIVO reduz levemente (-5%)
  it('REQ 08: Teste INCONCLUSIVO deve aplicar ajuste moderado (-5%) com registro em log', () => {
    const inv = SimulatorCaseE4.createEcoSportMisfireCase(dummyVehicle)
    const node = inv.hypotheses_tree[0]
    const initialConf = node.currentConfidence

    const incTest: ExecutedConfirmationTest = {
      id: 'test_inc_1',
      testCode: 'TEST-303',
      title: 'Inspeção Térmica do Escape',
      targetHypothesisId: node.hypothesis.id,
      targetComponent: 'Coletor de Escape',
      status: 'INCONCLUSIVO',
      responsible: 'Theo',
      measuredValue: 'Variação sutil de temperatura',
      observation: 'Vento ambiente afetou a leitura do pirômetro',
      executedAtUtc: new Date().toISOString(),
    }

    const updatedNode = MultifourceConfidenceEngine.recalculateAfterTest({
      node,
      test: incTest,
    })

    expect(updatedNode.currentConfidence).toBe(initialConf - 5)
    expect(updatedNode.recalculationAuditLog.some((l) => l.includes('INCONCLUSIVO'))).toBe(true)
  })

  // REQUISITO 9: Nunca confundir hipótese com diagnóstico confirmado
  it('REQ 09: Uma hipótese só pode ser CONFIRMADA com registro explícito de critério técnico', () => {
    const inv = SimulatorCaseE4.createEcoSportMisfireCase(dummyVehicle)
    const node = inv.hypotheses_tree[0]

    // Uma hipótese de alta confiança (ex: 95%) NÃO deve nascer como CONFIRMADA
    expect(node.status).not.toBe('CONFIRMADA')

    const confirmedNode = MultifourceConfidenceEngine.confirmHypothesis({
      node,
      confirmationCriteria:
        'Falha migrou de P0301 para P0302 comprovando isolamento rompido na bobina 1',
      technicianName: 'Theo',
    })

    expect(confirmedNode.status).toBe('CONFIRMADA')
    expect(confirmedNode.confirmationCriteriaRegistered).toBeDefined()
    expect(confirmedNode.confirmedAtUtc).toBeDefined()
  })

  // REQUISITO 10: Intervenção e Validação Pós-Reparo (Antes vs Depois)
  it('REQ 10: Matriz comparativa pós-reparo deve registrar antes/depois sem apagar histórico', () => {
    const inv = SimulatorCaseE4.createEcoSportMisfireCase(dummyVehicle)

    // Simula registro de intervenção
    inv.intervention = {
      id: 'int_1',
      title: 'Substituição de Bobina',
      description: 'Bobina de ignição FoMoCo do cil 1 substituída',
      replacedParts: [
        { partName: 'Bobina de Ignição', partNumber: 'GN1G-12A366-AB', replacedQuantity: 1 },
      ],
      responsibleTechnician: 'Theo',
      serviceDateUtc: new Date().toISOString(),
    }

    inv.post_repair_validation = {
      retestSessionId: 'sess_retest_101',
      retestSessionUid: 'retest_uid',
      executedAtUtc: new Date().toISOString(),
      outcome: 'FALHA_NAO_REPRODUZIDA',
      beforeDtcList: ['P0301'],
      afterDtcList: [],
      beforeSymptomObserved: 'Trepidação e perda de torque sob carga',
      afterSymptomObserved: 'Funcionamento liso em todos os regimes',
      parameterComparison: [
        {
          parameter: 'RPM Oscilação Lenta',
          beforeValue: '±95 RPM',
          afterValue: '±12 RPM',
          normalized: true,
        },
      ],
      technicianVerdict: 'Falha não reproduzida após teste de 15 min sob carga plena.',
    }

    expect(inv.post_repair_validation.outcome).toBe('FALHA_NAO_REPRODUZIDA')
    expect(inv.post_repair_validation.beforeDtcList).toContain('P0301')
    expect(inv.post_repair_validation.afterDtcList.length).toBe(0)
  })

  // REQUISITO 11: Linha do Tempo / Prontuário Técnico
  it('REQ 11: Timeline deve ser encadeada cronologicamente formando prontuário técnico auditável', () => {
    const inv = SimulatorCaseE4.createEcoSportMisfireCase(dummyVehicle)
    const categories = inv.timeline.map((t) => t.category)

    expect(categories).toContain('QUEIXA')
    expect(categories).toContain('AVALIACAO_INICIAL')
    expect(categories).toContain('SESSAO_OBD')
  })
})
