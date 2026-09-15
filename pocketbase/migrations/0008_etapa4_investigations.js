migrate(
  (app) => {
    const vehiclesCol = app.findCollectionByNameOrId('vehicles')
    const sessionsCol = app.findCollectionByNameOrId('sessions')

    // 1. Coleção diagnostic_investigations (Ordem de Diagnóstico 360)
    const investigations = new Collection({
      name: 'diagnostic_investigations',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        { name: 'investigation_number', type: 'text', required: true },
        {
          name: 'vehicle',
          type: 'relation',
          collectionId: vehiclesCol.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'vehicle_plate', type: 'text', required: true },
        { name: 'vehicle_model', type: 'text' },
        { name: 'odometer_km', type: 'number' },
        {
          name: 'status',
          type: 'select',
          values: [
            'ABERTA',
            'EM_INVESTIGACAO',
            'TESTES_PENDENTES',
            'REPARO_PENDENTE',
            'VALIDACAO_POS_REPARO',
            'CONCLUIDA',
            'FECHADA',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'client_complaint', type: 'json' },
        { name: 'mechanic_evaluation', type: 'json' },
        { name: 'initial_session', type: 'relation', collectionId: sessionsCol.id, maxSelect: 1 },
        { name: 'retest_session', type: 'relation', collectionId: sessionsCol.id, maxSelect: 1 },
        { name: 'hypotheses_tree', type: 'json' },
        { name: 'tests_log', type: 'json' },
        { name: 'intervention', type: 'json' },
        { name: 'post_repair_validation', type: 'json' },
        { name: 'timeline', type: 'json' },
        { name: 'final_conclusion', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_diag_investigation_number ON diagnostic_investigations (investigation_number)',
        'CREATE INDEX idx_diag_investigation_vehicle ON diagnostic_investigations (vehicle)',
        'CREATE INDEX idx_diag_investigation_status ON diagnostic_investigations (status)',
      ],
    })
    app.save(investigations)

    // 2. Coleção confirmation_tests (Execução individual de testes de confirmação)
    const confirmationTests = new Collection({
      name: 'confirmation_tests',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'investigation',
          type: 'relation',
          collectionId: investigations.id,
          maxSelect: 1,
          required: true,
        },
        { name: 'test_code', type: 'text', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'target_hypothesis_id', type: 'text', required: true },
        { name: 'target_component', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: [
            'PENDENTE',
            'EM_EXECUCAO',
            'POSITIVO',
            'NEGATIVO',
            'INCONCLUSIVO',
            'NAO_REALIZADO',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'responsible', type: 'text' },
        { name: 'measured_value', type: 'text' },
        { name: 'measured_unit', type: 'text' },
        { name: 'observation', type: 'text' },
        { name: 'attachment_meta', type: 'json' },
        { name: 'executed_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_conf_test_investigation ON confirmation_tests (investigation)',
        'CREATE INDEX idx_conf_test_status ON confirmation_tests (status)',
      ],
    })
    app.save(confirmationTests)
  },
  (app) => {
    try {
      const confirmationTests = app.findCollectionByNameOrId('confirmation_tests')
      app.delete(confirmationTests)
    } catch (_) {}
    try {
      const investigations = app.findCollectionByNameOrId('diagnostic_investigations')
      app.delete(investigations)
    } catch (_) {}
  },
)
