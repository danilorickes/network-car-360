migrate(
  (app) => {
    // OS-ME001-E6.6.1: Persistência Automática de Sessões OBD em Hardware Real
    // Adiciona campos de rastreabilidade na collection 'sessions':
    // origin ('HARDWARE_REAL' | 'SIMULADOR'), device_collector, detected_protocol,
    // supported_pids, app_version, customer_id, workshop_id, etc.

    let sessionsCol
    try {
      sessionsCol = app.findCollectionByNameOrId('sessions')
    } catch (_) {
      return
    }

    // Atualiza select adapter_type para aceitar OBD REAL BLUETOOTH CLASSIC se necessário
    const adapterTypeField = sessionsCol.fields.getByName('adapter_type')
    if (adapterTypeField) {
      adapterTypeField.values = [
        'SIMULADOR',
        'OBD REAL',
        'OBD REAL BLUETOOTH',
        'OBD REAL BLUETOOTH CLASSIC',
      ]
    }

    if (!sessionsCol.fields.getByName('origin')) {
      sessionsCol.fields.add(
        new SelectField({
          name: 'origin',
          values: ['HARDWARE_REAL', 'SIMULADOR'],
          maxSelect: 1,
        }),
      )
    }

    if (!sessionsCol.fields.getByName('device_collector')) {
      sessionsCol.fields.add(new TextField({ name: 'device_collector' }))
    }

    if (!sessionsCol.fields.getByName('detected_protocol')) {
      sessionsCol.fields.add(new TextField({ name: 'detected_protocol' }))
    }

    if (!sessionsCol.fields.getByName('supported_pids')) {
      sessionsCol.fields.add(new JSONField({ name: 'supported_pids' }))
    }

    if (!sessionsCol.fields.getByName('app_version')) {
      sessionsCol.fields.add(new TextField({ name: 'app_version' }))
    }

    if (!sessionsCol.fields.getByName('customer_id')) {
      sessionsCol.fields.add(new TextField({ name: 'customer_id' }))
    }

    if (!sessionsCol.fields.getByName('workshop_id')) {
      sessionsCol.fields.add(new TextField({ name: 'workshop_id' }))
    }

    if (!sessionsCol.fields.getByName('connection_state')) {
      sessionsCol.fields.add(new TextField({ name: 'connection_state' }))
    }

    if (!sessionsCol.fields.getByName('total_samples')) {
      sessionsCol.fields.add(new NumberField({ name: 'total_samples' }))
    }

    if (!sessionsCol.fields.getByName('total_duration_ms')) {
      sessionsCol.fields.add(new NumberField({ name: 'total_duration_ms' }))
    }

    if (!sessionsCol.fields.getByName('anomalies_summary')) {
      sessionsCol.fields.add(new JSONField({ name: 'anomalies_summary' }))
    }

    if (!sessionsCol.fields.getByName('dtcs_summary')) {
      sessionsCol.fields.add(new JSONField({ name: 'dtcs_summary' }))
    }

    app.save(sessionsCol)

    // Ajustes na collection raw_samples se campos faltarem
    let rawCol
    try {
      rawCol = app.findCollectionByNameOrId('raw_samples')
    } catch (_) {
      return
    }

    if (!rawCol.fields.getByName('ecu')) {
      rawCol.fields.add(new TextField({ name: 'ecu' }))
    }

    if (!rawCol.fields.getByName('raw_frame')) {
      rawCol.fields.add(new TextField({ name: 'raw_frame' }))
    }

    if (!rawCol.fields.getByName('status')) {
      rawCol.fields.add(new TextField({ name: 'status' }))
    }

    app.save(rawCol)
  },
  (app) => {
    try {
      const sessionsCol = app.findCollectionByNameOrId('sessions')
      const fieldsToRemove = [
        'origin',
        'device_collector',
        'detected_protocol',
        'supported_pids',
        'app_version',
        'customer_id',
        'workshop_id',
        'connection_state',
        'total_samples',
        'total_duration_ms',
        'anomalies_summary',
        'dtcs_summary',
      ]
      for (const f of fieldsToRemove) {
        sessionsCol.fields.removeByName(f)
      }
      app.save(sessionsCol)

      const rawCol = app.findCollectionByNameOrId('raw_samples')
      rawCol.fields.removeByName('ecu')
      rawCol.fields.removeByName('raw_frame')
      rawCol.fields.removeByName('status')
      app.save(rawCol)
    } catch (_) {}
  },
)
