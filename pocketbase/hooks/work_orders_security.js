// Hook de isolamento multitenant, integridade e numeração concorrente segura de Work Orders
// Executa no PocketBase antes de criar ou alterar entidades comerciais

// Hook utilitário para validar e forçar workshop_id em coleções comerciais
const COMMERCIAL_COLLECTIONS = [
  'clients',
  'vehicles',
  'service_catalog',
  'parts_catalog',
  'vehicle_receptions',
  'work_order_audits',
]

for (let i = 0; i < COMMERCIAL_COLLECTIONS.length; i++) {
  const colName = COMMERCIAL_COLLECTIONS[i]

  onRecordCreate((e) => {
    const record = e.record
    const authUser = e.auth

    // Se a requisição veio via HTTP com usuário autenticado, força a oficina do usuário
    if (authUser) {
      const userWorkshop = authUser.getString('workshop_id')
      if (!userWorkshop) {
        throw new BadRequestError(
          'Operação negada: usuário autenticado não possui vínculo com nenhuma oficina.',
        )
      }
      // Rejeita tentativa de cliente malicioso enviar workshop_id divergente (NC-E5-SEC-02)
      const requestedWorkshop = record.getString('workshop_id')
      if (requestedWorkshop && requestedWorkshop !== userWorkshop) {
        throw new BadRequestError(
          'Operação negada: proibido criar registros em oficina de terceiros.',
        )
      }
      record.set('workshop_id', userWorkshop)
    } else {
      // Criação interna/seed sem contexto HTTP direto: deve exigir workshop_id explicitado
      if (!record.getString('workshop_id')) {
        throw new BadRequestError('workshop_id é obrigatório.')
      }
    }

    e.next()
  }, colName)

  onRecordUpdate((e) => {
    const record = e.record
    const original = record.original()
    const authUser = e.auth

    // Proíbe alterar o workshop_id de um registro existente
    if (original && original.getString('workshop_id') !== record.getString('workshop_id')) {
      throw new BadRequestError(
        'Operação negada: não é permitido transferir registros entre oficinas.',
      )
    }

    // Se houver usuário autenticado, garante que só pode alterar registros da sua oficina
    if (authUser) {
      const userWorkshop = authUser.getString('workshop_id')
      if (record.getString('workshop_id') !== userWorkshop) {
        throw new BadRequestError('Operação negada: registro não pertence à sua oficina.')
      }
    }

    e.next()
  }, colName)
}

// -------------------------------------------------------------
// WORK ORDERS: Numeração Concorrente Segura + Validação Estrita
// -------------------------------------------------------------

onRecordCreate((e) => {
  const record = e.record
  const authUser = e.auth

  // 1. Obter e validar workshop_id da sessão técnica (NC-E5-SEC-02)
  let workshopId = ''
  if (authUser) {
    workshopId = authUser.getString('workshop_id')
    if (!workshopId) {
      throw new BadRequestError('Operação negada: usuário sem oficina associada.')
    }
    const requestedWorkshop = record.getString('workshop_id')
    if (requestedWorkshop && requestedWorkshop !== workshopId) {
      throw new BadRequestError('Operação negada: tentativa de criar OS para outra oficina.')
    }
    record.set('workshop_id', workshopId)
  } else {
    workshopId = record.getString('workshop_id')
    if (!workshopId) {
      throw new BadRequestError('workshop_id é obrigatório para criação de Ordem de Serviço.')
    }
  }

  // 2. Numeração sequencial segura contra concorrência e exclusões (NC-E5-INT-01)
  // Utiliza workshop_sequences transacional por oficina
  if (!record.getString('order_number') || !record.getInt('sequential_num')) {
    let nextSeq = 1

    $app.runInTransaction((txApp) => {
      let seqRecord = null
      try {
        seqRecord = txApp.findFirstRecordByData('workshop_sequences', 'workshop_id', workshopId)
      } catch (_) {
        // Sequência ainda não existia para esta oficina: inicializa a partir do max(sequential_num)
        const seqCol = txApp.findCollectionByNameOrId('workshop_sequences')
        seqRecord = new Record(seqCol)
        seqRecord.set('workshop_id', workshopId)

        let currentMax = 0
        try {
          const existingOrders = txApp.findRecordsByFilter(
            'work_orders',
            `workshop_id = '${workshopId}'`,
            '-sequential_num',
            1,
            0,
          )
          if (existingOrders.length > 0) {
            currentMax = existingOrders[0].getInt('sequential_num') || 0
          }
        } catch (_) {}

        seqRecord.set('next_os_number', currentMax + 1)
        txApp.save(seqRecord)
      }

      nextSeq = seqRecord.getInt('next_os_number') || 1
      // Incrementa a sequência monotônica para a próxima requisição
      seqRecord.set('next_os_number', nextSeq + 1)
      txApp.save(seqRecord)
    })

    const seqStr = String(nextSeq).padStart(6, '0')
    record.set('order_number', 'OS #' + seqStr)
    record.set('sequential_num', nextSeq)
  }

  if (!record.get('budget_version')) {
    record.set('budget_version', 1)
  }

  e.next()
}, 'work_orders')

onRecordUpdate((e) => {
  const record = e.record
  const original = record.original()
  const authUser = e.auth

  // Não permitir transferir OS entre oficinas
  if (original && original.getString('workshop_id') !== record.getString('workshop_id')) {
    throw new BadRequestError('Operação negada: não é permitido mudar a oficina de uma OS.')
  }

  if (authUser) {
    const userWorkshop = authUser.getString('workshop_id')
    if (record.getString('workshop_id') !== userWorkshop) {
      throw new BadRequestError('Operação negada: OS não pertence à sua oficina.')
    }
  }

  // Não permitir alterar order_number ou sequential_num após criado
  if (
    original &&
    original.getString('order_number') &&
    record.getString('order_number') !== original.getString('order_number')
  ) {
    record.set('order_number', original.getString('order_number'))
  }
  if (
    original &&
    original.getInt('sequential_num') &&
    record.getInt('sequential_num') !== original.getInt('sequential_num')
  ) {
    record.set('sequential_num', original.getInt('sequential_num'))
  }

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
