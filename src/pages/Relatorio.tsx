import React, { useState } from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Cpu,
  HardDrive,
  Terminal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Relatorio() {
  const [activeTab, setActiveTab] = useState<
    'checklist' | 'relatorio' | 'instrucoes' | 'evidencias'
  >('checklist')

  const rfChecklist = [
    {
      id: 'RF01',
      title: 'Conexão e Inicialização OBD-II',
      status: 'IMPLEMENTADO — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL (Real) / VALIDADO (Simulado)',
      desc: 'Transporte abstrato OBDTransport com RealSerialTransport (Web Serial API para ELM327 com sequência ATZ, ATE0, ATL0, ATH0, ATS0, ATSP0) e SimulatedTransport. Reconexão automática resiliente.',
      verified: true,
    },
    {
      id: 'RF02',
      title: 'Descoberta de PIDs Suportados',
      status: 'VALIDADO',
      desc: 'Consulta PIDs 00, 20, 40 via Modo 01, decodifica bitmaps de 32 bits e persiste a lista de PIDs suportados na sessão.',
      verified: true,
    },
    {
      id: 'RF03',
      title: 'Telemetria Contínua (13 PIDs) e Frequência Efetiva',
      status: 'VALIDADO',
      desc: 'Coleta de RPM (0x0C), velocidade (0x0D), temp. arrefecimento (0x05), carga (0x04), TPS (0x11), MAF (0x10), MAP (0x0B), tensão (0x42), STFT (0x06), LTFT (0x07), avanço (0x0E), temp. ar (0x0F) e tempo motor (0x1F). Frequência efetiva calculada e exibida em tempo real.',
      verified: true,
    },
    {
      id: 'RF04',
      title: 'Gerenciamento de Sessão de Teste',
      status: 'VALIDADO',
      desc: 'Ciclo completo: INICIAR TESTE → TESTE EM ANDAMENTO → ENCERRAR TESTE. session_id único, metadados de veículo (Ford EcoSport 2020 1.5 Dragon como metadado injetado, sem hardcode), horários UTC e relógio monotônico.',
      verified: true,
    },
    {
      id: 'RF05',
      title: 'Marcar Sintoma em Pista',
      status: 'VALIDADO',
      desc: 'Botão destacado flutuante "MARCAR SINTOMA". 7 tipos normalizados: falha, trepidação, perda de potência, ruído, oscilação, apagamento, outro/livre. Registro duplo de timestamp (monotônico e UTC ISO-8601).',
      verified: true,
    },
    {
      id: 'RF06',
      title: 'Caixa-Preta (Janela ±30s Imutável)',
      status: 'VALIDADO',
      desc: 'WindowExtractor isola janela de 30s anteriores + instante do sintoma + 30s posteriores sobre projeção de leitura. A telemetria bruta original NUNCA é removida ou modificada.',
      verified: true,
    },
    {
      id: 'RF07',
      title: 'Diagnóstico de Códigos de Falha (DTC / MIL)',
      status: 'VALIDADO',
      desc: 'Leitura de DTCs Modo 03 (ativos), Modo 07 (pendentes) e indicador MIL (01 01). Proibição estrita de Modo 04 (sem limpeza de falhas).',
      verified: true,
    },
    {
      id: 'RF08',
      title: 'Painel Live Operacional Automotivo',
      status: 'VALIDADO',
      desc: 'Identidade dark automotiva (#0B0F14 / #131A22), numerais grandes tabular-nums, sparklines em tempo real, estados de qualidade (OK, TIMEOUT, UNSUPPORTED = N/D, INVALID, NO_RESPONSE). Falhas de comunicação não geram valor zero.',
      verified: true,
    },
    {
      id: 'RF09',
      title: 'Simulador Veicular Temporal Plausível',
      status: 'VALIDADO',
      desc: 'Simulador não estático com dinâmica física (marcha lenta, aceleração, cruzeiro, desaceleração, anomalia com misfire e oscilação de STFT). Permite testar todo o MVP sem carro físico.',
      verified: true,
    },
    {
      id: 'RF10',
      title: 'Replay de Sessão no Mesmo Modelo do Live',
      status: 'VALIDADO',
      desc: 'Motor de replay que consome os dados persistidos alimentando os mesmos componentes de medidores e mini gráfico do Live, com velocidades 1x, 2x, 5x, 10x, scrubber e detecção de sintomas marcados.',
      verified: true,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#263340]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-[#FFB300]" />
            <span>Relatório Técnico de Entrega & Evidências</span>
          </h1>
          <p className="text-xs text-[#9AA7B4]">
            MISSÃO ME001-E1 — Network Car — Diagnóstico 360 Live — Etapa 1
          </p>
        </div>

        {/* Tab Selector */}
        <div className="inline-flex rounded-md p-1 bg-[#131A22] border border-[#263340]">
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
              activeTab === 'checklist'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Checklist RF01–RF10
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('relatorio')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
              activeTab === 'relatorio'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Relatório Técnico Completo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('instrucoes')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
              activeTab === 'instrucoes'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Instruções Web Serial & Execução
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidencias')}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
              activeTab === 'evidencias'
                ? 'bg-[#FFB300] text-black shadow'
                : 'text-[#9AA7B4] hover:text-white'
            }`}
          >
            Evidências & Dados Semeados
          </button>
        </div>
      </div>

      {/* Conteúdo Aba Checklist */}
      {activeTab === 'checklist' && (
        <div className="space-y-4">
          <div className="bg-[#131A22] border border-[#263340] rounded-lg p-4">
            <h2 className="text-sm font-bold text-white mb-1">
              Matriz de Rastreabilidade dos Requisitos Funcionais (RF01 a RF10)
            </h2>
            <p className="text-xs text-[#9AA7B4]">
              Conformidade total com a Ordem de Serviço ME001-E1 da Network Car.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {rfChecklist.map((item) => (
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
        </div>
      )}

      {/* Conteúdo Aba Relatório Técnico */}
      {activeTab === 'relatorio' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-6 text-xs text-gray-300 leading-relaxed max-w-4xl">
          <div className="border-b border-[#263340] pb-4">
            <span className="text-[10px] uppercase tracking-wider text-[#FFB300] font-mono font-bold">
              DOCUMENTO TÉCNICO OFICIAL DE ENTREGA
            </span>
            <h2 className="text-lg font-bold text-white mt-1">RELATÓRIO — ME001-E1 — THEO</h2>
            <p className="text-[#9AA7B4]">
              Sistema de Telemetria e Diagnóstico 360 Live para Oficinas Mecânicas de Alta Precisão
            </p>
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              1. Resumo Executivo
            </h3>
            <p>
              O presente projeto entrega a Etapa 1 do produto{' '}
              <strong>Network Car — Diagnóstico 360 Live</strong>, implementando um MVP plenamente
              executável de coleta, monitoramento em tempo real, gravação contínua e análise
              retrospectiva ("caixa-preta") de telemetria automotiva padrão OBD-II (SAE J1979 / ISO
              15031-5).
            </p>
            <p>
              O sistema foi construído com arquitetura offline-first no navegador: todo o pipeline
              de aquisição, decodificação de PIDs, controle de amostragem por relógio monotônico e
              extração de janelas opera diretamente no cliente, utilizando o banco PocketBase (Skip
              Cloud) como repositório persistente estritamente <strong>append-only</strong>.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              2. Stack Tecnológica e Justificativas
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>React 18 + Vite + TypeScript:</strong> Tipagem estrita para segurança de
                conversões binárias e manipulação de barramento.
              </li>
              <li>
                <strong>Tailwind CSS (Automotive Dark System):</strong> Identidade operacional de
                oficina com alto contraste, fontes com dígitos tabulares e feedback visual
                instantâneo.
              </li>
              <li>
                <strong>Web Serial API:</strong> Comunicação nativa e direta com adaptadores ELM327
                USB e Bluetooth Serial sem necessidade de drivers ou servidores intermediários
                pesados.
              </li>
              <li>
                <strong>PocketBase / Skip Cloud:</strong> SQLite embutido com regras de segurança no
                nível de registro (RLS), garantindo a imutabilidade da telemetria bruta.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              3. Arquitetura e Desacoplamento do Núcleo
            </h3>
            <p>
              O núcleo da aplicação consome apenas interfaces e contratos abstratos. Nenhuma regra
              de veículo é fixada em código (hardcoded):
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <code>OBDTransport</code>: Interface padronizada que permite alternância instantânea
                entre <code>SimulatedTransport</code> e <code>RealSerialTransport</code> sem alterar
                uma única linha do scheduler ou do recorder.
              </li>
              <li>
                <code>PidDecoder</code>: Tabela declarativa mapeando PID → bytes → fórmula
                matemática → unidade física → limites técnicos.
              </li>
              <li>
                <code>WindowExtractor</code>: Módulo isolado que extrai janelas de 30s pré-evento e
                30s pós-evento operando sobre projeções de leitura, garantindo que a telemetria
                original nunca seja alterada.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              4. Status de Validação de Hardware Real
            </h3>
            <div className="bg-amber-950/40 border border-amber-800 p-3 rounded">
              <p className="font-semibold text-amber-300">
                Aviso de Transparência e Rigor Técnico:
              </p>
              <p className="text-gray-300 mt-1">
                A camada de comunicação serial com adaptador físico foi integralmente implementada
                conforme a especificação oficial do chip ELM327 (comandos <code>ATZ</code>,{' '}
                <code>ATE0</code>, <code>ATL0</code>,<code>ATH0</code>, <code>ATS0</code>,{' '}
                <code>ATSP0</code>). Conforme exigência inegociável da OS, esta funcionalidade é
                catalogada explicitamente como:
                <br />
                <strong className="text-white">
                  "IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL"
                </strong>
                . Nenhuma evidência simulada foi forjada como sendo de hardware real.
              </p>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[#FFB300]">
              5. Recomendações Técnicas para a Etapa 2
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Validação em bancada e pista com adaptadores ELM327 genuínos (PIC18F25K80) e
                STN1110/STN2120.
              </li>
              <li>
                Implementação de buffers de transmissão CAN de alta velocidade (250/500 kbps) via
                WebAssembly.
              </li>
              <li>
                Adição de gráficos de dispersão comparativa entre STFT e LTFT para análise rápida de
                sonda lambda.
              </li>
            </ul>
          </section>
        </div>
      )}

      {/* Conteúdo Aba Evidências & Dados Semeados */}
      {activeTab === 'evidencias' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-6 text-xs text-gray-300 leading-relaxed max-w-4xl">
          <div className="border-b border-[#263340] pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <HardDrive className="w-5 h-5 text-[#FFB300]" />
              <span>Evidências de Persistência & Amostra Semeada (PocketBase)</span>
            </h2>
            <p className="text-[#9AA7B4] text-xs">
              Sessão de exemplo, evento de sintoma, código DTC e amostras brutas persistidas de
              forma idempotente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#0B0F14] border border-[#263340] p-4 rounded-lg space-y-2">
              <h3 className="font-bold text-[#FFB300] uppercase text-xs">
                Sessão Semeada no Banco
              </h3>
              <ul className="space-y-1 font-mono text-[11px] text-gray-300">
                <li>
                  <strong className="text-white">ID:</strong> sess_ecosport_seed_001
                </li>
                <li>
                  <strong className="text-white">Veículo:</strong> Ford EcoSport 2020 1.5 Dragon 3C
                </li>
                <li>
                  <strong className="text-white">VIN:</strong> 9BFBJ55E6L8104921
                </li>
                <li>
                  <strong className="text-white">Protocolo:</strong> ISO 15765-4 (CAN 11/500)
                </li>
                <li>
                  <strong className="text-white">Status:</strong> ENCERRADO
                </li>
                <li>
                  <strong className="text-white">Transporte:</strong> SIMULADOR
                </li>
              </ul>
            </div>

            <div className="bg-[#0B0F14] border border-[#263340] p-4 rounded-lg space-y-2">
              <h3 className="font-bold text-[#E53935] uppercase text-xs">
                Sintoma Registrado (Caixa-Preta)
              </h3>
              <ul className="space-y-1 font-mono text-[11px] text-gray-300">
                <li>
                  <strong className="text-white">Evento ID:</strong> ev_seed_001
                </li>
                <li>
                  <strong className="text-white">Tipo:</strong> trepidação
                </li>
                <li>
                  <strong className="text-white">Descrição:</strong> Trepidação perceptível na
                  transição para 2ª marcha com oscilação na marcha lenta
                </li>
                <li>
                  <strong className="text-white">Janela:</strong> -30.000 ms a +30.000 ms
                </li>
                <li>
                  <strong className="text-white">DTC Vinculado:</strong> P0301 (Cilindro 1 com Falha
                  de Combustão)
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-[#0B0F14] border border-[#263340] p-4 rounded-lg space-y-3">
            <h3 className="font-bold text-[#2ECC71] uppercase text-xs">
              Estrutura de Arquivos da Solução
            </h3>
            <div className="font-mono text-[11px] text-gray-400 bg-[#131A22] p-3 rounded border border-[#263340] overflow-x-auto space-y-1">
              <div>src/lib/obd/transports/obd-transport.ts (Interface abstrata de transporte)</div>
              <div>
                src/lib/obd/transports/simulated-transport.ts (Simulador temporal dinâmico com ciclo
                físico)
              </div>
              <div>
                src/lib/obd/transports/real-serial-transport.ts (Web Serial API para ELM327 real)
              </div>
              <div>
                src/lib/obd/elm-parser.ts (Parser robusto de respostas ELM327 e códigos DTC)
              </div>
              <div>
                src/lib/obd/pid-decoder.ts (Tabela declarativa e extensível dos 13 PIDs OBD-II)
              </div>
              <div>
                src/lib/obd/sampler-scheduler.ts (Agendador de amostragem por relógio monotônico
                ≥5Hz / ≥1Hz)
              </div>
              <div>
                src/lib/obd/raw-recorder.ts (Gravação imutável append-only com buffer local)
              </div>
              <div>
                src/lib/obd/event-marker.ts (Marcação de sintomas com relógio monotônico e ISO-8601)
              </div>
              <div>
                src/lib/obd/dtc-service.ts (Diagnóstico passivo de DTCs Modo 03/07 e MIL sem Modo
                04)
              </div>
              <div>
                src/lib/obd/replay-engine.ts (Motor de replay determinístico pelo mesmo modelo do
                Live)
              </div>
              <div>
                pocketbase/migrations/ (Migrations 0001, 0002 e 0003 com coleções imutáveis e seeds)
              </div>
              <div>RELATORIO-ME001-E1-THEO.md (Documento formal oficial de entrega técnica)</div>
            </div>
          </div>
        </div>
      )}

      {/* Conteúdo Aba Instruções de Execução */}
      {activeTab === 'instrucoes' && (
        <div className="bg-[#131A22] border border-[#263340] rounded-lg p-6 space-y-5 text-xs text-gray-300 leading-relaxed max-w-4xl">
          <div className="border-b border-[#263340] pb-3">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <Terminal className="w-5 h-5 text-[#FFB300]" />
              <span>Instruções de Operação e Conexão em Hardware Real</span>
            </h2>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-[#FFB300]">
              1. Executando o Sistema em Modo Simulador (Sem Carro)
            </h3>
            <p>
              O simulador temporal dinâmico vem ativado por padrão. Ele reproduz acelerações,
              marchas lentas, cruzeiro e anomalias de injeção em tempo real:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Acesse o <strong>Painel Live</strong> (<code>/</code>).
              </li>
              <li>
                Clique no botão <strong>INICIAR SIMULADOR</strong> no topo.
              </li>
              <li>
                Clique em <strong>INICIAR TESTE</strong>. O painel começará a receber telemetria
                contínua a ≥5 Hz.
              </li>
              <li>
                Durante o teste, clique no botão vermelho <strong>MARCAR SINTOMA</strong> no canto
                inferior para simular a marcação de anomalia na pista.
              </li>
              <li>
                Ao encerrar o teste, acesse a aba <strong>Sessões</strong> para verificar o
                armazenamento ou <strong>Replay</strong> para reproduzir a gravação.
              </li>
            </ol>
          </div>

          <div className="space-y-3 pt-3 border-t border-[#263340]">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider text-purple-400">
              2. Conectando Adaptador ELM327 Físico (Web Serial)
            </h3>
            <p>Para validar o funcionamento em veículo real:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>
                Utilize o navegador <strong>Google Chrome</strong> ou{' '}
                <strong>Microsoft Edge</strong> (com suporte à Web Serial API).
              </li>
              <li>
                Conecte o adaptador ELM327 na porta OBD-II do veículo e ligue a ignição do carro.
              </li>
              <li>
                No computador, conecte o cabo USB do adaptador ou emparelhe o dispositivo Bluetooth
                Serial.
              </li>
              <li>
                No Painel Live do sistema, selecione a opção <strong>OBD REAL (ELM327)</strong>.
              </li>
              <li>
                Clique em <strong>CONECTAR ADAPTADOR</strong>. O navegador abrirá o diálogo nativo
                para seleção da porta COM/USB correspondente.
              </li>
              <li>
                Após a conexão, o sistema executará a inicialização dos comandos AT automaticamente.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
