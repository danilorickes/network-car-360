migrate(
  (app) => {
    // OS-ME001-CLEAN-SIMULATOR: Limpeza controlada de dados de demonstração (SIMULADOR)
    // Preserva integralmente sessões e dados de hardware real ('HARDWARE_REAL').

    const TARGET_SESSION_IDS = [
      '8zrsynaoketd3ik', // sess_1789476397609_pmmx (Simulador Perda de Potência)
      '3cao45qp8695uiy', // sess_1789438957836_6ly0 (Simulador NORMAL)
      '0yu8idlrt98oeox', // sess_1789438465692_jmwv (Simulador NORMAL)
      'm954g1167de0ki9', // sess_ecosport_seed_001 (Simulador Veicular Temporal)
    ]

    const REAL_SESSION_ID = 'dnaab9l8gq5omuf' // sess_1789651428943_g57i (HARDWARE_REAL)

    if (TARGET_SESSION_IDS.indexOf(REAL_SESSION_ID) !== -1) {
      throw new Error(
        'ABORTADO: Sessão de hardware real (' +
          REAL_SESSION_ID +
          ') incluída no array de exclusão!',
      )
    }

    app.runInTransaction((txApp) => {
      // 1. Buscar sessões candidatas via txApp.findRecordsByFilter
      const filterParts = TARGET_SESSION_IDS.map((id) => 'id = "' + id + '"').join(' || ')
      const candidateRecords = txApp.findRecordsByFilter('sessions', filterParts, '', 50, 0)

      console.log(
        '[CLEAN-SIM] Candidatos encontrados na collection sessions:',
        candidateRecords.length,
      )

      if (candidateRecords.length === 0) {
        console.log(
          '[CLEAN-SIM] Nenhuma sessão simuladora para remover. Encerrando de forma idempotente.',
        )
        return
      }

      const validatedIds = []

      for (let i = 0; i < candidateRecords.length; i++) {
        const rec = candidateRecords[i]
        const id = rec.id
        const sessionId = rec.getString('session_id')
        const adapterType = rec.getString('adapter_type')
        const origin = rec.getString('origin')

        console.log(
          '[CLEAN-SIM] Analisando sessão:',
          id,
          '| session_id:',
          sessionId,
          '| adapter_type:',
          adapterType,
          '| origin:',
          origin,
        )

        // Verificação estrita de segurança:
        // origin NUNCA pode ser HARDWARE_REAL
        if (origin === 'HARDWARE_REAL') {
          throw new Error(
            'ABORTADO: Sessão ' + id + ' possui origin=HARDWARE_REAL! Abortando transação.',
          )
        }

        // adapter_type DEVE ser SIMULADOR
        if (adapterType !== 'SIMULADOR') {
          throw new Error(
            'ABORTADO: Sessão ' +
              id +
              ' possui adapter_type=' +
              adapterType +
              ' (esperado SIMULADOR). Abortando transação.',
          )
        }

        // origin deve ser SIMULADOR, vazio ou null
        const originVal = origin ? String(origin).trim() : ''
        if (originVal !== '' && originVal !== 'SIMULADOR') {
          throw new Error(
            'ABORTADO: Sessão ' +
              id +
              ' possui origin inesperado: ' +
              origin +
              '. Abortando transação.',
          )
        }

        validatedIds.push(id)
      }

      if (validatedIds.length === 0) {
        console.log('[CLEAN-SIM] Nenhuma sessão validada para exclusão.')
        return
      }

      // 2. Identificar eventos filhos dessas sessões
      const eventFilterParts = validatedIds.map((id) => 'session = "' + id + '"').join(' || ')
      const eventRecords = txApp.findRecordsByFilter('events', eventFilterParts, '', 100, 0)
      const targetEventIds = eventRecords.map((r) => r.id)
      console.log('[CLEAN-SIM] Eventos filhos encontrados:', targetEventIds.length, targetEventIds)

      // 3. Contar registros das coleções antes da exclusão
      // Montar SQL filters
      const quotedSessionIds = validatedIds.map((id) => "'" + id + "'").join(',')

      let analysesFilter = 'session IN (' + quotedSessionIds + ')'
      let evidencesFilter = 'session IN (' + quotedSessionIds + ')'
      if (targetEventIds.length > 0) {
        const quotedEventIds = targetEventIds.map((id) => "'" + id + "'").join(',')
        analysesFilter += ' OR event IN (' + quotedEventIds + ')'
        evidencesFilter += ' OR event IN (' + quotedEventIds + ')'
      }

      // Contagens via findRecordsByFilter ou query
      const dtcRecords = txApp.findRecordsByFilter('dtcs', eventFilterParts, '', 100, 0)
      const evidenceRecords = txApp.findRecordsByFilter(
        'diagnostic_evidences',
        targetEventIds.length > 0
          ? eventFilterParts +
              ' || ' +
              targetEventIds.map((id) => 'event = "' + id + '"').join(' || ')
          : eventFilterParts,
        '',
        100,
        0,
      )
      const analysisRecords = txApp.findRecordsByFilter(
        'diagnostic_analyses',
        targetEventIds.length > 0
          ? eventFilterParts +
              ' || ' +
              targetEventIds.map((id) => 'event = "' + id + '"').join(' || ')
          : eventFilterParts,
        '',
        100,
        0,
      )

      // Para raw_samples que tem centenas/milhares, usar findRecordsByFilter limit 1 ou SQL count
      // txApp.countRecords aceita filter? Não, aceita collectionName. Mas podemos usar findRecordsByFilter com limit ou execute direto.
      // Vamos buscar o count de raw_samples por sessão via findRecordsByFilter limit: 10000 se necessário ou deletar direto
      console.log('--- CONTAGEM DE REGISTROS A REMOVER ---')
      console.log('[CLEAN-SIM] diagnostic_analyses encontrados:', analysisRecords.length)
      console.log('[CLEAN-SIM] diagnostic_evidences encontrados:', evidenceRecords.length)
      console.log('[CLEAN-SIM] dtcs encontrados:', dtcRecords.length)
      console.log('[CLEAN-SIM] events encontrados:', eventRecords.length)
      console.log('[CLEAN-SIM] sessions a remover:', validatedIds.length, validatedIds)
      console.log('---------------------------------------')

      // 4. Executar exclusão na ordem estrita: filhos antes de pais
      // 4.1 Deletar diagnostic_analyses
      for (let i = 0; i < analysisRecords.length; i++) {
        txApp.delete(analysisRecords[i])
      }
      // Por garantia, qualquer remanescente via SQL seguro
      txApp
        .db()
        .newQuery('DELETE FROM diagnostic_analyses WHERE ' + analysesFilter)
        .execute()
      console.log('[CLEAN-SIM] diagnostic_analyses removidas com sucesso')

      // 4.2 Deletar diagnostic_evidences
      for (let i = 0; i < evidenceRecords.length; i++) {
        txApp.delete(evidenceRecords[i])
      }
      txApp
        .db()
        .newQuery('DELETE FROM diagnostic_evidences WHERE ' + evidencesFilter)
        .execute()
      console.log('[CLEAN-SIM] diagnostic_evidences removidas com sucesso')

      // 4.3 Deletar dtcs
      for (let i = 0; i < dtcRecords.length; i++) {
        txApp.delete(dtcRecords[i])
      }
      txApp
        .db()
        .newQuery('DELETE FROM dtcs WHERE session IN (' + quotedSessionIds + ')')
        .execute()
      console.log('[CLEAN-SIM] dtcs removidos com sucesso')

      // 4.4 Deletar events
      for (let i = 0; i < eventRecords.length; i++) {
        txApp.delete(eventRecords[i])
      }
      txApp
        .db()
        .newQuery('DELETE FROM events WHERE session IN (' + quotedSessionIds + ')')
        .execute()
      console.log('[CLEAN-SIM] events removidos com sucesso')

      // 4.5 Deletar raw_samples
      txApp
        .db()
        .newQuery('DELETE FROM raw_samples WHERE session IN (' + quotedSessionIds + ')')
        .execute()
      console.log('[CLEAN-SIM] raw_samples das sessões simuladas removidas com sucesso')

      // 4.6 Deletar sessions
      for (let i = 0; i < candidateRecords.length; i++) {
        txApp.delete(candidateRecords[i])
      }
      txApp
        .db()
        .newQuery('DELETE FROM sessions WHERE id IN (' + quotedSessionIds + ')')
        .execute()
      console.log('[CLEAN-SIM] sessions simuladas removidas com sucesso')

      // 5. Verificação de integridade pós-deleção
      const realSessionRec = txApp.findFirstRecordByData('sessions', 'id', REAL_SESSION_ID)
      if (!realSessionRec || realSessionRec.id !== REAL_SESSION_ID) {
        throw new Error(
          'FALHA DE INTEGRIDADE: Sessão de hardware real (' + REAL_SESSION_ID + ') foi afetada!',
        )
      }

      // Amostras da sessão real: verificar que existem
      const realSamples = txApp.findRecordsByFilter(
        'raw_samples',
        'session = "' + REAL_SESSION_ID + '"',
        '',
        1,
        0,
      )
      if (realSamples.length === 0) {
        throw new Error('FALHA DE INTEGRIDADE: Nenhuma amostra encontrada para sessão real!')
      }

      console.log(
        '[CLEAN-SIM] Verificação de integridade OK. Sessão real preservada:',
        realSessionRec.id,
      )
    })
  },
  (app) => {
    // Migration de limpeza de dados: down é no-op
  },
)
