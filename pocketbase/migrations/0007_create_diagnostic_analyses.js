migrate(
  (app) => {
    // Criação da coleção diagnostic_analyses para persistência do Diagnóstico 360 gerado
    if (!app.hasTable('diagnostic_analyses')) {
      const col = new Collection({
        name: 'diagnostic_analyses',
        type: 'base',
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
        fields: [
          {
            name: 'session',
            type: 'relation',
            required: false,
            collectionId: app.findCollectionByNameOrId('sessions').id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'event',
            type: 'relation',
            required: false,
            collectionId: app.findCollectionByNameOrId('events').id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'session_id', type: 'text', required: true },
          { name: 'event_id', type: 'text', required: true },
          { name: 'symptom_type', type: 'text', required: false },
          {
            name: 'safety_level',
            type: 'select',
            values: ['INFORMATIVO', 'ATENCAO', 'CRITICO'],
            maxSelect: 1,
          },
          { name: 'hypotheses_count', type: 'number', required: false },
          { name: 'top_hypothesis_title', type: 'text', required: false },
          { name: 'top_hypothesis_confidence', type: 'number', required: false },
          { name: 'report_json', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_diag_analyses_session ON diagnostic_analyses (session_id)',
          'CREATE INDEX idx_diag_analyses_event ON diagnostic_analyses (event_id)',
        ],
      })
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('diagnostic_analyses')
      app.delete(col)
    } catch (_) {}
  },
)
