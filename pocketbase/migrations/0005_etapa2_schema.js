migrate(
  (app) => {
    // 1. Coleção vehicles (cadastro reutilizável genérico OBD-II)
    const vehicles = new Collection({
      name: 'vehicles',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'plate', type: 'text', required: true },
        { name: 'make', type: 'text', required: true },
        { name: 'model', type: 'text', required: true },
        { name: 'version', type: 'text' },
        { name: 'year_model', type: 'text' },
        { name: 'engine', type: 'text' },
        { name: 'fuel', type: 'text' },
        { name: 'transmission', type: 'text' },
        { name: 'odometer_km', type: 'number' },
        { name: 'vin', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_vehicles_plate ON vehicles (plate)',
        'CREATE INDEX idx_vehicles_make_model ON vehicles (make, model)',
      ],
    })
    app.save(vehicles)

    // 2. Coleção obd_capabilities (assinatura/capacidade OBD do veículo/adaptador)
    const obdCapabilities = new Collection({
      name: 'obd_capabilities',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'vehicle',
          type: 'relation',
          collectionId: vehicles.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'protocol_detected', type: 'text' },
        { name: 'adapter_type', type: 'text' },
        { name: 'adapter_name', type: 'text' },
        { name: 'pids_supported', type: 'json' },
        { name: 'pids_unavailable', type: 'json' },
        { name: 'vin_supported', type: 'bool' },
        { name: 'vin_read', type: 'text' },
        { name: 'mil_initial_state', type: 'bool' },
        { name: 'dtcs_present', type: 'json' },
        { name: 'raw_discovery_log', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_obd_cap_vehicle ON obd_capabilities (vehicle)'],
    })
    app.save(obdCapabilities)

    // 3. Atualizar sessions para vincular vehicle relation
    const sessionsCol = app.findCollectionByNameOrId('sessions')
    if (!sessionsCol.fields.getByName('vehicle')) {
      sessionsCol.fields.add(
        new RelationField({
          name: 'vehicle',
          collectionId: vehicles.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(sessionsCol)
    }

    // 4. Coleção diagnostic_evidences (Caixa-preta isolada, fatos observados, sem hipóteses)
    // Permite apontar para o evento correspondente e para a sessão
    const eventsCol = app.findCollectionByNameOrId('events')
    const diagnosticEvidences = new Collection({
      name: 'diagnostic_evidences',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null, // append-only: evidências congeladas
      deleteRule: null,
      fields: [
        {
          name: 'event',
          type: 'relation',
          collectionId: eventsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'session',
          type: 'relation',
          collectionId: sessionsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        { name: 'event_id', type: 'text', required: true },
        { name: 'session_id', type: 'text', required: true },
        { name: 'vehicle_info', type: 'json' },
        { name: 'symptom_type', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'timestamp_utc', type: 'date', required: true },
        { name: 'mono_offset_ms', type: 'number', required: true },
        { name: 'window_stats', type: 'json' }, // { min, max, avg, count } por PID
        { name: 'dtcs_context', type: 'json' },
        { name: 'communication_state', type: 'text' },
        { name: 'sample_quality_summary', type: 'json' },
        { name: 'pids_available', type: 'json' },
        { name: 'facts', type: 'json' }, // lista declarativa de fatos observados para futura IA
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_evidence_event_id ON diagnostic_evidences (event_id)',
        'CREATE INDEX idx_evidence_session ON diagnostic_evidences (session)',
      ],
    })
    app.save(diagnosticEvidences)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('diagnostic_evidences'))
    } catch (_) {}
    try {
      const sessions = app.findCollectionByNameOrId('sessions')
      sessions.fields.removeByName('vehicle')
      app.save(sessions)
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('obd_capabilities'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('vehicles'))
    } catch (_) {}
  },
)
