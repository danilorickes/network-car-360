migrate(
  (app) => {
    // 0018: Normalização de investigações diagnósticas para aprendizado estruturado futuro
    // Garante as colunas na tabela diagnostic_investigations:
    // - vehicle_profile (json)
    // - structured_case_data (json)
    // - discarded_hypotheses (json)
    // - confirmed_diagnosis_details (json)
    const investigations = app.findCollectionByNameOrId('diagnostic_investigations')

    if (!investigations.fields.getByName('vehicle_profile')) {
      investigations.fields.add(
        new JSONField({
          name: 'vehicle_profile',
          required: false,
        }),
      )
    }

    if (!investigations.fields.getByName('structured_case_data')) {
      investigations.fields.add(
        new JSONField({
          name: 'structured_case_data',
          required: false,
        }),
      )
    }

    if (!investigations.fields.getByName('discarded_hypotheses')) {
      investigations.fields.add(
        new JSONField({
          name: 'discarded_hypotheses',
          required: false,
        }),
      )
    }

    if (!investigations.fields.getByName('confirmed_diagnosis_details')) {
      investigations.fields.add(
        new JSONField({
          name: 'confirmed_diagnosis_details',
          required: false,
        }),
      )
    }

    app.save(investigations)
  },
  (app) => {
    const investigations = app.findCollectionByNameOrId('diagnostic_investigations')
    investigations.fields.removeByName('vehicle_profile')
    investigations.fields.removeByName('structured_case_data')
    investigations.fields.removeByName('discarded_hypotheses')
    investigations.fields.removeByName('confirmed_diagnosis_details')
    app.save(investigations)
  },
)
