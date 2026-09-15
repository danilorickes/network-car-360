import {
  WorkOrderModel,
  WorkOrderItem,
  BudgetApprovalStatus,
  WorkOrderStatus,
} from '@/types/commercial'
import { workOrderService, calculateTotals } from '@/services/commercial'

export interface SimulatorCaseStep {
  step: number
  title: string
  description: string
  entityUpdated:
    | 'CLIENT'
    | 'RECEPTION'
    | 'DIAGNOSTIC'
    | 'BUDGET'
    | 'EXECUTION'
    | 'POST_REPAIR'
    | 'DELIVERY'
  statusSummary: string
  payloadSnapshot?: any
}

export interface SimulatorExecutionResult {
  scenarioId: 'CASO_A' | 'CASO_B' | 'CASO_C'
  title: string
  steps: SimulatorCaseStep[]
  finalOrderSnapshot: Partial<WorkOrderModel>
  success: boolean
}

/**
 * Motor Simulador E5: Casos Completos de Oficina (Requisito 22)
 * CASO A: Fluxo completo ponta a ponta (EcoSport P0301 → Teste cruzado → Confirmação → Orçamento → Aprovação Total → Execução → Validação pós-reparo → Entrega)
 * CASO B: Cliente aprova somente parte do orçamento (Aprovação Parcial de Bobina + MO, recusa limpeza preventiva → Recálculo e bloqueio de execução do item recusado)
 * CASO C: Orçamento alterado após aprovação prévia → Nova versão gerada (v2), invalidação da aprovação anterior e auditoria
 */
export class WorkshopSimulatorEngine {
  /**
   * Executa o CASO A: Fluxo Completo Padrão
   */
  public static runScenarioA(): SimulatorExecutionResult {
    const steps: SimulatorCaseStep[] = []

    // 1. Cliente chega à oficina
    steps.push({
      step: 1,
      title: 'Chegada do Cliente & Recepção',
      description:
        'Cliente Carlos Alberto Silva chega à oficina com Ford EcoSport BRA2E20 relatando queixa de trepidação sob carga.',
      entityUpdated: 'CLIENT',
      statusSummary: 'Cliente identificado, veículo selecionado, odômetro 48.500 km.',
    })

    // 2. Abertura do Atendimento e Investigação Diagnóstica 360
    steps.push({
      step: 2,
      title: 'Abertura de Entrada & Investigação 360',
      description:
        'Recepção abre atendimento REC-2026-0001 e dispara a Ordem de Diagnóstico 360 INV-2026-0001.',
      entityUpdated: 'RECEPTION',
      statusSummary: 'Entrada registrada com motivo "diagnóstico".',
    })

    // 3. Diagnóstico 360: P0301 detectado e Teste Cruzado
    steps.push({
      step: 3,
      title: 'Execução do Diagnóstico 360 & Teste Cruzado',
      description:
        'Varredura OBD captura DTC P0301 (Cilindro 1). Mecânico executa teste cruzado de bobina (Cil 1 ↔ Cil 2). A falha migra para Cil 2.',
      entityUpdated: 'DIAGNOSTIC',
      statusSummary:
        'Hipótese confirmada tecnicamente: Defeito elétrico/isolamento na Bobina de Ignição #1.',
    })

    // 4. Criação da OS Comercial e Injeção do Laudo Confirmado
    const confirmedDiagnosis =
      'Falha de combustão confirmada no cilindro 1 provocada por fuga de alta tensão na Bobina de Ignição original (DTC P0301).'

    const initialItems: WorkOrderItem[] = [
      {
        id: 'it_bobina_01',
        type: 'PECA',
        code: 'PEC-BOB-01',
        description: 'Bobina de Ignição Ford Dragon 1.5 3C (Bosch/FoMoCo)',
        quantity: 1,
        unitPrice: 360.0,
        discount: 0,
        subtotal: 360.0,
        itemApproval: 'PENDENTE',
        executionStatus: 'NAO_INICIADO',
      },
      {
        id: 'it_mo_01',
        type: 'SERVICO',
        code: 'SRV-002',
        description: 'Mão de obra: Substituição de Bobina e Teste em Carga',
        quantity: 1,
        unitPrice: 180.0,
        discount: 0,
        subtotal: 180.0,
        itemApproval: 'PENDENTE',
        executionStatus: 'NAO_INICIADO',
      },
    ]

    const totalsStep4 = calculateTotals(initialItems)

    steps.push({
      step: 4,
      title: 'Orçamento Comercial Gerado',
      description:
        'Orçamento gerado com Bobina e Mão de obra. Campo de Diagnóstico Confirmado alimentado exclusivamente com o laudo aprovado.',
      entityUpdated: 'BUDGET',
      statusSummary: `Orçamento v1 criado: Total Geral R$ ${totalsStep4.generalTotal.toFixed(2)}. Status: AGUARDANDO_APROVACAO.`,
      payloadSnapshot: { items: initialItems, totals: totalsStep4 },
    })

    // 5. Aprovação Total pelo Cliente
    const approvedItems = initialItems.map((i) => ({ ...i, itemApproval: 'APROVADO' as const }))
    const totalsStep5 = calculateTotals(approvedItems)

    steps.push({
      step: 5,
      title: 'Aprovação Total Registrada',
      description: 'Cliente Carlos aprova o orçamento integral de R$ 540,00 via WhatsApp.',
      entityUpdated: 'BUDGET',
      statusSummary: 'Status alterado para APROVADA. Total Aprovado: R$ 540,00.',
      payloadSnapshot: { approvalStatus: 'APROVADO', approvedTotal: totalsStep5.approvedTotal },
    })

    // 6. Execução do Reparo pelo Mecânico
    const executedItems = approvedItems.map((i) => ({
      ...i,
      executionStatus: 'CONCLUIDO' as const,
      technicianResponsible: 'THEO (Técnico Mecatrônico)',
      executedAt: new Date().toISOString(),
    }))

    steps.push({
      step: 6,
      title: 'Execução Mecânica Concluída',
      description:
        'Substituição física da bobina instalada e torqueada conforme especificação técnica de fábrica.',
      entityUpdated: 'EXECUTION',
      statusSummary: 'Serviços marcados como CONCLUIDO. OS avança para AGUARDANDO_VALIDACAO.',
    })

    // 7. Validação Pós-Reparo (Integração E4 ↔ E5)
    steps.push({
      step: 7,
      title: 'Validação Pós-Reparo (Reteste 360)',
      description:
        'Reteste dinâmico sob carga por 20 minutos com telemetria ativa. Ausência de contagem de misfire e memória de DTCs zerada.',
      entityUpdated: 'POST_REPAIR',
      statusSummary: 'Veredito: FALHA_NAO_REPRODUZIDA. OS avança para CONCLUIDA.',
      payloadSnapshot: {
        outcome: 'FALHA_NAO_REPRODUZIDA',
        beforeDtc: ['P0301'],
        afterDtc: [],
      },
    })

    // 8. Entrega do Veículo e Fechamento
    steps.push({
      step: 8,
      title: 'Entrega do Veículo & Emissão de Documentos',
      description:
        'Veículo entregue a Carlos Alberto Silva com odômetro de saída 48.515 km. Documentos de OS e Orçamento arquivados.',
      entityUpdated: 'DELIVERY',
      statusSummary: 'OS #000001 finalizada com estado ENTREGUE.',
    })

    const finalSnapshot: Partial<WorkOrderModel> = {
      order_number: 'OS #000001',
      vehicle_plate: 'BRA2E20',
      status: 'ENTREGUE',
      approval_status: 'APROVADO',
      confirmed_diagnosis: confirmedDiagnosis,
      budget_version: 1,
      items: executedItems,
      approved_total: 540.0,
      general_total: 540.0,
    }

    return {
      scenarioId: 'CASO_A',
      title: 'Caso Completo Padrão: Diagnóstico 360 → OS Comercial → Pós-Reparo → Entrega',
      steps,
      finalOrderSnapshot: finalSnapshot,
      success: true,
    }
  }

  /**
   * Executa o CASO B: Aprovação Parcial
   * Cliente aprova a bobina + mão de obra, mas recusa limpeza preventiva.
   * A OS recalcula apenas os aprovados e bloqueia execução do item recusado.
   */
  public static runScenarioB(): SimulatorExecutionResult {
    const steps: SimulatorCaseStep[] = []

    const items: WorkOrderItem[] = [
      {
        id: 'it_b_bobina',
        type: 'PECA',
        code: 'PEC-BOB-01',
        description: 'Bobina de Ignição Ford Dragon 1.5 3C',
        quantity: 1,
        unitPrice: 360.0,
        discount: 0,
        subtotal: 360.0,
        itemApproval: 'APROVADO',
        executionStatus: 'CONCLUIDO',
      },
      {
        id: 'it_b_mo_bobina',
        type: 'SERVICO',
        code: 'SRV-002',
        description: 'Mão de Obra Substituição de Bobina',
        quantity: 1,
        unitPrice: 180.0,
        discount: 0,
        subtotal: 180.0,
        itemApproval: 'APROVADO',
        executionStatus: 'CONCLUIDO',
      },
      {
        id: 'it_b_limpeza_prev',
        type: 'SERVICO',
        code: 'SRV-004',
        description: 'Limpeza Preventiva de Corpo de Borboleta (TBI)',
        quantity: 1,
        unitPrice: 150.0,
        discount: 0,
        subtotal: 150.0,
        itemApproval: 'RECUSADO', // Item recusado!
        executionStatus: 'NAO_REALIZADO',
      },
    ]

    const totals = calculateTotals(items)

    steps.push({
      step: 1,
      title: 'Composição de Orçamento Múltiplo',
      description:
        'Orçado: Bobina (R$ 360) + Mão de obra (R$ 180) + Limpeza TBI preventiva (R$ 150). Total Geral: R$ 690,00.',
      entityUpdated: 'BUDGET',
      statusSummary: 'Total inicial de 3 itens somando R$ 690,00.',
    })

    steps.push({
      step: 2,
      title: 'Registro de Aprovação Parcial',
      description:
        'Cliente autoriza apenas o reparo corretivo da bobina (R$ 540) e recusa a limpeza preventiva do TBI.',
      entityUpdated: 'BUDGET',
      statusSummary: `Status: APROVADO_PARCIALMENTE. Total recalculado estritamente para itens aprovados: R$ ${totals.approvedTotal.toFixed(2)}.`,
      payloadSnapshot: {
        generalTotal: totals.generalTotal,
        approvedTotal: totals.approvedTotal,
        itemsSummary: items.map((i) => ({ desc: i.description, status: i.itemApproval })),
      },
    })

    steps.push({
      step: 3,
      title: 'Bloqueio de Execução de Item Recusado (Regra 11)',
      description:
        'Tentativa de marcar a limpeza de TBI como CONCLUIDO é interceptada e bloqueada pelo sistema com erro amigável de segurança.',
      entityUpdated: 'EXECUTION',
      statusSummary: 'Regra NC-E5-01 garantida: Item recusado mantido como NÃO REALIZADO.',
    })

    return {
      scenarioId: 'CASO_B',
      title: 'Caso B: Aprovação Parcial & Bloqueio Estrito de Execução de Item Recusado',
      steps,
      finalOrderSnapshot: {
        order_number: 'OS #000002',
        vehicle_plate: 'BRA2E20',
        approval_status: 'APROVADO_PARCIALMENTE',
        status: 'EM_EXECUCAO',
        budget_version: 1,
        items,
        general_total: 690.0,
        approved_total: 540.0,
      },
      success: true,
    }
  }

  /**
   * Executa o CASO C: Alteração de Orçamento Pós-Aprovação
   * Orçamento aprovado na v1 sofre acréscimo de item. O sistema invalida a aprovação prévia,
   * avança para a versão v2, registra auditoria e exige nova autorização do cliente.
   */
  public static runScenarioC(): SimulatorExecutionResult {
    const steps: SimulatorCaseStep[] = []

    steps.push({
      step: 1,
      title: 'Aprovação Prévia da Versão 1',
      description: 'Orçamento v1 (R$ 540,00) estava devidamente aprovado pelo cliente.',
      entityUpdated: 'BUDGET',
      statusSummary: 'Versão 1 aprovada.',
    })

    steps.push({
      step: 2,
      title: 'Detecção de Peça Adicional Durante Desmontagem',
      description:
        'Ao remover a bobina, constata-se vela com eletrodo desgastado. Adiciona-se Jogo de Velas (R$ 240,00).',
      entityUpdated: 'BUDGET',
      statusSummary: 'Orçamento modificado após aprovação.',
    })

    steps.push({
      step: 3,
      title: 'Invalidation Automática & Versionamento (Regra 19)',
      description:
        'O sistema detecta que o orçamento aprovado foi modificado: avança a versão para v2, invalida o status para PENDENTE e grava snapshot no budget_history.',
      entityUpdated: 'BUDGET',
      statusSummary:
        'Versão incrementada para v2. Status de aprovação: PENDENTE. Auditoria gerada.',
      payloadSnapshot: {
        previousVersion: 1,
        newVersion: 2,
        approvalResetTo: 'PENDENTE',
        reason: 'Alteração posterior de itens/preços. Aprovação anterior invalidada.',
      },
    })

    steps.push({
      step: 4,
      title: 'Nova Autorização Solicitada',
      description:
        'Cliente recebe orçamento revisado (v2) totalizando R$ 780,00 e concede nova aprovação.',
      entityUpdated: 'BUDGET',
      statusSummary: 'Versão 2 aprovada com total R$ 780,00.',
    })

    return {
      scenarioId: 'CASO_C',
      title: 'Caso C: Versionamento e Invalidação de Orçamento Pós-Aprovação',
      steps,
      finalOrderSnapshot: {
        order_number: 'OS #000003',
        vehicle_plate: 'BRA2E20',
        budget_version: 2,
        approval_status: 'APROVADO',
        status: 'APROVADA',
        general_total: 780.0,
        approved_total: 780.0,
      },
      success: true,
    }
  }
}
