import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Cpu,
  HardDrive,
  Terminal,
  Car,
  Layers,
  Sparkles,
  FileDown,
  Printer,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Relatorio() {
  const [activeTab, setActiveTab] = useState<
    'relatorio_e4' | 'checklist' | 'relatorio_e2' | 'arquitetura' | 'instrucoes' | 'evidencias'
  >('relatorio_e4')

  const rfChecklistEtapa2 = [
    {
      id: 'REQ 01',
      title: 'Perfil do Veículo (Cadastro Reutilizável Genérico)',
      status: 'VALIDADO',
      desc: 'Cadastro reutilizável: placa, fabricante, modelo, versão, ano/modelo, motorização, combustível, câmbio, odômetro, VIN e observações. Sem nenhuma lógica hardcoded. Seed inicial com Ford EcoSport 2020 1.5 Dragon 3C e VW T-Cross 1.0 TSI.',
    },
    {
      id: 'REQ 02',
      title: 'Descoberta OBD & Assinatura do Veículo',
      status: 'VALIDADO',
      desc: 'Ao conectar, registra: protocolo OBD, PIDs suportados e indisponíveis, transporte utilizado, DTCs presentes, MIL e VIN. Assinatura salva na coleção obd_capabilities e associada ao veículo.',
    },
    {
      id: 'REQ 03',
      title: 'Caixa-Preta do Sintoma Autocontida',
      status: 'VALIDADO',
      desc: 'Pacote diagnóstico automático contendo veículo, sessão, timestamp exato, tipo do sintoma, telemetria ±30s, DTCs de contexto, estado do barramento, qualidade das amostras, PIDs disponíveis e estatísticas (min/max/avg). RAW original preservado estritamente append-only.',
    },
    {
      id: 'REQ 04',
      title: 'Comparação Temporal Simultânea (Antes → Sintoma → Depois)',
      status: 'VALIDADO',
      desc: 'Visualização comparativa simultânea no Replay e Caixa-Preta (RPM, Velocidade, Carga, TPS, MAP, MAF, STFT, LTFT, Avanço, Temp., Tensão). Permite correlacionar causa-efeito sem atribuir diagnóstico antecipado.',
    },
    {
      id: 'REQ 05',
      title: 'Múltiplos Sintomas por Sessão',
      status: 'VALIDADO',
      desc: 'Suporte a múltiplas ocorrências na mesma sessão. Cada sintoma gera sua própria caixa-preta isolada e pode ser aberto e inspecionado individualmente no Replay.',
    },
    {
      id: 'REQ 06',
      title: 'Exportação Multiformato (JSON, CSV, PDF Imprimível)',
      status: 'VALIDADO',
      desc: 'Exportação da sessão completa e de eventos individuais em JSON técnico completo, CSV de telemetria bruta e Relatório PDF para oficina/cliente via CSS print de alta definição (Salvar como PDF). RAW original não alterado.',
    },
    {
      id: 'REQ 07',
      title: 'Preparação para IA (DiagnosticEvidence)',
      status: 'VALIDADO',
      desc: 'Estrutura DiagnosticEvidence com fatos puramente objetivos (ex: queda percentual de RPM, posição de TPS, faixa de STFT). Separação estrita: RAW → DERIVED/EVIDENCE → FUTURA INTERPRETAÇÃO IA. Nenhuma hipótese de defeito gravada como fato.',
    },
    {
      id: 'REQ 08',
      title: 'Simulador Expandido com 7 Cenários Reproduzíveis',
      status: 'VALIDADO',
      desc: 'Cenários selecionáveis nas Configurações e no Painel: Funcionamento Normal, Perda de Potência, Oscilação de Marcha Lenta, Trepidação/Misfire (DTC P0301), Apagamento Súbito, DTC Ativo (P0171) e Perda Temporária de Comunicação.',
    },
    {
      id: 'REQ 09',
      title: 'Testes Unitários e Integrados Abrangentes',
      status: 'VALIDADO',
      desc: 'Cobertura de testes para perfil de veículo, associação sessão/veículo, capacidade OBD, múltiplos sintomas, janela ±30s, imutabilidade do RAW, cálculo de evidências, replay e exportação. Nenhuma regressão nos RF01–RF10 da Etapa 1.',
    },
    {
      id: 'REQ 10',
      title: 'Interface Operacional para Mecânico em Rodagem',
      status: 'VALIDADO',
      desc: 'Fluxo direto: Veículo → Conectar OBD → Iniciar teste → Live → Marcar Sintoma → Encerrar → Analisar Caixa-Preta. Alta legibilidade em ambiente de teste de rodagem.',
    },
    {
      id: 'REQ 11',
      title: 'Transparência de Hardware Real ELM327',
      status: 'IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL',
      desc: 'Suporte completo Web Serial e Web Bluetooth (BLE/Android). Mantido status explícito sem fabricação de dados de hardware físico.',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#FFB300]" />
            <span>Relatório Oficial de Entrega — OS-ME001-E2</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            Network Car — Diagnóstico 360 Live — Dan e Theo (Network Soluções)
          </p>
        </div>

        {/* Tab Selector */}
        <div className="inline-flex rounded-md p-1 bg-[#131A22] border border-[#263340] overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('relatorio_e4')}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              activeTab === 'relatorio_e4'
                ? 'bg-[#FFB300] text-black shadow font-bold'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            RELATÓRIO — ME001-E4 (NOVO)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('relatorio_e2')}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              activeTab === 'relatorio_e2'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            RELATÓRIO — ME001-E2
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              activeTab === 'checklist'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Checklist Requisitos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('arquitetura')}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              activeTab === 'arquitetura'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Arquitetura & Evidências IA
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instrucoes')}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              activeTab === 'instrucoes'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Instruções Operacionais
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidencias')}
            className={`px-3 py-1.5 text-xs font-semibold rounded whitespace-nowrap transition-colors ${
              activeTab === 'evidencias'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Dados Semeados (EcoSport)
          </button>
        </div>
      </div>

      {/* Aba 0: RELATÓRIO OFICIAL ME001-E4 */}
      {activeTab === 'relatorio_e4' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-6 text-xs text-gray-300 leading-relaxed max-w-4xl">
          <div className="border-b border-[#263340] pb-4">
            <span className="text-[10px] uppercase tracking-wider text-[#FFB300] font-mono font-bold">
              DOCUMENTO TÉCNICO OFICIAL DE ENTREGA — ETAPA 4 (OS-ME001-E4)
            </span>
            <h2 className="text-xl font-bold text-white mt-1">RELATÓRIO — ME001-E4 — THEO</h2>
            <p className="text-[#9AA7B4] mt-0.5">
              Network Car Diagnóstico 360 Completo • Versão 0.0.7 • Autor: Theo (Desenvolvedor) •
              Para: Danilo (Network Soluções)
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              1. Resumo Executivo da Entrega (Etapa 4)
            </h3>
            <p>
              Em cumprimento estrito à Ordem de Serviço <strong>OS-ME001-E4</strong>, foi
              implementado o<strong> Diagnóstico 360 Completo</strong>, transformando o motor
              diagnóstico em um fluxo integrado de investigação automotiva:
            </p>
            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] font-mono text-[11px] text-[#FFB300]">
              Veículo → Queixa do cliente → Avaliação do mecânico → Scanner/OBD → Teste de rodagem →
              Sintomas → Motor Diagnóstico → Hipóteses → Testes de confirmação → Resultado →
              Intervenção → Validação Pós-Reparo → Relatório / Prontuário.
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              2. Separação Epistemológica: Relato vs Medido vs Inferido vs Confirmado
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Relato do Cliente (Peso 0.35):</strong> Percepção subjetiva com regime,
                velocidade e sintomas assinalados. Nunca convertido automaticamente em fato
                comprovado.
              </li>
              <li>
                <strong>Constatação Técnica do Mecânico (Peso 0.65):</strong> Registro estruturado
                das observações do especialista.
              </li>
              <li>
                <strong>Telemetria RAW & Scanner OBD (Peso 1.0):</strong> Dados físicos medidos pela
                ECU, PIDs e DTCs. RAW mantido rigorosamente append-only.
              </li>
              <li>
                <strong>Histórico do Mesmo Veículo (Peso 0.6):</strong> Comparação temporal
                individual (STFT baseline, tensão média histórica, primeira ocorrência vs
                recorrência de falha). Veículos distintos nunca são misturados.
              </li>
              <li>
                <strong>Testes de Confirmação e Critério de Diagnóstico:</strong> Uma hipótese
                JAMAIS assume estado "CONFIRMADA" apenas por alta pontuação matemática. Exige
                protocolo executado e critério auditável registrado pelo mecânico.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              3. Matriz Antes vs Depois e Validação Pós-Reparo
            </h3>
            <p>
              Foi implementado o módulo de intervenção com registro de peças substituídas e execução
              de reteste, gerando a matriz comparativa:
              <strong> Antes do Reparo ↔ Depois do Reparo</strong> com status formalizado:{' '}
              <em>"Falha não reproduzida"</em>, <em>"Falha permanece"</em> ou{' '}
              <em>"Resultado inconclusivo"</em>.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              4. Transparência de Hardware Real
            </h3>
            <div className="bg-amber-950/40 border border-amber-800 p-3 rounded">
              <span className="font-bold text-amber-300">Classificação Obrigatória:</span>
              <p className="text-gray-300 mt-1">
                Funcionalidades dependentes do ELM327 físico (Web Serial / BLE) mantêm o rótulo:
                <br />
                <strong className="text-white">
                  "IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"
                </strong>
                .
              </p>
            </div>
          </section>
        </div>
      )}

      {/* Aba 1: RELATÓRIO OFICIAL ME001-E2 */}
      {activeTab === 'relatorio_e2' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-6 text-xs text-gray-300 leading-relaxed max-w-4xl">
          <div className="border-b border-[#263340] pb-4">
            <span className="text-[10px] uppercase tracking-wider text-[#FFB300] font-mono font-bold">
              DOCUMENTO TÉCNICO OFICIAL DE ENTREGA — ETAPA 2
            </span>
            <h2 className="text-xl font-bold text-white mt-1">RELATÓRIO — ME001-E2 — THEO</h2>
            <p className="text-[#9AA7B4] mt-0.5">
              Network Car Diagnóstico 360 Live • Versão 2.0.0 • Autor: Theo (Desenvolvedor) • Para:
              Danilo (Network Soluções)
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              1. Resumo Executivo da Entrega (Etapa 2)
            </h3>
            <p>
              Em cumprimento integral à Ordem de Serviço <strong>OS-ME001-E2</strong>, entregamos a
              Etapa 2 do sistema
              <strong> Network Car — Diagnóstico 360 Live</strong>. A arquitetura validada e
              aprovada na Etapa 1 (v0.0.4) foi integralmente preservada sem regressões nos
              requisitos funcionais RF01 a RF10.
            </p>
            <p>
              Foi implementada a camada completa de{' '}
              <strong>Perfil do Veículo Genérico OBD-II</strong>, a descoberta e assinatura de
              capacidades da ECU (<code>obd_capabilities</code>), a{' '}
              <strong>Caixa-Preta do Sintoma</strong> com congelamento de fatos objetivos (
              <code>DiagnosticEvidence</code>), o módulo de{' '}
              <strong>Comparação Temporal Simultânea</strong> (Antes → Sintoma → Depois), suporte a{' '}
              <strong>Múltiplos Sintomas por Sessão</strong>,{' '}
              <strong>Exportação Multiformato</strong> (JSON técnico, CSV da telemetria e Relatório
              PDF para oficina) e a expansão do <strong>Simulador Multicenário</strong> para 7 modos
              de falha reproduzíveis.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              2. Arquitetura e Preservação da Imutabilidade RAW
            </h3>
            <p>
              A regra fundamental de segurança de dados automotivos foi rigorosamente respeitada:
            </p>
            <div className="bg-[#0B0F14] p-3 rounded border border-[#263340] font-mono text-[11px] text-[#2ECC71]">
              RAW TELEMETRY (Imutável / Append-Only) → DERIVED WINDOW / BLACKBOX → DIAGNOSTIC
              EVIDENCE (Fatos Objetivos) → [FUTURA IA]
            </div>
            <p>
              O motor de geração de caixa-preta (<code>BlackBoxBuilder</code>) opera sobre cópias
              defensivas da telemetria bruta. Nenhum dado é modificado, sobrescrito ou deletado para
              calcular resumos, gerar gráficos comparativos ou renderizar relatórios.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              3. Preparação para IA (DiagnosticEvidence) & Princípio Epistemológico
            </h3>
            <p>
              Conforme exigência expressa do usuário Danilo, a Etapa 2 não atribui diagnósticos de
              causa raiz ou suposições mecânicas automaticamente. Em seu lugar, foi construído o
              gerador de evidências diagnósticas <code>DiagnosticFact</code>, que extrai apenas
              declarações puramente objetivas e verificáveis a partir da janela de -30s a +30s:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Exemplo de Fato:{' '}
                <em>"RPM decresceu 28.5% no momento do evento (de média 2.150 para 1.537 RPM)."</em>
              </li>
              <li>
                Exemplo de Fato:{' '}
                <em>"Posição da borboleta/pedal (TPS) no evento: 78% (acelerador exigido)."</em>
              </li>
              <li>
                Exemplo de Fato:{' '}
                <em>
                  "Ajuste de combustível a curto prazo (STFT) oscilou entre +12% e +24% (média:
                  +18.2%)."
                </em>
              </li>
              <li>
                Exemplo de Fato:{' '}
                <em>"Código de anomalia P0301 (ATIVO) estava presente na ECU (MIL: Aceso)."</em>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              4. Decisão Técnica de Exportação & PDF
            </h3>
            <p>A exportação foi desenvolvida em três formatos obrigatórios:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>JSON Técnico Completo:</strong> Estrutura autocontida incluindo metadados do
                veículo, sessão, DTCs e telemetria RAW integral.
              </li>
              <li>
                <strong>CSV da Telemetria:</strong> Arquivo tabular delimitado por ponto e vírgula
                com UTF-8 BOM, compatível diretamente com Excel e LibreOffice.
              </li>
              <li>
                <strong>Relatório PDF Legível:</strong> Implementado via composição visual
                especializada em CSS Print (@media print) de alta resolução, dispensando
                dependências binárias infladas e permitindo ao mecânico imprimir em impressora
                física ou acionar o diálogo nativo "Salvar como PDF" com diagramação profissional
                pronta para o cliente final.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              5. Transparência de Hardware Real
            </h3>
            <div className="bg-amber-950/40 border border-amber-800 p-3 rounded">
              <span className="font-bold text-amber-300">Classificação Obrigatória:</span>
              <p className="text-gray-300 mt-1">
                Todas as rotinas que interagem com o barramento físico ELM327 USB (Web Serial) e
                Bluetooth BLE (Web Bluetooth) permanecem categorizadas estritamente como:
                <br />
                <strong className="text-white">
                  "IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"
                </strong>
                . Não foram geradas evidências fictícias de testes físicos.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              6. Conclusão da Etapa 2 & Aguardo de Auditoria
            </h3>
            <p className="text-emerald-400 font-semibold">
              ✓ Todos os critérios da Definition of Done foram atendidos com êxito. Conforme
              instrução expressa da OS-ME001-E2, a Etapa 3 não foi iniciada automaticamente. O
              sistema aguarda auditoria e aprovação da Network Soluções.
            </p>
          </section>
        </div>
      )}

      {/* Aba 2: CHECKLIST DOS REQUISITOS */}
      {activeTab === 'checklist' && (
        <div className="space-y-3">
          {rfChecklistEtapa2.map((item) => (
            <div
              key={item.id}
              className="bg-[#131A22] border border-[#263340] rounded-lg p-4 space-y-2 hover:border-[#FFB300]/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="bg-[#0B0F14] text-[#FFB300] font-mono font-bold text-xs px-2 py-0.5 rounded border border-[#263340]">
                    {item.id}
                  </span>
                  <span className="font-bold text-white text-sm">{item.title}</span>
                </div>

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    item.status.includes('AGUARDANDO')
                      ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                      : 'bg-emerald-950/80 text-[#2ECC71] border border-emerald-700'
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Aba 3: ARQUITETURA & EVIDÊNCIAS IA */}
      {activeTab === 'arquitetura' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-6 text-xs text-gray-300 leading-relaxed max-w-4xl">
          <div className="border-b border-[#263340] pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-[#FFB300]" />
              <span>Arquitetura de Isolamento & Modelos de Dados (PocketBase)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0B0F14] p-4 rounded border border-[#263340] space-y-2">
              <span className="font-bold text-[#FFB300] uppercase text-xs block">
                Coleção: vehicles
              </span>
              <p className="text-gray-400">
                Cadastro genérico e reutilizável de veículos. Campos: plate, make, model, version,
                year_model, engine, fuel, transmission, odometer_km, vin, notes.
              </p>
            </div>

            <div className="bg-[#0B0F14] p-4 rounded border border-[#263340] space-y-2">
              <span className="font-bold text-[#FFB300] uppercase text-xs block">
                Coleção: obd_capabilities
              </span>
              <p className="text-gray-400">
                Assinatura de capacidades OBD detectadas no veículo: protocol_detected,
                adapter_type, pids_supported, pids_unavailable, vin_read, mil_initial_state,
                dtcs_present.
              </p>
            </div>

            <div className="bg-[#0B0F14] p-4 rounded border border-[#263340] space-y-2">
              <span className="font-bold text-[#FFB300] uppercase text-xs block">
                Coleção: diagnostic_evidences
              </span>
              <p className="text-gray-400">
                Pacotes congelados de caixa-preta e fatos observados objetivos. Relação com event e
                session. Imutável (sem updateRule nem deleteRule).
              </p>
            </div>

            <div className="bg-[#0B0F14] p-4 rounded border border-[#263340] space-y-2">
              <span className="font-bold text-[#2ECC71] uppercase text-xs block">
                Coleções Preservadas da Etapa 1
              </span>
              <p className="text-gray-400">
                sessions (ampliada com relação a vehicle), raw_samples (telemetria bruta imutável
                append-only), events e dtcs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aba 4: INSTRUÇÕES OPERACIONAIS */}
      {activeTab === 'instrucoes' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-5 text-xs text-gray-300 leading-relaxed max-w-4xl">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-[#FFB300]" />
            <span>Fluxo Principal do Mecânico em Teste de Rodagem</span>
          </h2>

          <div className="bg-[#0B0F14] p-4 rounded border border-[#263340] space-y-3">
            <div className="flex items-center space-x-2 font-mono text-sm text-[#FFB300] font-bold">
              <span>
                VEÍCULO → CONECTAR OBD → INICIAR TESTE → LIVE → MARCAR SINTOMA → ENCERRAR →
                CAIXA-PRETA
              </span>
            </div>

            <ol className="list-decimal pl-5 space-y-2 text-gray-300">
              <li>
                <strong>Veículo:</strong> Selecione o veículo na lista suspensa do Painel Live ou
                acesse a aba <em>Veículos</em> para cadastrar ou editar o perfil.
              </li>
              <li>
                <strong>Cenário do Simulador:</strong> Escolha um dos 7 cenários reproduzíveis
                (Normal, Perda de Potência, Oscilação, Trepidação/Falha P0301, Apagamento, DTC Ativo
                P0171, Perda de Comunicação).
              </li>
              <li>
                <strong>Conectar & Iniciar Teste:</strong> Clique em <em>INICIAR SIMULADOR</em> (ou
                Conectar Adaptador) e em seguida <em>INICIAR TESTE</em>.
              </li>
              <li>
                <strong>Monitoramento Live & Marcação:</strong> Acompanhe a telemetria ao vivo. Ao
                perceber a anomalia simulada ou real, clique no botão flutuante vermelho{' '}
                <em>MARCAR SINTOMA</em>.
              </li>
              <li>
                <strong>Múltiplos Sintomas:</strong> Marque quantos sintomas desejar durante a
                rodagem contínua.
              </li>
              <li>
                <strong>Encerramento & Análise:</strong> Clique em <em>ENCERRAR TESTE</em> e navegue
                até a aba <em>Replay</em> para abrir individualmente as caixas-pretas e exportar
                JSON/CSV/PDF.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* Aba 5: DADOS SEMEADOS */}
      {activeTab === 'evidencias' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-4 text-xs text-gray-300 max-w-4xl">
          <h2 className="text-base font-bold text-white flex items-center space-x-2">
            <Car className="w-5 h-5 text-[#FFB300]" />
            <span>Perfil Padrão de Validação Semeado no Banco</span>
          </h2>

          <div className="bg-[#0B0F14] p-4 rounded border border-[#263340] space-y-2 font-mono text-[11px]">
            <div className="text-[#FFB300] font-bold text-sm">
              Ford EcoSport 2020 — 1.5 Dragon — 3 cilindros
            </div>
            <div>Placa: BRA2E20</div>
            <div>Versão: Freestyle 1.5 AT</div>
            <div>Motor: 1.5 Ti-VCT Dragon 3C (137 cv) Flex</div>
            <div>VIN: 9BFBJ55E6L8104921</div>
            <div>Odômetro: 48.500 km</div>
            <div>
              Assinatura OBD: Protocolo ISO 15765-4 (CAN 11/500), 13 PIDs suportados, MIL inicial
              Apagado
            </div>
            <div className="text-gray-400 italic mt-2">
              Observação: Cadastrado como DADOS genéricos reutilizáveis, provando a ausência de
              hardcode veicular no código.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
