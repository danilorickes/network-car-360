// Endpoint do Copiloto Nina no PocketBase pb_hooks
// Conecta com o agente nativo 'nina-copiloto' via $ai.agent("nina-copiloto").chat(...)
// e responde estruturado com segurança determinística e validação de contexto

routerAdd(
  'POST',
  '/backend/v1/nina/chat',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const authUser = e.auth
      const userId = authUser ? authUser.id : null

      if (!userId) {
        return e.json(401, { error: 'Autenticação necessária para consultar a Copiloto Nina' })
      }

      const message = body.message || ''
      if (!message.trim()) {
        return e.json(400, { error: 'Mensagem vazia' })
      }

      // Contexto estruturado recebido do cliente (telemetria resumida, viagem, alertas locais)
      const copilotContext = body.context || {}
      const contextSummary =
        `[CONTEXTO ATUAL DO VEÍCULO]\n` +
        `Veículo: ${copilotContext.vehicleName || 'Desconhecido'} (${copilotContext.vehiclePlate || 'S/P'})\n` +
        `Conexão: ${copilotContext.connectionStatus || 'DESCONECTADO'} | Transporte: ${copilotContext.transportType || 'N/D'}\n` +
        `Contexto Condução: ${copilotContext.drivingContext || 'DESCONHECIDO'}\n` +
        `Velocidade: ${copilotContext.speedKmh !== undefined ? copilotContext.speedKmh + ' km/h' : 'Indisponível'}\n` +
        `RPM: ${copilotContext.rpm !== undefined ? copilotContext.rpm + ' RPM' : 'Indisponível'}\n` +
        `Temperatura Arrefecimento: ${copilotContext.coolantTemp !== undefined ? copilotContext.coolantTemp + ' °C' : 'Indisponível'}\n` +
        `Tensão Módulo: ${copilotContext.batteryVoltage !== undefined ? copilotContext.batteryVoltage + ' V' : 'Indisponível'}\n` +
        `STFT: ${copilotContext.stft !== undefined ? copilotContext.stft + '%' : 'Indisponível'} | LTFT: ${copilotContext.ltft !== undefined ? copilotContext.ltft + '%' : 'Indisponível'}\n` +
        `DTCs Ativos: ${Array.isArray(copilotContext.activeDtcs) && copilotContext.activeDtcs.length > 0 ? copilotContext.activeDtcs.join(', ') : 'Nenhum'}\n` +
        `MIL (Injeção): ${copilotContext.milOn ? 'ACESO (ALERTA)' : 'Apagado'}\n` +
        `Nível de Segurança Local (determinístico): ${copilotContext.safetyLevel || 'NORMAL'}\n` +
        `Alertas Ativos: ${Array.isArray(copilotContext.activeAlerts) && copilotContext.activeAlerts.length > 0 ? copilotContext.activeAlerts.join('; ') : 'Nenhum'}\n` +
        `Viagem Ativa: ${copilotContext.isTripActive ? 'Sim - ' + (copilotContext.tripTitle || '') + ' (' + (copilotContext.tripDuration || '') + ', ' + (copilotContext.tripDistance || '') + ')' : 'Não'}\n`

      const promptWithContext = `${contextSummary}\nPergunta/Comando do condutor ou passageiro: "${message}"`

      let agentResult = null
      try {
        agentResult = $ai.agent('nina-copiloto').chat({
          user_id: userId,
          conversation_id: body.conversation_id || null,
          message: promptWithContext,
        })
      } catch (agentErr) {
        // Fallback robusto se a API de AI estiver temporariamente sem quota ou offline
        const simulatedReply =
          'Entendido. Estou acompanhando os parâmetros locais em tempo real. ' +
          (copilotContext.safetyLevel === 'CRITICO'
            ? 'ATENÇÃO: Há um alerta crítico de segurança no veículo. Recomendo verificar com prioridade máxima.'
            : copilotContext.safetyLevel === 'ATENCAO'
              ? 'O motor de segurança identificou um ponto de atenção nos sensores, mas o carro segue em monitoramento.'
              : 'O funcionamento dos sensores disponíveis está dentro dos padrões normais de condução.')

        return e.json(200, {
          conversation_id: body.conversation_id || 'conv_local_fallback',
          content: simulatedReply,
          citations: [],
          fallback_mode: true,
        })
      }

      return e.json(200, {
        conversation_id: agentResult.conversation_id,
        content: agentResult.content,
        citations: agentResult.citations || [],
        message_id: agentResult.message_id,
        fallback_mode: false,
      })
    } catch (err) {
      return e.json(500, { error: 'Falha no processamento da Copiloto Nina: ' + err.message })
    }
  },
  $apis.requireAuth(),
)
