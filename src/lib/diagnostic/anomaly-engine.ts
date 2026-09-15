import { BlackBoxPackage, ParameterWindowStat } from '@/types/obd'
import { DiagnosticAnomaly, DiagnosticSeverity, DynamicSessionBaseline } from '@/types/diagnostic'

/**
 * AnomalyEngine: Analisa rigorosamente a janela da Caixa-Preta comparando com o baseline dinâmico.
 * NÃO inventa anomalias para PIDs não suportados.
 * Identifica:
 * 1. Queda abrupta de RPM (RPM_DROP_ABRUPT)
 * 2. RPM instável / flutter (RPM_UNSTABLE)
 * 3. STFT/LTFT fora do comportamento esperado (STFT_LTFT_OUT_OF_BOUNDS)
 * 4. MAP incompatível com carga/TPS (MAP_TPS_INCOMPATIBLE)
 * 5. MAF incompatível com regime (MAF_REGIME_INCOMPATIBLE)
 * 6. Queda ou anomalia de tensão da bateria/módulo (VOLTAGE_DROP_OR_UNSTABLE)
 * 7. Temperatura anormal (TEMPERATURE_ANOMALOUS)
 * 8. TPS alterado sem resposta correspondente (TPS_UNRESPONSIVE_RESPONSE)
 * 9. Perda de comunicação / timeouts (COMMUNICATION_LOSS_OR_TIMEOUT)
 * 10. Divergências imediatamente anteriores ao sintoma (PRE_SYMPTOM_DIVERGENCE)
 */
export class AnomalyEngine {
  static detectAnomalies(params: {
    blackBox: BlackBoxPackage
    baseline: DynamicSessionBaseline
  }): DiagnosticAnomaly[] {
    const { blackBox, baseline } = params
    const anomalies: DiagnosticAnomaly[] = []
    const stats = blackBox.window_stats
    const supportedPids = new Set(blackBox.pids_available)

    // 1. Queda abrupta de RPM (0x0C)
    if (supportedPids.has('0x0C') && stats['0x0C']) {
      const rpmStat = stats['0x0C']
      const eventVal = rpmStat.atEventValue
      const beforeAvg = rpmStat.beforeAvg ?? baseline.statsByPid['0x0C']?.normalSessionAvg

      if (eventVal !== undefined && beforeAvg !== undefined && beforeAvg > 500) {
        const delta = eventVal - beforeAvg
        const deltaPct = Math.round((delta / beforeAvg) * 1000) / 10

        // Queda drástica (> 25% de redução imediata ou queda para 0)
        if (eventVal <= 100 && beforeAvg > 650) {
          anomalies.push({
            id: 'anom_rpm_stall',
            type: 'RPM_DROP_ABRUPT',
            title: 'Apagamento / Estol Completo de Rotação (RPM foi a 0)',
            description: `A rotação do motor despencou de ${beforeAvg} RPM para ${eventVal} RPM no momento do sintoma, caracterizando apagamento instantâneo.`,
            pidsInvolved: ['0x0C'],
            observedValue: `${eventVal} RPM`,
            baselineComparison: {
              beforeAvg,
              eventValue: eventVal,
              deltaPercent: -100,
              unit: 'RPM',
              notes: 'Parada súbita do motor em regime ativo',
            },
            momentOffsetMs: blackBox.mono_offset_ms,
            relativeToSymptomSec: 0,
            durationMs: 3000,
            severity: 'CRITICO',
            originEvidenceId: 'fact_rpm_variation',
          })
        } else if (deltaPct <= -25) {
          anomalies.push({
            id: 'anom_rpm_drop',
            type: 'RPM_DROP_ABRUPT',
            title: 'Queda Abrupta de RPM Sob Carga',
            description: `Queda imediata de ${Math.abs(deltaPct)}% na rotação do motor (de ${beforeAvg} para ${eventVal} RPM) sem fechamento condizente de acelerador.`,
            pidsInvolved: ['0x0C'],
            observedValue: `${eventVal} RPM`,
            baselineComparison: {
              beforeAvg,
              eventValue: eventVal,
              deltaPercent: deltaPct,
              unit: 'RPM',
            },
            momentOffsetMs: blackBox.mono_offset_ms,
            relativeToSymptomSec: 0,
            durationMs: 2000,
            severity: 'ATENCAO',
            originEvidenceId: 'fact_rpm_variation',
          })
        }
      }

      // RPM Instável / Oscilação (delta entre min e max elevado em marcha lenta ou desvio na janela)
      const rpmRange = rpmStat.max - rpmStat.min
      if (rpmRange > 300 && (rpmStat.beforeAvg ?? 0) < 1300 && (rpmStat.afterAvg ?? 0) < 1300) {
        anomalies.push({
          id: 'anom_rpm_unstable',
          type: 'RPM_UNSTABLE',
          title: 'Instabilidade e Oscilação Cíclica de Rotação',
          description: `Variação severa de rotação (amplitude de ${rpmRange} RPM, entre ${rpmStat.min} e ${rpmStat.max} RPM) em regime de baixa carga.`,
          pidsInvolved: ['0x0C'],
          observedValue: `Delta de ${rpmRange} RPM`,
          baselineComparison: {
            baselineValue: rpmStat.avg,
            beforeAvg: rpmStat.beforeAvg,
            afterAvg: rpmStat.afterAvg,
            unit: 'RPM',
            notes: 'Desvio padrão elevado em marcha lenta/baixa velocidade',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 5000,
          severity: 'ATENCAO',
          originEvidenceId: 'fact_rpm_oscillation',
        })
      }
    }

    // 2. STFT / LTFT Fora do Comportamento Esperado (0x06 / 0x07)
    if (supportedPids.has('0x06') && stats['0x06']) {
      const stftStat = stats['0x06']
      const ltftStat = stats['0x07']
      const avgStft = stftStat.avg
      const maxStft = stftStat.max
      const ltftVal = ltftStat?.avg ?? 0

      // Limites aceitáveis normais: geralmente entre -10% e +10%.
      // Correção acima de +15% aponta enriquecimento excessivo (mistura pobre detectada pela sonda).
      if (maxStft >= 15 || avgStft >= 12 || avgStft + ltftVal >= 20) {
        const combined = Math.round((avgStft + ltftVal) * 10) / 10
        anomalies.push({
          id: 'anom_trim_lean',
          type: 'STFT_LTFT_OUT_OF_BOUNDS',
          title: 'Ajuste de Combustível Extremamente Positivo (Tendência Pobre)',
          description: `STFT médio atingiu +${avgStft}% (pico de +${maxStft}%). Correção combinada (STFT+LTFT) de +${combined}%, indicando que a injeção está compensando excesso de ar ou falta de combustível.`,
          pidsInvolved: ['0x06', ...(supportedPids.has('0x07') ? ['0x07'] : [])],
          observedValue: `+${avgStft}% STFT (Pico +${maxStft}%)`,
          baselineComparison: {
            baselineValue: 0,
            beforeAvg: stftStat.beforeAvg,
            eventValue: stftStat.atEventValue,
            unit: '%',
            notes: 'Limite de normalidade aceitável: ±10%',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 8000,
          severity: avgStft > 20 ? 'CRITICO' : 'ATENCAO',
          originEvidenceId: 'fact_stft_range',
        })
      } else if (stftStat.min <= -15 || avgStft <= -12) {
        anomalies.push({
          id: 'anom_trim_rich',
          type: 'STFT_LTFT_OUT_OF_BOUNDS',
          title: 'Ajuste de Combustível Negativo Excessivo (Tendência Rica)',
          description: `STFT reduziu para ${stftStat.min}% (média ${avgStft}%), indicando corte de injeção por excesso de combustível ou restrição na admissão.`,
          pidsInvolved: ['0x06'],
          observedValue: `${avgStft}% STFT`,
          baselineComparison: {
            baselineValue: 0,
            beforeAvg: stftStat.beforeAvg,
            unit: '%',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 6000,
          severity: 'ATENCAO',
          originEvidenceId: 'fact_stft_range',
        })
      }
    }

    // 3. MAP Incompatível com Carga / TPS (0x0B vs 0x11 vs 0x04)
    if (supportedPids.has('0x0B') && supportedPids.has('0x11') && stats['0x0B'] && stats['0x11']) {
      const mapStat = stats['0x0B']
      const tpsStat = stats['0x11']
      const eventMap = mapStat.atEventValue ?? mapStat.avg
      const eventTps = tpsStat.atEventValue ?? tpsStat.avg

      // Borboleta pouco aberta (TPS < 20%), mas MAP muito alto (> 65 kPa em motor aspirado/lenta)
      if (eventTps < 20 && eventMap > 65 && (stats['0x0C']?.atEventValue ?? 1000) > 400) {
        anomalies.push({
          id: 'anom_map_high_idle',
          type: 'MAP_TPS_INCOMPATIBLE',
          title: 'Pressão Absoluta no Coletor Incompatível com Borboleta Fechada',
          description: `MAP elevado (${eventMap} kPa) com TPS baixo (${eventTps}%), sinalizando possível entrada falsa de ar ou baixa eficiência volumétrica.`,
          pidsInvolved: ['0x0B', '0x11'],
          observedValue: `${eventMap} kPa com TPS ${eventTps}%`,
          baselineComparison: {
            baselineValue: '30-45 kPa (marcha lenta normal)',
            eventValue: eventMap,
            unit: 'kPa',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 4000,
          severity: 'ATENCAO',
          originEvidenceId: 'fact_map_range',
        })
      }
    }

    // 4. MAF Incompatível com Regime (0x10 vs 0x0C)
    if (supportedPids.has('0x10') && supportedPids.has('0x0C') && stats['0x10'] && stats['0x0C']) {
      const mafStat = stats['0x10']
      const rpmStat = stats['0x0C']
      const eventRpm = rpmStat.atEventValue ?? rpmStat.avg
      const eventMaf = mafStat.atEventValue ?? mafStat.avg

      // Em alta rotação (> 3000 RPM), MAF muito baixo (< 4 g/s)
      if (eventRpm > 3000 && eventMaf < 4.5) {
        anomalies.push({
          id: 'anom_maf_low',
          type: 'MAF_REGIME_INCOMPATIBLE',
          title: 'Fluxo de Massa de Ar (MAF) Excessivamente Baixo para Alta Rotação',
          description: `Leitura do sensor MAF de apenas ${eventMaf} g/s sob regime de ${eventRpm} RPM, incompatível com demanda de aspiração.`,
          pidsInvolved: ['0x10', '0x0C'],
          observedValue: `${eventMaf} g/s`,
          baselineComparison: {
            baselineValue: '> 15 g/s sob regime',
            eventValue: eventMaf,
            unit: 'g/s',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 3000,
          severity: 'ATENCAO',
          originEvidenceId: 'fact_maf_range',
        })
      }
    }

    // 5. Queda de Tensão Elétrica do Módulo / Bateria (0x42)
    if (supportedPids.has('0x42') && stats['0x42']) {
      const voltStat = stats['0x42']
      const minVolt = voltStat.min
      const avgVolt = voltStat.avg

      // Tensão abaixo de 12.0 V com motor ligado ou queda abaixo de 11.0 V
      if (minVolt < 11.5) {
        anomalies.push({
          id: 'anom_voltage_critical',
          type: 'VOLTAGE_DROP_OR_UNSTABLE',
          title: 'Subtensão Elétrica Crítica no Barramento do Módulo',
          description: `Queda de tensão registrada para ${minVolt} V (média ${avgVolt} V). Tensão abaixo de 11.5 V compromete o chaveamento de bobinas e bicos injetores.`,
          pidsInvolved: ['0x42'],
          observedValue: `${minVolt} V`,
          baselineComparison: {
            baselineValue: '13.8 - 14.4 V (alternador em carga)',
            eventValue: minVolt,
            unit: 'V',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 2500,
          severity: minVolt < 10.8 ? 'CRITICO' : 'ATENCAO',
          originEvidenceId: 'fact_voltage_stability',
        })
      }
    }

    // 6. Temperatura Anormal de Arrefecimento (0x05)
    if (supportedPids.has('0x05') && stats['0x05']) {
      const tempStat = stats['0x05']
      if (tempStat.max >= 108) {
        anomalies.push({
          id: 'anom_temp_high',
          type: 'TEMPERATURE_ANOMALOUS',
          title: 'Temperatura Excessiva do Líquido de Arrefecimento (Superaquecimento)',
          description: `Temperatura do motor atingiu pico de ${tempStat.max} °C na janela de análise (risco imediato de danos à junta do cabeçote).`,
          pidsInvolved: ['0x05'],
          observedValue: `${tempStat.max} °C`,
          baselineComparison: {
            baselineValue: '85 - 95 °C',
            eventValue: tempStat.max,
            unit: '°C',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 5000,
          severity: 'CRITICO',
          originEvidenceId: 'fact_coolant_temp',
        })
      }
    }

    // 7. TPS Alterado sem Resposta Correspondente (0x11 vs 0x0C / 0x04)
    if (supportedPids.has('0x11') && supportedPids.has('0x0C') && stats['0x11'] && stats['0x0C']) {
      const tpsStat = stats['0x11']
      const rpmStat = stats['0x0C']
      const eventTps = tpsStat.atEventValue ?? tpsStat.avg
      const beforeRpm = rpmStat.beforeAvg ?? 2000
      const eventRpm = rpmStat.atEventValue ?? rpmStat.avg

      // Condutor pisou fundo no acelerador (TPS > 60%), mas RPM caiu ou estagnou
      if (eventTps >= 55 && eventRpm < beforeRpm && eventRpm < 1800) {
        anomalies.push({
          id: 'anom_tps_unresponsive',
          type: 'TPS_UNRESPONSIVE_RESPONSE',
          title: 'Acelerador Aberto Sem Resposta de Rotação (Engasgo / Falha de Carga)',
          description: `Posição do acelerador em ${eventTps}%, porém o motor não respondeu com subida de giro (RPM em ${eventRpm}), caracterizando perda grave de rendimento.`,
          pidsInvolved: ['0x11', '0x0C'],
          observedValue: `TPS ${eventTps}% vs RPM ${eventRpm}`,
          baselineComparison: {
            beforeAvg: beforeRpm,
            eventValue: eventRpm,
            unit: 'RPM',
            notes: 'Aceleração comandada sem correspondência mecânica',
          },
          momentOffsetMs: blackBox.mono_offset_ms,
          relativeToSymptomSec: 0,
          durationMs: 3500,
          severity: 'ATENCAO',
          originEvidenceId: 'fact_tps_state',
        })
      }
    }

    // 8. Perda de Comunicação / Timeouts
    const quality = blackBox.sample_quality_summary
    if (
      blackBox.communication_state !== 'CONECTADO' ||
      quality.okPercentage < 75 ||
      quality.timeoutCount > 5
    ) {
      anomalies.push({
        id: 'anom_comm_loss',
        type: 'COMMUNICATION_LOSS_OR_TIMEOUT',
        title: 'Instabilidade ou Perda de Pacotes no Barramento OBD-II',
        description: `Estado do barramento: ${blackBox.communication_state}. Índice de integridade de amostras em ${quality.okPercentage}% (${quality.timeoutCount} timeouts registrados).`,
        pidsInvolved: [],
        observedValue: `${quality.timeoutCount} timeouts`,
        baselineComparison: {
          baselineValue: '100% OK',
          eventValue: quality.okPercentage,
          unit: '% integridade',
        },
        momentOffsetMs: blackBox.mono_offset_ms,
        relativeToSymptomSec: 0,
        durationMs: 4000,
        severity: blackBox.communication_state === 'FALHA' ? 'CRITICO' : 'ATENCAO',
        originEvidenceId: 'fact_comm_state',
      })
    }

    // 9. Alterações Imediatamente Anteriores ao Sintoma (PRE_SYMPTOM_DIVERGENCE)
    // Se no período pré-sintoma o STFT ou RPM já divergiam fortemente da média da sessão
    if (supportedPids.has('0x06') && stats['0x06']?.beforeAvg !== undefined) {
      const normalStft = baseline.statsByPid['0x06']?.normalSessionAvg ?? 0
      const preAvg = stats['0x06'].beforeAvg!
      if (Math.abs(preAvg - normalStft) >= 10) {
        anomalies.push({
          id: 'anom_pre_symptom_stft',
          type: 'PRE_SYMPTOM_DIVERGENCE',
          title: 'Desvio Prévio ao Sintoma na Correção de Mistura',
          description: `Nos segundos imediatamente anteriores ao sintoma marcado, o STFT já operava em ${preAvg}% (desvio prévio de ${Math.round(preAvg - normalStft)}% frente à sessão).`,
          pidsInvolved: ['0x06'],
          observedValue: `${preAvg}%`,
          baselineComparison: {
            baselineValue: normalStft,
            beforeAvg: preAvg,
            unit: '%',
          },
          momentOffsetMs: Math.max(0, blackBox.mono_offset_ms - 10000),
          relativeToSymptomSec: -10,
          durationMs: 10000,
          severity: 'INFORMATIVO',
          originEvidenceId: 'fact_stft_range',
        })
      }
    }

    return anomalies
  }
}
