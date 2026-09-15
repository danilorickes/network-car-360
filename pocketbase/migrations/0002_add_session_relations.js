migrate(
  (app) => {
    const sessionsCol = app.findCollectionByNameOrId('sessions')

    // Add session relation to raw_samples
    const rawSamples = app.findCollectionByNameOrId('raw_samples')
    if (!rawSamples.fields.getByName('session')) {
      rawSamples.fields.add(
        new RelationField({
          name: 'session',
          required: true,
          collectionId: sessionsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(rawSamples)
    }

    // Add session relation to events
    const events = app.findCollectionByNameOrId('events')
    if (!events.fields.getByName('session')) {
      events.fields.add(
        new RelationField({
          name: 'session',
          required: true,
          collectionId: sessionsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(events)
    }

    // Add session relation to dtcs
    const dtcs = app.findCollectionByNameOrId('dtcs')
    if (!dtcs.fields.getByName('session')) {
      dtcs.fields.add(
        new RelationField({
          name: 'session',
          required: true,
          collectionId: sessionsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(dtcs)
    }
  },
  (app) => {
    try {
      const rawSamples = app.findCollectionByNameOrId('raw_samples')
      rawSamples.fields.removeByName('session')
      app.save(rawSamples)
    } catch (_) {}

    try {
      const events = app.findCollectionByNameOrId('events')
      events.fields.removeByName('session')
      app.save(events)
    } catch (_) {}

    try {
      const dtcs = app.findCollectionByNameOrId('dtcs')
      dtcs.fields.removeByName('session')
      app.save(dtcs)
    } catch (_) {}
  },
)
