// Hook de validação e isolamento multitenant + integridade de Work Orders
// Executa no PocketBase antes de salvar ordens de serviço
onRecordCreate((e) => {
  const record = e.record
  const status = record.getString('status') || 'RASCUNHO'
  const approval = record.getString('approval_status') || 'PENDENTE'

  // Garante workshop_id
  if (!record.getString('workshop_id')) {
    record.set('workshop_id', 'wsnetmatriz0001')
  }

  // Se for rascunho sem numeração humana, inicializa formato sequencial
  if (!record.getString('order_number')) {
    const totalCount = $app.countRecords('work_orders') + 1
    const seqStr = String(totalCount).padStart(6, '0')
    record.set('order_number', 'OS #' + seqStr)
    record.set('sequential_num', totalCount)
  }

  if (!record.get('budget_version')) {
    record.set('budget_version', 1)
  }

  e.next()
}, 'work_orders')

onRecordUpdate((e) => {
  const record = e.record
  const original = record.original()

  // Regra crítica 11: Não permitir que serviço recusado seja marcado como executado sem nova aprovação registrada
  const items = record.get('items') || []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (it.itemApproval === 'RECUSADO' && it.executionStatus === 'CONCLUIDO') {
      throw new BadRequestError(
        'Regra NC-E5-01: Não é permitido executar item recusado pelo cliente sem nova aprovação registrada.',
      )
    }
  }

  // Regra crítica 19: Alteração de orçamento após aprovação exige nova versão e nova autorização
  const origApproval = original ? original.getString('approval_status') : ''
  if (origApproval === 'APROVADO' || origApproval === 'APROVADO_PARCIALMENTE') {
    const origItems = original.get('items') || []
    const origSubtotalParts = original.getFloat('parts_subtotal')
    const origSubtotalServices = original.getFloat('services_subtotal')
    const newSubtotalParts = record.getFloat('parts_subtotal')
    const newSubtotalServices = record.getFloat('services_subtotal')

    const budgetChanged =
      origSubtotalParts !== newSubtotalParts ||
      origSubtotalServices !== newSubtotalServices ||
      JSON.stringify(origItems) !== JSON.stringify(items)

    // Se mudou valores/itens mas o status de aprovação não foi explicitamente resetado para PENDENTE:
    if (budgetChanged && record.getString('approval_status') === origApproval) {
      // Automaticamente incrementa a versão e invalida a aprovação
      const currentVer = record.getInt('budget_version') || 1
      record.set('budget_version', currentVer + 1)
      record.set('approval_status', 'PENDENTE')

      // Registra histórico de versão
      const history = record.get('budget_history') || []
      history.push({
        version: currentVer,
        invalidatedAt: new Date().toISOString(),
        previousApprovalStatus: origApproval,
        previousSubtotalParts: origSubtotalParts,
        previousSubtotalServices: origSubtotalServices,
        reason: 'Orçamento alterado após aprovação prévia. Nova aprovação necessária.',
      })
      record.set('budget_history', history)
    }
  }

  e.next()
}, 'work_orders')
