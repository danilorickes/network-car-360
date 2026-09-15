import { BlackBoxPackage } from '@/types/obd'
import { DiagnosticAnomaly, DiagnosticCorrelation } from '@/types/diagnostic'

/**
 * CorrelationEngine: Identifica relações temporais de causa e efeito entre múltiplos sinais.
 * REGRA FUNDAMENTAL: "Correlação não é diagnóstico; toda correlação aponta para as evidências RAW/DERIVED que a originaram."
 * Exemplos:
 * - TPS ↑ + Carga ↑ → RPM deveria responder → RPM ↓ (Perda de potência / engasgo correlacionado)
 * - STFT ↑ + LTFT positivo + MAP elevado em lenta → Condição de mistura pobre por entrada falsa de ar
 * - Trepidação + Oscilação periódica de RPM + STFT elevado → Falha cíclica de combustão
 * - Queda de Tensão + Falha de Comunicação → Anomalia de alimentação elétrica do barramento/ECU
 */
export class CorrelationEngine {
  static correlateSignals(params: {
    blackBox: BlackBoxPackage
    anomalies: DiagnosticAnomaly[]
  }): DiagnosticCorrelation[] {
    const { blackBox, anomalies } = params
    const correlations: DiagnosticCorrelation[] = []
    const stats = blackBox.window_stats
    const anomTypes = new Set(anomalies.map((a) => a.type))

    // 1. Correlação: TPS ↑ com RPM ↓ (Aceleração comandada vs queda de potência)
    if (
      anomTypes.has('TPS_UNRESPONSIVE_RESPONSE') ||
      (anomTypes.has('RPM_DROP_ABRUPT') && (stats['0x11']?.atEventValue ?? 0) > 40)
    ) {
      correlations.push({
        id: 'corr_tps_rpm_divergence',
        title: 'Correlação Temporal: Demanda de Acelerador vs Queda de Rotação',
        description:
          'O condutor demandou potência abrindo a borboleta (TPS elevado), porém a rotação do motor (RPM) decresceu instantaneamente em vez de acelerar.',
        relatedPids: ['0x11', '0x0C', '0x04'],
        timeWindowMs: {
          start: Math.max(0, blackBox.mono_offset_ms - 2000),
          end: blackBox.mono_offset_ms + 4000,
        },
        mechanism: 'TPS ↑ (comanda abertura) → RPM ↓ (motor falha sob carga em vez de acelerar)',
        confidenceImpact: 25,
        rawEvidenceIds: ['fact_tps_state', 'fact_rpm_variation'],
      })
    }

    // 2. Correlação: STFT/LTFT Positivo Elevado + MAP em Lenta (Mistura Pobre / Entrada Falsa)
    if (anomTypes.has('STFT_LTFT_OUT_OF_BOUNDS')) {
      const stftVal = stats['0x06']?.avg ?? 0
      const mapVal = stats['0x0B']?.avg ?? 0
      if (stftVal > 12) {
        correlations.push({
          id: 'corr_trim_map_lean',
          title: 'Correlação: Enriquecimento por Compensação de Mistura Pobre',
          description: `STFT operando em +${stftVal}% em conjunto com MAP (${mapVal > 0 ? `${mapVal} kPa` : 'disponível'}), indicando que a sonda lambda detectou excesso de oxigênio nos gases e a ECU tenta enriquecer a mistura.`,
          relatedPids: [
            '0x06',
            ...(stats['0x07'] ? ['0x07'] : []),
            ...(stats['0x0B'] ? ['0x0B'] : []),
          ],
          timeWindowMs: {
            start: Math.max(0, blackBox.mono_offset_ms - 15000),
            end: blackBox.mono_offset_ms + 15000,
          },
          mechanism:
            'Excesso de ar / falta de combustível → Sonda detecta mistura pobre → ECU eleva STFT/LTFT',
          confidenceImpact: 20,
          rawEvidenceIds: ['fact_stft_range', ...(stats['0x0B'] ? ['fact_map_range'] : [])],
        })
      }
    }

    // 3. Correlação: Sintoma de Trepidação + Oscilação/Queda de RPM + DTC de Misfire
    const hasMisfireDtc = blackBox.dtcs_context.some((d) => d.dtc_code.startsWith('P030'))
    if (
      (anomTypes.has('RPM_UNSTABLE') ||
        anomTypes.has('RPM_DROP_ABRUPT') ||
        blackBox.event_type === 'trepidação') &&
      hasMisfireDtc
    ) {
      correlations.push({
        id: 'corr_misfire_dynamics',
        title: 'Correlação: Sintoma de Trepidação Sincronizado com Código de Combustão',
        description:
          'O evento registrado de trepidação coincide temporalmente com flutter dinâmico de rotação e código de falha de combustão (P030x) ativo na ECU.',
        relatedPids: ['0x0C', '0x11'],
        timeWindowMs: {
          start: Math.max(0, blackBox.mono_offset_ms - 5000),
          end: blackBox.mono_offset_ms + 5000,
        },
        mechanism:
          'Combustão incompleta no cilindro → Perda instantânea de torque angular no virabrequim → Queda cíclica de RPM percebida como trepidação',
        confidenceImpact: 30,
        rawEvidenceIds: ['fact_rpm_variation', 'fact_dtc_1'],
      })
    }

    // 4. Correlação: Subtensão Elétrica + Queda de Barramento
    if (
      anomTypes.has('VOLTAGE_DROP_OR_UNSTABLE') &&
      anomTypes.has('COMMUNICATION_LOSS_OR_TIMEOUT')
    ) {
      correlations.push({
        id: 'corr_voltage_comm_collapse',
        title: 'Correlação: Colapso Elétrico Afetando Transceiver do Barramento',
        description:
          'A queda de tensão do sistema elétrico ocorreu simultaneamente à perda de pacotes e timeouts OBD-II, apontando que a anomalia é de infraestrutura de alimentação.',
        relatedPids: ['0x42'],
        timeWindowMs: {
          start: Math.max(0, blackBox.mono_offset_ms - 2000),
          end: blackBox.mono_offset_ms + 5000,
        },
        mechanism:
          'Tensão cai abaixo do limite de sustentação dos transceivers (<11.5V) → Timeout nos pacotes CAN/K-Line',
        confidenceImpact: 35,
        rawEvidenceIds: ['fact_voltage_stability', 'fact_comm_state'],
      })
    }

    return correlations
  }
}
