# Network Car — Diagnóstico 360 Live (Etapa 1)

MVP Funcional e Executável de Telemetria Veicular OBD-II (SAE J1979 / ISO 15031-5).

---

## 1. Visão Geral da Arquitetura

O sistema implementa uma arquitetura **offline-first desacoplada**:
- **Núcleo no Navegador:** Todo o ciclo de vida (transporte, parser, decodificação, agendamento de amostragem, gravação contínua, extração de caixa-preta, detecção de DTCs e replay) executa como módulos TypeScript puros no cliente.
- **Persistência Append-Only:** Banco PocketBase (Skip Cloud) operando com coleções estritamente append-only (`sessions`, `raw_samples`, `events`, `dtcs`). Nenhuma regra de UPDATE ou DELETE é permitida para amostras de telemetria ou eventos registrados.
- **Buffer Local e Resiliência:** Caso a conexão de internet oscile durante o teste de pista, as amostras brutas são mantidas em buffer de memória local e sincronizadas oportunisticamente assim que o backend estiver alcançável, sem qualquer perda de dados.

```
[ Adaptador Físico ELM327 ]        [ Simulador Veicular Temporal ]
         (Web Serial)                            (Física / Dinâmica)
               \                                        /
                \                                      /
                 ▼                                    ▼
             [ Interface Abstrata: OBDTransport ]
                                 │
                                 ▼
                     [ ElmProtocolParser ]
                                 │
                                 ▼
                 [ PidDecoder (Tabela Declarativa) ]
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
            [ SamplerScheduler ]      [ DtcService (03/07) ]
            (Frequências 5Hz/1Hz)
                     │
                     ▼
             [ RawRecorder ] ────► [ Buffer Local / PocketBase Append-Only ]
                     │
                     ▼
           [ Painel Live / Replay ] ◄──── [ EventMarker & WindowExtractor ]
```

---

## 2. PIDs Suportados e Tabela Declarativa

A decodificação de PIDs é declarativa e desacoplada em `src/lib/obd/pid-decoder.ts`:
1. **RPM (0x0C):** Modo 01, 2 bytes, fórmula `((A * 256) + B) / 4`, unidade RPM.
2. **Velocidade (0x0D):** Modo 01, 1 byte, fórmula `A`, unidade km/h.
3. **Temp. Líquido de Arrefecimento (0x05):** Modo 01, 1 byte, fórmula `A - 40`, unidade °C.
4. **Carga Calculada do Motor (0x04):** Modo 01, 1 byte, fórmula `(A * 100) / 255`, unidade %.
5. **Posição do Acelerador TPS (0x11):** Modo 01, 1 byte, fórmula `(A * 100) / 255`, unidade %.
6. **Fluxo de Massa de Ar MAF (0x10):** Modo 01, 2 bytes, fórmula `((A * 256) + B) / 100`, unidade g/s.
7. **Pressão Absoluta no Coletor MAP (0x0B):** Modo 01, 1 byte, fórmula `A`, unidade kPa.
8. **Tensão do Módulo de Controle (0x42):** Modo 01, 2 bytes, fórmula `((A * 256) + B) / 1000`, unidade V.
9. **STFT Ajuste Curto Prazo (0x06):** Modo 01, 1 byte, fórmula `(A - 128) * 100 / 128`, unidade %.
10. **LTFT Ajuste Longo Prazo (0x07):** Modo 01, 1 byte, fórmula `(A - 128) * 100 / 128`, unidade %.
11. **Avanço da Ignição (0x0E):** Modo 01, 1 byte, fórmula `(A / 2) - 64`, unidade °.
12. **Temp. do Ar de Admissão IAT (0x0F):** Modo 01, 1 byte, fórmula `A - 40`, unidade °C.
13. **Tempo em Funcionamento (0x1F):** Modo 01, 2 bytes, fórmula `(A * 256) + B`, unidade s.

---

## 3. Instruções de Conexão com Adaptador Real (Web Serial)

Status: **IMPLEMENTADA — AGUARDANDO VALIDAÇÃO EM HARDWARE REAL**

### Requisitos:
- Navegador **Google Chrome** ou **Microsoft Edge** (versão 89+ com suporte à Web Serial API).
- Adaptador **ELM327 USB** ou **ELM327 Bluetooth Serial** conectado ao computador.
- Chave de ignição do veículo ligada (ou motor em funcionamento).

### Passo a Passo:
1. Abra a aplicação e acesse a tela **Painel Live** (`/`).
2. No seletor de transporte, mude de `SIMULADOR` para `OBD REAL (ELM327)`.
3. Clique no botão **CONECTAR ADAPTADOR**.
4. O navegador exibirá a janela nativa de permissão: selecione a porta serial correspondente (ex.: `COM3`, `COM4` no Windows, ou `/dev/ttyUSB0` / `/dev/tty.usbserial` no Linux/macOS).
5. O sistema enviará automaticamente a sequência de inicialização padrão:
   - `ATZ` (Reset)
   - `ATE0` (Desliga eco)
   - `ATL0` (Desliga linefeed)
   - `ATH0` (Desliga cabeçalhos adicionais)
   - `ATS0` (Ajusta espaços)
   - `ATSP0` (Configura protocolo para detecção automática)
6. Uma vez com status `CONECTADO`, clique em **INICIAR TESTE** para iniciar a descoberta de PIDs e a coleta contínua.

---

## 4. Tradeoffs Técnicos & Limitações Conhecidas

- **Offline-First:** O app pode realizar o teste em túneis ou zonas sem cobertura 4G/5G; as amostras são bufferizadas e gravadas assim que a rede restabelecer contato com o Skip Cloud.
- **Limitação de Hardware Real:** Não foi validado em veículo físico nesta entrega (status explícito "AGUARDANDO VALIDAÇÃO EM HARDWARE REAL").
- **Segurança Operacional:** O comando destrutivo de limpeza de DTCs (Modo 04) foi intencionalmente omitido para evitar ocultação de falhas antes da análise pericial da oficina.

---

## 5. Credenciais de Demonstração

- **Usuário Seed:** `danilorickes@gmail.com`
- **Senha:** `Skip@Pass`
- Sessão de teste pré-semeada disponível na aba **Sessões** e no **Replay**.
