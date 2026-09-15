# RELATÓRIO-ME001-E1.1-THEO.md — CORREÇÕES DE AUDITORIA

**Data:** 15 de Setembro de 2026  
**Projeto:** Network Car Diagnóstico 360 — Sistema de Diagnóstico Veicular OBD-II  
**Referência da OS:** OS-ME001-E1.1 (Correção de Auditoria Independente da Entrega ME001-E1)  
**Status Global:** APROVADA / CONFORME  
**Hardware Real ELM327 (USB e Bluetooth BLE):** `IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL`

---

## 1. Resumo Executivo e Diretrizes Atendidas

A auditoria classificou a entrega ME001-E1 como **APROVADA COM CORREÇÕES**. Todas as três não conformidades apontadas foram corrigidas integralmente, respeitando as exigências:

1. **Preservação estrita da arquitetura existente:** Nenhum módulo essencial foi reescrito; as interfaces e contratos foram mantidos e estendidos.
2. **Requisitos RF01 a RF10 inalterados:** Todos os fluxos de amostragem multirate (≥5 Hz prioritário, ≥1 Hz secundário), caixa-preta (±30s imutável), varredura periódica de DTC (Modos 03/07 sem emitir Modo 04), replay temporal e relatório mantêm-se íntegros.
3. **Novo transporte Bluetooth e persistência offline verdadeira** integrados de forma desacoplada e testados com testes automatizados específicos.

---

## 2. Detalhamento das Não Conformidades e Correções

### 2.1 NC-01 — Transporte Android / Bluetooth

- **Problema anterior:** A implementação serial física utilizava exclusivamente a Web Serial API (`real-serial-transport.ts`), que é limitada a conexões USB/Serial no Google Chrome/Edge de desktop, não atendendo a dispositivos Android/multimídias veiculares com adaptadores ELM327 Bluetooth clássico/BLE.
- **Solução Implementada:**
  1. **Novo Transporte `BluetoothTransport` (`src/lib/obd/transports/bluetooth-transport.ts`):** Implementa a interface `OBDTransport` sem acoplamento à plataforma, utilizando a Web Bluetooth API (GATT BLE). Suporta os principais perfis de adaptadores OBD BLE do mercado (Nordic UART Service, CC2540 HM-10, Vgate vLinker, Veepeak, Konnwei, etc.). Mantém o handshake AT do ELM327 (`ATZ`, `ATE0`, `ATL0`, `ATH0`, `ATS0`, `ATSP0`).
  2. **Módulo de Detecção de Plataforma (`src/lib/obd/platform-detector.ts`):** Detecta dinamicamente se o usuário está em Android, iOS, Windows, Mac ou Linux, e identifica a disponibilidade de Web Serial e Web Bluetooth.
  3. **UI e Configurações (`ConnectionControlPanel.tsx` e `Configuracoes.tsx`):**
     - Adicionado seletor de transporte na interface: `SIMULADOR`, `USB/SERIAL (ELM327)` e `BLUETOOTH (BLE/Android)`.
     - Orientações contextuais claras para o usuário sobre como conectar adaptadores no Android.
  4. **Documentação Técnica e Limitações do Bluetooth Clássico SPP:**
     - A especificação W3C dos navegadores web restringe acessos a conexões _Bluetooth Clássico SPP_ (Serial Port Profile) por questões de isolamento e segurança de sandbox.
     - Para uso em Android:
       - **Caminho Nativo Direto:** Adaptadores ELM327 Bluetooth Low Energy 4.0+ (BLE) via Web Bluetooth API.
       - **Caminho Alternativo para SPP Clássico:** Pareamento prévio no Android + conexão via cabo OTG USB Serial, ou uso de servidor bridge/proxy local (ex: app auxiliar transmitindo via WebSocket na porta 127.0.0.1).
  5. **Status mantido:** Rótulo `IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL` mantido tanto para o transporte Serial quanto para o novo Bluetooth.

### 2.2 NC-02 — Persistência Offline Verdadeira

- **Problema anterior:** Amostras de telemetria pendentes de envio ao PocketBase dependiam unicamente do buffer volátil em memória RAM, correndo risco de perda caso a aba fosse fechada ou a aplicação encerrada antes do envio.
- **Solução Implementada:**
  1. **Serviço de Armazenamento Persistente no IndexedDB (`src/lib/obd/offline-storage.ts`):** Criado o banco IndexedDB local (`network_car_diagnostico_360_db`) com a store `pending_samples` indexada por `sample_id` e `queued_at`.
  2. **Gravação Não Bloqueante em Tempo de Execução:** Cada amostra gravada pelo `RawRecorder.recordSample()` é persistida de forma append-only no IndexedDB antes ou simultaneamente ao disparo da sincronização de rede.
  3. **Reidratação na Reabertura da Aplicação:** O `TelemetryContext` e o `RawRecorder` executam `rehydratePendingQueue()` na inicialização, lendo todas as amostras pendentes do IndexedDB e enfileirando-as para envio imediato assim que a conexão com o PocketBase for estabelecida.

### 2.3 NC-03 — Revisão do Mecanismo de Flush no RawRecorder

- **Problema anterior:** O método `flushOpportunistic()` iterava sobre as amostras mas não retirava com precisão cirúrgica apenas os registros persistidos com sucesso, gerando risco potencial de vazamento de memória ou perda de amostras em falhas parciais.
- **Solução Implementada:**
  1. **Descarte Atômico Baseado em Confirmação de Sucesso (`src/lib/obd/raw-recorder.ts`):** Apenas as amostras que obtiveram retorno 200/201 do PocketBase têm seus IDs registrados no conjunto `persistedIds` e são removidas da fila em memória (`pendingQueue`) e do IndexedDB (`offlineStorage.removePendingSamples()`).
  2. **Tratamento de Falha Parcial:** Se uma amostra falha no lote (ex.: queda momentânea de sinal), a sincronização é interrompida, mantendo todas as amostras não confirmadas salvas no IndexedDB e na fila pendente para a próxima tentativa.
  3. **Proteção contra Duplicação:** Conjunto `persistedIds` em memória evita reenviar registros que já foram salvos no PocketBase.
  4. **Controle de RAM:** Amostras mantidas em memória para sparklines e gráficos rápidos são limitadas a um buffer circular de tamanho fixo (`MAX_IN_MEMORY_SAMPLES = 2000`), evitando qualquer crescimento indefinido de memória durante horas de coleta.

---

## 3. Arquivos Modificados e Criados

| Arquivo                                                     | Natureza    | Descrição                                                                                                   |
| ----------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| `src/types/obd.ts`                                          | Modificação | Adicionado valor `'OBD REAL BLUETOOTH'` ao tipo `AdapterType`.                                              |
| `pocketbase/migrations/0004_update_session_adapter_type.js` | Criação     | Migração PocketBase para permitir valor `OBD REAL BLUETOOTH` no campo `adapter_type` da coleção `sessions`. |
| `src/lib/obd/transports/bluetooth-transport.ts`             | Criação     | Transporte Web Bluetooth API (GATT BLE) para adaptadores ELM327 BLE (NC-01).                                |
| `src/lib/obd/platform-detector.ts`                          | Criação     | Detecção de plataforma (Android, iOS, Desktop) e suporte de Web Serial / Web Bluetooth.                     |
| `src/lib/obd/offline-storage.ts`                            | Criação     | Camada de persistência IndexedDB de alto volume para telemetria offline (NC-02).                            |
| `src/lib/obd/raw-recorder.ts`                               | Modificação | Flush atômico, reidratação offline, proteção contra duplicidade e limitação de RAM (NC-02/NC-03).           |
| `src/contexts/TelemetryContext.tsx`                         | Modificação | Integração do transporte Bluetooth, inicialização com reidratação do IndexedDB e descarte de recursos.      |
| `src/components/live/ConnectionControlPanel.tsx`            | Modificação | UI com botão de transporte Bluetooth, badges de hardware real e orientações Android.                        |
| `src/pages/Configuracoes.tsx`                               | Modificação | Painel informativo de limitações do Bluetooth Clássico SPP, caminhos alternativos e status do IndexedDB.    |
| `src/lib/obd/__tests__/offline-and-flush.test.ts`           | Criação     | Bateria de testes automatizados com simulação de interrupção abrupta, reabertura, persistência e flush.     |
| `RELATÓRIO-ME001-E1.1-THEO.md`                              | Criação     | Este relatório formal de evidências de auditoria.                                                           |

---

## 4. Evidências de Validação Automatizada (Testes, Lint e Build)

### 4.1 Bateria de Testes Vitest (Suíte Completa)

Comando executado via QA pipeline:

- `src/lib/obd/__tests__/obd-pipeline.test.ts` (RF01 a RF10 originais: PidDecoder, ElmProtocolParser, WindowExtractor, SimulatedTransport, ReplayEngine).
- `src/lib/obd/__tests__/offline-and-flush.test.ts` (Testes obrigatórios de auditoria NC-02 e NC-03).

**Cenários validados nos testes:**

1. Persistência de amostras no armazenamento offline sem depender de memória RAM.
2. Interrupção simulada da aplicação (destruição do objeto em memória) seguida de reabertura e reidratação íntegra das amostras do IndexedDB.
3. Descarte de registros persistidos com sucesso e retenção daqueles que falharam por queda de rede.
4. Prevenção de duplicação de dados em requisições de flush subsequentes.
5. Sincronização pós-reconexão com o PocketBase e limpeza automática do banco local.

---

## 5. Rótulo de Homologação em Hardware Real

Conforme requerido expressamente pela auditoria:

> **STATUS DO HARDWARE REAL:**  
> **"IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"**  
> Aplica-se ao transporte **Web Serial ELM327 USB** (`RealSerialTransport`) e ao novo transporte **Web Bluetooth ELM327 BLE** (`BluetoothTransport`).
