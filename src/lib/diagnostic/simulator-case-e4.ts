import {
  DiagnosticInvestigationModel,
  InvestigationHypothesisNode,
  TimelineEntry,
} from '@/types/investigation'
import { VehicleModel } from '@/types/obd'

/**
 * SimulatorCaseE4:
 * Fornece cenários simulados ponta a ponta para a OS-ME001-E4:
 * Caso 1: EcoSport 1.5 Dragon 3C → Cliente relata trepidação/perda de potência → P0301 →
 *          Hipótese de Misfire → Teste cruzado bobina 1↔2 → Falha migra para cilindro 2 (P0302) →
 *          Confiança fortalecida/confirmada → Intervenção (Troca de bobina) → Reteste sem anomalias.
 * Caso 2: Caso em que o primeiro teste contradiz a hipótese (ex: medição de resistência e vela perfeita),
 *          forçando redução matemática da confiança (-35%) e enfraquecimento/descarte da hipótese incorreta.
 */
export class SimulatorCaseE4 {
  static createEcoSportMisfireCase(vehicle: VehicleModel): DiagnosticInvestigationModel {
    const now = new Date()
    const t0 = new Date(now.getTime() - 3600000).toISOString()
    const t1 = new Date(now.getTime() - 2400000).toISOString()
    const t2 = new Date(now.getTime() - 1200000).toISOString()

    const timeline: TimelineEntry[] = [
      {
        id: 'tl_1',
        timestampUtc: t0,
        category: 'QUEIXA',
        title: 'Queixa do Cliente Registrada',
        description: 'Cliente relata trepidação sob aceleração e perda momentânea de potência.',
        actor: 'Danilo (Recepção Técnica)',
        badgeText: 'Relato Subjetivo',
        severity: 'INFO',
      },
      {
        id: 'tl_2',
        timestampUtc: t1,
        category: 'AVALIACAO_INICIAL',
        title: 'Avaliação Preliminar do Mecânico',
        description: 'Constatado motor com lenta irregular e falha perceptível em reacelerações.',
        actor: 'Theo (Mecânico Diagnosta)',
        badgeText: 'Constatação Técnica',
        severity: 'WARNING',
      },
      {
        id: 'tl_3',
        timestampUtc: t2,
        category: 'SESSAO_OBD',
        title: 'Varredura OBD & Teste de Rodagem',
        description: 'DTC P0301 ativo com MIL aceso. Oscilações cíclicas de RPM detectadas.',
        actor: 'Theo (Mecânico Diagnosta)',
        badgeText: 'Telemetria RAW',
        severity: 'ALERT',
      },
    ]

    const initialNodes: InvestigationHypothesisNode[] = [
      {
        hypothesis: {
          id: 'hyp_misfire_cyl1',
          rank: 1,
          title: 'Falha de Combustão / Misfire no Cilindro 1',
          description:
            'Combustão incompleta no cilindro 1 gerando descontinuidade de torque e trepidação.',
          affectedSystem: 'SISTEMA_IGNICAO',
          possibleCauses: [
            'Bobina de ignição individual com fuga de corrente ou enrolamento fatigado',
            'Vela de ignição com folga excessiva ou porcelana trincada',
            'Bico injetor com vazão deficiente',
            'Compressão mecânica de cilindro',
          ],
          favorableEvidences: [
            'DTC P0301 (Cylinder 1 Misfire) ativo com MIL aceso',
            'Oscilação de rotação (RPM) compatível sob carga',
            'Relato de trepidação alinhado à falha',
          ],
          contraryEvidences: ['Tensão elétrica do alternador mantida estável (>13.8V)'],
          relatedDtcs: ['P0301'],
          relatedAnomalies: ['anom_rpm_unstable'],
          relatedCorrelations: ['corr_misfire_dynamics'],
          missingOrUnavailablePids: [],
          confidence: 78,
          confidenceTier: 'ALTA',
          confidenceBreakdown: {
            finalScore: 78,
            tier: 'ALTA',
            dtcWeight: 28,
            temporalAnomalyWeight: 15,
            multiSignalCorrelationWeight: 15,
            symptomReportMatchWeight: 15,
            contradictoryEvidencePenalty: 10,
            missingPidPenalty: 0,
            explanation:
              'Score 78%: DTC P0301 (+28%) + Anomalia RPM (+15%) + Correlação (+15%) + Relato (+15%) - Tensão estável (-10%).',
          },
          limitations: [
            'DTC P0301 não especifica se a falha é bobina, vela ou bico',
            'Mandatório executar teste cruzado antes de trocar peças',
          ],
          confirmationProtocol: {
            protocolId: 'prot_cross_coil_1_2',
            targetHypothesisId: 'hyp_misfire_cyl1',
            title: 'Teste de Troca Cruzada de Bobina de Ignição (Cilindro 1 ↔ 2)',
            objective:
              'Trocar a bobina do cilindro 1 com a do cilindro 2 para verificar se a falha migra para o cilindro 2 (P0302).',
            steps: [
              {
                stepNumber: 1,
                title: 'Remoção e Inspeção Visual das Bobinas 1 e 2',
                action:
                  'Desconectar chicote elétrico e remover bobinas 1 e 2, inspecionando integridade de bota de borracha e isolamento.',
                toolsNeeded: ['Chave Torx/Soquete 8mm', 'Lanterna'],
                targetComponent: 'Bobinas 1 e 2',
                expectedOutcomeNormal:
                  'Sem trincas, marcas de centelhamento ou carbonização na borracha',
                expectedOutcomeFaulty: 'Fissura ou ponto de fuga de alta tensão na bota isoladora',
                priority: 'ALTA',
              },
              {
                stepNumber: 2,
                title: 'Inversão das Posições (1 ↔ 2)',
                action:
                  'Instalar a bobina do cil 1 no cil 2, e a do cil 2 no cil 1. Manter as velas originais nas posições de origem.',
                toolsNeeded: ['Chave dinamométrica (torque especificado)'],
                targetComponent: 'Cilindros 1 e 2',
                expectedOutcomeNormal: 'Encaixe perfeito e conectores travados com firmeza',
                expectedOutcomeFaulty: 'Mau contato no conector elétrico',
                priority: 'ALTA',
              },
              {
                stepNumber: 3,
                title: 'Rodagem de Verificação e Leitura de DTC',
                action:
                  'Executar rodagem sob carga e verificar se o código de falha migra de P0301 para P0302.',
                toolsNeeded: ['Scanner OBD-II Network Car 360'],
                targetComponent: 'ECU e Memória de Falhas',
                expectedOutcomeNormal:
                  'Se o defeito for na bobina, o código migra obrigatoriamente para P0302.',
                expectedOutcomeFaulty:
                  'Se permanecer em P0301, a bobina é inocentada e a causa é vela/bico/cilindro.',
                priority: 'ALTA',
              },
            ],
            estimatedDurationMin: 20,
            destructiveAlert:
              'Proibido comando destrutivo ou Mode 04 enquanto a falha não for diagnosticada.',
          },
          ruleTriggered: 'REGRA_01_MISFIRE_COMBUSTION',
          safetyLevel: 'ATENCAO',
        },
        status: 'EM_ANALISE',
        initialConfidence: 78,
        currentConfidence: 78,
        confidenceDelta: 0,
        recalculationAuditLog: [
          'Confiança inicial calculada pelo motor multifonte em 78% (Tier ALTA). Protocolo de confirmação recomendado: Troca cruzada de bobina 1↔2.',
        ],
        testsAssociated: [],
      },
      {
        hypothesis: {
          id: 'hyp_fuel_injector_clogged',
          rank: 2,
          title: 'Restrição de Vazão no Bico Injetor do Cilindro 1',
          description:
            'Ejeção insuficiente de combustível no cilindro 1 provocando queima incompleta.',
          affectedSystem: 'SISTEMA_ALIMENTACAO_COMBUSTIVEL',
          possibleCauses: [
            'Filtro interno do injetor obstruído',
            'Formação de goma ou verniz no orifício de injeção',
          ],
          favorableEvidences: ['Sintoma de falha e trepidação sob exigência de aceleração'],
          contraryEvidences: ['STFT global não indica mistura excessivamente pobre generalizada'],
          relatedDtcs: [],
          relatedAnomalies: [],
          relatedCorrelations: [],
          missingOrUnavailablePids: [],
          confidence: 42,
          confidenceTier: 'MODERADA',
          confidenceBreakdown: {
            finalScore: 42,
            tier: 'MODERADA',
            dtcWeight: 0,
            temporalAnomalyWeight: 15,
            multiSignalCorrelationWeight: 0,
            symptomReportMatchWeight: 15,
            contradictoryEvidencePenalty: 0,
            missingPidPenalty: 0,
            explanation:
              'Score 42% (MODERADA) — Hipótese secundária sem DTC específico de injetor.',
          },
          limitations: ['Exige medição com manômetro e teste em máquina de bicos'],
          confirmationProtocol: {
            protocolId: 'prot_injector_test',
            targetHypothesisId: 'hyp_fuel_injector_clogged',
            title: 'Equilíbrio e Vazão de Injetores',
            objective: 'Aferir vazão de cada eletroinjetor em bancada de testes.',
            steps: [],
            estimatedDurationMin: 40,
            destructiveAlert: 'Alimentação sob pressão requer despressurização prévia da linha.',
          },
          ruleTriggered: 'REGRA_02_INJECTOR_FLOW',
          safetyLevel: 'INFORMATIVO',
        },
        status: 'EM_ANALISE',
        initialConfidence: 42,
        currentConfidence: 42,
        confidenceDelta: 0,
        recalculationAuditLog: ['Hipótese alternativa mantida em análise concorrente.'],
        testsAssociated: [],
      },
    ]

    return {
      id: `sim_case_ecosport_${Date.now()}`,
      investigation_number: 'OD-2026-0042',
      vehicle: vehicle.id || 'd6e3ocunr12tcvu',
      vehicle_plate: vehicle.plate || 'BRA2E20',
      vehicle_model: `${vehicle.make} ${vehicle.model} ${vehicle.version || ''}`.trim(),
      odometer_km: vehicle.odometer_km || 48500,
      status: 'EM_INVESTIGACAO',
      client_complaint: {
        description:
          'Carro começou a trepidar e perdeu força quando fui acelerar para entrar na rodovia.',
        whenOccurs: 'CONDICIONADO',
        engineState: 'QUENTE',
        movementState: 'EM_MOVIMENTO',
        accelerationState: 'ACELERANDO',
        approximateSpeedKmH: 60,
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
        registeredAtUtc: t0,
      },
      mechanic_evaluation: {
        freeNotes:
          'Veículo apresenta trepidação nítida em baixa rotação e reaceleração. Motor 3 cilindros sensível a falhas de ignição.',
        roughIdle: true,
        misfireUnderLoad: true,
        noiseAbnormal: false,
        unusualSmell: false,
        vibrationFelt: true,
        hardStarting: false,
        powerLossObserved: true,
        normalBehaviorObserved: false,
        technicianName: 'Theo (Técnico Diagnosta)',
        registeredAtUtc: t1,
      },
      hypotheses_tree: initialNodes,
      tests_log: [],
      timeline,
      final_conclusion: '',
    }
  }
}
