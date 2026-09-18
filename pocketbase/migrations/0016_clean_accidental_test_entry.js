migrate(
  (app) => {
    // OS-ME001-CLEAN-ACCIDENTAL-TEST: Limpeza de entrada manual acidental no tests_log
    // Investigação: 2qwnn2olf4lo6s0 (OD-2026-2Q8D, Ford Ecosport DRE0E59)
    // ID da entrada a remover: test_1789655185234
    const TARGET_INV_ID = '2qwnn2olf4lo6s0'
    const TARGET_TEST_ID = 'test_1789655185234'

    app.runInTransaction((txApp) => {
      let invRecord
      try {
        invRecord = txApp.findFirstRecordByData('diagnostic_investigations', 'id', TARGET_INV_ID)
      } catch (e) {
        console.log('[CLEAN-TEST] Investigação não encontrada pelo id:', TARGET_INV_ID)
        return
      }

      if (!invRecord) {
        console.log('[CLEAN-TEST] Registro inexistente.')
        return
      }

      // 1. Processar tests_log
      const rawTestsLog = invRecord.get('tests_log')
      let testsList = []
      if (Array.isArray(rawTestsLog)) {
        testsList = rawTestsLog
      } else if (rawTestsLog) {
        try {
          testsList = typeof rawTestsLog === 'string' ? JSON.parse(rawTestsLog) : rawTestsLog
        } catch (_) {
          testsList = []
        }
      }

      console.log('[CLEAN-TEST] Quantidade de testes antes:', testsList.length)
      const filteredTests = testsList.filter((t) => t && t.id !== TARGET_TEST_ID)
      console.log('[CLEAN-TEST] Quantidade de testes após remoção:', filteredTests.length)
      invRecord.set('tests_log', filteredTests)

      // 2. Verificar se hypotheses_tree precisa de ajuste se derivar da entrada manual
      // A telemetria real dessa investigação constatou conformidade (NENHUMA_FALHA_DETECTADA).
      const rawTree = invRecord.get('hypotheses_tree')
      let treeList = []
      if (Array.isArray(rawTree)) {
        treeList = rawTree
      } else if (rawTree) {
        try {
          treeList = typeof rawTree === 'string' ? JSON.parse(rawTree) : rawTree
        } catch (_) {
          treeList = []
        }
      }

      // Se qualquer nó estiver associado exclusivamente a test_1789655185234 ou se houver hipótese de bobina
      let treeModified = false
      for (let i = 0; i < treeList.length; i++) {
        const node = treeList[i]
        if (!node) continue

        // Remove o teste dos testsAssociated
        if (Array.isArray(node.testsAssociated)) {
          const prevLen = node.testsAssociated.length
          node.testsAssociated = node.testsAssociated.filter((t) => t && t.id !== TARGET_TEST_ID)
          if (node.testsAssociated.length !== prevLen) {
            treeModified = true
          }
        }

        // Se a hipótese for NENHUMA_FALHA_DETECTADA, restaurar confiança original de telemetria se foi alterada pelo teste
        if (
          node.hypothesis &&
          node.hypothesis.affectedSystem === 'NENHUMA_FALHA_DETECTADA' &&
          node.status !== 'CONFIRMADA'
        ) {
          node.currentConfidence = node.initialConfidence || 95
          node.confidenceDelta = 0
          if (Array.isArray(node.recalculationAuditLog)) {
            node.recalculationAuditLog = node.recalculationAuditLog.filter(
              (log) =>
                typeof log === 'string' && !log.includes(TARGET_TEST_ID) && !log.includes('P0302'),
            )
          }
          treeModified = true
        }
      }

      if (treeModified) {
        invRecord.set('hypotheses_tree', treeList)
      }

      // 3. Atualizar status da investigação se estava em TESTES_PENDENTES apenas pelo teste manual
      if (filteredTests.length === 0) {
        invRecord.set('status', 'EM_INVESTIGACAO')
      }

      // 4. Salvar registro com segurança
      txApp.save(invRecord)
      console.log(
        '[CLEAN-TEST] Investigação',
        TARGET_INV_ID,
        'atualizada com sucesso sem o teste acidental.',
      )
    })
  },
  (app) => {
    // Migration de limpeza descartável: down é no-op
  },
)
