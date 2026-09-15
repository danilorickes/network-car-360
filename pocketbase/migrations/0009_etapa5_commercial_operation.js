migrate(
  (app) => {
    // 1. Atualizar users para conter campos role (ADMINISTRADOR, RECEPCAO, MECANICO) e workshop_id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          values: ['ADMINISTRADOR', 'RECEPCAO', 'MECANICO'],
          maxSelect: 1,
        }),
      )
    }
    if (!usersCol.fields.getByName('workshop_id')) {
      usersCol.fields.add(
        new TextField({
          name: 'workshop_id',
        }),
      )
    }
    app.save(usersCol)

    // Atualiza o usuário Danilo com role ADMINISTRADOR e workshop_id padrão se existir
    try {
      const danilo = app.findAuthRecordByEmail('_pb_users_auth_', 'danilorickes@gmail.com')
      if (danilo) {
        danilo.set('role', 'ADMINISTRADOR')
        danilo.set('workshop_id', 'wsnetmatriz0001')
        app.save(danilo)
      }
    } catch (_) {}

    // 2. Criar coleção workshops (Oficinas / Multitenant)
    const workshops = new Collection({
      name: 'workshops',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'code', type: 'text', required: true },
        { name: 'cnpj', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'address', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_workshops_code ON workshops (code)'],
    })
    app.save(workshops)

    // Seed matriz workshop (PocketBase IDs are 15 lowercase alphanumeric chars [a-z0-9])
    const wsMatriz = new Record(workshops)
    wsMatriz.set('id', 'wsnetmatriz0001')
    wsMatriz.set('name', 'Network Car Matriz — Oficina Modelo')
    wsMatriz.set('code', 'NET-MATRIZ')
    wsMatriz.set('cnpj', '12.345.678/0001-90')
    wsMatriz.set('phone', '(11) 98765-4321')
    wsMatriz.set('address', 'Av. Engenheiro Automotivo, 1000 - São Paulo/SP')
    wsMatriz.set('active', true)
    app.save(wsMatriz)

    // 3. Criar coleção clients (Clientes da Oficina)
    const clients = new Collection({
      name: 'clients',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'workshop_id', type: 'text', required: true },
        { name: 'name', type: 'text', required: true },
        { name: 'document', type: 'text' }, // CPF/CNPJ opcional
        { name: 'phone', type: 'text' },
        { name: 'whatsapp', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'address', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_clients_workshop ON clients (workshop_id)',
        'CREATE INDEX idx_clients_phone ON clients (phone)',
        'CREATE INDEX idx_clients_name ON clients (name)',
      ],
    })
    app.save(clients)

    // 4. Atualizar vehicles para suportar client_id / relation client e workshop_id
    const vehiclesCol = app.findCollectionByNameOrId('vehicles')
    if (!vehiclesCol.fields.getByName('client')) {
      vehiclesCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          maxSelect: 1,
          required: false,
        }),
      )
    }
    if (!vehiclesCol.fields.getByName('workshop_id')) {
      vehiclesCol.fields.add(
        new TextField({
          name: 'workshop_id',
        }),
      )
    }
    app.save(vehiclesCol)

    // 5. Coleção service_catalog (Catálogo de Serviços)
    const serviceCatalog = new Collection({
      name: 'service_catalog',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'workshop_id', type: 'text', required: true },
        { name: 'code', type: 'text' },
        { name: 'description', type: 'text', required: true },
        { name: 'category', type: 'text' },
        { name: 'default_price', type: 'number' },
        { name: 'estimated_minutes', type: 'number' },
        { name: 'notes', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_services_workshop ON service_catalog (workshop_id)'],
    })
    app.save(serviceCatalog)

    // 6. Coleção parts_catalog (Catálogo de Peças / Produtos)
    const partsCatalog = new Collection({
      name: 'parts_catalog',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'workshop_id', type: 'text', required: true },
        { name: 'code', type: 'text', required: true },
        { name: 'description', type: 'text', required: true },
        { name: 'manufacturer', type: 'text' },
        { name: 'reference_code', type: 'text' },
        { name: 'cost_price', type: 'number' },
        { name: 'sale_price', type: 'number' },
        { name: 'unit', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_parts_workshop ON parts_catalog (workshop_id)',
        'CREATE INDEX idx_parts_code ON parts_catalog (code)',
      ],
    })
    app.save(partsCatalog)

    // 7. Coleção vehicle_receptions (Entrada rápida de veículo / Recepção)
    const vehicleReceptions = new Collection({
      name: 'vehicle_receptions',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'workshop_id', type: 'text', required: true },
        { name: 'reception_number', type: 'text', required: true },
        {
          name: 'client',
          type: 'relation',
          collectionId: clients.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'vehicle',
          type: 'relation',
          collectionId: vehiclesCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'vehicle_plate', type: 'text', required: true },
        { name: 'odometer_km', type: 'number', required: true },
        {
          name: 'entry_reason',
          type: 'select',
          values: ['diagnostico', 'manutencao', 'revisao', 'reparo', 'retorno', 'outros'],
          maxSelect: 1,
          required: true,
        },
        { name: 'notes', type: 'text' },
        { name: 'responsible', type: 'text', required: true },
        { name: 'entry_date', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['ABERTO', 'EM_ANDAMENTO', 'ENCERRADO'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_reception_number ON vehicle_receptions (reception_number)',
        'CREATE INDEX idx_reception_workshop ON vehicle_receptions (workshop_id)',
        'CREATE INDEX idx_reception_vehicle ON vehicle_receptions (vehicle)',
      ],
    })
    app.save(vehicleReceptions)

    // 8. Coleção work_orders (Ordem de Serviço Comercial)
    const diagCol = app.findCollectionByNameOrId('diagnostic_investigations')
    const workOrders = new Collection({
      name: 'work_orders',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'workshop_id', type: 'text', required: true },
        { name: 'order_number', type: 'text', required: true }, // ex: "OS #000001"
        { name: 'sequential_num', type: 'number', required: true },
        {
          name: 'client',
          type: 'relation',
          collectionId: clients.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'vehicle',
          type: 'relation',
          collectionId: vehiclesCol.id,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'reception',
          type: 'relation',
          collectionId: vehicleReceptions.id,
          maxSelect: 1,
        },
        {
          name: 'diagnostic_investigation',
          type: 'relation',
          collectionId: diagCol.id,
          maxSelect: 1,
        },
        { name: 'vehicle_plate', type: 'text', required: true },
        { name: 'odometer_km', type: 'number', required: true },
        {
          name: 'status',
          type: 'select',
          values: [
            'RASCUNHO',
            'AGUARDANDO_DIAGNOSTICO',
            'AGUARDANDO_ORCAMENTO',
            'AGUARDANDO_APROVACAO',
            'APROVADA',
            'EM_EXECUCAO',
            'AGUARDANDO_PECA',
            'AGUARDANDO_VALIDACAO',
            'CONCLUIDA',
            'ENTREGUE',
            'CANCELADA',
          ],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'approval_status',
          type: 'select',
          values: ['PENDENTE', 'APROVADO', 'APROVADO_PARCIALMENTE', 'RECUSADO'],
          maxSelect: 1,
          required: true,
        },
        { name: 'confirmed_diagnosis', type: 'text' }, // Apenas informação confirmada da OD-360
        { name: 'budget_version', type: 'number' }, // Versionamento de orçamento (1, 2, ...)
        { name: 'items', type: 'json' }, // Itens do orçamento (serviços e peças com aprovação e execução)
        { name: 'services_subtotal', type: 'number' },
        { name: 'parts_subtotal', type: 'number' },
        { name: 'discount_total', type: 'number' },
        { name: 'approved_total', type: 'number' },
        { name: 'general_total', type: 'number' },
        { name: 'budget_notes', type: 'text' },
        { name: 'budget_validity_days', type: 'number' },
        { name: 'approval_details', type: 'json' }, // data, quem, forma, obs
        { name: 'budget_history', type: 'json' }, // Versões anteriores de orçamentos modificados
        { name: 'post_repair_result', type: 'json' }, // Integração pós-reparo (falha não reproduzida, permanece, inconclusivo)
        { name: 'delivery_details', type: 'json' }, // Data de entrega, responsável, km, notas
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_work_order_num ON work_orders (order_number)',
        'CREATE INDEX idx_work_order_workshop ON work_orders (workshop_id)',
        'CREATE INDEX idx_work_order_vehicle ON work_orders (vehicle)',
        'CREATE INDEX idx_work_order_client ON work_orders (client)',
        'CREATE INDEX idx_work_order_status ON work_orders (status)',
      ],
    })
    app.save(workOrders)

    // 9. Coleção work_order_audits (Auditoria imutável)
    const workOrderAudits = new Collection({
      name: 'work_order_audits',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'workshop_id', type: 'text', required: true },
        {
          name: 'work_order',
          type: 'relation',
          collectionId: workOrders.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'order_number', type: 'text', required: true },
        { name: 'event_type', type: 'text', required: true },
        { name: 'actor_id', type: 'text' },
        { name: 'actor_name', type: 'text', required: true },
        { name: 'actor_role', type: 'text' },
        { name: 'details', type: 'text' },
        { name: 'diff_data', type: 'json' },
        { name: 'timestamp_utc', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wo_audits_order ON work_order_audits (work_order)',
        'CREATE INDEX idx_wo_audits_workshop ON work_order_audits (workshop_id)',
      ],
    })
    app.save(workOrderAudits)
  },
  (app) => {
    try {
      const workOrderAudits = app.findCollectionByNameOrId('work_order_audits')
      app.delete(workOrderAudits)
    } catch (_) {}
    try {
      const workOrders = app.findCollectionByNameOrId('work_orders')
      app.delete(workOrders)
    } catch (_) {}
    try {
      const vehicleReceptions = app.findCollectionByNameOrId('vehicle_receptions')
      app.delete(vehicleReceptions)
    } catch (_) {}
    try {
      const partsCatalog = app.findCollectionByNameOrId('parts_catalog')
      app.delete(partsCatalog)
    } catch (_) {}
    try {
      const serviceCatalog = app.findCollectionByNameOrId('service_catalog')
      app.delete(serviceCatalog)
    } catch (_) {}
    try {
      const clients = app.findCollectionByNameOrId('clients')
      app.delete(clients)
    } catch (_) {}
    try {
      const workshops = app.findCollectionByNameOrId('workshops')
      app.delete(workshops)
    } catch (_) {}
  },
)
