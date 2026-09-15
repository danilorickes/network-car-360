# RELATÓRIO — ME001-E1 — THEO

## Network Car — Diagnóstico 360 Live — Etapa 1 (MVP Executável de Telemetria OBD-II)

**Ordem de Serviço / Missão:** ME001-E1  
**Autor Técnico:** THEO (Skip Specialist Developer)  
**Data:** 15 de Setembro de 2026  
**Status de Entrega:** COMPLETA, EXECUTÁVEL, VERIFICADA E INTEGRADA

---

### 1. Resumo Executivo

O presente documento formaliza a entrega da **Etapa 1 (ME001-E1)** do produto **Network Car — Diagnóstico 360 Live**, um sistema web progressivo voltado a oficinas mecânicas de precisão e testes de rodagem para diagnóstico automotivo em tempo real baseado no protocolo padrão OBD-II (SAE J1979 / ISO 15031-5 / ISO 15765-4 CAN).

Todas as diretrizes da Ordem de Serviço foram atendidas integralmente em código executável no repositório:

- Não há mockups estáticos, pseudocódigo ou interfaces desconectadas do fluxo real de dados.
- O pipeline de aquisição roda no navegador (offline-first), desacoplado de hardware específico.
- A persistência no Skip Cloud (PocketBase) é garantidamente **append-only** para amostras brutas, eventos de pista e registros de DTC, com proibição estrita de mutação ou deleção.
- O simulador dinâmico temporal permite validação de ponta a ponta sem veículo físico.
- A comunicação com hardware real via Web Serial API foi implementada seguindo a especificação dos comandos AT do ELM327, catalogada como **"IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"**, sem fabricação de falsas evidências de teste físico.

---

### 2. Stack Tecnológica e Justificativas Técnicas

1. **Frontend / Runtime:**
   - **React 18 + TypeScript + Vite:** Garantia de segurança de tipos na manipulação de barramentos seriais, conversores de bytes hexadecimais, fórmulas matemáticas e buffers de amostras.
   - **Tailwind CSS + shadcn/ui:** Design system automotivo operacional escuro (_Automotive Dark System_), paleta de alto contraste (#0B0F14, #131A22, #1A232E, #263340), fontes com dígitos tabulares (_tabular-nums_) para eliminação de jittering em medidores digitais e pulso de gravação (REC).
   - **Lucide React:** Iconografia de grau técnico industrial.

2. **Backend & Persistência (Skip Cloud / PocketBase):**
   - **PocketBase v0.36:** Motor SQLite embutido ultra-rápido com RLS configurado via migrations Javascript.
   - **Coleções Imutáveis:** Coleções `raw_samples`, `events` e `dtcs` configuradas com permissões de `list`, `view` e `create`, com `updateRule` e `deleteRule` nulos para reforço estrito de append-only.
   - **Sessões Estruturadas:** Coleção `sessions` armazena metadados de rodagem, PIDs suportados descobertos dinamicamente e horários em UTC ISO-8601.

3. **Arquitetura de Tempo & Relógio:**
   - **Relógio Monotônico (`performance.now()`):** Utilizado para controle de amostragem, intervalos, cálculo de frequência efetiva (Hz) e janelas temporais de pré/pós evento (evita distorções por ajuste de fuso ou relógio do sistema operacional).
   - **UTC ISO-8601 (`new Date().toISOString()`):** Utilizado para correlação temporal unívoca e auditoria forense dos registros.

---

### 3. Matriz de Atendimento aos Requisitos Funcionais (RF01 a RF10)

| Requisito | Descrição                                                                              | Status de Implementação                                                           | Evidência / Módulo                                                              |
| --------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **RF01**  | Conexão, sequenciamento ELM327 (ATZ, ATE0, ATL0, ATH0, ATS0, ATSP0), reconexão         | IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL (Real) / VALIDADO (Simulado) | `RealSerialTransport.ts`, `SimulatedTransport.ts`                               |
| **RF02**  | Descoberta dinâmica de PIDs (Modo 01 00/20/40...)                                      | VALIDADO                                                                          | `PidDecoder.parseSupportedPidsBitmap`, `SamplerScheduler.discoverSupportedPids` |
| **RF03**  | Telemetria contínua (13 PIDs), meta ≥5 Hz prioritários, ≥1 Hz secundários              | VALIDADO                                                                          | `PID_DEFINITIONS`, `SamplerScheduler.ts`, cálculo móvel de `effectiveFreqHz`    |
| **RF04**  | Gestão de Sessão (INICIAR TESTE → ANDAMENTO → ENCERRAR), metadado do veículo           | VALIDADO                                                                          | `TelemetryContext.startSession`, `endSession`, coleção `sessions`               |
| **RF05**  | Botão destacado "MARCAR SINTOMA", 7 categorias, timestamp duplo                        | VALIDADO                                                                          | `SymptomMarkerButton.tsx`, `EventMarker.ts`, coleção `events`                   |
| **RF06**  | Caixa-preta: extração de janela ±30 s sem modificar telemetria bruta                   | VALIDADO                                                                          | `WindowExtractor.extractEventWindow`, teste unitário aprovado                   |
| **RF07**  | Diagnóstico DTCs Modo 03/07, status MIL, proibição estrita de Modo 04                  | VALIDADO                                                                          | `DtcService.ts`, `ElmProtocolParser.parseDtcResponse`                           |
| **RF08**  | Painel Live operacional, grid de medidores, sparklines, distinção de "SEM COMUNICAÇÃO" | VALIDADO                                                                          | `Index.tsx`, `GaugeCard.tsx`, `ConnectionControlPanel.tsx`                      |
| **RF09**  | Simulador dinâmico com condução temporal plausível e injeção de falhas/queda de sinal  | VALIDADO                                                                          | `SimulatedTransport.ts` (marcha lenta, aceleração, cruzeiro, anomalia)          |
| **RF10**  | Replay pelo mesmo modelo de dados do Live (1x, 2x, 5x, 10x, scrubber, marcadores)      | VALIDADO                                                                          | `Replay.tsx`, `ReplayEngine.ts`, reuso de `GaugeCard` e `MiniLiveChart`         |

---

### 4. Arquitetura do Núcleo e Desacoplamento

1. **Contrato de Transporte (`OBDTransport`):**
   O núcleo de amostragem consome apenas a interface `OBDTransport` com métodos `connect()`, `disconnect()`, `send(cmd)` e eventos de status. Dessa forma, a aplicação alterna entre o `SimulatedTransport` e o `RealSerialTransport` transparentemente, sem afetar gravador, decodificador ou scheduler.

2. **Tabela Declarativa de PIDs (`PID_DEFINITIONS`):**
   Mapeia o identificador hexadecimal do PID, bytes esperados, unidade, limites e fórmula matemática pura. Não há estruturas `switch/case` engessadas espalhadas pela UI.

3. **Extração de Caixa-Preta Imutável (`WindowExtractor`):**
   Ao acionar um sintoma ("falha", "trepidação", etc.), o sistema registra o evento com seu offset monotônico e parâmetros de janela (padrão 30.000 ms anteriores e posteriores). Quando uma análise retrospectiva é solicitada, o `WindowExtractor` projeta uma visão fatiada sem realizar qualquer mutação ou deleção na série temporal original armazenada no PocketBase.

4. **Resiliência a Falhas de Comunicação:**
   Caso o adaptador desconecte, sofra timeout ou retorne `NO DATA`, o sistema nunca assume valor numérico zero nem interrompe a aplicação: o estado é assinalado como `SEM COMUNICAÇÃO` / `TIMEOUT` / `UNSUPPORTED (N/D)`, preservando a integridade da tela e retomando a gravação automaticamente assim que a conexão se restabelece.

---

### 5. Cobertura de Testes Automatizados e Evidências

A suíte de testes unitários foi elaborada com Vitest cobrindo:

1. **Decodificação de PIDs Prioritários e Secundários:**
   - RPM (0x0C): conversão de 2 bytes com fator 1/4.
   - Velocidade (0x0D): conversão de byte direto em km/h.
   - Temperatura do Arrefecimento (0x05): compensação de offset -40 °C.
   - Carga (0x04) e Acelerador (0x11): conversão percentual `(A * 100) / 255`.
   - Conversão de bitmap binário de PIDs suportados (Modo 01 00/20/40).
2. **Parser de Respostas ELM327:**
   - Respostas padrão de Modo 01 (`41 0C 1A F8`).
   - Respostas de erro e ausência de dados (`NO DATA`, `UNABLE TO CONNECT`, `?`).
   - Respostas de códigos DTC em Modo 03 (`43 01 03 01 00 00` -> `P0301`).
3. **Extração de Caixa-Preta (`WindowExtractor`):**
   - Verificação de isolamento da janela temporal ±30 s.
   - Verificação de imutabilidade estrita do array original de amostras.
4. **Motor de Replay:**
   - Reprodução por passos e cálculo de progresso percentual determinístico.

---

### 6. Validação em Hardware Real: Declaração de Transparência

Em estrito cumprimento aos princípios de integridade técnica da Network Car:

- **Status Atual:** A implementação para comunicação via Web Serial com chip ELM327 está completa em `src/lib/obd/transports/real-serial-transport.ts`.
- **Classificação:** Permanece formalmente assinalada como **"IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"**.
- **Justificativa:** Os testes realizados na Etapa 1 foram executados no simulador veicular dinâmico e em emulação serial local. Nenhuma evidência fictícia foi forjada.

---

### 7. Recomendações Técnicas para a Etapa 2

1. **Validação em Veículo Físico:** Realizar baterias de teste em pista com adaptadores com chip PIC18F25K80 genuíno em portas USB e Bluetooth SPP no veículo Ford EcoSport 2020 1.5 Dragon.
2. **Otimização de Amostragem CAN:** Introduzir comandos `AT H1` / `AT MA` para monitoramento de barramento CAN em modo passivo quando se desejar taxas acima de 20 Hz sem polling.
3. **Exportação de Evidências Periciais:** Adicionar exportação de relatórios em PDF/CSV contendo o laudo da caixa-preta dos eventos marcados para anexação na ordem de serviço da oficina mecânica.

---

**THEO — Engenharia de Diagnóstico Automotivo & Telemetria 360**  
_Network Soluções — Network Office_
