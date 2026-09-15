migrate(
  (app) => {
    // 1. sessions collection
    const sessions = new Collection({
      name: 'sessions',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'session_id', type: 'text', required: true },
        { name: 'vehicle_name', type: 'text' },
        {
          name: 'adapter_type',
          type: 'select',
          values: ['SIMULADOR', 'OBD REAL'],
          maxSelect: 1,
          required: true,
        },
        { name: 'transport_detail', type: 'text' },
        { name: 'vin', type: 'text' },
        { name: 'protocol', type: 'text' },
        { name: 'pids_found', type: 'json' },
        { name: 'started_at', type: 'date', required: true },
        { name: 'ended_at', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['ATIVO', 'ENCERRADO', 'INTERROMPIDO'],
          maxSelect: 1,
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_sessions_session_id ON sessions (session_id)',
        'CREATE INDEX idx_sessions_started_at ON sessions (started_at DESC)',
        'CREATE INDEX idx_sessions_status ON sessions (status)',
      ],
    })
    app.save(sessions)

    // 2. raw_samples collection (append-only: no update/delete rules)
    const rawSamples = new Collection({
      name: 'raw_samples',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'sample_id', type: 'text', required: true },
        { name: 'ts_utc', type: 'date', required: true },
        { name: 'ts_mono_offset_ms', type: 'number' },
        { name: 'pid', type: 'text', required: true },
        { name: 'raw_value', type: 'number' },
        { name: 'decoded_value', type: 'number' },
        { name: 'unit', type: 'text' },
        {
          name: 'quality',
          type: 'select',
          values: ['OK', 'TIMEOUT', 'UNSUPPORTED', 'INVALID', 'NO_RESPONSE'],
          maxSelect: 1,
          required: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_raw_samples_id ON raw_samples (sample_id)',
        'CREATE INDEX idx_raw_samples_pid_ts ON raw_samples (pid, ts_utc DESC)',
      ],
    })
    app.save(rawSamples)

    // 3. events collection (append-only: no update/delete rules)
    const events = new Collection({
      name: 'events',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'event_id', type: 'text', required: true },
        {
          name: 'event_type',
          type: 'select',
          values: [
            'falha',
            'trepidação',
            'perda de potência',
            'ruído',
            'oscilação',
            'apagamento',
            'outro/livre',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'description', type: 'text' },
        { name: 'ts_utc', type: 'date', required: true },
        { name: 'ts_mono_offset_ms', type: 'number' },
        { name: 'window_pre_ms', type: 'number' },
        { name: 'window_post_ms', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_events_event_id ON events (event_id)',
        'CREATE INDEX idx_events_ts_utc ON events (ts_utc DESC)',
      ],
    })
    app.save(events)

    // 4. dtcs collection (append-only: no update/delete rules)
    const dtcs = new Collection({
      name: 'dtcs',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'dtc_code', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['ATIVO', 'PENDENTE'],
          maxSelect: 1,
          required: true,
        },
        { name: 'mil_on', type: 'bool' },
        { name: 'read_at_utc', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_dtcs_code ON dtcs (dtc_code)'],
    })
    app.save(dtcs)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('dtcs'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('events'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('raw_samples'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('sessions'))
    } catch (_) {}
  },
)
