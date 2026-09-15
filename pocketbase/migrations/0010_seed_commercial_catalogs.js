migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')
    const vehiclesCol = app.findCollectionByNameOrId('vehicles')
    const serviceCol = app.findCollectionByNameOrId('service_catalog')
    const partsCol = app.findCollectionByNameOrId('parts_catalog')

    // 1. Seed Cliente Padrão: Carlos Silva (PocketBase IDs are lowercase alphanumeric only)
    let clientCarlos
    try {
      clientCarlos = app.findFirstRecordByData('clients', 'phone', '(11) 97123-4567')
    } catch (_) {
      clientCarlos = new Record(clientsCol)
      clientCarlos.set('id', 'clicarlos000001')
      clientCarlos.set('workshop_id', 'wsnetmatriz0001')
      clientCarlos.set('name', 'Carlos Alberto Silva')
      clientCarlos.set('document', '123.456.789-00')
      clientCarlos.set('phone', '(11) 97123-4567')
      clientCarlos.set('whatsapp', '(11) 97123-4567')
      clientCarlos.set('email', 'carlos.silva@exemplo.com.br')
      clientCarlos.set('address', 'Rua das Flores, 123 - São Paulo/SP')
      clientCarlos.set('notes', 'Cliente proprietário da EcoSport BRA2E20')
      clientCarlos.set('active', true)
      app.save(clientCarlos)
    }

    // 2. Vincular o veículo EcoSport (BRA2E20) ao Cliente Carlos Silva
    try {
      const eco = app.findFirstRecordByData('vehicles', 'plate', 'BRA2E20')
      if (eco) {
        eco.set('client', clientCarlos.id)
        eco.set('workshop_id', 'wsnetmatriz0001')
        app.save(eco)
      }
    } catch (_) {}

    // 3. Vincular o veículo T-Cross (NET3600) à oficina
    try {
      const tc = app.findFirstRecordByData('vehicles', 'plate', 'NET3600')
      if (tc) {
        tc.set('workshop_id', 'wsnetmatriz0001')
        app.save(tc)
      }
    } catch (_) {}

    // 4. Seed Catálogo de Serviços
    const defaultServices = [
      {
        code: 'SRV-001',
        description: 'Diagnóstico Eletrônico Avançado 360',
        category: 'Diagnóstico',
        default_price: 250.0,
        estimated_minutes: 60,
        notes: 'Varredura OBD, análise gráfica de telemetria e teste guiado',
      },
      {
        code: 'SRV-002',
        description: 'Substituição de Bobina de Ignição e Teste',
        category: 'Ignição',
        default_price: 180.0,
        estimated_minutes: 45,
        notes: 'Mão de obra para troca de bobina e reteste sob carga',
      },
      {
        code: 'SRV-003',
        description: 'Limpeza e Equalização de Bicos Injetores',
        category: 'Alimentação',
        default_price: 220.0,
        estimated_minutes: 90,
        notes: 'Teste em bancada ultrassônica',
      },
      {
        code: 'SRV-004',
        description: 'Limpeza do Corpo de Borboleta (TBI) e Aprendizado',
        category: 'Alimentação',
        default_price: 150.0,
        estimated_minutes: 40,
        notes: 'Descarbonização e reset de parâmetros adaptativos',
      },
      {
        code: 'SRV-005',
        description: 'Troca de Óleo do Motor e Filtros',
        category: 'Revisão',
        default_price: 120.0,
        estimated_minutes: 30,
        notes: 'Mão de obra preventiva',
      },
    ]

    for (const s of defaultServices) {
      try {
        app.findFirstRecordByData('service_catalog', 'code', s.code)
      } catch (_) {
        const sRec = new Record(serviceCol)
        sRec.set('workshop_id', 'wsnetmatriz0001')
        sRec.set('code', s.code)
        sRec.set('description', s.description)
        sRec.set('category', s.category)
        sRec.set('default_price', s.default_price)
        sRec.set('estimated_minutes', s.estimated_minutes)
        sRec.set('notes', s.notes)
        sRec.set('active', true)
        app.save(sRec)
      }
    }

    // 5. Seed Catálogo de Peças
    const defaultParts = [
      {
        code: 'PEC-BOB-01',
        description: 'Bobina de Ignição Ford Dragon 1.5 3C',
        manufacturer: 'FoMoCo / Bosch',
        reference_code: 'GN1G-12A366-AB',
        cost_price: 210.0,
        sale_price: 360.0,
        unit: 'UN',
        notes: 'Compatível com EcoSport e Ka 1.5 Dragon',
      },
      {
        code: 'PEC-VEL-01',
        description: 'Jogo de Velas de Ignição Iridium (3 un)',
        manufacturer: 'NGK',
        reference_code: 'SILZKR7B11',
        cost_price: 130.0,
        sale_price: 240.0,
        unit: 'JG',
        notes: 'Eletrodo fino 0.7mm alta durabilidade',
      },
      {
        code: 'PEC-OLEO-5W20',
        description: 'Óleo Motor 5W20 Sintético Castrol Magnatec Professional',
        manufacturer: 'Castrol',
        reference_code: 'WSS-M2C948-B',
        cost_price: 42.0,
        sale_price: 78.0,
        unit: 'L',
        notes: 'Homologado Ford Dragon',
      },
      {
        code: 'PEC-FIL-OLEO',
        description: 'Filtro de Óleo Blindado',
        manufacturer: 'Mann Filter',
        reference_code: 'W7015',
        cost_price: 22.0,
        sale_price: 45.0,
        unit: 'UN',
        notes: 'Válvula anti-retorno integrada',
      },
      {
        code: 'PEC-DESCARB',
        description: 'Spray Descarbonizante / Limpa TBI 300ml',
        manufacturer: 'Koube',
        reference_code: 'KB-2000',
        cost_price: 18.0,
        sale_price: 38.0,
        unit: 'UN',
        notes: 'Ação rápida sem agressão a vedações',
      },
    ]

    for (const p of defaultParts) {
      try {
        app.findFirstRecordByData('parts_catalog', 'code', p.code)
      } catch (_) {
        const pRec = new Record(partsCol)
        pRec.set('workshop_id', 'wsnetmatriz0001')
        pRec.set('code', p.code)
        pRec.set('description', p.description)
        pRec.set('manufacturer', p.manufacturer)
        pRec.set('reference_code', p.reference_code)
        pRec.set('cost_price', p.cost_price)
        pRec.set('sale_price', p.sale_price)
        pRec.set('unit', p.unit)
        pRec.set('notes', p.notes)
        pRec.set('active', true)
        app.save(pRec)
      }
    }
  },
  (app) => {
    try {
      app.db().newQuery("DELETE FROM parts_catalog WHERE workshop_id = 'wsnetmatriz0001'").execute()
      app
        .db()
        .newQuery("DELETE FROM service_catalog WHERE workshop_id = 'wsnetmatriz0001'")
        .execute()
      app.db().newQuery("DELETE FROM clients WHERE phone = '(11) 97123-4567'").execute()
    } catch (_) {}
  },
)
