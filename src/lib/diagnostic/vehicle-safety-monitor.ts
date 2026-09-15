import { SafetyLevel, SafetyAlert } from '@/types/etapa6'

/**
 * VehicleSafetyMonitor:
 * Motor determinístico local de segurança que roda 100% no cliente sem internet.
 *
 * Princípios mandatórios:
 * 1. Monitora APENAS parâmetros efetivamente disponíveis na conexão.
 * 2. Classificação: NORMAL (sem interrupção), ATENÇÃO (aviso discreto), CRÍTICO (aviso prioritário visual/sonoro).
 * 3. Alertas essenciais não dependem de LLM, Nina, internet ou nuvem.
 * 4. Não afirma risco mecânico específico sem evidência suficiente.
 * 5. Prioridade máxima: CRÍTICO > NAVEGAÇÃO > NINA > ENTRETENIMENTO.
 */
export class VehicleSafetyMonitor {
  private activeAlerts: Map<string, SafetyAlert> = new Map()
  private consecutiveCoolantHigh = 0
  private consecutiveVoltageLow = 0
  private consecutiveCommDrop = 0

  evaluateSafety(params: {
    coolantTemp?: number
    batteryVoltage?: number
    rpm?: number
    speed?: number
    milOn?: boolean
    dtcCodes?: string[]
    communicationState?: 'CONECTADO' | 'RECONECTANDO' | 'FALHA'
  }): { overallLevel: SafetyLevel; alerts: SafetyAlert[] } {
    const {
      coolantTemp,
      batteryVoltage,
      rpm,
      milOn,
      dtcCodes = [],
      communicationState = 'CONECTADO',
    } = params

    const nowIso = new Date().toISOString()
    const detectedAlerts: SafetyAlert[] = []

    // 1. Temperatura de Arrefecimento (ECT - 0x05)
    if (coolantTemp !== undefined && !isNaN(coolantTemp)) {
      if (coolantTemp >= 110) {
        this.consecutiveCoolantHigh++
        if (this.consecutiveCoolantHigh >= 2) {
          detectedAlerts.push({
            id: 'alert_coolant_critical',
            code: 'ECT_CRITICAL',
            title: 'Temperatura Excessiva do Motor (Superaquecimento)',
            message: `Temperatura atingiu ${coolantTemp} °C. Risco iminente de sobreaquecimento.`,
            severity: 'CRITICO',
            priority: 1,
            source: 'TEMPERATURA',
            timestampUtc: nowIso,
            valueObserved: `${coolantTemp} °C`,
            recommendedAction:
              'Reduza a velocidade com segurança e pare o veículo em local seguro. Não abra o reservatório enquanto quente.',
          })
        }
      } else if (coolantTemp >= 104) {
        this.consecutiveCoolantHigh = 0
        detectedAlerts.push({
          id: 'alert_coolant_warn',
          code: 'ECT_WARN',
          title: 'Temperatura do Motor Elevada',
          message: `Arrefecimento em ${coolantTemp} °C (acima da faixa nominal 85-95 °C).`,
          severity: 'ATENCAO',
          priority: 4,
          source: 'TEMPERATURA',
          timestampUtc: nowIso,
          valueObserved: `${coolantTemp} °C`,
          recommendedAction:
            'Acompanhe o indicador. Evite acelerações fortes ou ar-condicionado em subidas acentuadas.',
        })
      } else {
        this.consecutiveCoolantHigh = 0
      }
    }

    // 2. Tensão Elétrica do Módulo / Alternador (0x42)
    if (batteryVoltage !== undefined && !isNaN(batteryVoltage)) {
      if (batteryVoltage < 11.2 && (rpm || 0) > 400) {
        this.consecutiveVoltageLow++
        if (this.consecutiveVoltageLow >= 3) {
          detectedAlerts.push({
            id: 'alert_voltage_critical',
            code: 'VOLT_CRITICAL',
            title: 'Subtensão Grave do Sistema Elétrico',
            message: `Tensão de alimentação em ${batteryVoltage} V com motor funcionando. Falha provável de carga do alternador.`,
            severity: 'CRITICO',
            priority: 2,
            source: 'TENSAO',
            timestampUtc: nowIso,
            valueObserved: `${batteryVoltage} V`,
            recommendedAction:
              'Desligue consumidores secundários (ar, multimídia, desembaçador) e procure oficina antes da descarga total da bateria.',
          })
        }
      } else if (batteryVoltage < 12.2 && (rpm || 0) > 400) {
        this.consecutiveVoltageLow = 0
        detectedAlerts.push({
          id: 'alert_voltage_warn',
          code: 'VOLT_WARN',
          title: 'Tensão de Carga Abaixo do Esperado',
          message: `Tensão em ${batteryVoltage} V. Alternador pode estar com rendimento reduzido.`,
          severity: 'ATENCAO',
          priority: 6,
          source: 'TENSAO',
          timestampUtc: nowIso,
          valueObserved: `${batteryVoltage} V`,
          recommendedAction: 'Acompanhe a estabilidade elétrica.',
        })
      } else {
        this.consecutiveVoltageLow = 0
      }
    }

    // 3. Luz de Injeção / DTCs Ativos
    if (milOn || dtcCodes.length > 0) {
      const isMisfire = dtcCodes.some((d) => d.startsWith('P030'))
      detectedAlerts.push({
        id: 'alert_mil_dtc',
        code: isMisfire ? 'MIL_MISFIRE' : 'MIL_GENERIC',
        title: isMisfire
          ? 'Falha de Combustão / Ignição Detectada'
          : 'Luz de Injeção Eletrônica Ativa',
        message:
          dtcCodes.length > 0
            ? `DTCs reportados pela ECU: ${dtcCodes.join(', ')}.`
            : 'Luz de advertência MIL acesa no painel.',
        severity: isMisfire ? 'CRITICO' : 'ATENCAO',
        priority: isMisfire ? 3 : 5,
        source: 'DTC_MIL',
        timestampUtc: nowIso,
        valueObserved: dtcCodes.join(', ') || 'MIL=ON',
        recommendedAction: isMisfire
          ? 'Evite rotações elevadas para proteger o catalisador e bicos injetores.'
          : 'Agende uma inspeção técnica para verificação dos códigos memorizados.',
      })
    }

    // 4. Perda de Comunicação com Adaptador OBD
    if (communicationState === 'FALHA' || communicationState === 'RECONECTANDO') {
      this.consecutiveCommDrop++
      if (this.consecutiveCommDrop >= 2) {
        detectedAlerts.push({
          id: 'alert_comm_drop',
          code: 'OBD_COMM_LOSS',
          title: 'Comunicação com Adaptador OBD Interrompida',
          message:
            communicationState === 'RECONECTANDO'
              ? 'Tentando restabelecer link serial/BLE com o adaptador...'
              : 'Sinal com o adaptador OBD perdido. Monitoramento em modo passivo.',
          severity: communicationState === 'FALHA' ? 'ATENCAO' : 'ATENCAO',
          priority: 7,
          source: 'COMUNICACAO',
          timestampUtc: nowIso,
          recommendedAction:
            'Verifique se o adaptador ELM327 está bem encaixado no conector sob o painel.',
        })
      }
    } else {
      this.consecutiveCommDrop = 0
    }

    // Atualiza mapa de alertas ativos
    this.activeAlerts.clear()
    detectedAlerts.forEach((a) => this.activeAlerts.set(a.id, a))

    // Nível geral de segurança
    const hasCritical = detectedAlerts.some((a) => a.severity === 'CRITICO')
    const hasWarning = detectedAlerts.some((a) => a.severity === 'ATENCAO')
    const overallLevel: SafetyLevel = hasCritical ? 'CRITICO' : hasWarning ? 'ATENCAO' : 'NORMAL'

    return {
      overallLevel,
      alerts: detectedAlerts.sort((a, b) => a.priority - b.priority),
    }
  }

  getActiveAlerts(): SafetyAlert[] {
    return Array.from(this.activeAlerts.values()).sort((a, b) => a.priority - b.priority)
  }
}
