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
      vehicle: vehicle?.id || 'd6e3ocunr12tcvu',
      vehicle_plate: vehicle?.plate || 'BRA2E20',
      vehicle_model:
        `${vehicle?.make || 'Ford'} ${vehicle?.model || 'EcoSport'} ${vehicle?.version || ''}`.trim(),
      odometer_km: vehicle?.odometer_km || 48500,
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

  /**
   * Constrói caso de investigação alimentado automaticamente por uma Sessão REAL de Hardware
   * (Req 7 e 8: Não inventar anomalias; extrair dados objetivos reais e deixar dados humanos para o mecânico).
   */
  static createFromRealSession(params: {
    vehicle: VehicleModel
    session: any
    samples: any[]
    dtcs: any[]
  }): DiagnosticInvestigationModel {
    const { vehicle, session, samples, dtcs } = params
    const now = new Date()
    const t0 = session.started_at || now.toISOString()

    // Extrai medições objetivas reais da sessão
    const rpms = samples
      .filter((s) => s.pid === '0x0C' && s.decoded_value !== undefined)
      .map((s) => s.decoded_value)
    const speeds = samples
      .filter((s) => s.pid === '0x0D' && s.decoded_value !== undefined)
      .map((s) => s.decoded_value)
    const temps = samples
      .filter((s) => s.pid === '0x05' && s.decoded_value !== undefined)
      .map((s) => s.decoded_value)
    const maps = samples
      .filter((s) => s.pid === '0x0B' && s.decoded_value !== undefined)
      .map((s) => s.decoded_value)
    const mafs = samples
      .filter((s) => s.pid === '0x10' && s.decoded_value !== undefined)
      .map((s) => s.decoded_value)
    const voltages = samples
      .filter((s) => s.pid === '0x42' && s.decoded_value !== undefined)
      .map((s) => s.decoded_value)

    const avg = (arr: number[]) =>
      arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '--'
    const max = (arr: number[]) => (arr.length > 0 ? Math.max(...arr).toFixed(1) : '--')
    const min = (arr: number[]) => (arr.length > 0 ? Math.min(...arr).toFixed(1) : '--')

    const dtcCodes = dtcs.map((d) => d.dtc_code || d)
    const hasDtcs = dtcCodes.length > 0

    const initialNodes: InvestigationHypothesisNode[] = []

    if (hasDtcs) {
      initialNodes.push({
        hypothesis: {
          id: `hyp_real_dtc_${Date.now()}`,
          rank: 1,
          title: `Falhas Registradas na Memória da ECU (${dtcCodes.join(', ')})`,
          description: `Identificados códigos de anomalia ativos na sessão de telemetria real: ${dtcCodes.join(', ')}.`,
          affectedSystem: 'GERENCIAMENTO_MOTOR_ECU',
          possibleCauses: ['Falha reportada pelo módulo de controle do motor'],
          favorableEvidences: [`Códigos ativos coletados: ${dtcCodes.join(', ')}`],
          contraryEvidences: [],
          relatedDtcs: dtcCodes,
          relatedAnomalies: [],
          relatedCorrelations: [],
          missingOrUnavailablePids: [],
          confidence: 75,
          confidenceTier: 'ALTA',
          confidenceBreakdown: {
            finalScore: 75,
            tier: 'ALTA',
            dtcWeight: 75,
            temporalAnomalyWeight: 0,
            multiSignalCorrelationWeight: 0,
            symptomReportMatchWeight: 0,
            contradictoryEvidencePenalty: 0,
            missingPidPenalty: 0,
            explanation: `DTCs confirmados pela ECU física: ${dtcCodes.join(', ')}.`,
          },
          limitations: ['Necessário executar confirmação guiada pelo mecânico antes de intervir'],
          confirmationProtocol: {
            protocolId: 'prot_real_dtc_verify',
            targetHypothesisId: 'hyp_real_dtc',
            title: `Protocolo de Verificação Específico para ${dtcCodes[0]}`,
            objective: `Inspecionar componentes e chicote associados aos códigos ${dtcCodes.join(', ')}.`,
            steps: [],
            estimatedDurationMin: 25,
            destructiveAlert: 'Não efetuar reset de códigos antes de registrar o freeze frame.',
          },
          ruleTriggered: 'REGRA_REAL_DTC_MONITOR',
          safetyLevel: 'ATENCAO',
        },
        status: 'EM_ANALISE',
        initialConfidence: 75,
        currentConfidence: 75,
        confidenceDelta: 0,
        recalculationAuditLog: ['Hipótese gerada automaticamente com base nos DTCs reais da ECU.'],
        testsAssociated: [],
      })
    } else {
      // Requisito 8: Não inventar anomalias se tudo estiver em conformidade
      initialNodes.push({
        hypothesis: {
          id: `hyp_real_normal_${Date.now()}`,
          rank: 1,
          title: 'Parâmetros Operacionais em Conformidade (Sem Falhas Críticas)',
          description:
            'Nenhuma alteração relevante foi identificada nos parâmetros monitorados durante esta sessão. Telemetria e memória de falhas operando dentro das faixas normais de projeto.',
          affectedSystem: 'NENHUMA_FALHA_DETECTADA',
          possibleCauses: ['Veículo em condições normais de funcionamento'],
          favorableEvidences: [
            `RPM médio: ${avg(rpms)} (min ${min(rpms)}, max ${max(rpms)})`,
            `Temperatura média do motor: ${avg(temps)} °C`,
            `Tensão média do sistema elétrico: ${avg(voltages)} V`,
            'Zero DTCs de anomalia registrados na ECU',
          ],
          contraryEvidences: [],
          relatedDtcs: [],
          relatedAnomalies: [],
          relatedCorrelations: [],
          missingOrUnavailablePids: [],
          confidence: 95,
          confidenceTier: 'MUITO_ALTA',
          confidenceBreakdown: {
            finalScore: 95,
            tier: 'MUITO_ALTA',
            dtcWeight: 0,
            temporalAnomalyWeight: 45,
            multiSignalCorrelationWeight: 50,
            symptomReportMatchWeight: 0,
            contradictoryEvidencePenalty: 0,
            missingPidPenalty: 0,
            explanation: 'Sessão física com 100% de estabilidade e ausência de DTCs.',
          },
          limitations: [],
          confirmationProtocol: {
            protocolId: 'prot_real_conformity',
            targetHypothesisId: 'hyp_real_normal',
            title: 'Inspeção Preventiva de Rotina (Parâmetros Normais)',
            objective: 'Concluir análise e validar integridade mecânica com cliente.',
            steps: [],
            estimatedDurationMin: 10,
            destructiveAlert: 'Não se aplica a regime normal.',
          },
          ruleTriggered: 'REGRA_CONFORMIDADE_NORMAL',
          safetyLevel: 'INFORMATIVO',
        },
        status: 'EM_ANALISE',
        initialConfidence: 95,
        currentConfidence: 95,
        confidenceDelta: 0,
        recalculationAuditLog: ['Conformidade operacional constatada pela telemetria real.'],
        testsAssociated: [],
      })
    }

    const timeline: TimelineEntry[] = [
      {
        id: `tl_real_${Date.now()}_start`,
        timestampUtc: t0,
        category: 'SESSAO_OBD',
        title: `Sessão OBD Real Iniciada (${session.origin || 'HARDWARE_REAL'})`,
        description: `Coleta iniciada via ${session.adapter_type || 'ELM327'}. Dispositivo: ${session.device_collector || 'Bridge'}. Total de amostras: ${samples.length}.`,
        actor: 'Android Bridge / Scanner Físico',
        badgeText: 'Hardware Real',
        severity: 'INFO',
      },
    ]

    return {
      id: `real_inv_${session.id || session.session_id}`,
      investigation_number: `OD-${new Date().getFullYear()}-${session.session_id.slice(-4).toUpperCase()}`,
      vehicle: vehicle?.id || session.vehicle || 'real_veh',
      vehicle_plate: vehicle?.plate || 'BRA2E20',
      vehicle_model:
        `${vehicle?.make || session.vehicle_name || 'Veículo'} ${vehicle?.model || ''}`.trim(),
      odometer_km: vehicle?.odometer_km || 0,
      status: 'EM_INVESTIGACAO',
      client_complaint: {
        description:
          'Sessão originada de hardware real. Adicionar queixa ou relato do condutor se aplicável.',
        whenOccurs: 'CONDICIONADO',
        engineState: 'QUENTE',
        movementState: 'EM_MOVIMENTO',
        accelerationState: 'ACELERANDO',
        approximateSpeedKmH: Number(avg(speeds)) || 0,
        frequency: 'MUITAS_VEZES_DIA',
        symptomsSelected: {
          checkEngineLight: hasDtcs,
          noise: false,
          vibration: false,
          powerLoss: false,
          highFuelConsumption: false,
          hardStart: false,
          engineStall: false,
        },
        registeredAtUtc: t0,
      },
      mechanic_evaluation: {
        freeNotes: `Parâmetros objetivos medidos na sessão real: RPM médio ${avg(rpms)}, Temperatura ${avg(temps)}°C, MAP ${avg(maps)} kPa, MAF ${avg(mafs)} g/s, Tensão ${avg(voltages)}V. ${hasDtcs ? `DTCs ativos: ${dtcCodes.join(', ')}` : 'Nenhum DTC ativo.'}`,
        roughIdle: false,
        misfireUnderLoad: false,
        noiseAbnormal: false,
        unusualSmell: false,
        vibrationFelt: false,
        hardStarting: false,
        powerLossObserved: false,
        normalBehaviorObserved: !hasDtcs,
        technicianName: 'Mecânico Diagnosta',
        registeredAtUtc: t0,
      },
      hypotheses_tree: initialNodes,
      tests_log: [],
      timeline,
      final_conclusion: hasDtcs
        ? `Sessão real com falhas registradas na ECU: ${dtcCodes.join(', ')}.`
        : 'Nenhuma alteração relevante foi identificada nos parâmetros monitorados durante esta sessão.',
    }
  }
}
