migrate(
  (app) => {
    // 1. Criar coleção workshop_sequences para numeração atômica e segura por oficina
    let workshopSequences
    try {
      workshopSequences = app.findCollectionByNameOrId('workshop_sequences')
    } catch (_) {
      workshopSequences = new Collection({
        name: 'workshop_sequences',
        type: 'base',
        listRule: "@request.auth.id != '' && workshop_id = @request.auth.workshop_id",
        viewRule: "@request.auth.id != '' && workshop_id = @request.auth.workshop_id",
        createRule: null, // Apenas via hook/transação interna
        updateRule: null, // Apenas via hook/transação interna
        deleteRule: null, // Apenas via hook/transação interna
        fields: [
          { name: 'workshop_id', type: 'text', required: true },
          { name: 'next_os_number', type: 'number', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_ws_seq_workshop ON workshop_sequences (workshop_id)'],
      })
      app.save(workshopSequences)
    }

    // Inicializar sequência para oficinas existentes (ex.: wsnetmatriz0001)
    // Preserva numeração atual das OS existentes
    try {
      let maxSeq = 0
      try {
        const osRecords = app.findRecordsByFilter(
          'work_orders',
          "workshop_id = 'wsnetmatriz0001'",
          '-sequential_num',
          1,
          0,
        )
        if (osRecords.length > 0) {
          maxSeq = osRecords[0].getInt('sequential_num') || 0
        }
      } catch (_) {}

      try {
        app.findFirstRecordByData('workshop_sequences', 'workshop_id', 'wsnetmatriz0001')
      } catch (_) {
        const seqRec = new Record(workshopSequences)
        seqRec.set('workshop_id', 'wsnetmatriz0001')
        seqRec.set('next_os_number', maxSeq + 1)
        app.save(seqRec)
      }
    } catch (_) {}

    // 2. Aplicar regras RLS estritas nas coleções comerciais e operacionais

    // Helper para atualizar regras
    const updateRules = (colName, list, view, create, update, del) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule = list
        col.viewRule = view
        col.createRule = create
        col.updateRule = update
        col.deleteRule = del
        app.save(col)
      } catch (err) {
        console.log(`Erro ao atualizar regras da coleção ${colName}:`, err)
      }
    }

    const tenantRule =
      "@request.auth.id != '' && @request.auth.workshop_id != '' && workshop_id = @request.auth.workshop_id"
    const tenantCreateRule = "@request.auth.id != '' && @request.auth.workshop_id != ''"

    // CLIENTS
    updateRules('clients', tenantRule, tenantRule, tenantCreateRule, tenantRule, tenantRule)

    // VEHICLES (veículos têm workshop_id na base)
    updateRules('vehicles', tenantRule, tenantRule, tenantCreateRule, tenantRule, tenantRule)

    // SERVICE CATALOG
    updateRules('service_catalog', tenantRule, tenantRule, tenantCreateRule, tenantRule, tenantRule)

    // PARTS CATALOG
    updateRules('parts_catalog', tenantRule, tenantRule, tenantCreateRule, tenantRule, tenantRule)

    // VEHICLE RECEPTIONS
    updateRules(
      'vehicle_receptions',
      tenantRule,
      tenantRule,
      tenantCreateRule,
      tenantRule,
      tenantRule,
    )

    // WORK ORDERS
    updateRules('work_orders', tenantRule, tenantRule, tenantCreateRule, tenantRule, tenantRule)

    // WORK ORDER AUDITS — Auditoria realmente imutável (NC-E5-AUD-01)
    // Leitura restrita à oficina; criação permitida por usuários autenticados da oficina;
    // Alteração e Exclusão estritamente negadas (null) para usuários comuns (somente superadmin do PB)
    updateRules(
      'work_order_audits',
      tenantRule,
      tenantRule,
      tenantCreateRule,
      null, // updateRule = null (imutável)
      null, // deleteRule = null (imutável)
    )

    // WORKSHOPS (Permitir listar e visualizar apenas a própria oficina)
    updateRules(
      'workshops',
      "@request.auth.id != '' && id = @request.auth.workshop_id",
      "@request.auth.id != '' && id = @request.auth.workshop_id",
      null, // Usuários não criam workshops
      "@request.auth.id != '' && id = @request.auth.workshop_id && @request.auth.role = 'ADMINISTRADOR'",
      null,
    )
  },
  (app) => {
    // Reverter regras para público autenticado/livre em rollback
    const revertRules = (colName) => {
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule = ''
        col.viewRule = ''
        col.createRule = ''
        col.updateRule = ''
        col.deleteRule = ''
        app.save(col)
      } catch (_) {}
    }

    revertRules('clients')
    revertRules('vehicles')
    revertRules('service_catalog')
    revertRules('parts_catalog')
    revertRules('vehicle_receptions')
    revertRules('work_orders')
    revertRules('work_order_audits')
    revertRules('workshops')

    try {
      const workshopSequences = app.findCollectionByNameOrId('workshop_sequences')
      app.delete(workshopSequences)
    } catch (_) {}
  },
)
