migrate(
  (app) => {
    // 1. Coleção: hardware_homologations
    // Registra adaptadores testados fisicamente e compatibilidade
    // Estados: NAO_TESTADO | EM_TESTE | COMPATIVEL | COMPATIVEL_COM_LIMITACOES | INCOMPATIVEL
    let hardwareCol
    try {
      hardwareCol = app.findCollectionByNameOrId('hardware_homologations')
    } catch (_) {
      hardwareCol = new Collection({
        name: 'hardware_homologations',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'manufacturer', type: 'text', required: true },
          { name: 'model', type: 'text', required: true },
          { name: 'hardware_version', type: 'text' },
          { name: 'firmware_version', type: 'text' },
          {
            name: 'transport',
            type: 'select',
            required: true,
            values: ['BLE', 'BLUETOOTH_CLASSIC', 'USB_SERIAL', 'SIMULADOR'],
            maxSelect: 1,
          },
          { name: 'platform', type: 'text' },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: [
              'NAO_TESTADO',
              'EM_TESTE',
              'COMPATIVEL',
              'COMPATIVEL_COM_LIMITACOES',
              'INCOMPATIVEL',
            ],
            maxSelect: 1,
          },
          { name: 'tested_vehicles', type: 'json' },
          { name: 'supported_pids', type: 'json' },
          { name: 'sample_rate_hz', type: 'number' },
          { name: 'stability_score', type: 'number' },
          { name: 'notes', type: 'text' },
          { name: 'field_test_report', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_hw_mfg_model ON hardware_homologations (manufacturer, model)',
          'CREATE INDEX idx_hw_status ON hardware_homologations (status)',
        ],
      })
      app.save(hardwareCol)
    }

    // 2. Coleção: trip_sessions (Sessões de Viagem)
    let tripCol
    try {
      tripCol = app.findCollectionByNameOrId('trip_sessions')
    } catch (_) {
      const vehiclesColId = app.findCollectionByNameOrId('vehicles').id
      tripCol = new Collection({
        name: 'trip_sessions',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          { name: 'trip_id', type: 'text', required: true },
          {
            name: 'vehicle',
            type: 'relation',
            required: false,
            collectionId: vehiclesColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'vehicle_plate', type: 'text' },
          { name: 'title', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['EM_ANDAMENTO', 'PAUSADA', 'CONCLUIDA', 'CANCELADA'],
            maxSelect: 1,
          },
          { name: 'started_at', type: 'date', required: true },
          { name: 'ended_at', type: 'date' },
          { name: 'duration_seconds', type: 'number' },
          { name: 'distance_km', type: 'number' },
          { name: 'avg_speed_kmh', type: 'number' },
          { name: 'max_speed_kmh', type: 'number' },
          { name: 'estimated_fuel_liters', type: 'number' },
          { name: 'fuel_calculation_mode', type: 'text' },
          { name: 'stop_count', type: 'number' },
          { name: 'total_events_count', type: 'number' },
          { name: 'critical_alerts_count', type: 'number' },
          { name: 'telemetry_summary', type: 'json' },
          { name: 'trip_summary_report', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_trip_id ON trip_sessions (trip_id)',
          'CREATE INDEX idx_trip_status ON trip_sessions (status)',
          'CREATE INDEX idx_trip_started ON trip_sessions (started_at)',
        ],
      })
      app.save(tripCol)
    }

    // 3. Coleção: trip_diary_entries (Diário da Viagem - momentos, paradas e anotações com consentimento de privacidade)
    let diaryCol
    try {
      diaryCol = app.findCollectionByNameOrId('trip_diary_entries')
    } catch (_) {
      const tripColId = app.findCollectionByNameOrId('trip_sessions').id
      diaryCol = new Collection({
        name: 'trip_diary_entries',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'trip',
            type: 'relation',
            required: true,
            collectionId: tripColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'trip_id', type: 'text', required: true },
          {
            name: 'entry_type',
            type: 'select',
            required: true,
            values: ['PARADA', 'PONTO_TURISTICO', 'FOTO', 'COMENTARIO', 'MOMENTO_ESPECIAL'],
            maxSelect: 1,
          },
          { name: 'title', type: 'text', required: true },
          { name: 'notes', type: 'text' },
          { name: 'location_label', type: 'text' },
          { name: 'latitude', type: 'number' },
          { name: 'longitude', type: 'number' },
          { name: 'has_location_consent', type: 'bool' },
          { name: 'odometer_km', type: 'number' },
          { name: 'photo_url', type: 'text' },
          { name: 'timestamp_utc', type: 'date', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_diary_trip ON trip_diary_entries (trip_id)',
          'CREATE INDEX idx_diary_type ON trip_diary_entries (entry_type)',
        ],
      })
      app.save(diaryCol)
    }

    // 4. Coleção: vehicle_baselines (Baselines Estatísticos de Longo Prazo Aprendidos por Veículo)
    let baselineCol
    try {
      baselineCol = app.findCollectionByNameOrId('vehicle_baselines')
    } catch (_) {
      const vehiclesColId = app.findCollectionByNameOrId('vehicles').id
      baselineCol = new Collection({
        name: 'vehicle_baselines',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
        fields: [
          {
            name: 'vehicle',
            type: 'relation',
            required: true,
            collectionId: vehiclesColId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'vehicle_plate', type: 'text', required: true },
          {
            name: 'driving_context',
            type: 'select',
            required: true,
            values: [
              'MOTOR_FRIO',
              'MARCHA_LENTA_FRIA',
              'MARCHA_LENTA_QUENTE',
              'TRANSITO_URBANO',
              'ACELERACAO',
              'VELOCIDADE_ESTABILIZADA',
              'DESACELERACAO',
              'CARGA_ELEVADA',
              'ESTRADA',
              'PARADA_PROLONGADA',
              'DESCONHECIDO',
            ],
            maxSelect: 1,
          },
          { name: 'samples_count', type: 'number', required: true },
          { name: 'stats_by_pid', type: 'json', required: true },
          { name: 'last_updated_utc', type: 'date', required: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_base_veh_ctx ON vehicle_baselines (vehicle_plate, driving_context)',
        ],
      })
      app.save(baselineCol)
    }

    // 5. Agente Skip Cloud Nativo: Nina Copiloto
    // Assistente inteligente embarcado com acesso de consulta às coleções do veículo e viagens
    try {
      $ai.agents.define(app, {
        slug: 'nina-copiloto',
        name: 'Nina Copiloto Inteligente',
        description:
          'Copiloto automotivo do Network Car 360. Explica diagnósticos, acompanha a viagem, sugere brincadeiras e responde dúvidas baseando-se estritamente no contexto real do veículo.',
        systemPrompt:
          'Você é a Nina, copiloto inteligente do Network Car 360. Seu papel é auxiliar o motorista e os passageiros com tom calmo, amigável, direto e seguro. ' +
          'REGRAS CRÍTICAS DE SEGURANÇA E CONFIABILIDADE:\n' +
          '1. Você NUNCA inventa telemetria, sensores ou diagnósticos mecânicos. Se uma informação ou PID não estiver explicitamente presente no contexto fornecido, responda exatamente: "Esse dado não está disponível neste veículo ou nesta conexão OBD."\n' +
          '2. Alertas de segurança do veículo são produzidos DETERMINISTICAMENTE pelo motor de segurança local. Seu papel é APENAS explicar e orientar, nunca substituir o motor determinístico.\n' +
          '3. Se houver um alerta CRÍTICO do veículo (ex: superaquecimento, perda de freio, subtensão crítica), sua prioridade MÁXIMA é avisar imediatamente o motorista com concisão: indique parar o veículo em local seguro.\n' +
          '4. Quando o motorista perguntar "como está o carro?" ou "aconteceu alguma coisa diferente?", consulte estritamente os fatos de telemetria, contexto de condução, baseline e anomalias do momento.\n' +
          '5. Em momentos de lazer ("anima a viagem"), conduza jogos verbais interativos (quiz, curiosidades, perguntas de estrada) com perguntas curtas para que o motorista participe sem desviar o olhar da pista.\n' +
          '6. Seja breve durante condução. Respostas diretas e sem prolixidade.',
        tier: 'fast',
        tools: [
          { collection: 'trip_sessions', perms: { read: true, list: true } },
          { collection: 'trip_diary_entries', perms: { read: true, list: true } },
          { collection: 'hardware_homologations', perms: { read: true, list: true } },
          { collection: 'vehicles', perms: { read: true, list: true } },
          { collection: 'diagnostic_analyses', perms: { read: true, list: true } },
        ],
        memory: [
          {
            type: 'faq',
            payload: {
              qa: [
                {
                  question: 'Quem é você e qual sua função?',
                  answer:
                    'Eu sou a Nina, sua copiloto inteligente no Network Car 360. Monitoro os parâmetros do carro em segundo plano, auxilio durante viagens e explico qualquer comportamento diferente identificado pelo motor de segurança.',
                },
                {
                  question: 'Como funciona o monitoramento sem internet?',
                  answer:
                    'Toda a leitura OBD, detecção de anomalias, Caixa-Preta e alertas de segurança funcionam 100% locais no dispositivo, sem depender de internet ou nuvem.',
                },
                {
                  question: 'Qual o perfil do Ford EcoSport 2020 1.5 Dragon?',
                  answer:
                    'É o primeiro veículo de validação de campo do projeto: motor 3 cilindros 1.5 Ti-VCT Dragon Flex, protocolo ISO 15765-4 CAN 11/500 kbps, com roteiro guiado de homologação de 9 etapas.',
                },
              ],
            },
          },
          {
            type: 'text',
            payload: {
              text: 'Diretriz de prioridade: Alerta Crítico do Veículo > Navegação/Viagem > Nina Copiloto > Entretenimento. Havendo alerta crítico, entretenimento é interrompido imediatamente.',
            },
          },
        ],
      })
    } catch (agentErr) {
      console.log('Aviso ao registrar agente Nina no Skip Cloud:', agentErr)
    }

    // 6. Seed de hardware de homologação inicial (marcado como NÃO TESTADO / EM TESTE, nunca falsamente homologado)
    try {
      const initialHardware = [
        {
          manufacturer: 'Vgate',
          model: 'iCar Pro Bluetooth 4.0 BLE',
          hardware_version: 'v2.2',
          firmware_version: 'ELM327 v2.2',
          transport: 'BLE',
          platform: 'Android / Web Bluetooth',
          status: 'EM_TESTE',
          tested_vehicles: ['Ford EcoSport 2020 1.5 Dragon'],
          supported_pids: ['0x0C', '0x0D', '0x05', '0x04', '0x11', '0x06', '0x07', '0x0B'],
          sample_rate_hz: 9.2,
          stability_score: 95,
          notes: 'Hardware em processo de homologação física com perfil EcoSport 2020.',
          field_test_report: {
            physical_tested: false,
            status_label: 'HARDWARE REAL — AGUARDANDO VALIDAÇÃO',
          },
        },
        {
          manufacturer: 'OBDLink',
          model: 'CX Bimmercode BLE',
          hardware_version: 'v1.0',
          firmware_version: 'STN2120',
          transport: 'BLE',
          platform: 'Android / iOS / Chromium',
          status: 'NAO_TESTADO',
          tested_vehicles: [],
          supported_pids: [],
          sample_rate_hz: 0,
          stability_score: 0,
          notes: 'Aguardando bancada de testes de campo.',
          field_test_report: {
            physical_tested: false,
            status_label: 'HARDWARE REAL — AGUARDANDO VALIDAÇÃO',
          },
        },
        {
          manufacturer: 'ELM Electronics / Genérico',
          model: 'ELM327 USB FTDI / CH340',
          hardware_version: 'v1.5',
          firmware_version: 'v1.5',
          transport: 'USB_SERIAL',
          platform: 'Chromium Desktop / Android OTG',
          status: 'EM_TESTE',
          tested_vehicles: ['Ford EcoSport 2020 1.5 Dragon'],
          supported_pids: ['0x0C', '0x0D', '0x05', '0x04', '0x11', '0x0B'],
          sample_rate_hz: 11.5,
          stability_score: 98,
          notes: 'Conexão física via cabo serial/OTG. Teste de latência em andamento.',
          field_test_report: {
            physical_tested: false,
            status_label: 'HARDWARE REAL — AGUARDANDO VALIDAÇÃO',
          },
        },
      ]

      for (let i = 0; i < initialHardware.length; i++) {
        const item = initialHardware[i]
        try {
          app.findFirstRecordByData('hardware_homologations', 'model', item.model)
        } catch (_) {
          const rec = new Record(hardwareCol)
          rec.set('manufacturer', item.manufacturer)
          rec.set('model', item.model)
          rec.set('hardware_version', item.hardware_version)
          rec.set('firmware_version', item.firmware_version)
          rec.set('transport', item.transport)
          rec.set('platform', item.platform)
          rec.set('status', item.status)
          rec.set('tested_vehicles', item.tested_vehicles)
          rec.set('supported_pids', item.supported_pids)
          rec.set('sample_rate_hz', item.sample_rate_hz)
          rec.set('stability_score', item.stability_score)
          rec.set('notes', item.notes)
          rec.set('field_test_report', item.field_test_report)
          app.save(rec)
        }
      }
    } catch (e) {
      console.log('Aviso ao inicializar sementes de hardware:', e)
    }
  },
  (app) => {
    try {
      $ai.agents.delete(app, 'nina-copiloto')
    } catch (_) {}
    try {
      const b = app.findCollectionByNameOrId('vehicle_baselines')
      app.delete(b)
    } catch (_) {}
    try {
      const d = app.findCollectionByNameOrId('trip_diary_entries')
      app.delete(d)
    } catch (_) {}
    try {
      const t = app.findCollectionByNameOrId('trip_sessions')
      app.delete(t)
    } catch (_) {}
    try {
      const h = app.findCollectionByNameOrId('hardware_homologations')
      app.delete(h)
    } catch (_) {}
  },
)
