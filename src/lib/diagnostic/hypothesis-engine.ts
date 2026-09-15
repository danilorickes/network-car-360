import { BlackBoxPackage } from '@/types/obd'
import {
  DiagnosticAnomaly,
  DiagnosticCorrelation,
  DiagnosticHypothesis,
  DiagnosticSeverity,
  DynamicSessionBaseline,
} from '@/types/diagnostic'
import { ConfidenceEngine } from './confidence-engine'
import { CONFIRMATION_PROTOCOLS } from './confirmation-protocols'

/**
 * HypothesisEngine: Síntese determinística de hipóteses diagnósticas com rastreabilidade total.
 * REGRA FUNDAMENTAL:
 * - Uma hipótese NUNCA é armazenada/apresentada como fato confirmado.
 * - Priorizar "testar antes de substituir peça".
 * - CENÁRIO NORMAL NÃO PODE GERAR DIAGNÓSTICO DE DEFEITO apenas para preencher a tela.
 * - Integra DTC como evidência (não veredito), anomalias temporais e correlações.
 */
export class HypothesisEngine {
  static generateHypotheses(params: {
    blackBox: BlackBoxPackage
    baseline: DynamicSessionBaseline
    anomalies: DiagnosticAnomaly[]
    correlations: DiagnosticCorrelation[]
  }): DiagnosticHypothesis[] {
    const { blackBox, anomalies, correlations } = params
    const hypotheses: DiagnosticHypothesis[] = []
    const dtcs = blackBox.dtcs_context
    const dtcCodes = new Set(dtcs.map((d) => d.dtc_code))
    const supportedPids = new Set(blackBox.pids_available)
    const anomTypes = new Set(anomalies.map((a) => a.type))

    // Se NÃO houver anomalias, NÃO houver DTCs e os sinais estiverem estáveis:
    // Retorna explicitamente hipótese de Sistema em Conformidade (anti-falso positivo)
    if (anomalies.length === 0 && dtcs.length === 0) {
      const confidence = ConfidenceEngine.calculateConfidence({
        hasCompatibleDtc: false,
        temporalAnomaliesCount: 0,
        multiSignalCorrelationsCount: 0,
        symptomReportMatched: false,
        contradictoryEvidencesCount: 0,
        missingCriticalPidsCount: 0,
        isBaselineNormalCase: true,
      })

      hypotheses.push({
        id: 'hyp_system_normal',
        rank: 1,
        title: 'Sistema em Plena Conformidade Operacional (Sem Anomalias)',
        description:
          'A análise da telemetria bruta e da linha de base dinâmica não identificou desvios físicos, oscilações severas ou códigos de falha armazenados. Todos os sensores monitorados operam dentro das tolerâncias nominais.',
        affectedSystem: 'NENHUMA_FALHA_DETECTADA',
        possibleCauses: [
          'Condução regular sem falhas eletromecânicas',
          'Sintoma subjetivo ou provocado por fatores externos à ECU (piso irregular, vibração de suspensão/pneus)',
        ],
        favorableEvidences: [
          'Nenhum DTC ativo ou pendente no barramento',
          'STFT e LTFT dentro da faixa normal (±10%)',
          'Rotação (RPM) estável sem flutter ou queda sob carga',
          'Tensão elétrica mantida estável (> 13.8 V)',
        ],
        contraryEvidences: [],
        relatedDtcs: [],
        relatedAnomalies: [],
        relatedCorrelations: [],
        missingOrUnavailablePids: [],
        confidence: confidence.finalScore,
        confidenceTier: confidence.tier,
        confidenceBreakdown: confidence,
        limitations: [
          'Sensores não suportados pela ECU do veículo não foram avaliados',
          'Componentes puramente mecânicos (alinhamento, amortecedores) não possuem telemetria OBD direta',
        ],
        confirmationProtocol: CONFIRMATION_PROTOCOLS.SYSTEM_NORMAL(),
        ruleTriggered: 'REGRA_00_CONFORMIDADE_NORMAL',
        safetyLevel: 'INFORMATIVO',
        safetyRecommendation:
          'Veículo liberado para rodagem padrão. Manter manutenções preventivas em dia.',
      })

      return hypotheses
    }

    // REGRA 01: Misfire / Falha de Combustão em Cilindro (ex: P0301 ou queda cíclica com trepidação)
    const hasP0301 = dtcCodes.has('P0301')
    const hasAnyMisfireDtc = Array.from(dtcCodes).some((c) => c.startsWith('P030'))
    const hasRpmInstability = anomTypes.has('RPM_UNSTABLE') || anomTypes.has('RPM_DROP_ABRUPT')
    const isVibrationSymptom =
      blackBox.event_type === 'trepidação' || blackBox.event_type === 'falha'

    if (hasAnyMisfireDtc || (hasRpmInstability && isVibrationSymptom)) {
      const targetedCyl = hasP0301 ? 'Cilindro 1' : 'Cilindro Identificado'
      const favEvidences: string[] = []
      const contraEvidences: string[] = []

      if (hasP0301)
        favEvidences.push('DTC P0301 (Cylinder 1 Misfire) ativo na memória da ECU com lâmpada MIL')
      if (hasRpmInstability)
        favEvidences.push('Oscilação / queda cíclica de rotação detectada na telemetria')
      if (isVibrationSymptom)
        favEvidences.push(`Evento na pista marcado pelo operador como "${blackBox.event_type}"`)
      if (anomTypes.has('STFT_LTFT_OUT_OF_BOUNDS')) {
        favEvidences.push('STFT alterado (sonda detecta oxigênio de combustível não queimado)')
      }

      // Evidência contrária objetiva: Tensão elétrica perfeita descarta que o misfire seja falta de alimentação geral
      const voltStat = blackBox.window_stats['0x42']
      if (voltStat && voltStat.min >= 13.5) {
        contraEvidences.push(
          'Tensão elétrica do alternador/módulo permaneceu totalmente estável (>13.5V)',
        )
      }

      const missingPids: string[] = []
      if (!supportedPids.has('0x0E')) missingPids.push('0x0E (Avanço de Ignição)')

      const confBreakdown = ConfidenceEngine.calculateConfidence({
        hasCompatibleDtc: hasAnyMisfireDtc,
        dtcWeightBase: 28,
        temporalAnomaliesCount: anomalies.filter((a) => a.pidsInvolved.includes('0x0C')).length,
        multiSignalCorrelationsCount: correlations.filter((c) => c.id === 'corr_misfire_dynamics')
          .length,
        symptomReportMatched: isVibrationSymptom,
        contradictoryEvidencesCount: contraEvidences.length > 0 ? 1 : 0,
        contradictoryPenaltyPerUnit: 10, // pequena redução pois tensão boa apenas refina o escopo para a bobina/vela
        missingCriticalPidsCount: missingPids.length,
      })

      hypotheses.push({
        id: 'hyp_misfire_cyl1',
        rank: 1,
        title: `Falha de Combustão / Misfire no ${targetedCyl}`,
        description: `Indícios substanciais de combustão incompleta no ${targetedCyl}, provocando descontinuidade de torque no virabrequim e trepidação percebida.`,
        affectedSystem: 'SISTEMA_IGNICAO',
        possibleCauses: [
          'Vela de ignição com folga excessiva, carbonização ou porcelana trincada',
          'Bobina de ignição individual com fuga de corrente ou enrolamento fatigado',
          'Bico injetor com giclagem obstruída ou má atomização',
          'Compressão mecânica deficiente no cilindro (válvula presa)',
        ],
        favorableEvidences: favEvidences,
        contraryEvidences: contraEvidences,
        relatedDtcs: Array.from(dtcCodes).filter((c) => c.startsWith('P030')),
        relatedAnomalies: anomalies.filter((a) => a.pidsInvolved.includes('0x0C')).map((a) => a.id),
        relatedCorrelations: correlations
          .filter((c) => c.id === 'corr_misfire_dynamics')
          .map((c) => c.id),
        missingOrUnavailablePids: missingPids,
        confidence: confBreakdown.finalScore,
        confidenceTier: confBreakdown.tier,
        confidenceBreakdown: confBreakdown,
        limitations: [
          'Não é possível distinguir via telemetria pura se a causa raiz é vela gasta ou bobina fissurada',
          'O teste cruzado de bobina (Protocolo anexo) é mandatório antes de qualquer compra de peça',
        ],
        confirmationProtocol: CONFIRMATION_PROTOCOLS.MISFIRE_CYLINDER({
          targetComponent: `Bobina e vela do ${targetedCyl}`,
          dtc: hasP0301 ? 'P0301' : 'P030x',
        }),
        ruleTriggered: 'REGRA_01_MISFIRE_COMBUSTION',
        safetyLevel: confBreakdown.finalScore >= 70 ? 'ATENCAO' : 'INFORMATIVO',
        safetyRecommendation:
          'Evitar acelerações em carga máxima contínua para não danificar o catalisador por combustível não queimado.',
      })
    }

    // REGRA 02: Mistura Pobre / Entrada Falsa de Ar / Falta de Alimentação (P0171 ou STFT > +15%)
    const hasP0171 = dtcCodes.has('P0171')
    const hasHighTrim =
      anomTypes.has('STFT_LTFT_OUT_OF_BOUNDS') && (blackBox.window_stats['0x06']?.avg ?? 0) > 12

    if (hasP0171 || hasHighTrim) {
      const favEvidences: string[] = []
      const contraEvidences: string[] = []

      if (hasP0171) favEvidences.push('DTC P0171 (System Too Lean Bank 1) registrado pela ECU')
      if (hasHighTrim) {
        favEvidences.push(
          `STFT elevado (+${blackBox.window_stats['0x06']?.avg}%), forçando enriquecimento contínuo`,
        )
      }
      if (correlations.some((c) => c.id === 'corr_trim_map_lean')) {
        favEvidences.push(
          'Correlação entre leitura de oxigênio excedente e pressão do coletor (MAP)',
        )
      }

      // Se a temperatura do motor estiver correta, descarta falha térmica de fase fria
      const tempStat = blackBox.window_stats['0x05']
      if (tempStat && tempStat.avg >= 80 && tempStat.avg <= 95) {
        contraEvidences.push(
          'Motor operando em temperatura de regime nominal (não há enriquecimento por motor frio)',
        )
      }

      const missingPids: string[] = []
      if (!supportedPids.has('0x10')) missingPids.push('0x10 (MAF - Massa de Ar)')

      const confBreakdown = ConfidenceEngine.calculateConfidence({
        hasCompatibleDtc: hasP0171,
        dtcWeightBase: 28,
        temporalAnomaliesCount: anomalies.filter((a) => a.type === 'STFT_LTFT_OUT_OF_BOUNDS')
          .length,
        multiSignalCorrelationsCount: correlations.filter((c) => c.id === 'corr_trim_map_lean')
          .length,
        symptomReportMatched:
          blackBox.event_type === 'falha' || blackBox.event_type === 'perda de potência',
        contradictoryEvidencesCount: 0,
        missingCriticalPidsCount: missingPids.length,
      })

      hypotheses.push({
        id: 'hyp_lean_mixture_bank1',
        rank: hypotheses.length + 1,
        title: 'Condição de Mistura Pobre (Excesso de Ar Não Medido ou Baixa Vazão de Combustível)',
        description:
          'Os trims de combustível (STFT/LTFT) operam em nível máximo de enriquecimento, indicando que a queima possui ar excedente ou o volume de combustível injetado é insuficiente para a estequiometria ideal.',
        affectedSystem: 'SISTEMA_ALIMENTACAO_COMBUSTIVEL',
        possibleCauses: [
          'Entrada falsa de ar após o medidor (junta do coletor, mangueira de hidrovácuo, cânister)',
          'Pressão ou vazão insuficiente da bomba de combustível (ou filtro obstruído)',
          'Sensor MAF descalibrado por acúmulo de sujidade no fio aquecido',
          'Injetores com restrição mecânica de vazão',
        ],
        favorableEvidences: favEvidences,
        contraryEvidences: contraEvidences,
        relatedDtcs: hasP0171 ? ['P0171'] : [],
        relatedAnomalies: anomalies
          .filter((a) => a.type === 'STFT_LTFT_OUT_OF_BOUNDS')
          .map((a) => a.id),
        relatedCorrelations: correlations
          .filter((c) => c.id === 'corr_trim_map_lean')
          .map((c) => c.id),
        missingOrUnavailablePids: missingPids,
        confidence: confBreakdown.finalScore,
        confidenceTier: confBreakdown.tier,
        confidenceBreakdown: confBreakdown,
        limitations: [
          'O DTC P0171 não especifica se a falha é na admissão de ar ou na bomba de combustível',
          'Não substituir a Sonda Lambda sem antes aferir pressão mecânica de combustível e teste de fumaça',
        ],
        confirmationProtocol: CONFIRMATION_PROTOCOLS.LEAN_MIXTURE(),
        ruleTriggered: 'REGRA_02_LEAN_MIXTURE_TRIM',
        safetyLevel: 'ATENCAO',
        safetyRecommendation:
          'Mistura excessivamente pobre pode provocar pré-ignição e elevação da temperatura das câmaras de combustão.',
      })
    }

    // REGRA 03: Perda de Potência / Engasgo Sob Aceleração
    if (
      anomTypes.has('TPS_UNRESPONSIVE_RESPONSE') ||
      correlations.some((c) => c.id === 'corr_tps_rpm_divergence') ||
      blackBox.event_type === 'perda de potência'
    ) {
      const favEvidences: string[] = []
      const contraEvidences: string[] = []

      if (anomTypes.has('TPS_UNRESPONSIVE_RESPONSE')) {
        favEvidences.push('TPS aberto (>55%) sem incremento correspondente de rotação/carga')
      }
      if (dtcCodes.has('P0299')) favEvidences.push('DTC P0299 (Underboost) presente na ECU')
      if (blackBox.event_type === 'perda de potência') {
        favEvidences.push('Sintoma marcado como "perda de potência" na pista')
      }

      // Se a rotação do motor em lenta anterior for normal, mostra que o defeito ocorre apenas sob carga
      if (
        blackBox.window_stats['0x0C']?.beforeAvg &&
        blackBox.window_stats['0x0C'].beforeAvg > 700
      ) {
        contraEvidences.push(
          'Em marcha lenta ou baixa carga a estabilidade é preservada (defeito condicionado à demanda)',
        )
      }

      const confBreakdown = ConfidenceEngine.calculateConfidence({
        hasCompatibleDtc: dtcCodes.has('P0299'),
        dtcWeightBase: 25,
        temporalAnomaliesCount: anomalies.filter((a) => a.pidsInvolved.includes('0x11')).length,
        multiSignalCorrelationsCount: correlations.filter((c) => c.id === 'corr_tps_rpm_divergence')
          .length,
        symptomReportMatched: blackBox.event_type === 'perda de potência',
        contradictoryEvidencesCount: 0,
        missingCriticalPidsCount: 0,
      })

      hypotheses.push({
        id: 'hyp_power_loss_restriction',
        rank: hypotheses.length + 1,
        title: 'Restrição de Fluxo / Perda de Eficiência Volumétrica Sob Carga',
        description:
          'Divergência expressiva entre a abertura comandada pelo acelerador e a entrega mecânica de rotação/torque pelo motor.',
        affectedSystem: 'SISTEMA_ADMISSAO_AR',
        possibleCauses: [
          'Restrição na exaustão por catalisador colapsado ou silenciador obstruído',
          'Perda de pressão de sobrealimentação (mangote de intercooler fissurado ou wastegate presa)',
          'Carbonização severa no corpo de borboleta ou válvulas de admissão',
          'Filtro de ar saturado',
        ],
        favorableEvidences: favEvidences,
        contraryEvidences: contraEvidences,
        relatedDtcs: dtcCodes.has('P0299') ? ['P0299'] : [],
        relatedAnomalies: anomalies.filter((a) => a.pidsInvolved.includes('0x11')).map((a) => a.id),
        relatedCorrelations: correlations
          .filter((c) => c.id === 'corr_tps_rpm_divergence')
          .map((c) => c.id),
        missingOrUnavailablePids: [],
        confidence: confBreakdown.finalScore,
        confidenceTier: confBreakdown.tier,
        confidenceBreakdown: confBreakdown,
        limitations: [
          'Sem sensor de pressão de turbo (MAP pós-turbo), a medição física do manômetro é necessária',
        ],
        confirmationProtocol: CONFIRMATION_PROTOCOLS.POWER_LOSS(),
        ruleTriggered: 'REGRA_03_THROTTLE_TORQUE_DIVERGENCE',
        safetyLevel: 'ATENCAO',
        safetyRecommendation:
          'Evitar ultrapassagens ou exigência em aclives até a validação do fluxo de escape.',
      })
    }

    // REGRA 04: Subtensão / Falha no Sistema Elétrico de Carga
    if (anomTypes.has('VOLTAGE_DROP_OR_UNSTABLE')) {
      const voltStat = blackBox.window_stats['0x42']
      const minVolt = voltStat?.min ?? 11.0

      const confBreakdown = ConfidenceEngine.calculateConfidence({
        hasCompatibleDtc: false,
        temporalAnomaliesCount: 1,
        multiSignalCorrelationsCount: correlations.filter(
          (c) => c.id === 'corr_voltage_comm_collapse',
        ).length,
        symptomReportMatched: true,
        contradictoryEvidencesCount: 0,
        missingCriticalPidsCount: 0,
      })

      hypotheses.push({
        id: 'hyp_electrical_undervoltage',
        rank: hypotheses.length + 1,
        title: 'Subtensão Elétrica no Módulo e Sistema de Carga',
        description: `Tensão elétrica caiu para ${minVolt} V, patamar crítico que inviabiliza a saturação das bobinas de ignição e a resposta correta de atuadores eletrônicos.`,
        affectedSystem: 'SISTEMA_ELETRICO_CARGA',
        possibleCauses: [
          'Regulador de tensão do alternador com escovas desgastadas ou diodo retificador aberto',
          'Queda de tensão na malha de aterramento principal entre câmbio/bloco e chassi',
          'Bateria com resistência interna elevada ou placa em curto',
          'Correia de acessórios frouxa ou com patinamento',
        ],
        favorableEvidences: [
          `Tensão mínima registrada de ${minVolt} V (abaixo de 11.5 V nominais)`,
          'Instabilidade detectada no barramento de alimentação durante o teste',
        ],
        contraryEvidences: [],
        relatedDtcs: [],
        relatedAnomalies: anomalies
          .filter((a) => a.type === 'VOLTAGE_DROP_OR_UNSTABLE')
          .map((a) => a.id),
        relatedCorrelations: correlations
          .filter((c) => c.id === 'corr_voltage_comm_collapse')
          .map((c) => c.id),
        missingOrUnavailablePids: [],
        confidence: confBreakdown.finalScore,
        confidenceTier: confBreakdown.tier,
        confidenceBreakdown: confBreakdown,
        limitations: [
          'A medição OBD mede a tensão interna da ECU; a tensão nos bornes da bateria deve ser aferida',
        ],
        confirmationProtocol: CONFIRMATION_PROTOCOLS.ELECTRICAL_STABILITY(),
        ruleTriggered: 'REGRA_04_VOLTAGE_INSTABILITY',
        safetyLevel: minVolt < 11.0 ? 'CRITICO' : 'ATENCAO',
        safetyRecommendation:
          minVolt < 11.0
            ? 'PERIGO DE PARADA DO MOTOR EM RODOVIA: Interromper o teste dinâmico e aferir alternador/bateria imediatamente.'
            : 'Evitar rodagem prolongada com consumidores elétricos no máximo.',
      })
    }

    // REGRA 05: Perda de Comunicação com Barramento
    if (anomTypes.has('COMMUNICATION_LOSS_OR_TIMEOUT')) {
      const confBreakdown = ConfidenceEngine.calculateConfidence({
        hasCompatibleDtc: false,
        temporalAnomaliesCount: 1,
        multiSignalCorrelationsCount: 0,
        symptomReportMatched: true,
        contradictoryEvidencesCount: 0,
        missingCriticalPidsCount: 0,
      })

      hypotheses.push({
        id: 'hyp_comm_loss',
        rank: hypotheses.length + 1,
        title: 'Intermitência de Comunicação / Timeouts no Barramento Diagnóstico',
        description:
          'Ocorrência de perda temporária de quadros e timeouts com o módulo de injeção, interferindo na amostragem em tempo real.',
        affectedSystem: 'COMUNICACAO_OBD',
        possibleCauses: [
          'Mau contato físico nos pinos 4, 5, 6, 14 ou 16 do conector DLC do veículo',
          'Ruído eletromagnético por cabo de vela furado ou transiente elétrico',
          'Latência excessiva do adaptador OBD-II utilizado',
        ],
        favorableEvidences: [
          `Estado do enlace: ${blackBox.communication_state}`,
          `${blackBox.sample_quality_summary.timeoutCount} timeouts de comunicação contabilizados na janela`,
        ],
        contraryEvidences: [],
        relatedDtcs: [],
        relatedAnomalies: anomalies
          .filter((a) => a.type === 'COMMUNICATION_LOSS_OR_TIMEOUT')
          .map((a) => a.id),
        relatedCorrelations: [],
        missingOrUnavailablePids: [],
        confidence: confBreakdown.finalScore,
        confidenceTier: confBreakdown.tier,
        confidenceBreakdown: confBreakdown,
        limitations: ['Falhas físicas de conector não geram DTCs na ECU do motor'],
        confirmationProtocol: CONFIRMATION_PROTOCOLS.COMMUNICATION_RESILIENCE(),
        ruleTriggered: 'REGRA_05_BUS_COMMUNICATION_TIMEOUT',
        safetyLevel: 'INFORMATIVO',
        safetyRecommendation:
          'Verificar firmeza do encaixe do adaptador no conector antes de novo ensaio.',
      })
    }

    // Ordena hipóteses por confiança decrescente
    hypotheses.sort((a, b) => b.confidence - a.confidence)
    hypotheses.forEach((h, idx) => {
      h.rank = idx + 1
    })

    return hypotheses
  }
}
