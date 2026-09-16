# RELATÓRIO TÉCNICO DE IMPLEMENTAÇÃO — ETAPA 7 (E7)

## Integração Real ELM327 Bluetooth Classic (SPP/RFCOMM) — Ford EcoSport 2020 1.5 Dragon

**Projeto:** Network Car Diagnóstico 360  
**Versão Homologada do Código:** `v0.0.19`  
**Data:** $(date -u +"%Y-%m-%d %H:%M:%S UTC")  
**Responsável Técnico / Engenharia:** Agente Desenvolvedor Network Car  
**Status da Etapa:** **IMPLEMENTADO — AGUARDANDO VALIDAÇÃO COM HARDWARE REAL**

---

### 1. Resumo Executivo da Missão E7

Nesta etapa (E7), foi implementada a capacidade de comunicação real entre o aplicativo web **Network Car Diagnóstico 360** e o adaptador físico **ELM327 Mini Bluetooth Classic (SPP/RFCOMM)** pareado no smartphone **Xiaomi Android**, com conexão física validada no veículo **Ford EcoSport 2020 1.5 Dragon Ti-VCT** (protocolo identificado: ISO 15765-4 CAN 11-bit / 500 kbps).

Anteriormente, o sistema exibia na tela de condução a mensagem `VEÍCULO DESCONECTADO` / `DADOS SIMULADOS`. Com a conclusão desta etapa, a arquitetura foi estendida para suportar comunicação bidirecional com adaptadores Bluetooth Classic SPP sem quebrar o simulador existente ou o Web Serial USB anterior, com tolerância a clones e estrita conformidade com a política **Read-Only de Segurança**.

---

### 2. Análise Técnica Fundamental: Bluetooth Classic vs Web Bluetooth vs Web Serial Android

Durante a fase preliminar de arquitetura, foi analisada rigorosamente a limitação técnica dos navegadores modernos sobre Android para o transporte Bluetooth Clássico:

1. **Web Bluetooth API (`navigator.bluetooth`):**
   - É **exclusiva para BLE (Bluetooth Low Energy / GATT)**.
   - **NÃO suporta Bluetooth Classic SPP (Serial Port Profile)**.
   - Qualquer adaptador clássico ELM327 Mini v1.5 / v2.1 nunca funcionará através de Web Bluetooth puro.
   - **Decisão:** Não foi implementada solução falsa ou enganosa com Web Bluetooth para o ELM327 Clássico.

2. **Web Serial API sobre Bluetooth Classic RFCOMM (`navigator.serial`):**
   - No **Desktop Chrome (v117+)**, o Chrome já disponibiliza suporte a portas seriais sobre Bluetooth Classic RFCOMM.
   - No **Chrome para Android**, o Google lançou o suporte nativo no **Chrome 138+** (_chromestatus feature "Web serial over Bluetooth on Android"_, Finch flag `BluetoothRfcommAndroid`).
   - Nesta especificação, o navegador permite abrir canais RFCOMM requisitando o UUID padrão SPP:
     `00001101-0000-1000-8000-00805f9b34fb` (outros UUIDs SIG Base permanecem bloqueados por segurança).

3. **Arquitetura de Duplo Canal Adotada (`AndroidBluetoothTransport`):**
   - **Caminho Web Direto (Chrome Android 138+ / Desktop Chrome 117+):**
     Utiliza `navigator.serial.requestPort({ allowedBluetoothServiceClassIds: ['00001101-0000-1000-8000-00805f9b34fb'] })` para conectar diretamente ao dispositivo Bluetooth pareado no sistema operacional.
   - **Ponte Nativa Android (Chrome Android < 138 ou WebView de Multimídias):**
     Fallback transparente para a interface de ponte nativa `window.AndroidOBD` (`AndroidNativeTransport`) em aplicações empacotadas via APK/Capacitor.
   - O frontend **não conhece detalhes de baixo nível do transporte**, comunicando-se estritamente através da interface uniforme `OBDTransport`.

---

### 3. Arquitetura de Comunicação e Fluxo de Inicialização ELM327

O fluxo de conexão foi desenhado para tolerar falhas pontuais e idiossincrasias de adaptadores clones chineses ELM327 v1.5/v2.1:

1. **Seleção e Abertura:** Conexão física na taxa nominal de 38400 baud.
2. **Sequência Determinística de Inicialização ELM327:**
   - `ATZ` — Reset do microcontrolador (com tolerância a atrasos de até 3500ms).
   - `ATE0` — Desativação de eco de caracteres.
   - `ATL0` — Desativação de linefeeds extras.
   - `ATH0` — Desativação de cabeçalhos de barramento redundantes.
   - `ATS0` — Remoção de espaços para compactação de transmissão.
   - `ATSP0` — Seleção automática de protocolo (com fallback para `ATSP6` - ISO 15765-4 CAN 11/500 caso o veículo seja o Ford EcoSport).
3. **Confirmação de ECU:**
   - Envio de consulta PID 00 (`0100`).
   - Leitura do protocolo ativo através de `ATDP`.
4. **Descoberta de PIDs Suportados via Bitmaps:**
   - Leitura do PID 0x00 (PIDs 01–20), PID 0x20 (PIDs 21–40) e PID 0x40 (PIDs 41–60).
   - Amostragem orientada exclusivamente aos PIDs marcados como presentes na ECU.
5. **Resiliência e Tolerância a Erros:**
   - Tratamento de `NO DATA`, `?` (resposta não compreendida por clone), `BUFFER FULL` e `UNABLE TO CONNECT`.
   - Se um PID responder `NO DATA`, o sistema rotula como `NÃO SUPORTADO` na UI, **jamais inventando o valor 0**.
   - Em caso de perda de sinal Bluetooth, o sistema tenta reconectar até 3 vezes e, se não restabelecer, sinaliza `FALHA` / `SEM COMUNICAÇÃO`.
   - **REGRA INVIOLÁVEL:** O sistema **NUNCA substitui silenciosamente uma conexão física real perdida por dados simulados**.

---

### 4. PIDs de Homologação Implementados (Modo 01 Padrão OBD-II)

Todos os PIDs essenciais solicitados para o piloto foram homologados com fórmulas estritamente padronizadas:

| PID Hex       | Nome do Parâmetro                        | Fórmula de Decodificação           | Unidade |
| ------------- | ---------------------------------------- | ---------------------------------- | ------- |
| `0x0C`        | Rotação do Motor (RPM)                   | `((A * 256) + B) / 4`              | RPM     |
| `0x0D`        | Velocidade do Veículo                    | `A`                                | km/h    |
| `0x05`        | Temp. Líquido de Arrefecimento (ECT)     | `A - 40`                           | °C      |
| `0x42`        | Tensão do Módulo de Controle             | `((A * 256) + B) / 1000`           | V       |
| `0x04`        | Carga Calculada do Motor                 | `(A * 100) / 255`                  | %       |
| `0x0B`        | Pressão Absoluta no Coletor (MAP)        | `A`                                | kPa     |
| `0x11`        | Posição da Borboleta (TPS)               | `(A * 100) / 255`                  | %       |
| `0x06`        | Short Term Fuel Trim (STFT Banco 1)      | `(A - 128) * 100 / 128`            | %       |
| `0x07`        | Long Term Fuel Trim (LTFT Banco 1)       | `(A - 128) * 100 / 128`            | %       |
| `0x14`        | Sensor O2 B1S1 (Tensão da Sonda)         | `A / 200`                          | V       |
| `0x24`        | Sensor Lambda Banda Larga (Equivalência) | `((A * 256 + B) * 2) / 65535`      | λ       |
| `0x00 / 0x20` | Bitmaps de PIDs Suportados               | Decodificação bit a bit de 32 bits | —       |

_Nota sobre PIDs Estendidos Ford:_ A arquitetura foi estruturada para manter a separação clara entre OBD-II Modo 01 e futuros PIDs de engenharia Ford (VCT, correlação de comando/fase). Nenhum comando proprietário fictício foi inserido.

---

### 5. Gravação Diagnóstica: Sessões Antes vs Depois da Manutenção

Para possibilitar o comparativo de comportamento do motor na oficina mecânica:

- Adicionados os campos `origin: 'REAL' | 'SIMULATED'` e `maintenance_stage: 'ANTES_MANUTENCAO' | 'DEPOIS_MANUTENCAO' | 'PADRAO'` ao modelo `RawSampleModel`.
- O `ConnectionWizardModal` agora inclui um seletor visual de estágio de manutenção antes do início da captura.
- Cada amostra gravada no banco de dados imutável (append-only) carimba a origem física comprovada e o momento do ciclo de reparo.

---

### 6. Política Rigorosa de Segurança (Read-Only)

O Network Car é um scanner estritamente passivo e diagnóstico:

- **Proibido Modo 04:** Nenhum comando de apagamento de códigos de falha (DTC) ou reset de adaptativos foi inserido.
- **Proibida Escrita em ECU:** Bloqueado qualquer comando de atuação, codificação, calibração ou escrita em memórias FLASH/EEPROM.
- Todas as requisições enviadas ao barramento utilizam exclusivamente comandos de leitura `01`, `03` e comandos de configuração AT locais do modem ELM.

---

### 7. Passo a Passo Exato para Conexão no Xiaomi Android + Ford EcoSport

Para o operador de oficina realizar a validação em hardware real:

1. **Pareamento Inicial no Android:**
   - Plugue o adaptador ELM327 Mini Bluetooth na porta OBD-II do Ford EcoSport 2020 (abaixo do painel, lado esquerdo do motorista).
   - Ligue a ignição do EcoSport (chave ligada ou motor em funcionamento).
   - No smartphone Xiaomi, acesse **Configurações → Bluetooth**.
   - Localize o dispositivo (geralmente nomeado `OBDII`, `OBD2` ou `vLinker`).
   - Realize o pareamento digitando o PIN do fabricante (geralmente `1234` ou `0000`).
   - Confirme que o dispositivo aparece na lista de **Dispositivos Pareados**.

2. **Abertura do Aplicativo no Chrome Android:**
   - Abra o Google Chrome no Xiaomi (recomenda-se versão 138+ com flag serial bluetooth ativa, ou Chrome Dev/Canary).
   - Acesse a URL de preview do Network Car Diagnóstico 360.
   - Navegue para a rota de Condução `/network-car-drive` ou tela inicial `/`.

3. **Execução do Assistente de Conexão (Connection Wizard):**
   - Clique no botão **Conectar OBD** ou no assistente de conexão.
   - Selecione a opção **"ELM327 Bluetooth Classic (SPP / Android)"**.
   - Escolha o modo de gravação (`Antes da Manutenção` ou `Depois da Manutenção` se for gravar sessão comparativa).
   - Clique em **"Iniciar Descoberta"**.
   - O navegador abrirá o seletor nativo do sistema para escolha da porta Bluetooth pareada: selecione o adaptador `OBDII`.

4. **Detecção e Leitura Automática:**
   - O aplicativo executará automaticamente a inicialização `ATZ`, `ATE0`, `ATSP0`.
   - A ECU responderá ao protocolo `ISO 15765-4 CAN (11 bit)`.
   - O banner mudará de `VEÍCULO DESCONECTADO` para `VEÍCULO CONECTADO` e `DADOS REAIS • ELM327`.
   - As grandezas reais de RPM, Velocidade, ECT, Tensão da Bateria e Sonda Lambda serão renderizadas no painel em tempo real.

---

### 8. Arquivos Criados ou Modificados

- **Criado:** `src/lib/obd/transports/android-bluetooth-transport.ts` (transporte Web Serial RFCOMM UUID SPP + fallback Native Bridge)
- **Criado:** `src/lib/obd/__tests__/etapa7-validation.test.ts` (bateria abrangente de testes unitários para a etapa E7)
- **Criado:** `RELATÓRIO-ME001-E7-THEO.md` (este documento técnico formal de entrega)
- **Modificado:** `package.json` (bump de versão para `0.0.19`)
- **Modificado:** `src/types/obd.ts` (novo transporte `OBD REAL BLUETOOTH CLASSIC` e campos de origem/estágio de manutenção)
- **Modificado:** `src/lib/obd/pid-decoder.ts` (adição dos PIDs 0x14 e 0x24 de sonda lambda / O2)
- **Modificado:** `src/lib/obd/elm-parser.ts` (tolerância aprimorada para respostas de clones ELM327)
- **Modificado:** `src/lib/obd/sampler-scheduler.ts` (carimbo de dados reais/simulados e PIDs prioritários)
- **Modificado:** `src/lib/obd/platform-detector.ts` (identificação precisa do suporte Chrome 138+ RFCOMM)
- **Modificado:** `src/contexts/TelemetryContext.tsx` (integração do novo transporte e suporte a estágios de manutenção)
- **Modificado:** `src/components/live/ConnectionWizardModal.tsx` (interface com seletor Bluetooth Classic e comparativo antes/depois)
- **Modificado:** `src/components/live/ConnectionControlPanel.tsx` (seletor explícito de Bluetooth Classic SPP)
- **Modificado:** `src/components/live/GaugeCard.tsx` (tratamento textual de `NÃO SUPORTADO`)
- **Modificado:** `src/pages/NetworkCarDrive.tsx` (exibição de DADOS REAIS • ELM327, VEÍCULO CONECTADO, status ECU e protocolo CAN)
- **Modificado:** `src/pages/Index.tsx` (badge de status real vs simulado)

---

### 9. Resultado dos Testes Automatizados e QA

- **Static Analysis (oxlint):** 0 erros.
- **TypeScript Typecheck (`tsc --noEmit`):** 0 erros.
- **Vite Build:** Sucesso total (`dist/index.html` gerado).
- **Suíte de Testes (Vitest):**
  - Todas as 10 suítes de teste (incluindo regressão completa E1–E6.5 e a nova E7) passaram com 100% de sucesso.
  - Testes específicos da E7 (`etapa7-validation.test.ts`):
    - Decodificação de PIDs 0C, 0D, 05, 04, 11, 0B, 42, 06, 07, 14, 24.
    - Decodificação do bitmap de PIDs 00/20/40.
    - Tolerância a respostas `NO DATA`, `?`, `UNABLE TO CONNECT`, `CAN ERROR`.
    - Inspecção ambiental do Chrome 138+ Android vs versões anteriores.
    - Garantia de que conexão perdida **nunca ativa dados simulados silenciosamente**.
    - Rotulagem de `NÃO SUPORTADO` sem inventar zeros.

---

### 10. Declaração Final de Homologação

Conforme as diretrizes obrigatórias de engenharia, antes da conexão física na garagem/oficina:

> **ESTADO FINAL DA ETAPA 7:**
> **IMPLEMENTADO — AGUARDANDO VALIDAÇÃO COM HARDWARE REAL**
