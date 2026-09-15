# RELATÓRIO TÉCNICO DE CONCLUSÃO DE ENGENHARIA — ETAPA 3

## OS-ME001-E3 — NETWORK CAR 360: MOTOR DE INTELIGÊNCIA DIAGNÓSTICA

- **Data de Execução:** $(date +"%Y-%m-%d")
- **Responsável Técnico:** Theo (Engenheiro de Software & Sistemas Diagnósticos)
- **Status do Projeto:** ETAPA 3 CONCLUÍDA COM SUCESSO (100% dos testes aprovados)
- **Base Preservada:** Etapa 1 e Etapa 2 (RF01 a RF10) integralmente intactas e em pleno funcionamento.
- **Hardware Físico:** Rotulado obrigatoriamente como `IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL`.

---

### 1. OBJETIVO E ARQUITETURA IMPLEMENTADA

A Etapa 3 entregou a transformação determinística e transparente de dados de telemetria bruta (**RAW**), janelas da Caixa-Preta (±30s) e evidências objetivas em:

1. **Anomalias Dinâmicas** (comparações físicas com a linha de base).
2. **Correlações Multi-Sinais** (relações temporais de causa e efeito).
3. **Hipóteses Diagnósticas Rastreáveis** (com causas prováveis, evidências favoráveis e contrárias).
4. **Cálculo de Nível de Confiança Explicável** (pesos explícitos, sem alucinação por LLM).
5. **Protocolos de Confirmação Técnica** (foco estrito em "testar antes de trocar qualquer peça").

#### Pipeline Obrigatório em Camadas Separadas:

$$\text{RAW} \longrightarrow \text{DERIVED/EVIDENCE} \longrightarrow \text{ANOMALY} \longrightarrow \text{CORRELATION} \longrightarrow \text{HYPOTHESIS} \longrightarrow \text{CONFIDENCE} \longrightarrow \text{CONFIRMATION TEST}$$

```
[ Telemetria Bruta (RAW) ]
           │
           ▼
[ Dynamic Baseline Engine ] (Média sessão -> Pré-sintoma -> Sintoma -> Pós-sintoma)
           │
           ▼
[ Anomaly Engine ] (10 regras físicas: Quedas abruptas, trims fora da faixa, desvios de MAP/TPS, subtensão)
           │
           ▼
[ Correlation Engine ] (Relações temporais: ex: TPS sobe -> RPM cai; STFT alto + MAP elevado)
           │
           ▼
[ Hypothesis Engine ] (DTC como evidência e não veredito; síntese de causas, favoráveis e contrárias)
           │
           ▼
[ Confidence Engine ] (Fórmula matemática ponderada: Base 15% + DTC + Anomalias + Correlações - Penalidades)
           │
           ▼
[ Confirmation Protocols ] (Testes cruzados de bobina/vela, estanqueidade com fumaça, pressão mecânica)
```

---

### 2. REGRAS FUNDAMENTAIS E DIRETRIZES DE SEGURANÇA

1. **Separação Epistemológica:** Uma hipótese **NUNCA** é armazenada ou apresentada como fato confirmado.
2. **Anti-Substituição Precipitada:** O sistema não recomenda substituição de componente exclusivamente com base em código DTC.
3. **Segurança Veicular:** Proibição irrestrita de comandos destrutivos na ECU (Modo 04 / Limpeza de DTC permanece bloqueado).
4. **Segurança Diagnóstica em Três Níveis:**
   - `INFORMATIVO`: Sistema em conformidade ou desvios menores que não impedem a rodagem.
   - `ATENÇÃO`: Anomalias em trims de combustível, falhas pontuais sob carga ou oscilações de rotação.
   - `CRÍTICO`: Subtensão elétrica severa (<11.0V), apagamento do motor ou superaquecimento (>108°C), orientando interrupção imediata do teste dinâmico.
5. **Anti-Falso Positivo:** O cenário normal **NÃO** gera diagnóstico de defeito forçado apenas para preencher a tela.

---

### 3. FÓRMULA MATEMÁTICA E PESOS DE CONFIANÇA (ConfidenceEngine)

O cálculo de confiança é **100% determinístico e reproduzível** (mesma entrada = exatamente o mesmo resultado bit a bit):

$$\text{Score} = \text{Base (15\%)} + W_{\text{DTC}} + W_{\text{Anomalias}} + W_{\text{Correlações}} + W_{\text{Sintoma}} - P_{\text{Contradição}} - P_{\text{PIDs Ausentes}}$$

- **$W_{\text{DTC}}$ (DTC Compatível Presente):** +25% a +28%.
- **$W_{\text{Anomalias}}$ (Anomalias Temporais Relevantes):** +15% por anomalia (limitado a +30%).
- **$W_{\text{Correlações}}$ (Correlações entre múltiplos sinais):** +15% a +20% por correlação (limitado a +30%).
- **$W_{\text{Sintoma}}$ (Concordância do Sintoma Relatado):** +15%.
- **$P_{\text{Contradição}}$ (Evidência Contraditória Observada):** -10% a -20%.
- **$P_{\text{PIDs Ausentes}}$ (Sensores Críticos Não Suportados pela ECU):** -12% por PID ausente.
- **Faixas de Confiança (Sem Falsa Precisão):**
  - $\ge 85\%$: **Muito Alta**
  - $70\% - 84\%$: **Alta**
  - $45\% - 69\%$: **Moderada**
  - $< 45\%$: **Baixa**

---

### 4. BIBLIOTECA DE PROTOCOLOS DE CONFIRMAÇÃO (ConfirmationProtocols)

Cada hipótese relevante gera passos estruturados com ferramentas recomendadas, componentes-alvo e desfechos esperados:

- `MISFIRE_CYLINDER`:
  - Passo 1: Inspeção visual e conector de chicote.
  - Passo 2: Teste de troca cruzada (_cross-swap_) de bobinas entre cilindros para verificar se o defeito migra.
  - Passo 3: Inspeção de folga do eletrodo e cerâmica da vela de ignição.
  - Passo 4: Medição ôhmica e pulsagem do eletroinjetor.
  - Passo 5: Teste de compressão relativa e estanqueidade mecânica.
- `LEAN_MIXTURE`:
  - Teste de estanqueidade com máquina de fumaça (_smoke test_) na admissão.
  - Medição de pressão estática e dinâmica da bomba e filtro de combustível.
  - Teste de isolamento da válvula de purga do cânister.
- `POWER_LOSS`:
  - Aferição de contrapressão do escapamento com manômetro na rosca da sonda (teste de catalisador obstruído).
  - Teste dinâmico de pista dupla do corpo de borboleta (TBI).
- `ELECTRICAL_STABILITY`:
  - Teste de queda de tensão (_voltage drop_) na malha de aterramento do bloco/chassi sob carga.
  - Medição de tensão do regulador do alternador e teste de _ripple AC_.

---

### 5. INTERFACE — ÁREA "DIAGNÓSTICO 360"

Integrada diretamente na rota `/replay`, apresentando os 7 blocos em ordem obrigatória:

1. **Sintoma Observado** (Tipo marcado, instante relativo e relato técnico).
2. **O Que os Sensores Mostraram** (Tabela comparativa: Média normal da sessão $\rightarrow$ Antes do sintoma $\rightarrow$ Momento do sintoma $\rightarrow$ Após o sintoma).
3. **Anomalias Encontradas** (Severidade, valor observado, PIDs envolvidos e link para voltar ao ponto correspondente do RAW).
4. **Hipóteses Diagnósticas** (Rankeamento, sistema afetado, causas possíveis, limitações e dados faltantes).
5. **Nível de Confiança** (Percentual com classificação por faixa: Baixa / Moderada / Alta / Muito Alta).
6. **Por Que o Sistema Chegou Nisso** (Transparência total dos pesos: DTC + anomalia + correlação - penalidades).
7. **O Que Testar Agora** (Protocolo de testes práticos passo a passo com ferramentas necessárias).

---

### 6. ARQUIVOS CRIADOS E MODIFICADOS NA ETAPA 3

#### Novos Arquivos:

1. `src/types/diagnostic.ts` — Tipagens do motor diagnóstico, anomalias, correlações, hipóteses e confiança.
2. `src/lib/diagnostic/baseline-engine.ts` — Motor de linha de base dinâmica comparativa da sessão.
3. `src/lib/diagnostic/anomaly-engine.ts` — Motor de detecção física de anomalias multi-sinais.
4. `src/lib/diagnostic/correlation-engine.ts` — Motor de correlação temporal causa-efeito.
5. `src/lib/diagnostic/confidence-engine.ts` — Motor determinístico de cálculo de confiança e pesos.
6. `src/lib/diagnostic/confirmation-protocols.ts` — Biblioteca de testes e procedimentos práticos.
7. `src/lib/diagnostic/hypothesis-engine.ts` — Motor de geração e filtragem de hipóteses rastreáveis.
8. `src/lib/diagnostic/diagnostic-pipeline.ts` — Orquestrador do pipeline de ponta a ponta.
9. `src/services/diagnostic.ts` — Camada de persistência do diagnóstico no PocketBase.
10. `src/components/diagnostic/Diagnostic360View.tsx` — Componente dos 7 blocos estruturados na UI.
11. `pocketbase/migrations/0007_create_diagnostic_analyses.js` — Migração da coleção `diagnostic_analyses`.
12. `src/lib/diagnostic/__tests__/etapa3-validation.test.ts` — Suíte de testes automatizados da Etapa 3.

#### Arquivos Modificados (sem quebra de regressão):

1. `src/contexts/TelemetryContext.tsx` — Acionamento automático da análise ao registrar sintomas e exposição do relatório mais recente.
2. `src/pages/Replay.tsx` — Integração da aba principal "Diagnóstico 360" e navegação bidirecional com a telemetria bruta.
3. `src/components/Layout.tsx` — Atualização do menu para "Replay & Diagnóstico 360" e badge de versão 3.0.0.
4. `src/pages/Index.tsx` — Banner contextual de conclusão de teste com atalho para o Diagnóstico 360.

---

### 7. RESULTADOS DOS TESTES AUTOMATIZADOS (QA)

- **Suíte Etapa 3 (`etapa3-validation.test.ts`):** 10/10 testes aprovados.
  - Cenário normal sem falso positivo: ✅ Aprovado.
  - Cenário Misfire / P0301: ✅ Aprovado.
  - Cenário Mistura Pobre / P0171: ✅ Aprovado.
  - Cenário Perda de Potência (TPS vs RPM): ✅ Aprovado.
  - Cenário Sintoma sem DTC: ✅ Aprovado.
  - PID Indisponível (penalidade transparente): ✅ Aprovado.
  - Evidência Contraditória (redução objetiva): ✅ Aprovado.
  - Determinismo matemático (mesma entrada = mesmo resultado): ✅ Aprovado.
  - Vínculo rastreável (Hipótese $\rightarrow$ Anomalia $\rightarrow$ RAW): ✅ Aprovado.
  - Criticidade de segurança: ✅ Aprovado.
- **Suíte Etapa 2 (`etapa2-validation.test.ts`):** 7/7 testes aprovados (Zero regressão).
- **Suíte de Pipeline OBD (`obd-pipeline.test.ts`):** 13/13 testes aprovados.
- **Suíte Offline & Flush (`offline-and-flush.test.ts`):** 5/5 testes aprovados.
- **TypeScript (`tsc`):** 0 erros.
- **Build de Produção (`vite build`):** Sucesso absoluto.

---

### 8. LIMITAÇÕES CONHECIDAS

1. **Testes em Hardware Físico:** Rotulado obrigatoriamente como `IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL`. O comportamento com adaptadores Bluetooth/USB físicos depende da estabilidade do transceiver do veículo.
2. **PIDs Proprietários:** Variáveis específicas de montadoras fora do padrão SAE J1979 (Modo 01) não foram incluídas para garantir compatibilidade universal.
3. **Componentes Puramente Mecânicos:** Coxins quebrados, folgas em rolamentos ou amortecedores estourados não possuem sensores diretos no barramento OBD-II; suas hipóteses dependem de relatos do operador.
