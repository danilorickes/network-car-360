migrate(
  (app) => {
    // OS-ME001-E6.5: Custo Inteligente de Viagem
    // Adiciona campos de custo de combustível, pedágios, fonte de consumo e isolamento de oficina a trip_sessions

    let tripCol
    try {
      tripCol = app.findCollectionByNameOrId('trip_sessions')
    } catch (_) {
      return
    }

    // Regras RLS estritas de tenant: se o usuário tiver workshop_id, isola por workshop_id
    const tenantTripRule =
      "@request.auth.id != '' && (@request.auth.workshop_id = '' || workshop_id = '' || workshop_id = @request.auth.workshop_id)"
    tripCol.listRule = tenantTripRule
    tripCol.viewRule = tenantTripRule
    tripCol.createRule = "@request.auth.id != ''"
    tripCol.updateRule = tenantTripRule
    tripCol.deleteRule = tenantTripRule

    if (!tripCol.fields.getByName('workshop_id')) {
      tripCol.fields.add(new TextField({ name: 'workshop_id' }))
    }

    if (!tripCol.fields.getByName('origin')) {
      tripCol.fields.add(new TextField({ name: 'origin' }))
    }

    if (!tripCol.fields.getByName('destination')) {
      tripCol.fields.add(new TextField({ name: 'destination' }))
    }

    if (!tripCol.fields.getByName('fuel_price_per_liter')) {
      tripCol.fields.add(new NumberField({ name: 'fuel_price_per_liter' }))
    }

    if (!tripCol.fields.getByName('fuel_type')) {
      tripCol.fields.add(
        new SelectField({
          name: 'fuel_type',
          values: ['GASOLINA', 'ETANOL', 'DIESEL', 'GNV', 'OUTRO'],
          maxSelect: 1,
        }),
      )
    }

    if (!tripCol.fields.getByName('consumption_source')) {
      tripCol.fields.add(
        new SelectField({
          name: 'consumption_source',
          values: ['AUTOMATICO_OBD', 'MANUAL_INFORMADO', 'ESTIMADO_HISTORICO'],
          maxSelect: 1,
        }),
      )
    }

    if (!tripCol.fields.getByName('avg_consumption_kml')) {
      tripCol.fields.add(new NumberField({ name: 'avg_consumption_kml' }))
    }

    if (!tripCol.fields.getByName('estimated_distance_km')) {
      tripCol.fields.add(new NumberField({ name: 'estimated_distance_km' }))
    }

    if (!tripCol.fields.getByName('estimated_cost_fuel')) {
      tripCol.fields.add(new NumberField({ name: 'estimated_cost_fuel' }))
    }

    if (!tripCol.fields.getByName('estimated_cost_tolls')) {
      tripCol.fields.add(new NumberField({ name: 'estimated_cost_tolls' }))
    }

    if (!tripCol.fields.getByName('estimated_cost_total')) {
      tripCol.fields.add(new NumberField({ name: 'estimated_cost_total' }))
    }

    if (!tripCol.fields.getByName('real_fuel_liters')) {
      tripCol.fields.add(new NumberField({ name: 'real_fuel_liters' }))
    }

    if (!tripCol.fields.getByName('fuel_cost_total')) {
      tripCol.fields.add(new NumberField({ name: 'fuel_cost_total' }))
    }

    if (!tripCol.fields.getByName('tolls_total')) {
      tripCol.fields.add(new NumberField({ name: 'tolls_total' }))
    }

    if (!tripCol.fields.getByName('total_cost')) {
      tripCol.fields.add(new NumberField({ name: 'total_cost' }))
    }

    if (!tripCol.fields.getByName('tolls_breakdown')) {
      tripCol.fields.add(new JSONField({ name: 'tolls_breakdown' }))
    }

    if (!tripCol.fields.getByName('cost_summary_report')) {
      tripCol.fields.add(new JSONField({ name: 'cost_summary_report' }))
    }

    app.save(tripCol)

    // Adiciona índices para consulta histórica eficiente por oficina e veículo
    try {
      tripCol.addIndex('idx_trip_workshop', false, 'workshop_id', '')
      tripCol.addIndex('idx_trip_vehicle_ended', false, 'vehicle_plate, ended_at', '')
      app.save(tripCol)
    } catch (_) {}
  },
  (app) => {
    try {
      const tripCol = app.findCollectionByNameOrId('trip_sessions')
      tripCol.removeIndex('idx_trip_vehicle_ended')
      tripCol.removeIndex('idx_trip_workshop')
      app.save(tripCol)
    } catch (_) {}
  },
)
