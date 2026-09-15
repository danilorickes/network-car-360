import { WorkOrderModel, WorkOrderItem } from '@/types/commercial'

export interface PdfDocumentOptions {
  workshopName: string
  workshopCnpj?: string
  workshopPhone?: string
  workshopAddress?: string
  includeDiagnosticSummary?: boolean
}

export function generateBudgetPrintHtml(
  order: WorkOrderModel,
  options: PdfDocumentOptions,
): string {
  const partsItems = order.items.filter((it) => it.type === 'PECA')
  const serviceItems = order.items.filter((it) => it.type === 'SERVICO')

  const clientName = (order as any).expand?.client?.name || order.client_data?.name || 'Cliente'
  const clientPhone = (order as any).expand?.client?.phone || order.client_data?.phone || '-'
  const clientDoc = (order as any).expand?.client?.document || order.client_data?.document || '-'

  const vehicleModel =
    (order as any).expand?.vehicle?.model || order.vehicle_data?.model || 'Veículo'
  const vehicleMake = (order as any).expand?.vehicle?.make || order.vehicle_data?.make || ''
  const vehicleYear =
    (order as any).expand?.vehicle?.year_model || order.vehicle_data?.year_model || ''

  const renderTableRows = (items: WorkOrderItem[]) => {
    if (items.length === 0) {
      return `<tr><td colspan="6" style="text-align:center; padding:8px; color:#666;">Nenhum item adicionado nesta seção.</td></tr>`
    }
    return items
      .map(
        (it) => `
      <tr>
        <td style="padding:6px 8px; border-bottom:1px solid #ddd; font-family:monospace;">${it.code || '-'}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #ddd;">
          <strong>${it.description}</strong>
          ${it.executionNotes ? `<div style="font-size:11px; color:#555;">Obs: ${it.executionNotes}</div>` : ''}
        </td>
        <td style="padding:6px 8px; border-bottom:1px solid #ddd; text-align:center;">${it.quantity}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #ddd; text-align:right;">R$ ${it.unitPrice.toFixed(2)}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #ddd; text-align:right;">${it.discount > 0 ? `R$ ${it.discount.toFixed(2)}` : '-'}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #ddd; text-align:right; font-weight:bold;">
          R$ ${Math.max(0, it.quantity * it.unitPrice - it.discount).toFixed(2)}
          <span style="font-size:10px; display:block; color:${it.itemApproval === 'APROVADO' ? '#2e7d32' : it.itemApproval === 'RECUSADO' ? '#c62828' : '#e65100'}">
            [${it.itemApproval}]
          </span>
        </td>
      </tr>
    `,
      )
      .join('')
  }

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Orçamento Comercial - ${order.order_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #1a1a1a; font-size: 13px; line-height: 1.4; }
    .header { border-bottom: 2px solid #263340; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 20px; font-weight: bold; color: #0B0F14; margin: 0; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
    .badge-approved { background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7; }
    .badge-pending { background: #fff8e1; color: #f57f17; border: 1px solid #ffe082; }
    .badge-refused { background: #ffebee; color: #c62828; border: 1px solid #ffcdd2; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .box { border: 1px solid #cfd8dc; border-radius: 4px; padding: 10px 14px; background: #fafafa; }
    .box h4 { margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #546e7a; border-bottom: 1px solid #eceff1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #eceff1; text-align: left; padding: 8px; font-size: 12px; color: #37474f; border-bottom: 2px solid #cfd8dc; }
    .totals { margin-top: 16px; border-top: 2px solid #263340; padding-top: 12px; display: flex; justify-content: flex-end; }
    .totals-table { width: 320px; font-size: 13px; }
    .totals-table td { padding: 4px 0; }
    .total-general { font-size: 16px; font-weight: bold; color: #0B0F14; border-top: 1px solid #ccc; padding-top: 6px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px dashed #bbb; font-size: 11px; color: #78909c; text-align: center; }
    .diag-box { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 4px; padding: 10px 14px; margin-bottom: 16px; }
    @media print {
      body { margin: 0; padding: 10mm; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${options.workshopName}</h1>
      <div>${options.workshopAddress || ''} ${options.workshopPhone ? '• Tel: ' + options.workshopPhone : ''}</div>
      ${options.workshopCnpj ? `<div>CNPJ: ${options.workshopCnpj}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <h2 style="margin:0; font-size: 18px; color:#d97706;">ORÇAMENTO COMERCIAL</h2>
      <div style="font-size: 14px; font-weight:bold; font-family:monospace;">${order.order_number}</div>
      <div style="font-size: 11px; color: #666;">Versão do Orçamento: v${order.budget_version}</div>
      <div style="margin-top: 4px;">
        <span class="badge ${order.approval_status === 'APROVADO' ? 'badge-approved' : order.approval_status === 'RECUSADO' ? 'badge-refused' : 'badge-pending'}">
          STATUS: ${order.approval_status}
        </span>
      </div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h4>Dados do Cliente</h4>
      <div><strong>Nome:</strong> ${clientName}</div>
      <div><strong>Telefone / WhatsApp:</strong> ${clientPhone}</div>
      <div><strong>CPF/CNPJ:</strong> ${clientDoc}</div>
    </div>
    <div class="box">
      <h4>Dados do Veículo</h4>
      <div><strong>Veículo:</strong> ${vehicleMake} ${vehicleModel} (${vehicleYear})</div>
      <div><strong>Placa:</strong> <span style="font-family:monospace; font-weight:bold; background:#eee; padding:1px 4px; border-radius:3px;">${order.vehicle_plate}</span></div>
      <div><strong>Quilometragem de Entrada:</strong> ${order.odometer_km.toLocaleString('pt-BR')} km</div>
    </div>
  </div>

  ${
    options.includeDiagnosticSummary && order.confirmed_diagnosis
      ? `
    <div class="diag-box">
      <h4 style="margin:0 0 4px 0; color:#1565c0; font-size:12px; text-transform:uppercase;">Resumo Técnico — Diagnóstico 360 Confirmado</h4>
      <div style="font-weight:bold; color:#0d47a1;">${order.confirmed_diagnosis}</div>
      <div style="font-size:11px; color:#546e7a; margin-top:2px;">Laudo técnico confirmado por testes cruzados e medições físicas. Sem hipóteses preliminares.</div>
    </div>
  `
      : ''
  }

  <h3 style="margin: 16px 0 6px 0; color:#37474f;">1. Serviços e Mão de Obra</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 12%;">Código</th>
        <th>Descrição do Serviço</th>
        <th style="width: 8%; text-align:center;">Qtd</th>
        <th style="width: 14%; text-align:right;">Valor Unit.</th>
        <th style="width: 12%; text-align:right;">Desc.</th>
        <th style="width: 18%; text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${renderTableRows(serviceItems)}
    </tbody>
  </table>

  <h3 style="margin: 16px 0 6px 0; color:#37474f;">2. Peças e Materiais</h3>
  <table>
    <thead>
      <tr>
        <th style="width: 12%;">Código</th>
        <th>Descrição da Peça</th>
        <th style="width: 8%; text-align:center;">Qtd</th>
        <th style="width: 14%; text-align:right;">Valor Unit.</th>
        <th style="width: 12%; text-align:right;">Desc.</th>
        <th style="width: 18%; text-align:right;">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${renderTableRows(partsItems)}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr>
        <td>Subtotal de Serviços:</td>
        <td style="text-align:right; font-weight:500;">R$ ${order.services_subtotal.toFixed(2)}</td>
      </tr>
      <tr>
        <td>Subtotal de Peças:</td>
        <td style="text-align:right; font-weight:500;">R$ ${order.parts_subtotal.toFixed(2)}</td>
      </tr>
      ${
        order.discount_total > 0
          ? `<tr>
        <td style="color:#c62828;">Descontos Concedidos:</td>
        <td style="text-align:right; color:#c62828;">- R$ ${order.discount_total.toFixed(2)}</td>
      </tr>`
          : ''
      }
      <tr class="total-general">
        <td>TOTAL GERAL DO ORÇAMENTO:</td>
        <td style="text-align:right;">R$ ${order.general_total.toFixed(2)}</td>
      </tr>
      <tr style="color:#2e7d32; font-weight:bold;">
        <td>TOTAL EFETIVAMENTE APROVADO:</td>
        <td style="text-align:right;">R$ ${order.approved_total.toFixed(2)}</td>
      </tr>
    </table>
  </div>

  ${
    order.budget_notes
      ? `
    <div style="margin-top: 16px; padding: 8px 12px; background: #fffde7; border-left: 3px solid #fbc02d; font-size:12px;">
      <strong>Observações e Validade:</strong> ${order.budget_notes} (Validade: ${order.budget_validity_days || 10} dias)
    </div>
  `
      : ''
  }

  ${
    order.approval_details
      ? `
    <div style="margin-top: 12px; font-size: 11px; color:#555; border:1px solid #ddd; padding: 6px 10px; border-radius:4px;">
      <strong>Registro de Aprovação:</strong> Canal: ${order.approval_details.channel} • Aprovado por: ${order.approval_details.responsibleUserName} em ${new Date(order.approval_details.approvedAtUtc).toLocaleString('pt-BR')}
      ${order.approval_details.customerNotes ? `<br><em>Notas do cliente: "${order.approval_details.customerNotes}"</em>` : ''}
    </div>
  `
      : ''
  }

  <div class="footer">
    Orçamento gerado pelo Network Car 360 • Software de Gestão e Diagnóstico Veicular Inteligente.<br>
    Este documento não autoriza a desmontagem de componentes recusados.
  </div>
</body>
</html>
  `
}

export function generateWorkOrderPrintHtml(
  order: WorkOrderModel,
  options: PdfDocumentOptions,
): string {
  const partsItems = order.items.filter((it) => it.type === 'PECA')
  const serviceItems = order.items.filter((it) => it.type === 'SERVICO')

  const clientName = (order as any).expand?.client?.name || order.client_data?.name || 'Cliente'
  const clientPhone = (order as any).expand?.client?.phone || order.client_data?.phone || '-'
  const vehicleModel =
    (order as any).expand?.vehicle?.model || order.vehicle_data?.model || 'Veículo'
  const vehicleMake = (order as any).expand?.vehicle?.make || order.vehicle_data?.make || ''

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Ordem de Serviço - ${order.order_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #1a1a1a; font-size: 13px; line-height: 1.4; }
    .header { border-bottom: 2px solid #263340; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 20px; font-weight: bold; color: #0B0F14; margin: 0; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 11px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .box { border: 1px solid #cfd8dc; border-radius: 4px; padding: 10px 14px; background: #fafafa; }
    .box h4 { margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #546e7a; border-bottom: 1px solid #eceff1; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #eceff1; text-align: left; padding: 8px; font-size: 12px; color: #37474f; border-bottom: 2px solid #cfd8dc; }
    td { padding: 6px 8px; border-bottom: 1px solid #ddd; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px dashed #bbb; font-size: 11px; color: #78909c; text-align: center; }
    .signatures { margin-top: 50px; display: flex; justify-content: space-around; text-align: center; }
    .sig-line { width: 220px; border-top: 1px solid #333; padding-top: 4px; font-size: 11px; }
    @media print {
      body { margin: 0; padding: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${options.workshopName}</h1>
      <div>${options.workshopAddress || ''} ${options.workshopPhone ? '• Tel: ' + options.workshopPhone : ''}</div>
      ${options.workshopCnpj ? `<div>CNPJ: ${options.workshopCnpj}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <h2 style="margin:0; font-size: 18px; color:#1e40af;">ORDEM DE SERVIÇO</h2>
      <div style="font-size: 16px; font-weight:bold; font-family:monospace;">${order.order_number}</div>
      <div style="font-size: 12px; font-weight:bold; margin-top:4px;">ESTADO: ${order.status}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h4>Identificação do Cliente</h4>
      <div><strong>Nome:</strong> ${clientName}</div>
      <div><strong>Telefone:</strong> ${clientPhone}</div>
    </div>
    <div class="box">
      <h4>Veículo em Reparo</h4>
      <div><strong>Veículo:</strong> ${vehicleMake} ${vehicleModel}</div>
      <div><strong>Placa:</strong> <span style="font-family:monospace; font-weight:bold; background:#eee; padding:1px 4px; border-radius:3px;">${order.vehicle_plate}</span></div>
      <div><strong>Odômetro de Entrada:</strong> ${order.odometer_km.toLocaleString('pt-BR')} km</div>
    </div>
  </div>

  ${
    order.confirmed_diagnosis
      ? `
    <div style="background:#e8f5e9; border:1px solid #81c784; padding:10px 14px; border-radius:4px; margin-bottom:16px;">
      <strong style="color:#2e7d32;">DIAGNÓSTICO TÉCNICO CONFIRMADO (360):</strong>
      <div style="margin-top:3px; color:#1b5e20;">${order.confirmed_diagnosis}</div>
    </div>
  `
      : ''
  }

  <h3>Itens de Execução (Serviços e Mão de Obra)</h3>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Descrição</th>
        <th>Aprovação Cliente</th>
        <th>Status de Execução</th>
        <th>Técnico Responsável</th>
      </tr>
    </thead>
    <tbody>
      ${serviceItems
        .map(
          (it) => `
        <tr>
          <td style="font-family:monospace;">${it.code || '-'}</td>
          <td><strong>${it.description}</strong></td>
          <td><span style="font-weight:bold; color:${it.itemApproval === 'APROVADO' ? '#2e7d32' : '#c62828'};">${it.itemApproval}</span></td>
          <td>${it.executionStatus}</td>
          <td>${it.technicianResponsible || 'Oficina'}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>

  <h3>Peças e Insumos Utilizados</h3>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Descrição</th>
        <th>Qtd</th>
        <th>Aprovação Cliente</th>
        <th>Status de Aplicação</th>
      </tr>
    </thead>
    <tbody>
      ${partsItems
        .map(
          (it) => `
        <tr>
          <td style="font-family:monospace;">${it.code || '-'}</td>
          <td><strong>${it.description}</strong></td>
          <td>${it.quantity}</td>
          <td><span style="font-weight:bold; color:${it.itemApproval === 'APROVADO' ? '#2e7d32' : '#c62828'};">${it.itemApproval}</span></td>
          <td>${it.executionStatus}</td>
        </tr>
      `,
        )
        .join('')}
    </tbody>
  </table>

  ${
    order.post_repair_result
      ? `
    <div style="background:#f3e8ff; border:1px solid #d8b4fe; padding:10px 14px; border-radius:4px; margin-bottom:16px;">
      <strong style="color:#6b21a8;">VALIDAÇÃO PÓS-REPARO: ${order.post_repair_result.outcome}</strong>
      <div>Veredito Técnico: ${order.post_repair_result.verdict}</div>
      <div style="font-size:11px; color:#555;">DTCs Antes: ${order.post_repair_result.beforeDtcList.join(', ') || 'Nenhum'} | DTCs Depois: ${order.post_repair_result.afterDtcList.join(', ') || 'Nenhum (zerado)'}</div>
    </div>
  `
      : ''
  }

  <div class="signatures">
    <div>
      <div class="sig-line">Responsável Técnico / Mecânica</div>
    </div>
    <div>
      <div class="sig-line">Cliente / Proprietário</div>
    </div>
  </div>

  <div class="footer">
    Ordem de Serviço gerada pelo Network Car 360 • A execução dos serviços segue as normas técnicas ABNT e garantia legal.
  </div>
</body>
</html>
  `
}
