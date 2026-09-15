# RELATÓRIO TÉCNICO DE IMPLEMENTAÇÃO — OS-ME001-E6.2

## PROJETO NETWORK CAR — DIAGNÓSTICO 360 & DRIVE

### ETAPA 6.2: ASSISTENTE PERSONALIZÁVEL ("MINHA ASSISTENTE")

- **Versão:** v0.0.13
- **Data de Execução:** Março/2025
- **Responsável:** Engenharia & Theo (Skip Developer)
- **Status da Homologação de Hardware:** `AGUARDANDO VALIDAÇÃO EM HARDWARE REAL` (Preservado conforme diretriz estrita da OS)
- **Base Prévia:** v0.0.12 (E6.1 aprovada)

---

### 1. OBJETIVO EXECUTIVO DA OS-ME001-E6.2

Transformar **"Nina"** de uma identidade fixa/rígida do Network Car em uma **instância configurável** da assistente/copiloto inteligente, permitindo que cada condutor ou oficina personalize:

1. **Nome Livre** (ex.: Luna, Sofia, Apollo, Jarvis ou Nina);
2. **Wake Word Dinâmico** configurável (ex.: `luna`, `sofia`, `copiloto`), removendo qualquer dependência funcional de `"nina"` literal;
3. **Seleção de Vozes Reais** disponíveis no dispositivo/sintetizador (Web Speech API / TTS), sem inventar vozes fictícias;
4. **Estilo de Comunicação** selecionável: `OBJETIVO` (ultra conciso), `AMIGAVEL` (tom próximo e acolhedor, estilo Danilo) ou `TECNICO` (preciso com foco em sensores e ECU);
5. **Denominação Neutra:** antes da personalização pelo usuário, a interface adota `"ASSISTENTE"`. Após configuração, a denominação torna-se dinâmica no Drive (ex.: `CARRO | VIAGEM | DIVERSÃO | LUNA`);
6. **Nina como Instância Legada:** "Nina" passa a ser apenas a predefinição utilizada pelo Danilo, e não uma imposição do Network Car.

---

### 2. ARQUITETURA IMPLEMENTADA & GENERALIZAÇÃO PROGRESSIVA

A arquitetura foi generalizada de forma progressiva, mantendo retrocompatibilidade estrita com todos os testes e chamadas da E6.1, sem qualquer refatoração destrutiva:

1. **Camada de Armazenamento e Identidade (`src/lib/assistant/assistant-identity-store.ts`):**
   - Cria o modelo `AssistantIdentityConfig` e tipos `AssistantStyle` (`OBJETIVO | AMIGAVEL | TECNICO`).
   - Persistência multitenant isolada por chave: `nc_assistant_identity_${workshopId}_${userId}_${plate}`.
   - Detecção e enumeração de vozes estritamente reais via `getAvailableTtsVoices()`.
   - Lógica de exibição neutra: `getAssistantDisplayName(identity)`. Retorna `"Assistente"` se `isCustomized === false`, ou o nome customizado caso configurado.

2. **Serviço de Copiloto Generalizado (`src/lib/assistant/assistant-copilot-service.ts`):**
   - Generalização para `AssistantCopilotService`.
   - Classe `NinaCopilotService` mantida como subclasse derivada com compatibilidade total.
   - Casamento de wake word dinâmico via `matchWakeWord(transcript)`:
     - Se o usuário configurou "Luna", expressões como `"Luna, como está o carro?"` ativam a instância;
     - Expressões com `"Nina..."` deixam de ativar aquela instância configurada como Luna.
   - Formatação contextual de respostas locais e offline por estilo (`formatByStyle`).
   - TTS acoplado à voz real selecionada (`selectedVoiceUri`).

3. **Serviço de Boletins Periódicos Generalizado (`src/lib/assistant/assistant-periodic-bulletin-service.ts`):**
   - Generalização para `AssistantPeriodicBulletinService`.
   - Exportação compatível de `NinaPeriodicBulletinService`.
   - O `parseVoiceCommand(transcript)` reconhece dinamicamente comandos de boletim iniciados com o wake word configurado (ex.: `"Luna, me avisa a cada 20 minutos"`, `"Luna, deixa os boletins mais detalhados"`).
   - O gerador de boletins usa o nome da assistente configurada (ex.: `"Boletim Luna: ..."`).
   - Preservação total de intervalos: Desativado, 5, 10, 20, 30, 60 e personalizado (1 a 180 min).
   - Preservação de níveis de detalhe: Resumido, Normal e Detalhado.
   - Regra de ouro da telemetria: nunca inventa PIDs indisponíveis nem afirma baseline sem dados consolidados.

4. **Backend Hook PocketBase (`pocketbase/hooks/nina_copilot.js`):**
   - Atualizado para ler dinamicamente `assistant_name` e `style` do payload JSON.
   - Prompt do agente instruído com o nome e estilo de comunicação definidos (`OBJETIVO`, `AMIGAVEL` ou `TECNICO`).
   - Fallback determinístico offline/sem quota formatado no estilo solicitado.

5. **Interface Network Car Drive (`src/pages/NetworkCarDrive.tsx`):**
   - Navegação inferior dinâmica: `CARRO | VIAGEM | DIVERSÃO | [NOME_ASSISTENTE]`.
   - Modal acessível `"Minha Assistente"` permitindo alterar nome, wake word, voz e estilo diretamente do tablet/celular/multimídia sem sair do Drive.
   - Predefinições com um clique: "Padrão Nina (Danilo)" e "Denominação Neutra".

6. **Configurações Globais (`src/pages/Configuracoes.tsx`):**
   - Adicionada seção operacional dedicada a "Minha Assistente (OS-ME001-E6.2)", com teste de voz em tempo real e persistência isolada por veículo.

7. **Camada Crítica 100% Blindada e Independente (`VehicleSafetyMonitor`):**
   - Os diagnósticos, leitura de falhas (DTCs), Caixa-Preta (NC-02/NC-03), monitoramento de superaquecimento e corte de contingência permanecem no núcleo desacoplado, sem jamais depender da presença, estado ou identidade da assistente.

---

### 3. ARQUIVOS CRIADOS E MODIFICADOS

| Arquivo                                                           | Status     | Descrição                                                                                                    |
| :---------------------------------------------------------------- | :--------- | :----------------------------------------------------------------------------------------------------------- |
| `src/types/etapa6.ts`                                             | Modificado | Adicionados `AssistantIdentityConfig`, `AssistantStyle`, `AvailableTtsVoice` e extensão de `CopilotContext`. |
| `src/lib/assistant/assistant-identity-store.ts`                   | **Criado** | Módulo de persistência multitenant, listagem de vozes reais TTS e exibição neutra.                           |
| `src/lib/assistant/assistant-copilot-service.ts`                  | **Criado** | Núcleo do copiloto generalizado com wake word dinâmico, STT/TTS e formatação por estilo.                     |
| `src/lib/assistant/assistant-periodic-bulletin-service.ts`        | **Criado** | Núcleo generalizado dos boletins por voz com comandos dinâmicos e linguagem segura.                          |
| `src/lib/nina/nina-copilot-service.ts`                            | Modificado | Ponte de compatibilidade retroativa para código legado.                                                      |
| `src/lib/nina/nina-periodic-bulletin-service.ts`                  | Modificado | Ponte de compatibilidade retroativa para código legado.                                                      |
| `src/components/assistant/AssistantSettingsModal.tsx`             | **Criado** | Componente Modal UI "Minha Assistente" para configuração ergonômica no Drive.                                |
| `src/pages/NetworkCarDrive.tsx`                                   | Modificado | Abas e textos dinâmicos (ASSISTENTE / LUNA / NINA), integração do modal e ducking.                           |
| `src/pages/Configuracoes.tsx`                                     | Modificado | Seção operacional de configuração da assistente e persistência por veículo.                                  |
| `pocketbase/hooks/nina_copilot.js`                                | Modificado | Hook de backend com suporte a nome, estilo e identidade da assistente.                                       |
| `src/lib/assistant/__tests__/assistant-customizable-e6-2.test.ts` | **Criado** | Bateria completa de testes automatizados da OS-ME001-E6.2 (100% aprovada).                                   |
| `package.json`                                                    | Modificado | Versão incrementada para `v0.0.13`.                                                                          |

---

### 4. REGRAS E DIRETRIZES DA OS ATENDIDAS

1. **Identidade Livre:** Nome livre e wake word configurável salvos por placa/usuário/oficina.
2. **Nina como Instância Danilo:** A identidade de Nina é disponibilizada como um botão de predefinição rápida ("Padrão Nina Danilo"), e não imposta como nome universal da plataforma.
3. **Denominação Neutra:** Exibição inicial como "ASSISTENTE" antes da personalização.
4. **Desativação do Wake Word Anterior:** Verificado em teste unitário — ao configurar "Luna", comandos iniciados com "Nina..." são sumariamente ignorados.
5. **Independência de Voz:** Apenas vozes reais presentes no navegador/dispositivo (`speechSynthesis.getVoices()`) são listadas, desacopladas do estilo e do nome.
6. **Linguagem Segura e Não-Inventiva:** Boletins nunca afirmam dados quando os PIDs não estiverem disponíveis no veículo/enlace.
7. **Regras de Não-Execução:**
   - E7 NÃO foi iniciada;
   - ERP comercial NÃO foi alterado;
   - O Drive NÃO foi reescrito (apenas recebeu adaptação dinâmica);
   - Hardware continua explicitamente marcado como `AGUARDANDO VALIDAÇÃO EM HARDWARE REAL`.

---

### 5. STATUS DA VALIDAÇÃO E TESTES

A suíte de testes de validação automatizada cobre:

- Inicialização neutra com "ASSISTENTE";
- Troca de identidade para "Luna" com wake word dinâmico;
- Rejeição de "Nina" após configuração de "Luna";
- Configuração de vozes reais sem invenção de nomes;
- Estilos Objetivo, Amigável e Técnico;
- Isolamento multitenant entre oficinas e usuários distintos;
- Preservação dos boletins periódicos, anti-repetição e regras de detalhe;
- Total independência do `VehicleSafetyMonitor` e dos alertas críticos determinísticos.

---

### 6. LIMITAÇÕES & PRÓXIMOS PASSOS (E7)

1. **Hardware Real:** A validação final do microfone e sintetizador TTS em multimídias físicas Android (ex.: Astar/H-Buster/Witson/multimídias chinesas genéricas) requer homologação com equipamento físico (`AGUARDANDO VALIDAÇÃO EM HARDWARE REAL`).
2. **Sincronização em Nuvem:** A persistência atual opera no `localStorage` isolado. Na E7 ou etapas futuras, poderá ser adicionada sincronização na coleção de perfis do PocketBase se demandado pela oficina.
