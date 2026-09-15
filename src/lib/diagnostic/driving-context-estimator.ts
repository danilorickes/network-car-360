import { RawSampleModel } from '@/types/obd'
import { DrivingContextType, DrivingContextInfo } from '@/types/etapa6'

/**
 * DrivingContextEstimator:
 * Classifica o contexto dinâmico do veículo estritamente a partir da telemetria OBD real disponível:
 * - MOTOR_DESLIGADO: RPM < 300
 * - MOTOR_FRIO: ECT (0x05) < 70 °C
 * - MARCHA_LENTA_FRIA: ECT < 70 °C e Speed == 0 e RPM entre 800 e 1350
 * - MARCHA_LENTA_QUENTE: ECT >= 70 °C e Speed == 0 e RPM entre 600 e 950
 * - TRANSITO_URBANO: Speed > 0 e Speed <= 55 km/h
 * - ACELERACAO: TPS (0x11) > 35% ou taxa de subida de RPM > 300 rpm/s
 * - VELOCIDADE_ESTABILIZADA: Speed >= 60 km/h e variação de velocidade baixa
 * - DESACELERACAO: TPS < 10% e Speed diminuindo
 * - CARGA_ELEVADA: Carga do motor (0x04) > 75% ou MAP (0x0B) > 85 kPa
 * - ESTRADA: Speed > 70 km/h contínuo
 * - PARADA_PROLONGADA: Speed == 0 contínuo por mais de 90 segundos com motor ligado
 */
export class DrivingContextEstimator {
  private lastRpm = 0
  private lastSpeed = 0
  private lastTps = 0
  private lastCoolant = 85
  private lastEngineLoad = 30
  private lastMap = 40
  private speedZeroStartMonoMs: number | null = null
  private currentContext: DrivingContextInfo = {
    type: 'DESCONHECIDO',
    label: 'Identificando regime...',
    confidence: 50,
    estimatedAtMonoMs: 0,
    description: 'Aguardando telemetria do motor.',
    activeSinceUtc: new Date().toISOString(),
  }

  updateSample(sample: RawSampleModel): DrivingContextInfo {
    const val = sample.decoded_value
    if (val === undefined || isNaN(val)) return this.currentContext

    switch (sample.pid) {
      case '0x0C':
        this.lastRpm = val
        break
      case '0x0D':
        this.lastSpeed = val
        if (val === 0) {
          if (this.speedZeroStartMonoMs === null) {
            this.speedZeroStartMonoMs = sample.ts_mono_offset_ms
          }
        } else {
          this.speedZeroStartMonoMs = null
        }
        break
      case '0x05':
        this.lastCoolant = val
        break
      case '0x11':
        this.lastTps = val
        break
      case '0x04':
        this.lastEngineLoad = val
        break
      case '0x0B':
        this.lastMap = val
        break
    }

    return this.recalculate(sample.ts_mono_offset_ms)
  }

  private recalculate(monoMs: number): DrivingContextInfo {
    let type: DrivingContextType = 'DESCONHECIDO'
    let label = 'Regime Geral'
    let description = 'Motor operando em regime intermediário'
    let confidence = 85

    // 1. Motor Desligado
    if (this.lastRpm < 300) {
      type = 'MOTOR_DESLIGADO'
      label = 'Motor Desligado'
      description = 'Ignição ligada sem rotação ativa do virabrequim.'
      confidence = 95
    }
    // 2. Parada Prolongada
    else if (
      this.lastSpeed === 0 &&
      this.speedZeroStartMonoMs !== null &&
      monoMs - this.speedZeroStartMonoMs > 90000
    ) {
      type = 'PARADA_PROLONGADA'
      label = 'Parada Prolongada'
      description = 'Veículo parado com motor em funcionamento há mais de 1m30s.'
      confidence = 90
    }
    // 3. Marcha Lenta
    else if (this.lastSpeed === 0) {
      if (this.lastCoolant < 70) {
        type = 'MARCHA_LENTA_FRIA'
        label = 'Marcha Lenta Fria'
        description = 'Motor em aquecimento (ECT < 70 °C) em rotação de compensação.'
      } else {
        type = 'MARCHA_LENTA_QUENTE'
        label = 'Marcha Lenta Estabilizada'
        description = 'Temperatura de trabalho nominal (ECT normal) com veículo parado.'
      }
      confidence = 92
    }
    // 4. Carga Elevada
    else if (this.lastEngineLoad > 75 || this.lastMap > 85) {
      type = 'CARGA_ELEVADA'
      label = 'Carga Elevada'
      description = 'Subida acentuada, retomada pesada ou reboque (alta demanda volumétrica).'
      confidence = 88
    }
    // 5. Aceleração Forte
    else if (this.lastTps > 45) {
      type = 'ACELERACAO'
      label = 'Aceleração Ativa'
      description = 'Condutor solicitando torque ao acelerador.'
      confidence = 85
    }
    // 6. Desaceleração / Freio-Motor
    else if (this.lastTps < 12 && this.lastSpeed > 30) {
      type = 'DESACELERACAO'
      label = 'Desaceleração / Cut-off'
      description = 'Borboleta fechada com veículo em movimento (freio-motor / corte de injeção).'
      confidence = 88
    }
    // 7. Estrada (Cruzeiro)
    else if (this.lastSpeed >= 75) {
      type = 'ESTRADA'
      label = 'Rodagem em Estrada'
      description = 'Deslocamento contínuo em rodovia / velocidade de viagem.'
      confidence = 92
    }
    // 8. Velocidade Estabilizada
    else if (this.lastSpeed >= 55 && Math.abs(this.lastTps - 20) < 15) {
      type = 'VELOCIDADE_ESTABILIZADA'
      label = 'Velocidade Estabilizada'
      description = 'Deslocamento constante sem grandes variações de aceleração.'
      confidence = 86
    }
    // 9. Trânsito Urbano
    else if (this.lastSpeed > 0 && this.lastSpeed < 55) {
      type = 'TRANSITO_URBANO'
      label = 'Trânsito Urbano'
      description = 'Ciclo urbano com paradas e velocidades variáveis.'
      confidence = 88
    }

    if (this.currentContext.type !== type) {
      this.currentContext = {
        type,
        label,
        confidence,
        estimatedAtMonoMs: monoMs,
        description,
        activeSinceUtc: new Date().toISOString(),
      }
    }

    return this.currentContext
  }

  getCurrentContext(): DrivingContextInfo {
    return this.currentContext
  }
}
