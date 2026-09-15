migrate(
  (app) => {
    const sessions = app.findCollectionByNameOrId('sessions')
    const adapterField = sessions.fields.getByName('adapter_type')
    if (adapterField) {
      adapterField.values = ['SIMULADOR', 'OBD REAL', 'OBD REAL BLUETOOTH']
      adapterField.maxSelect = 1
      app.save(sessions)
    }
  },
  (app) => {
    const sessions = app.findCollectionByNameOrId('sessions')
    const adapterField = sessions.fields.getByName('adapter_type')
    if (adapterField) {
      adapterField.values = ['SIMULADOR', 'OBD REAL']
      adapterField.maxSelect = 1
      app.save(sessions)
    }
  },
)
