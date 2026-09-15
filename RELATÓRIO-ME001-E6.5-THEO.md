# RELATÓRIO TÉCNICO DE IMPLEMENTAÇÃO

## OS-ME001-E6.5 — Network Car Drive: Custo Inteligente de Viagem

**Executor:** THEO  
**Versão:** 0.0.18 (Base: v0.0.17 — E1 a E6.3.1 aprovadas)  
**Data:** Março/2025

---

### 1. Resumo Executivo

Foi implementada com sucesso no módulo **VIAGEM** do _Network Car Drive_ a funcionalidade de **Custo Inteligente de Viagem**, permitindo ao condutor planejar custos antes da saída, acompanhar em tempo real o gasto acumulado de combustível e pedágios em layout otimizado para condução (números grandes, alta legibilidade e zero inputs complexos em movimento) e acessar o balanço final entre estimado vs. realizado com classificação rigorosa da origem de cada dado (**MEDIDO**, **ESTIMADO** ou **INFORMADO**).

---

### 2. Conformidade de Escopo e Arquitetura

- **Módulo VIAGEM preservado:** A estrutura de abas existente (`CARRO | VIAGEM | DIVERSÃO | ASSISTENTE`) permaneceu intacta.
- **Modos Automotivos intocados:** Motorista, Passageiro, Noturno e Demonstração mantiveram seu funcionamento original.
- **Motores críticos inalterados:** Motores OBD, telemetria, diagnóstico 360, segurança e blackbox permaneceram íntegros.
- **Regras de Isolamento Multitenant (E5.1):** Todos os dados de custos e preferências de combustível persistem isolados por `workshop_id` e usuário, validados tanto em cliente como em regras de coleção e hook de backend.
- **Sem falsificação de telemetria:** Se não houver telemetria comprovada de consumo, o sistema utiliza o consumo informado pelo condutor ou média histórica com indicação visual transparente.

---

### 3. Detalhamento das Funcionalidades Entregues

#### 3.1 Preço do Combustível & Persistência de Preferências (Requisito 1)

- O motorista informa o preço em R$/litro (ex.: R$ 6,19/L) e o tipo de combustível (Gasolina, Etanol, Diesel, GNV).
- As preferências são gravadas em chave isolada por `workshop_id + user_id + vehicle_plate` (`nc_trip_fuel_pref_...`).
- O valor é pré-carregado automaticamente nas viagens seguintes para evitar digitação repetitiva.
- Durante a viagem, é disponibilizado um ajuste rápido de preço caso ocorra abastecimento com valor diferente.

#### 3.2 Consumo: Contrato Desacoplado & Preparação para OBD Futuro (Requisitos 2 & 10)

- Foi desenvolvida a interface `IConsumptionProvider` e a classe concreta `HybridConsumptionProvider`.
- **Origem Automática:** Quando houver suporte e leitura OBD válida e comprovada de consumo (`obdValidAverageKml`), o sistema adota automaticamente como dado **MEDIDO** e identifica na UI como `"Consumo automático"`.
- **Origem Manual:** Na ausência de leitura confiável de consumo pelo hardware atual, o sistema utiliza o consumo informado com badge **INFORMADO** (`"Consumo informado"`).
- **Sem simulação:** O sistema não inventa nem simula valores de telemetria como se fossem reais.
- **Arquitetura Futura:** A interface `IConsumptionProvider` permite que novos módulos OBD (como PID 0x5E ou cálculos avançados de MAF/Fuel Rate homologados para Android Auto ou dongles proprietários) sejam plugados diretamente no `TripSessionManager` sem qualquer alteração na interface do usuário ou nas regras financeiras.

#### 3.3 Cálculos Matemáticos e Robustez (Requisito 3)

- $\text{Litros} = \text{Distância (km)} \div \text{Consumo Médio (km/L)}$
- $\text{Custo Combustível} = \text{Litros} \times \text{Preço/L}$
- $\text{Custo Total} = \text{Custo Combustível} + \sum \text{Pedágios}$
- Validações defensivas para proteção contra divisão por zero, consumo zero/negativo, preço zero e valores indefinidos/NaN.
- Arredondamentos monetários padronizados em duas casas decimais com representação em BRL (`R$ 0,00`).
- Caso de referência validado em testes: $180\text{ km} \div 11{,}2\text{ km/L a R\$ 6,19/L} \to 16{,}07\text{ L} \to \text{R\$ } 99{,}47$.

#### 3.4 Custo Estimado Pré-Viagem & Média Histórica (Requisito 4)

- Na aba VIAGEM, antes da saída, o condutor insere a distância prevista e pedágios estimados.
- O sistema exibe o card **CUSTO ESTIMADO DA VIAGEM** destacando distância, consumo médio sugerido (preferindo a média histórica acumulada do veículo), litros previstos, custo de combustível, pedágios previstos e o total geral estimado.

#### 3.5 Modo Condução: Card Automotivo Durante a Viagem (Requisito 5 & 11)

- Tipografia de alta visibilidade (font-mono em tamanhos 2xl a 4xl).
- Métrica em tempo real: Km percorridos, km/L médio, litros consumidos e custo até o momento.
- Linhas separadas para Combustível, Pedágios e Total.
- Se o veículo estiver em movimento (> 5 km/h) e o modo passageiro não estiver ativo, entradas complexas de texto são ocultadas em prol da segurança veicular.

#### 3.6 Estimado × Realizado (Requisito 6)

- Durante a viagem e na finalização, calcula a diferença em reais:
  $$\Delta = \text{Custo Real} - \text{Custo Estimado}$$
- Exemplo: Estimado R$ 165,00 / Real R$ 158,70 / Economia de −R$ 6,30 destacada em verde.

#### 3.7 Gestão de Pedágios (Requisito 7)

- Botão touch `" + Pedágio "` com inclusão rápida de valor monetário e nome da praça.
- Múltiplos pedágios registrados e listados individualmente, totalizados em separado do consumo de combustível.

#### 3.8 Resumo de Finalização & Transparência dos Dados (Requisito 8)

- Modal e card de finalização com mensagem padrão:
  _Ex.: "Pelotas → Porto Alegre · Distância: 260 km · Tempo: 3h12 · Média: 11,7 km/L · Combustível utilizado: 22,2 L · Custo combustível: R$ 137,42 · Pedágios: R$ 32,80 · Custo total: R$ 170,22"_
- Classificação explícita de cada componente como **MEDIDO**, **ESTIMADO** ou **INFORMADO**.

#### 3.9 Histórico e Persistência Resiliente (Requisitos 9 & 12)

- As viagens finalizadas são salvas localmente e sincronizadas com a coleção `trip_sessions` no PocketBase.
- Estrutura pronta para futuras análises de custo por km, média veicular e gasto mensal.
- Viagem em andamento persiste em `localStorage` e sobrevive a perda de conexão, recarregamento ou fechamento acidental da janela.

---

### 4. Alterações de Backend e Banco de Dados (PocketBase)

1. **Migration 0013 (`pocketbase/migrations/0013_etapa6_5_trip_cost.js`):**
   - Adicionou à coleção `trip_sessions` os campos: `workshop_id`, `origin`, `destination`, `fuel_price_per_liter`, `fuel_type`, `consumption_source`, `avg_consumption_kml`, `estimated_distance_km`, `estimated_cost_fuel`, `estimated_cost_tolls`, `estimated_cost_total`, `real_fuel_liters`, `fuel_cost_total`, `tolls_total`, `total_cost`, `tolls_breakdown`, `cost_summary_report`.
   - Adicionados índices de busca `idx_trip_workshop` e `idx_trip_vehicle_ended`.
   - Regras de segurança RLS multitenant por oficina.
2. **Hook de Segurança (`pocketbase/hooks/work_orders_security.js`):**
   - Inclusão da coleção `trip_sessions` na lista de coleções multitenant protegidas pelo servidor.

---

### 5. Arquivos Criados ou Modificados

- `pocketbase/migrations/0013_etapa6_5_trip_cost.js` (novo)
- `pocketbase/hooks/work_orders_security.js` (modificado)
- `src/types/etapa6.ts` (modificado — tipagens de custos, pedágios, badges e relatórios)
- `src/lib/trip/trip-cost-service.ts` (novo — motor de cálculo, persistência e contratos)
- `src/lib/trip/trip-session-manager.ts` (modificado — gerenciamento do ciclo de vida e custos em tempo real)
- `src/components/trip/TripCostPanel.tsx` (novo — card de condução automotiva e pré-viagem)
- `src/components/trip/TripFinishedSummaryModal.tsx` (novo — modal de encerramento com transparência de dados)
- `src/pages/NetworkCarDrive.tsx` (modificado — integração da aba VIAGEM)
- `src/lib/trip/__tests__/trip-cost-service.test.ts` (novo — bateria de testes de conformidade)
- `package.json` (bump de versão para v0.0.18)

---

### 6. Validação e Testes

- Bateria completa de testes automatizados executada cobrindo todos os cenários obrigatórios (preço, consumo manual e automático, divisão por zero, campos inválidos, pedágios, recarregamento offline, estimado vs real).
- Regressão de testes das etapas E1 a E6.3 executada com 100% de sucesso.
- QA completo (lint, build de produção e verificação estática de tipos) aprovado sem erros.
