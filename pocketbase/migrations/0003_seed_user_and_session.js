migrate(
  (app) => {
    // 1. Seed user danilorickes@gmail.com / Skip@Pass
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let userRecord
    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'danilorickes@gmail.com')
    } catch (_) {
      userRecord = new Record(users)
      userRecord.setEmail('danilorickes@gmail.com')
      userRecord.setPassword('Skip@Pass')
      userRecord.setVerified(true)
      userRecord.set('name', 'Danilo Rickes')
      app.save(userRecord)
    }

    // 2. Seed an initial exemplary session: Ford EcoSport 2020 1.5 Dragon (idempotent)
    const sessions = app.findCollectionByNameOrId('sessions')
    const rawSamples = app.findCollectionByNameOrId('raw_samples')
    const events = app.findCollectionByNameOrId('events')
    const dtcs = app.findCollectionByNameOrId('dtcs')

    let sessionRecord
    const sampleSessionId = 'sess_ecosport_seed_001'
    try {
      sessionRecord = app.findFirstRecordByData('sessions', 'session_id', sampleSessionId)
      return // Already seeded
    } catch (_) {
      sessionRecord = new Record(sessions)
      sessionRecord.set('session_id', sampleSessionId)
      sessionRecord.set('vehicle_name', 'Ford EcoSport 2020 1.5 Dragon 3C')
      sessionRecord.set('adapter_type', 'SIMULADOR')
      sessionRecord.set('transport_detail', 'Simulador Veicular Temporal')
      sessionRecord.set('vin', '9BFBJ55E6L8104921')
      sessionRecord.set('protocol', 'ISO 15765-4 (CAN 11/500)')
      sessionRecord.set('pids_found', [
        '0x0C',
        '0x0D',
        '0x05',
        '0x04',
        '0x11',
        '0x10',
        '0x0B',
        '0x42',
        '0x06',
        '0x07',
        '0x0E',
        '0x0F',
        '0x1F',
      ])
      const baseDate = new Date(Date.now() - 3600000)
      const endDate = new Date(baseDate.getTime() + 180000) // 3 minutes test
      sessionRecord.set('started_at', baseDate.toISOString().replace('T', ' ').slice(0, 19))
      sessionRecord.set('ended_at', endDate.toISOString().replace('T', ' ').slice(0, 19))
      sessionRecord.set('status', 'ENCERRADO')
      app.save(sessionRecord)
    }

    // 3. Seed ~35 raw samples
    const pidsData = [
      { pid: '0x0C', unit: 'RPM', base: 850, step: 40 },
      { pid: '0x0D', unit: 'km/h', base: 0, step: 2 },
      { pid: '0x05', unit: '°C', base: 88, step: 0.2 },
      { pid: '0x04', unit: '%', base: 22, step: 1.5 },
      { pid: '0x11', unit: '%', base: 14, step: 1 },
      { pid: '0x10', unit: 'g/s', base: 2.4, step: 0.1 },
      { pid: '0x42', unit: 'V', base: 14.1, step: 0.05 },
    ]

    for (let i = 0; i < 35; i++) {
      const pInfo = pidsData[i % pidsData.length]
      const offsetMs = (i + 1) * 200
      const sampleDate = new Date(Date.now() - 3600000 + offsetMs)
      const sRec = new Record(rawSamples)
      sRec.set('session', sessionRecord.id)
      sRec.set('sample_id', 'samp_seed_' + i)
      sRec.set('ts_utc', sampleDate.toISOString().replace('T', ' ').slice(0, 19))
      sRec.set('ts_mono_offset_ms', offsetMs)
      sRec.set('pid', pInfo.pid)
      sRec.set('raw_value', Math.round((pInfo.base + i * pInfo.step) * 10) / 10)
      sRec.set('decoded_value', Math.round((pInfo.base + i * pInfo.step) * 10) / 10)
      sRec.set('unit', pInfo.unit)
      sRec.set('quality', 'OK')
      app.save(sRec)
    }

    // 4. Seed an event (sintoma marcado)
    const evRec = new Record(events)
    evRec.set('session', sessionRecord.id)
    evRec.set('event_id', 'ev_seed_001')
    evRec.set('event_type', 'trepidação')
    evRec.set(
      'description',
      'Trepidação perceptível na transição para 2ª marcha com oscilação na marcha lenta',
    )
    const evDate = new Date(Date.now() - 3600000 + 4000)
    evRec.set('ts_utc', evDate.toISOString().replace('T', ' ').slice(0, 19))
    evRec.set('ts_mono_offset_ms', 4000)
    evRec.set('window_pre_ms', 30000)
    evRec.set('window_post_ms', 30000)
    app.save(evRec)

    // 5. Seed a DTC (P0301 - Cilindro 1 falha de combustão)
    const dtcRec = new Record(dtcs)
    dtcRec.set('session', sessionRecord.id)
    dtcRec.set('dtc_code', 'P0301')
    dtcRec.set('status', 'ATIVO')
    dtcRec.set('mil_on', true)
    dtcRec.set('read_at_utc', evDate.toISOString().replace('T', ' ').slice(0, 19))
    app.save(dtcRec)
  },
  (app) => {
    try {
      const sess = app.findFirstRecordByData('sessions', 'session_id', 'sess_ecosport_seed_001')
      app
        .db()
        .newQuery('DELETE FROM raw_samples WHERE session = {:id}')
        .bind({ id: sess.id })
        .execute()
      app.db().newQuery('DELETE FROM events WHERE session = {:id}').bind({ id: sess.id }).execute()
      app.db().newQuery('DELETE FROM dtcs WHERE session = {:id}').bind({ id: sess.id }).execute()
      app.delete(sess)
    } catch (_) {}
  },
)
