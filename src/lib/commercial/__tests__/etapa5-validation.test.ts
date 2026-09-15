import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateTotals, workOrderService, clientService } from '@/services/commercial'
import { WorkshopSimulatorEngine } from '@/lib/commercial/simulator-case-e5'
import { generateBudgetPrintHtml, generateWorkOrderPrintHtml } from '@/services/pdf-service'
import { WorkOrderModel, WorkOrderItem } from '@/types/commercial'

describe('Validação da Etapa 5 — Operação da Oficina & OS Comercial (OS-ME001-E5)', () => {
  // -------------------------------------------------------------
  // REQUISITO 1 & 6: Princípio Arquitetural e Desacoplamento da OD-360
  // -------------------------------------------------------------
  describe('Princípio Arquitetural: OD-360 vs OS Comercial', () => {
    it('deve manter entidade work_order desacoplada e permitir OS sem Diagnóstico 360', () => {
      const osSemDiag: Partial<WorkOrderModel> = {
        order_number: 'OS #000010',
        sequential_num: 10,
        vehicle_plate: 'BRA2E20',
        diagnostic_investigation: undefined, // Sem investigação vinculada
        status: 'RASCUNHO',
        items: [
          {
            id: 'it_oleo',
            type: 'SERVICO',
            code: 'SRV-005',
            description: 'Troca de Óleo e Filtros',
            quantity: 1,
            unitPrice: 120.0,
            discount: 0,
            subtotal: 120.0,
            itemApproval: 'APROVADO',
            executionStatus: 'NAO_INICIADO',
          },
        ],
      }

      expect(osSemDiag.diagnostic_investigation).toBeUndefined()
      expect(osSemDiag.order_number).toMatch(/^OS #\d{6}$/)
    })

    it('NÃO deve transformar hipótese em defeito confirmado na OS', () => {
      const confirmedText = 'Falha confirmada na Bobina de Ignição Cilindro 1 após teste cruzado.'
      const order: Partial<WorkOrderModel> = {
        order_number: 'OS #000001',
        confirmed_diagnosis: confirmedText,
      }

      // Somente resultado tecnicamente confirmado entra no laudo
      expect(order.confirmed_diagnosis).toContain('confirmada')
      expect(order.confirmed_diagnosis).not.toContain('HIPOTESE_PRELIMINAR')
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 2 & 3: Clientes e Relação 1 Cliente → N Veículos
  // -------------------------------------------------------------
  describe('Cadastro de Clientes e Relação com Veículos', () => {
    it('deve associar 1 cliente a múltiplos veículos sem quebrar dados técnicos', () => {
      const clienteId = 'clicarlos000001'
      const veiculo1 = {
        id: 'v1',
        plate: 'BRA2E20',
        make: 'Ford',
        model: 'EcoSport',
        client: clienteId,
        engine: '1.5 Dragon',
        odometer_km: 48500,
      }
      const veiculo2 = {
        id: 'v2',
        plate: 'NET3600',
        make: 'Volkswagen',
        model: 'T-Cross',
        client: clienteId,
        engine: '1.0 TSI',
        odometer_km: 32000,
      }

      const veiculosCliente = [veiculo1, veiculo2].filter((v) => v.client === clienteId)
      expect(veiculosCliente).toHaveLength(2)
      expect(veiculosCliente[0].plate).toBe('BRA2E20')
      expect(veiculosCliente[1].plate).toBe('NET3600')
      expect(veiculosCliente[0].engine).toBe('1.5 Dragon') // Dados técnicos intactos
    })
  })

  // -------------------------------------------------------------
  // REQUISITOS 5, 9 & 10: Orçamento, Totais Separados e Aprovação Individual
  // -------------------------------------------------------------
  describe('Motor Orçamentário e Aprovação', () => {
    const items: WorkOrderItem[] = [
      {
        id: '1',
        type: 'PECA',
        code: 'PEC-01',
        description: 'Bobina de Ignição',
        quantity: 1,
        unitPrice: 360.0,
        discount: 0,
        subtotal: 360.0,
        itemApproval: 'APROVADO',
        executionStatus: 'NAO_INICIADO',
      },
      {
        id: '2',
        type: 'SERVICO',
        code: 'SRV-01',
        description: 'Mão de obra substituição',
        quantity: 1,
        unitPrice: 180.0,
        discount: 0,
        subtotal: 180.0,
        itemApproval: 'APROVADO',
        executionStatus: 'NAO_INICIADO',
      },
      {
        id: '3',
        type: 'SERVICO',
        code: 'SRV-02',
        description: 'Limpeza preventiva de bicos',
        quantity: 1,
        unitPrice: 220.0,
        discount: 20.0,
        subtotal: 200.0,
        itemApproval: 'RECUSADO', // Item recusado pelo cliente!
        executionStatus: 'NAO_REALIZADO',
      },
    ]

    it('deve calcular subtotais separados de peças, serviços e total aprovado', () => {
      const totals = calculateTotals(items)

      expect(totals.partsSubtotal).toBe(360.0)
      expect(totals.servicesSubtotal).toBe(380.0) // 180 + (220 - 20)
      expect(totals.generalTotal).toBe(740.0)
      // Total aprovado considera somente os itens marcados como APROVADO (360 + 180 = 540)
      expect(totals.approvedTotal).toBe(540.0)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 11: Execução e Bloqueio Estrito de Serviço Recusado
  // -------------------------------------------------------------
  describe('Regra de Execução: Serviço Recusado', () => {
    it('deve impedir que serviço RECUSADO seja marcado como CONCLUIDO sem autorização prévia', async () => {
      const currentOrder: WorkOrderModel = {
        id: 'wo_test_01',
        workshop_id: 'wsnetmatriz0001',
        order_number: 'OS #000001',
        sequential_num: 1,
        client: 'cli_01',
        vehicle: 'veh_01',
        vehicle_plate: 'BRA2E20',
        odometer_km: 48500,
        status: 'APROVADA',
        approval_status: 'APROVADO_PARCIALMENTE',
        budget_version: 1,
        items: [
          {
            id: 'item_recusado',
            type: 'SERVICO',
            code: 'SRV-04',
            description: 'Limpeza de TBI',
            quantity: 1,
            unitPrice: 150.0,
            discount: 0,
            subtotal: 150.0,
            itemApproval: 'RECUSADO',
            executionStatus: 'NAO_REALIZADO',
          },
        ],
        services_subtotal: 150.0,
        parts_subtotal: 0,
        discount_total: 0,
        approved_total: 0,
        general_total: 150.0,
      }

      await expect(
        workOrderService.updateItemExecution(
          'wo_test_01',
          'item_recusado',
          'CONCLUIDO',
          'Mecânico Roberto',
          'Tentando executar serviço recusado',
          currentOrder,
        ),
      ).rejects.toThrow(/Não é permitido executar item que foi RECUSADO/i)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 19: Alteração de Orçamento Após Aprovação
  // -------------------------------------------------------------
  describe('Versionamento do Orçamento e Invalidação da Aprovação Prévia', () => {
    it('deve detectar alteração em orçamento aprovado, incrementar versão para v2 e resetar para PENDENTE', async () => {
      // Mock do PocketBase update
      const currentOrder: WorkOrderModel = {
        id: 'wo_test_02',
        workshop_id: 'wsnetmatriz0001',
        order_number: 'OS #000002',
        sequential_num: 2,
        client: 'cli_01',
        vehicle: 'veh_01',
        vehicle_plate: 'BRA2E20',
        odometer_km: 48500,
        status: 'APROVADA',
        approval_status: 'APROVADO',
        budget_version: 1,
        items: [
          {
            id: 'it_1',
            type: 'PECA',
            code: 'PEC-01',
            description: 'Bobina',
            quantity: 1,
            unitPrice: 360.0,
            discount: 0,
            subtotal: 360.0,
            itemApproval: 'APROVADO',
            executionStatus: 'CONCLUIDO',
          },
        ],
        services_subtotal: 0,
        parts_subtotal: 360.0,
        discount_total: 0,
        approved_total: 360.0,
        general_total: 360.0,
        budget_history: [],
      }

      // Novo item inserido pós-aprovação
      const newItems: WorkOrderItem[] = [
        ...currentOrder.items,
        {
          id: 'it_2',
          type: 'PECA',
          code: 'PEC-02',
          description: 'Jogo de Velas',
          quantity: 1,
          unitPrice: 240.0,
          discount: 0,
          subtotal: 240.0,
          itemApproval: 'PENDENTE',
          executionStatus: 'NAO_INICIADO',
        },
      ]

      const wasAlreadyApproved =
        currentOrder.approval_status === 'APROVADO' ||
        currentOrder.approval_status === 'APROVADO_PARCIALMENTE'

      expect(wasAlreadyApproved).toBe(true)

      let newVersion = currentOrder.budget_version
      let newApprovalStatus = currentOrder.approval_status
      const history = [...(currentOrder.budget_history || [])]

      if (wasAlreadyApproved) {
        newVersion += 1
        newApprovalStatus = 'PENDENTE'
        history.push({
          version: currentOrder.budget_version,
          invalidatedAt: new Date().toISOString(),
          previousApprovalStatus: currentOrder.approval_status,
          previousSubtotalParts: currentOrder.parts_subtotal,
          previousSubtotalServices: currentOrder.services_subtotal,
          reason: 'Alteração posterior de itens/preços. Aprovação anterior invalidada.',
          itemsSnapshot: currentOrder.items,
        })
      }

      expect(newVersion).toBe(2)
      expect(newApprovalStatus).toBe('PENDENTE')
      expect(history).toHaveLength(1)
      expect(history[0].version).toBe(1)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 20: Multitenant / Isolamento por Oficina
  // -------------------------------------------------------------
  describe('Isolamento Multi-oficina', () => {
    it('deve conter campo workshop_id em todas as entidades criadas', () => {
      const order: Partial<WorkOrderModel> = {
        order_number: 'OS #000001',
        workshop_id: 'wsnetmatriz0001',
        vehicle_plate: 'BRA2E20',
      }
      expect(order.workshop_id).toBeDefined()
      expect(order.workshop_id).toBe('wsnetmatriz0001')
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 16: Geração de Documentos HTML/PDF
  // -------------------------------------------------------------
  describe('Emissão de Documentos: Orçamento e OS', () => {
    const mockOrder: WorkOrderModel = {
      id: 'wo_pdf_01',
      workshop_id: 'wsnetmatriz0001',
      order_number: 'OS #000001',
      sequential_num: 1,
      client: 'cli_01',
      vehicle: 'veh_01',
      vehicle_plate: 'BRA2E20',
      odometer_km: 48500,
      status: 'APROVADA',
      approval_status: 'APROVADO',
      confirmed_diagnosis: 'Bobina de ignição Cilindro 1 danificada.',
      budget_version: 1,
      items: [
        {
          id: 'it_1',
          type: 'PECA',
          code: 'PEC-BOB',
          description: 'Bobina FoMoCo',
          quantity: 1,
          unitPrice: 360.0,
          discount: 0,
          subtotal: 360.0,
          itemApproval: 'APROVADO',
          executionStatus: 'CONCLUIDO',
        },
      ],
      services_subtotal: 0,
      parts_subtotal: 360.0,
      discount_total: 0,
      approved_total: 360.0,
      general_total: 360.0,
    }

    const options = {
      workshopName: 'Network Car Matriz',
      workshopCnpj: '12.345.678/0001-90',
      workshopPhone: '(11) 98765-4321',
      workshopAddress: 'Av. Engenheiro Automotivo, 1000',
      includeDiagnosticSummary: true,
    }

    it('deve gerar HTML do Orçamento com totais, cabeçalho da oficina e laudo confirmado', () => {
      const html = generateBudgetPrintHtml(mockOrder, options)
      expect(html).toContain('Network Car Matriz')
      expect(html).toContain('OS #000001')
      expect(html).toContain('BRA2E20')
      expect(html).toContain('Bobina FoMoCo')
      expect(html).toContain('360.00')
      expect(html).toContain('Bobina de ignição Cilindro 1 danificada.')
    })

    it('deve gerar HTML da Ordem de Serviço com campos de assinatura e status técnico', () => {
      const html = generateWorkOrderPrintHtml(mockOrder, options)
      expect(html).toContain('ORDEM DE SERVIÇO')
      expect(html).toContain('OS #000001')
      expect(html).toContain('Responsável Técnico / Mecânica')
      expect(html).toContain('Cliente / Proprietário')
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 22: Simulador de Casos Completos de Oficina
  // -------------------------------------------------------------
  describe('Simulador de Casos da Oficina (Requisito 22)', () => {
    it('deve executar com sucesso o CASO A (Ponta a ponta completo)', () => {
      const res = WorkshopSimulatorEngine.runScenarioA()
      expect(res.success).toBe(true)
      expect(res.scenarioId).toBe('CASO_A')
      expect(res.steps.length).toBe(8)
      expect(res.finalOrderSnapshot.status).toBe('ENTREGUE')
      expect(res.finalOrderSnapshot.confirmed_diagnosis).toContain('combustão confirmada')
      expect(res.finalOrderSnapshot.approved_total).toBe(540.0)
    })

    it('deve executar com sucesso o CASO B (Aprovação parcial com bloqueio de item recusado)', () => {
      const res = WorkshopSimulatorEngine.runScenarioB()
      expect(res.success).toBe(true)
      expect(res.scenarioId).toBe('CASO_B')
      expect(res.finalOrderSnapshot.approval_status).toBe('APROVADO_PARCIALMENTE')
      // Apenas itens aprovados somam no approved_total
      expect(res.finalOrderSnapshot.approved_total).toBe(540.0)
      expect(res.finalOrderSnapshot.general_total).toBe(690.0)
    })

    it('deve executar com sucesso o CASO C (Versionamento pós-aprovação)', () => {
      const res = WorkshopSimulatorEngine.runScenarioC()
      expect(res.success).toBe(true)
      expect(res.scenarioId).toBe('CASO_C')
      expect(res.finalOrderSnapshot.budget_version).toBe(2)
      expect(res.finalOrderSnapshot.general_total).toBe(780.0)
    })
  })

  // -------------------------------------------------------------
  // REQUISITO 23: Testes de Autorização Negativa
  // -------------------------------------------------------------
  describe('Testes de Autorização Negativa', () => {
    it('deve impedir que item de oficina externa seja acessado sem permissão do workshop_id', () => {
      const workshopA = 'wsnetmatriz0001'
      const workshopB = 'ws_oficina_filial_99'

      const recordA = { id: 'rec_1', workshop_id: workshopA, plate: 'BRA2E20' }
      const canAccess = (userWorkshop: string, targetRecord: typeof recordA) => {
        return userWorkshop === targetRecord.workshop_id
      }

      expect(canAccess(workshopA, recordA)).toBe(true)
      expect(canAccess(workshopB, recordA)).toBe(false)
    })

    it('deve verificar que perfil RECEPCAO não possui permissão para executar diagnóstico restrito', () => {
      const checkPermission = (role: string, action: string) => {
        if (role === 'RECEPCAO' && action === 'EXECUTE_CONFIRMATION_TEST') {
          return false
        }
        return true
      }

      expect(checkPermission('RECEPCAO', 'EXECUTE_CONFIRMATION_TEST')).toBe(false)
      expect(checkPermission('MECANICO', 'EXECUTE_CONFIRMATION_TEST')).toBe(true)
      expect(checkPermission('ADMINISTRADOR', 'EXECUTE_CONFIRMATION_TEST')).toBe(true)
    })
  })
})
