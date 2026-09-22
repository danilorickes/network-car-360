migrate(
  (app) => {
    // 0017: Criação da coleção vehicle_profiles
    try {
      app.findCollectionByNameOrId('vehicle_profiles')
      return // Já existe no banco
    } catch (_) {}

    const vehicles = app.findCollectionByNameOrId('vehicles')

    const collection = new Collection({
      name: 'vehicle_profiles',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          name: 'vehicle',
          type: 'relation',
          required: true,
          collectionId: vehicles.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['RASCUNHO', 'CONFIRMADO', 'DIVERGENTE'],
          maxSelect: 1,
        },
        { name: 'make', type: 'json' },
        { name: 'model', type: 'json' },
        { name: 'version', type: 'json' },
        { name: 'year_model', type: 'json' },
        { name: 'vin', type: 'json' },
        { name: 'fuel', type: 'json' },
        { name: 'engine', type: 'json' },
        { name: 'engine_code', type: 'json' },
        { name: 'displacement', type: 'json' },
        { name: 'cylinders', type: 'json' },
        { name: 'aspiration', type: 'json' },
        { name: 'power', type: 'json' },
        { name: 'transmission', type: 'json' },
        { name: 'injection_architecture', type: 'json' },
        { name: 'obd_protocol', type: 'json' },
        { name: 'supported_pids', type: 'json' },
        { name: 'expected_sensors', type: 'json' },
        { name: 'known_particularities', type: 'json' },
        { name: 'conflicts', type: 'json' },
        { name: 'confirmed_by', type: 'text' },
        { name: 'confirmed_at', type: 'date' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_vprof_vehicle ON vehicle_profiles (vehicle)',
        'CREATE INDEX idx_vprof_status ON vehicle_profiles (status)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('vehicle_profiles')
      app.delete(collection)
    } catch (_) {}
  },
)
