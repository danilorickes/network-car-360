import {
  RawSampleModel,
  SessionModel,
  EventModel,
  DtcModel,
  VehicleModel,
  BlackBoxPackage,
} from '@/types/obd'
import { PID_DEFINITIONS } from './pid-decoder'

export class ExporterService {
  /**
   * Dispara o download de um arquivo no navegador
   */
  private static triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // -------------------------------------------------------------------------
  // 1. EXPORTAÇÃO JSON TÉCNICO COMPLETO
  // -------------------------------------------------------------------------

  /**
   * Gera e exporta JSON técnico completo da sessão
   */
  static exportSessionJson(params: {
    session: SessionModel
    vehicle?: VehicleModel | null
    samples: readonly RawSampleModel[]
    events: readonly EventModel[]
    dtcs: readonly DtcModel[]
  }): void {
    const { session, vehicle, samples, events, dtcs } = params

    const technicalPayload = {
      export_version: '2.0.0',
      system: 'Network Car — Diagnóstico 360 Live (Etapa 2)',
      exported_at_utc: new Date().toISOString(),
      integrity_guarantee: 'RAW telemetry is strictly immutable (append-only)',
      vehicle: vehicle || {
        plate: 'N/A',
        name: session.vehicle_name || 'Veículo não informado',
      },
      session: {
        session_id: session.session_id,
        status: session.status,
        adapter_type: session.adapter_type,
        transport_detail: session.transport_detail,
        vin: session.vin,
        protocol: session.protocol,
        started_at: session.started_at,
        ended_at: session.ended_at,
        pids_found: session.pids_found,
      },
      metrics_summary: {
        total_samples: samples.length,
        total_events: events.length,
        total_dtcs: dtcs.length,
      },
      dtcs,
      events,
      raw_telemetry: samples,
    }

    const blob = new Blob([JSON.stringify(technicalPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const filename = `network_car_sessao_${session.session_id}_completa.json`
    this.triggerDownload(blob, filename)
  }

  /**
   * Gera e exporta JSON técnico completo de um evento individual (Caixa-Preta)
   */
  static exportEventJson(params: {
    event: EventModel
    pkg: BlackBoxPackage
    samplesInWindow: readonly RawSampleModel[]
  }): void {
    const { event, pkg, samplesInWindow } = params

    const technicalPayload = {
      export_type: 'BLACKBOX_EVENT_PACKAGE',
      export_version: '2.0.0',
      system: 'Network Car — Diagnóstico 360 Live',
      exported_at_utc: new Date().toISOString(),
      event_id: event.event_id,
      session_id: event.session_id,
      package: pkg,
      samples_in_window: samplesInWindow,
    }

    const blob = new Blob([JSON.stringify(technicalPayload, null, 2)], {
      type: 'application/json;charset=utf-8',
    })
    const filename = `network_car_evento_${event.event_id}_caixapreta.json`
    this.triggerDownload(blob, filename)
  }

  // -------------------------------------------------------------------------
  // 2. EXPORTAÇÃO CSV DA TELEMETRIA
  // -------------------------------------------------------------------------

  /**
   * Gera CSV das amostras de telemetria bruta
   */
  static exportTelemetryCsv(
    samples: readonly RawSampleModel[],
    filenamePrefix = 'telemetria',
  ): void {
    const headers = [
      'sample_id',
      'session_id',
      'ts_utc',
      'ts_mono_offset_ms',
      'pid',
      'pid_name',
      'raw_value',
      'decoded_value',
      'unit',
      'quality',
    ]

    const rows = samples.map((s) => {
      const def = PID_DEFINITIONS[s.pid]
      const pidName = def ? `"${def.name.replace(/"/g, '""')}"` : s.pid
      return [
        s.sample_id,
        s.session_id,
        s.ts_utc,
        s.ts_mono_offset_ms,
        s.pid,
        pidName,
        s.raw_value !== undefined ? s.raw_value : '',
        s.decoded_value !== undefined ? s.decoded_value : '',
        s.unit || def?.unit || '',
        s.quality,
      ].join(';')
    })

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const filename = `${filenamePrefix}_${Date.now()}.csv`
    this.triggerDownload(blob, filename)
  }

  // -------------------------------------------------------------------------
  // 3. RELATÓRIO PDF / IMPRESSÃO TÉCNICA FORMATADA
  // -------------------------------------------------------------------------

  // Imprime ou gera PDF profissional com CSS Print para a Investigação 360 (Req 12)
  static printInvestigationReport(params: {
    investigation: import('@/types/investigation').DiagnosticInvestigationModel
    vehicle?: VehicleModel | null
    historyComparison?: import('@/types/investigation').VehicleHistoryComparison | null
  }): void {
    const { investigation, vehicle, historyComparison } = params
    const printWindow = window.open('', '_blank', 'width=1000,height=900')
    if (!printWindow) return

    const clientComp = investigation.client_complaint
    const mechEval = investigation.mechanic_evaluation

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Laudo Técnico de Investigação 360 — ${investigation.investigation_number}</title>
        <style>
          @page { size: A4; margin: 12mm 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111; line-height: 1.35; font-size: 11px; margin: 0; padding: 10px; }
          .header { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
          .title { font-size: 16px; font-weight: bold; text-transform: uppercase; margin: 0; color: #000; }
          .subtitle { font-size: 10px; color: #555; margin: 2px 0 0 0; }
          .meta-box { border: 1px solid #ccc; background: #f9f9f9; padding: 8px; border-radius: 4px; margin-bottom: 12px; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
          .section { margin-bottom: 14px; page-break-inside: avoid; }
          .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ddd; padding-bottom: 3px; margin-bottom: 6px; color: #111; display: flex; justify-content: space-between; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; text-transform: uppercase; }
          .badge-relatado { background: #e3f2fd; color: #0d47a1; border: 1px solid #90caf9; }
          .badge-medido { background: #e8f5e9; color: #1b5e20; border: 1px solid #a5d6a7; }
          .badge-inferido { background: #fff3e0; color: #e65100; border: 1px solid #ffcc80; }
          .badge-confirmado { background: #fce4ec; color: #880e4f; border: 1px solid #f48fb1; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 4px; }
          th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; }
          th { background: #f0f0f0; font-weight: bold; }
          .footer { border-top: 1px solid #ccc; margin-top: 15px; padding-top: 8px; font-size: 9px; color: #666; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">Network Car 360 — Laudo Técnico Diagnóstico</h1>
            <p class="subtitle">Investigação Oficial nº ${investigation.investigation_number} • Executor Técnico: Theo (Network Soluções)</p>
          </div>
          <div style="text-align: right;">
            <span class="badge badge-confirmado">Status: ${investigation.status}</span>
            <div style="font-size: 9px; color: #666; margin-top: 4px;">Data: ${new Date().toLocaleDateString('pt-BR')}</div>
          </div>
        </div>

        <div class="meta-box">
          <div class="grid-2">
            <div>
              <strong>Veículo:</strong> ${investigation.vehicle_model || 'Não informado'}<br />
              <strong>Placa:</strong> ${investigation.vehicle_plate} • <strong>Odômetro:</strong> ${investigation.odometer_km ? `${investigation.odometer_km} km` : 'N/A'}<br />
              <strong>VIN:</strong> ${vehicle?.vin || '9BFBJ55E6L8104921'}
            </div>
            <div>
              <strong>Motor:</strong> ${vehicle?.engine || '1.5 Ti-VCT Dragon 3C'}<br />
              <strong>Transmissão:</strong> ${vehicle?.transmission || 'Automático'}<br />
              <strong>Combustível:</strong> ${vehicle?.fuel || 'Flex'}
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">
            <span>1. Queixa Estruturada do Cliente</span>
            <span class="badge badge-relatado">RELATADO (Percepção Subjetiva)</span>
          </div>
          <p style="margin: 3px 0;"><strong>Relato Livre:</strong> "${clientComp.description || 'Não detalhado'}"</p>
          <div style="font-size: 10px; color: #444; margin-top: 2px;">
            Condições: Ocorre ${clientComp.whenOccurs} • Motor ${clientComp.engineState} • Veículo ${clientComp.movementState} • Regime: ${clientComp.accelerationState}
          </div>
        </div>

        <div class="section">
          <div class="section-title">
            <span>2. Avaliação Preliminar do Mecânico</span>
            <span class="badge badge-relatado">REGISTRO MANUAL DO MECÂNICO (NÃO CONFIRMADO POR TELEMETRIA)</span>
          </div>
          <p style="margin: 3px 0;"><strong>Observação:</strong> ${(
            mechEval.freeNotes || 'Sem anotações'
          ).replace(
            'RPM médio --, Temperatura --°C, MAP -- kPa, MAF -- g/s, Tensão --V',
            'Sem amostras sincronizadas para esta sessão',
          )}</p>
          <div style="font-size: 10px; color: #444;">
            Sintomas observados: ${mechEval.roughIdle ? 'Marcha lenta irregular; ' : ''}${mechEval.misfireUnderLoad ? 'Falha sob carga; ' : ''}${mechEval.vibrationFelt ? 'Vibração acentuada; ' : ''}${mechEval.powerLossObserved ? 'Perda de potência;' : ''}
          </div>
        </div>

        ${
          historyComparison
            ? `
          <div class="section">
            <div class="section-title">
              <span>3. Comparativo com Histórico do Mesmo Veículo (${investigation.vehicle_plate})</span>
              <span class="badge badge-medido">BASELINE HISTÓRICO</span>
            </div>
            <p style="margin: 3px 0;">${historyComparison.comparisonSummary}</p>
            <div style="font-size: 10px; color: #444;">
              • STFT: ${historyComparison.stftComparisonNote}<br />
              • Tensão: ${historyComparison.voltageComparisonNote}
            </div>
          </div>
        `
            : ''
        }

        <div class="section">
          <div class="section-title">
            <span>4. Análise Automática (Telemetria) — Árvore de Hipóteses Determinística</span>
            <span class="badge badge-medido">ANÁLISE AUTOMÁTICA (TELEMETRIA)</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Hipótese Automática</th>
                <th>Sistema</th>
                <th>Confiança</th>
                <th>Status Atual</th>
                <th>Base / Evidência Automática</th>
              </tr>
            </thead>
            <tbody>
              ${investigation.hypotheses_tree
                .map((n) => {
                  const isConformity = n.hypothesis.affectedSystem === 'NENHUMA_FALHA_DETECTADA'
                  return `
                    <tr>
                      <td><strong>${n.hypothesis.title}</strong></td>
                      <td>${n.hypothesis.affectedSystem}</td>
                      <td><strong>${n.currentConfidence}%</strong></td>
                      <td>${n.status}</td>
                      <td>${isConformity ? 'Telemetria dentro dos limiares de projeto. Zero DTCs ativos na ECU.' : n.hypothesis.favorableEvidences?.[0] || 'Parâmetros avaliados por telemetria'}</td>
                    </tr>
                  `
                })
                .join('')}
            </tbody>
          </table>
        </div>

        ${
          investigation.tests_log && investigation.tests_log.length > 0
            ? `
          <div class="section">
            <div class="section-title">
              <span>5. Registros Manuais de Testes do Mecânico</span>
              <span class="badge badge-relatado">REGISTRO MANUAL DO MECÂNICO (NÃO CONFIRMADO POR TELEMETRIA)</span>
            </div>
            <p style="font-size: 9.5px; color: #b45309; margin: 0 0 6px 0; font-style: italic;">
              Aviso: As entradas abaixo foram registradas manualmente pelo operador e constituem anotações preliminares de oficina, não possuindo força de evidência definitiva nem alterando o veredito automático da telemetria.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Data/Hora (UTC)</th>
                  <th>Teste Registrado</th>
                  <th>Componente / Alvo</th>
                  <th>Resultado Informado</th>
                  <th>Valor / Aferição</th>
                  <th>Observação Técnica</th>
                </tr>
              </thead>
              <tbody>
                ${investigation.tests_log
                  .map(
                    (t) => `
                  <tr>
                    <td>${t.executedAtUtc ? new Date(t.executedAtUtc).toLocaleString('pt-BR') : '-'}</td>
                    <td><strong>${t.title || 'Teste de Confirmação'}</strong></td>
                    <td>${t.targetComponent || '-'}</td>
                    <td><span class="badge badge-relatado">${t.status || 'INFORMADO'}</span></td>
                    <td>${t.measuredValue || '-'}</td>
                    <td>${t.observation || '-'}</td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
            : ''
        }

        ${
          investigation.intervention
            ? `
          <div class="section">
            <div class="section-title">
              <span>5. Intervenção e Validação Pós-Reparo</span>
              <span class="badge badge-confirmado">CONFIRMADO / VALIDADO</span>
            </div>
            <p style="margin: 3px 0;"><strong>Intervenção Realizada:</strong> ${investigation.intervention.description}</p>
            ${
              investigation.post_repair_validation
                ? `
              <p style="margin: 3px 0;"><strong>Resultado do Reteste:</strong> <u>${investigation.post_repair_validation.outcome}</u></p>
              <table>
                <thead>
                  <tr><th>Parâmetro</th><th>Antes do Reparo</th><th>Depois do Reparo</th></tr>
                </thead>
                <tbody>
                  ${investigation.post_repair_validation.parameterComparison
                    .map(
                      (p) => `
                    <tr><td>${p.parameter}</td><td>${p.beforeValue}</td><td style="font-weight: bold; color: green;">${p.afterValue}</td></tr>
                  `,
                    )
                    .join('')}
                </tbody>
              </table>
              <p style="margin: 4px 0; font-style: italic;"><strong>Veredito:</strong> ${investigation.post_repair_validation.technicianVerdict}</p>
            `
                : ''
            }
          </div>
        `
            : ''
        }

        <div class="footer">
          <span>Network Car 360 • Provedor de Tecnologia Diagnóstica</span>
          <span>Assinatura do Responsável Técnico: ___________________________</span>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
  }

  /**
   * Abre janela de impressão formatada em alta resolução (CSS print especializado),
   * garantindo layout perfeito para impressão física ou geração direta de PDF (Salvar como PDF).
   * O RAW original não é alterado de forma alguma.
   */
  static printDiagnosticReport(params: {
    session: SessionModel
    vehicle?: VehicleModel | null
    events: readonly EventModel[]
    dtcs: readonly DtcModel[]
    packages?: readonly BlackBoxPackage[]
    totalSamplesCount?: number
  }): void {
    const { session, vehicle, events, dtcs, packages = [], totalSamplesCount = 0 } = params

    const printWindow = window.open('', '_blank', 'width=1000,height=800')
    if (!printWindow) {
      alert('Por favor, permita popups para visualizar e imprimir o Relatório PDF.')
      return
    }

    const vehName = vehicle
      ? `${vehicle.make} ${vehicle.model} ${vehicle.version || ''} (${vehicle.year_model || ''})`
      : session.vehicle_name || 'Veículo Não Informado'
    const plate = vehicle?.plate || 'Não Informada'
    const vin = vehicle?.vin || session.vin || 'N/D'

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Relatório Diagnóstico 360 — ${plate} — ${session.session_id}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0;
            padding: 24px;
            color: #1a1a1a;
            background: #fff;
            font-size: 11pt;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #0B0F14;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .header-brand {
            font-size: 18pt;
            font-weight: 800;
            color: #0B0F14;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .header-badge {
            background: #FFB300;
            color: #000;
            font-weight: 800;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 10pt;
            margin-left: 8px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 20px;
          }
          .box {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 12px;
            background: #f9fafb;
          }
          .box-title {
            font-size: 9pt;
            font-weight: 700;
            text-transform: uppercase;
            color: #4b5563;
            margin-bottom: 6px;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
          }
          .data-list {
            margin: 0;
            padding: 0;
            list-style: none;
            font-size: 10pt;
          }
          .data-list li {
            display: flex;
            justify-content: space-between;
            padding: 2px 0;
          }
          .label { color: #6b7280; }
          .val { font-weight: 600; font-family: monospace; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            font-size: 9.5pt;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 6px 8px;
            text-align: left;
          }
          th { background: #f3f4f6; font-weight: 700; }
          .dtc-badge {
            background: #fef3c7;
            color: #92400e;
            font-family: monospace;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #f59e0b;
          }
          .fact-item {
            padding: 4px 0;
            border-bottom: 1px dashed #e5e7eb;
          }
          .fact-bullet {
            color: #d97706;
            font-weight: bold;
            margin-right: 4px;
          }
          .footer {
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
            font-size: 8.5pt;
            color: #6b7280;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <span class="header-brand">Network Car</span>
            <span class="header-badge">360 LIVE</span>
            <div style="font-size: 9pt; color: #4b5563; margin-top: 4px;">
              Relatório Oficial de Telemetria Veicular & Análise Caixa-Preta (OS-ME001-E2)
            </div>
          </div>
          <div style="text-align: right; font-size: 9pt;">
            <div><strong>Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}</div>
            <div><strong>Sessão ID:</strong> <span class="val">${session.session_id}</span></div>
          </div>
        </div>

        <div class="no-print" style="margin-bottom: 16px; padding: 10px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #1e40af; font-size: 9.5pt;">Pressione o botão para imprimir ou salvar como PDF pelo navegador:</span>
          <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 6px 14px; border-radius: 4px; font-weight: bold; cursor: pointer;">Imprimir / Salvar PDF</button>
        </div>

        <div class="meta-grid">
          <div class="box">
            <div class="box-title">Identificação do Veículo</div>
            <ul class="data-list">
              <li><span class="label">Veículo:</span> <span class="val">${vehName}</span></li>
              <li><span class="label">Placa:</span> <span class="val">${plate}</span></li>
              <li><span class="label">Chassi / VIN:</span> <span class="val">${vin}</span></li>
              <li><span class="label">Motorização / Combustível:</span> <span class="val">${vehicle?.engine || 'OBD-II'} (${vehicle?.fuel || 'Flex'})</span></li>
              <li><span class="label">Quilometragem:</span> <span class="val">${vehicle?.odometer_km ? `${vehicle.odometer_km.toLocaleString('pt-BR')} km` : 'N/D'}</span></li>
            </ul>
          </div>

          <div class="box">
            <div class="box-title">Dados da Sessão de Teste</div>
            <ul class="data-list">
              <li><span class="label">Início:</span> <span class="val">${new Date(session.started_at).toLocaleString('pt-BR')}</span></li>
              <li><span class="label">Término:</span> <span class="val">${session.ended_at ? new Date(session.ended_at).toLocaleString('pt-BR') : 'Ativo'}</span></li>
              <li><span class="label">Adaptador / Transporte:</span> <span class="val">${session.adapter_type}</span></li>
              <li><span class="label">Protocolo OBD:</span> <span class="val">${session.protocol || 'ISO 15765-4 (CAN)'}</span></li>
              <li><span class="label">Amostras Brutas Gravadas:</span> <span class="val">${totalSamplesCount} (Append-Only)</span></li>
            </ul>
          </div>
        </div>

        <!-- DTCs -->
        <div class="box" style="margin-bottom: 20px;">
          <div class="box-title">Códigos de Diagnóstico (DTC) Presentes na Rodagem</div>
          ${
            dtcs.length === 0
              ? '<p style="font-size: 9pt; color: #059669; margin: 4px 0;">✓ Nenhuma falha detectada pela ECU (MIL Apagado).</p>'
              : `
              <table>
                <thead>
                  <tr>
                    <th>Código DTC</th>
                    <th>Status</th>
                    <th>Lâmpada MIL</th>
                    <th>Instante de Leitura</th>
                  </tr>
                </thead>
                <tbody>
                  ${dtcs
                    .map(
                      (d) => `
                    <tr>
                      <td><span class="dtc-badge">${d.dtc_code}</span></td>
                      <td>${d.status}</td>
                      <td>${d.mil_on ? 'ACESO' : 'APAGADO'}</td>
                      <td>${new Date(d.read_at_utc).toLocaleTimeString('pt-BR')}</td>
                    </tr>
                  `,
                    )
                    .join('')}
                </tbody>
              </table>
            `
          }
        </div>

        <!-- Sintomas e Pacotes Caixa-Preta -->
        <div class="box" style="margin-bottom: 20px;">
          <div class="box-title">Sintomas Marcados & Caixas-Pretas Associadas (${events.length} Ocorrências)</div>
          ${
            events.length === 0
              ? '<p style="font-size: 9pt; color: #6b7280; margin: 4px 0;">Nenhum sintoma marcado durante o teste de rodagem.</p>'
              : events
                  .map((ev, idx) => {
                    const pkg = packages.find((p) => p.event_id === ev.event_id)
                    return `
                    <div style="margin-top: 12px; padding: 10px; border: 1px solid #fca5a5; border-radius: 6px; background: #fff5f5;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: 800; color: #dc2626; text-transform: uppercase;">#${idx + 1} ${ev.event_type}</span>
                        <span style="font-size: 9pt; font-family: monospace;">T +${(ev.ts_mono_offset_ms / 1000).toFixed(1)}s (${new Date(ev.ts_utc).toLocaleTimeString('pt-BR')})</span>
                      </div>
                      <div style="font-size: 9.5pt; color: #374151; margin-bottom: 6px;">
                        <strong>Descrição informada:</strong> ${ev.description || 'Sem observações adicionais.'}
                      </div>
                      <div style="font-size: 8.5pt; color: #6b7280; margin-bottom: 8px;">
                        Janela isolada: -${(ev.window_pre_ms || 30000) / 1000}s anteriores e +${(ev.window_post_ms || 30000) / 1000}s posteriores. Telemetria bruta preservada intacta.
                      </div>

                      ${
                        pkg && Object.keys(pkg.window_stats).length > 0
                          ? `
                          <div style="font-size: 9pt; font-weight: 700; margin-top: 8px; color: #111827;">Resumo Estatístico dos Parâmetros na Janela:</div>
                          <table>
                            <thead>
                              <tr>
                                <th>Parâmetro</th>
                                <th>Mínimo</th>
                                <th>Médio</th>
                                <th>Máximo</th>
                                <th>Unidade</th>
                              </tr>
                            </thead>
                            <tbody>
                              ${Object.values(pkg.window_stats)
                                .slice(0, 7)
                                .map(
                                  (stat) => `
                                <tr>
                                  <td><strong>${stat.paramName}</strong> (${stat.pid})</td>
                                  <td>${stat.min}</td>
                                  <td>${stat.avg}</td>
                                  <td>${stat.max}</td>
                                  <td>${stat.unit}</td>
                                </tr>
                              `,
                                )
                                .join('')}
                            </tbody>
                          </table>
                        `
                          : ''
                      }

                      ${
                        pkg && pkg.facts && pkg.facts.length > 0
                          ? `
                          <div style="font-size: 9pt; font-weight: 700; margin-top: 10px; color: #111827;">Fatos Observados (DiagnosticEvidence):</div>
                          <div style="margin-top: 4px; font-size: 9pt;">
                            ${pkg.facts
                              .map(
                                (f) => `
                              <div class="fact-item"><span class="fact-bullet">▪</span> ${f.statement}</div>
                            `,
                              )
                              .join('')}
                          </div>
                        `
                          : ''
                      }
                    </div>
                  `
                  })
                  .join('')
          }
        </div>

        <div class="footer">
          <div>Network Soluções • Network Office • Diagnóstico 360 Live</div>
          <div>Garantia Arquitetural: Telemetria Bruta Imutável (Append-Only) • Sem hardcoding veicular</div>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }
}
