migrate(
  (app) => {
    const vehiclesCol = app.findCollectionByNameOrId('vehicles')
    const obdCapCol = app.findCollectionByNameOrId('obd_capabilities')
    const sessionsCol = app.findCollectionByNameOrId('sessions')

    // 1. Seed veículo de validação obrigatório (dados reutilizáveis, genérico):
    // "Ford EcoSport 2020 — 1.5 Dragon — 3 cilindros"
    let ecoSportRecord
    try {
      ecoSportRecord = app.findFirstRecordByData('vehicles', 'plate', 'BRA2E20')
    } catch (_) {
      ecoSportRecord = new Record(vehiclesCol)
      ecoSportRecord.set('plate', 'BRA2E20')
      ecoSportRecord.set('make', 'Ford')
      ecoSportRecord.set('model', 'EcoSport')
      ecoSportRecord.set('version', 'Freestyle 1.5 AT')
      ecoSportRecord.set('year_model', '2020/2020')
      ecoSportRecord.set('engine', '1.5 Ti-VCT Dragon 3C (137 cv)')
      ecoSportRecord.set('fuel', 'Flex')
      ecoSportRecord.set('transmission', 'Automático 6 marchas')
      ecoSportRecord.set('odometer_km', 48500)
      ecoSportRecord.set('vin', '9BFBJ55E6L8104921')
      ecoSportRecord.set(
        'notes',
        'Veículo padrão de validação OS-ME001-E2. Relato de trepidação em baixa rotação e perda momentânea de torque.',
      )
      app.save(ecoSportRecord)
    }

    // 2. Seed segundo veículo genérico para provar reutilização multimarcas
    let vwRecord
    try {
      vwRecord = app.findFirstRecordByData('vehicles', 'plate', 'NET3600')
    } catch (_) {
      vwRecord = new Record(vehiclesCol)
      vwRecord.set('plate', 'NET3600')
      vwRecord.set('make', 'Volkswagen')
      vwRecord.set('model', 'T-Cross')
      vwRecord.set('version', 'Comfortline 200 TSI')
      vwRecord.set('year_model', '2022/2023')
      vwRecord.set('engine', '1.0 TSI Turbo (128 cv)')
      vwRecord.set('fuel', 'Flex')
      vwRecord.set('transmission', 'Automático Tiptronic 6M')
      vwRecord.set('odometer_km', 32000)
      vwRecord.set('vin', '9BWAA42B5NP019842')
      vwRecord.set('notes', 'Veículo de validação de testes comparativos.')
      app.save(vwRecord)
    }

    // 3. Seed assinatura/capacidade OBD para o EcoSport
    try {
      app.findFirstRecordByData('obd_capabilities', 'vehicle', ecoSportRecord.id)
    } catch (_) {
      const cap = new Record(obdCapCol)
      cap.set('vehicle', ecoSportRecord.id)
      cap.set('protocol_detected', 'ISO 15765-4 (CAN 11/500)')
      cap.set('adapter_type', 'SIMULADOR')
      cap.set('adapter_name', 'ELM327 v1.5 Compatible Emulator')
      cap.set('pids_supported', [
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
      cap.set('pids_unavailable', ['0x2F', '0x33', '0x5E'])
      cap.set('vin_supported', true)
      cap.set('vin_read', '9BFBJ55E6L8104921')
      cap.set('mil_initial_state', false)
      cap.set('dtcs_present', [])
      cap.set('raw_discovery_log', {
        mode01_pid00: '41 00 BE 3F B8 11',
        mode01_pid20: '41 20 80 00 00 01',
        mode01_pid40: '41 40 40 00 00 00',
        protocol_response: 'ISO 15765-4 (CAN 11/500)',
      })
      app.save(cap)
    }

    // 4. Vincular sessão seed preexistente ao EcoSport
    try {
      const seedSession = app.findFirstRecordByData(
        'sessions',
        'session_id',
        'sess_ecosport_seed_001',
      )
      if (seedSession && !seedSession.getString('vehicle')) {
        seedSession.set('vehicle', ecoSportRecord.id)
        app.save(seedSession)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const v1 = app.findFirstRecordByData('vehicles', 'plate', 'BRA2E20')
      app
        .db()
        .newQuery('DELETE FROM obd_capabilities WHERE vehicle = {:id}')
        .bind({ id: v1.id })
        .execute()
      app.delete(v1)
    } catch (_) {}
    try {
      const v2 = app.findFirstRecordByData('vehicles', 'plate', 'NET3600')
      app.delete(v2)
    } catch (_) {}
  },
)
