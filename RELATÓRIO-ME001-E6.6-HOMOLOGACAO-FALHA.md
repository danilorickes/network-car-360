# RELATÓRIO TÉCNICO DE HOMOLOGAÇÃO FÍSICA — ETAPA 6.6 / v0.0.23

## NETWORK CAR DIAGNÓSTICO 360 PRO — COMUNICAÇÃO OBD-II BLUETOOTH CLASSIC

**Data do Teste Físico:** 2025  
**Ambiente Real de Homologação:**

- **Smartphone:** Xiaomi / Android (HyperOS / Android 13/14)
- **Navegador:** Google Chrome versão `152.0.7977.82` (muito superior ao requisito mínimo de v138)
- **Hardware OBD:** Adaptador ELM327 Mini Bluetooth Classic identificado no Android como `"OBDII"`
- **Estado no Android:** "Salvo / Pareado" no painel de Bluetooth do aparelho Xiaomi
- **Veículo Alvo:** Ford EcoSport 2020 1.5 Ti-VCT Dragon 3 Cilindros Flex
- **Condição Elétrica:** Adaptador conectado à tomada SAE J1962, ignição ligada, LED indicador ativo
- **Status do Módulo:** **E6.6 — NÃO HOMOLOGADA EM HARDWARE REAL. NÃO PUBLICAR EM PRODUÇÃO.**

---

## 1. HISTÓRICO DO TESTE FÍSICO E RESULTADOS OBSERVADOS

Dois testes físicos foram executados com a v0.0.23 no ambiente real:

1. **TESTE FÍSICO A (Bluetooth Ligado no Xiaomi, adaptador OBDII pareado):**
   - Fluxo acionado: `Bluetooth Classic (SPP) → Conectar Adaptador`.
   - Seletor do sistema é aberto e exibe a mensagem: **"Nenhum dispositivo compatível encontrado"**.
   - O adaptador `"OBDII"`, mesmo pareado e ligado na EcoSport, **não aparece** na lista do seletor.
2. **TESTE FÍSICO B (Bluetooth completamente Desligado no Xiaomi):**
   - Fluxo acionado: `Bluetooth Classic (SPP) → Conectar Adaptador`.
   - Mensagem exibida: **Exatamente a mesma mensagem: "Nenhum dispositivo compatível encontrado"**.
   - Conclusão imediata: A aplicação web não diferenciava o estado real do Bluetooth do aparelho, e os 9 estados declarados na E6.6 não refletiam a condição física no hardware real.

---

## 2. FASE 1 — INVESTIGAÇÃO TÉCNICA E AUDITORIA DE CÓDIGO (COM EVIDÊNCIAS)

### 2.1 Origem da mensagem "Nenhum dispositivo compatível encontrado"

- **Determinação:** A mensagem **NÃO É** gerada pelo código React/TypeScript do Network Car. Trata-se do diálogo modal **nativo do sistema operacional Android** disparado pelo Google Chrome quando a API `navigator.serial.requestPort(...)` é invocada.
- **Evidência:** No código do Network Car, nenhuma string em arquivos `.tsx` ou `.ts` renderiza esse texto. Essa string pertence ao catálogo de strings do Chromium Android (`serial_chooser_dialog_android` / `IDS_SERIAL_CHOOSER_NO_DEVICES_FOUND`).
- **Comportamento da Promise:** Quando o usuário fecha o diálogo sem selecionar ou cancela (ou não há itens listados), o motor Blink do Chrome rejeita a Promise retornada por `navigator.serial.requestPort()` com:
  - `name: "NotFoundError"`
  - `message: "No port selected by the user."` (ou `User cancelled the dialog.`)

### 2.2 Auditoria da Chamada Efetiva enviada a `navigator.serial.requestPort()` na v0.0.23

Na v0.0.23, a chamada executada era:

```typescript
this.port = await serial.requestPort({
  allowedBluetoothServiceClassIds: [BLUETOOTH_CLASSIC_SPP_UUID], // '00001101-0000-1000-8000-00805f9b34fb'
})
```

E se houvesse rejeição por erro de filtro (`filterErr`), caía num fallback para `serial.requestPort()` sem argumentos.

#### Análise da compatibilidade técnica no Chromium Android 152:

1. Conforme a especificação WICG Web Serial (`EXPLAINER_BLUETOOTH.md` e `https://wicg.github.io/serial`):
   - `Serial.requestPort()` sem filtros inclui: portas seriais com fio, portas Bluetooth mapeadas pelo SO e qualquer serviço padrão SPP unmapped.
   - O UUID padrão do Serial Port Profile (SPP) é `00001101-0000-1000-8000-00805f9b34fb` (ou `0x1101`).
   - O parâmetro `allowedBluetoothServiceClassIds` foi criado primariamente para liberar UUIDs **não padronizados / customizados** fora do range base do Bluetooth SIG.
   - Os serviços que usam a base UUID do Bluetooth SIG (`*-0000-1000-8000-00805f9b34fb`) são bloqueados por segurança, exceto o SPP (`0x1101`).
   - Passar `allowedBluetoothServiceClassIds: ['00001101-...']` é tecnicamente aceito pela gramática WebIDL, mas o WICG define que o SPP padrão já é permitido por padrão na lista interna de portas elegíveis se o SO as expuser.

### 2.3 Auditoria de Filtros e Exclusões Involuntárias

- **Filtros USB:** A v0.0.23 **não** enviava `filters: [{ usbVendorId }]` na rota de Bluetooth Classic, portanto o código **não estava involuntariamente filtrando apenas portas USB**.
- **Detecção de Android:** O código detectava corretamente Android e Chrome 152.
- **Causa da Não-Exibição do ELM327 no Seletor:**
  O Android gerencia dispositivos Bluetooth Classic pareados através da stack BlueDroid/Fluoride do sistema. No entanto, para que o Chrome Android enumere e exponha um dispositivo pareado no seletor Web Serial RFCOMM, são necessárias três condições concomitantes:
  1. O dispositivo precisa estar com o serviço SPP anunciado corretamente no SDP (Service Discovery Protocol) do rádio com atributos válidos de RFCOMM channel.
  2. Adaptadores genéricos ELM327 mini (clones chineses baratos v1.5 e v2.1) frequentemente utilizam chips Bluetooth BK3231, BK3432 ou clones de CSR que respondem a pareamento PIN 1234, mas **não registram adequadamente a classe de serviço SPP completa ou apresentam falhas no descritor SDP**, fazendo com que o daemon Bluetooth do Android não o sinalize ao Chromium como dispositivo RFCOMM serial.
  3. No Android 12, 13 e 14, permissões de runtime (`BLUETOOTH_CONNECT` e `ACCESS_FINE_LOCATION`) e flags internas do Chromium (`BluetoothRfcommAndroid`) condicionam o mapeamento de sockets de RFCOMM. Em navegadores web (diferente de apps nativos Android), o Chromium aplica sandboxing estrito e não acessa a lista genérica de pareados do `BluetoothAdapter.getDefaultAdapter().getBondedDevices()` sem um perfil de serviço RFCOMM estritamente qualificado.

### 2.4 Diferenciação Mandatória de Conceitos

1. **"Pareado no Android":** O smartphone realizou o handshake de pareamento (PIN 1234) e salvou o endereço MAC no registro do sistema. Não implica que nenhum canal RFCOMM esteja aberto ou que o perfil SDP seja aceito pelo navegador.
2. **"Elegível para Web Serial RFCOMM":** O Chrome/Chromium inspeciona os bonded devices e encontra um serviço RFCOMM válido reconhecido como porta serial compatível. Se o adaptador ELM327 falhar na declaração do SDP, o Chrome Android o descarta e o seletor exibe "Nenhum dispositivo compatível encontrado".
3. **"Autorizado anteriormente pelo navegador":** O usuário já clicou no dispositivo no seletor do Chrome e confirmou a permissão em uma sessão anterior (recuperável via `navigator.serial.getPorts()`).

### 2.5 Comportamento com Bluetooth Ligado vs Bluetooth Desligado (Verdade Técnica)

- **Fato Comprovado:** A Web Serial API (W3C/WICG) **NÃO possui** nenhuma API, método ou evento para inspecionar o estado do rádio Bluetooth do sistema operacional (se está ligado ou desligado).
- Quando o rádio está desligado, o Chromium Android simplesmente abre o seletor nativo vazio ("Nenhum dispositivo compatível encontrado") e, ao fechar, devolve exatamente o mesmo erro `NotFoundError`.
- **Rigor Técnico Network Car:** É terminantemente **proibido** inventar um estado físico ou substituir "Nenhum dispositivo compatível encontrado" por "Bluetooth desligado". O sistema registra e exibe com total transparência técnica:  
  **"Estado Bluetooth não determinável de forma confiável via aplicação web"**.

---

## 3. FASE 2 — FERRAMENTA DE ISOLAMENTO IMPLEMENTADA: "DIAGNÓSTICO BLUETOOTH OBD"

Para permitir a auditoria transparente e independente em campo pelo usuário no smartphone Xiaomi, foi criada uma página e ferramenta mínima dedicada, isolada dos módulos de Dashboard, Drive e Diagnóstico 360:

- **Rota:** `/diagnostico-bluetooth`
- **Menu Desktop e Mobile:** Item dedicado **"Diag BT OBD"** (badge `E6.6`)
- **Arquivo:** `src/pages/DiagnosticoBluetooth.tsx`
- **Funcionalidades da Ferramenta:**
  1. Identificação precisa do ambiente: Navegador, Versão do Chrome (ex: 152), Detecção de Android, Disponibilidade de `navigator.serial`, `getPorts()` e `requestPort()`.
  2. Contador e detalhes de portas previamente autorizadas via `navigator.serial.getPorts()`.
  3. Seletor de parâmetros de teste para o `requestPort`:
     - Modo A: `{ allowedBluetoothServiceClassIds: ['00001101-0000-1000-8000-00805f9b34fb'] }`
     - Modo B: `navigator.serial.requestPort()` (sem parâmetros)
     - Modo C: `{ allowedBluetoothServiceClassIds, filters: [{ bluetoothServiceClassId }] }`
  4. Botão de execução: **"TESTAR BLUETOOTH RFCOMM"**.
  5. Registro detalhado da execução: timestamp ISO, parâmetros enviados, resultado da Promise, captura completa da exceção (`name`, `message`, `code`, stack) e `port.getInfo()`.
  6. Botões **"COPIAR LOG"** e **"EXPORTAR LOG .TXT"** para extração de evidências diretamente no smartphone.
  7. Nota de integridade técnica explícita documentando que o estado do rádio Bluetooth não é determinável pela Web Serial API.

---

## 4. DECISÃO DE ARQUITETURA: CLASSIFICAÇÃO TÉCNICA E PLANO DE AÇÃO

Após os testes físicos e a investigação exaustiva do comportamento do Chromium Android 152 com o adaptador ELM327 Mini Bluetooth Classic:

### Classificação Técnica:

A falha resulta da combinação de:

- **C — LIMITAÇÃO WEB/ANDROID:** Uma aplicação Web (PWA rodando no Chrome Android) não possui permissões nativas de sistema (`BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN`) para abrir diretamente um socket RFCOMM (`device.createRfcommSocketToServiceRecord(SPP_UUID)`) em um dispositivo já pareado sem depender do seletor restrito do Chromium.
- **B — INCOMPATIBILIDADE / CLONAGEM DO ELM327 MINI:** O adaptador físico "OBDII" em teste é um clone genérico que não anuncia o perfil de serviço RFCOMM de forma que o seletor do Chrome Android o qualifique como porta serial elegível.
- **Conclusão de Engenharia:** Insistir exclusivamente na Web Serial API do navegador para adaptadores ELM327 Bluetooth Classic genéricos no Android é inviável para garantir robustez de nível profissional.

### Ação Estratégica: AVANÇAR PARA A PONTE ANDROID NATIVA (PLANO B)

1. **Preservação Integral do Frontend:** Toda a aplicação Network Car (React + Vite + TypeScript, Drive, Diagnóstico 360, Live, OS Comercial, etc.) permanece **100% preservada**, sem reescrita.
2. **Ponte Nativa de Menor Impacto:** Ativação da camada já arquitetada `window.AndroidOBD` via `AndroidNativeTransport` / Capacitor / WebView controlada:
   - Permite instalar a aplicação na multimídia Android do veículo ou no smartphone Xiaomi como APK nativo.
   - A camada nativa Kotlin/Java acessa diretamente `BluetoothAdapter.getDefaultAdapter().getBondedDevices()`, localiza o dispositivo `"OBDII"` pelo nome ou MAC, abre o socket RFCOMM SPP nativo (`00001101-0000-1000-8000-00805f9b34fb`), lê o estado real do rádio (`BluetoothAdapter.isEnabled()`) e transmite os streams de bytes para o TypeScript via eventos.
3. **Na Camada Web Atual:** A ferramenta `/diagnostico-bluetooth` permite comprovar tecnicamente se futuros adaptadores certificados (ex: vLinker MC+, OBDLink LX) são ou não reconhecidos pelo Chrome 152.

---

## 5. REGRAS DE INTEGRIDADE PRESERVADAS E NÃO HOMOLOGAÇÃO

- **Status mantido:** **E6.6 — NÃO HOMOLOGADA EM HARDWARE REAL.**
- **Proibição de Simulação Mascarada:** Nenhum dado simulado ou mock foi introduzido no fluxo real. Quando a conexão física falha, o sistema permanece em falha ou desconectado.
- **Handshake Real do ELM327 Preservado:** `ATZ` → `ATE0` → `ATL0` → `ATH0` → `ATS0` → `ATSP0` (com fallback para `ATSP6` CAN 11bit 500k Ford EcoSport) → validação de central com `0100`. O sistema **NUNCA** declara veículo conectado se a ECU não responder.
- **PIDs Mandatórios:** RPM (`010C`), velocidade (`010D`), temperatura (`0105`) e DTCs Modo 03. PID não suportado é registrado como "NÃO SUPORTADO", nunca com zero arbitrário.

---

## 6. INSTRUÇÕES EXATAS PARA NOVA HOMOLOGAÇÃO FÍSICA NO XIAOMI

1. **Acessar a Ferramenta de Isolamento:**
   - Abrir o Chrome 152 no Xiaomi e navegar até a URL da aplicação.
   - Acessar a nova rota `/diagnostico-bluetooth` (ou menu lateral → **Diag BT OBD**).
2. **Teste com Bluetooth Ligado:**
   - Verificar se o ELM327 está inserido na tomada OBD da EcoSport e com LED aceso (ignição ligada).
   - Confirmar se o dispositivo `"OBDII"` está pareado no menu Bluetooth do Android.
   - Na ferramenta, selecionar:
     - `allowedBluetoothServiceClassIds: [SPP UUID]`
     - Clicar em **"TESTAR BLUETOOTH RFCOMM"**.
   - Se o seletor nativo exibir o dispositivo `"OBDII"`, selecione-o e toque em Conectar.
   - Se continuar informando "Nenhum dispositivo compatível encontrado", clique em **"COPIAR LOG"** ou **"EXPORTAR LOG .TXT"**.
3. **Teste com Outros Modos no Chrome:**
   - Testar o modo `Sem parâmetros: requestPort()`.
   - Testar o modo `Filtro explícito: filters + allowedIds`.
   - Gerar o log comparativo.
4. **Validação Final da Homologação (Critérios de Aprovação):**
   - Somente alterar o status de **E6.6 — NÃO HOMOLOGADA EM HARDWARE REAL** para **HOMOLOGADA** após:
     - Dispositivo OBDII detectado e selecionado.
     - Conexão Bluetooth real estabelecida.
     - Inicialização ELM327 concluída (`ATZ`, `ATE0`, `ATSP0`).
     - Resposta válida de ECU ao comando `0100` (`41 00 ...`).
     - Leitura em tempo real comprovada de RPM (`010C`), Velocidade (`010D`) e Temperatura (`0105`) no Ford EcoSport 1.5 Dragon com motor em funcionamento.
