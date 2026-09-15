import { ConfirmationProtocol } from '@/types/diagnostic'

/**
 * ConfirmationProtocols: Biblioteca de protocolos de testes técnicos reprodutíveis.
 * REGRA FUNDAMENTAL:
 * - Priorizar "testar antes de substituir peça".
 * - O sistema NÃO recomenda substituição de componente exclusivamente com base em um DTC.
 * - Nenhum comando destrutivo na ECU; Mode 04 / Limpeza de DTC permanece terminantemente proibido.
 */
export const CONFIRMATION_PROTOCOLS: Record<
  string,
  (details?: { targetComponent?: string; dtc?: string }) => ConfirmationProtocol
> = {
  MISFIRE_CYLINDER: (details) => ({
    protocolId: 'prot_misfire_cyl',
    targetHypothesisId: 'hyp_misfire_cyl1',
    title: 'Protocolo de Investigação de Falha de Combustão / Misfire',
    objective:
      'Isolar se a causa raiz reside na ignição secundária (vela/bobina), injeção (bico travado/sujo) ou estanqueidade mecânica (compressão), sem troca indiscriminada de peças.',
    estimatedDurationMin: 35,
    destructiveAlert:
      'PROIBIDO: Não limpar DTCs nem acionar atuadores sem antes registrar a telemetria do teste cruzado.',
    steps: [
      {
        stepNumber: 1,
        title: 'Inspeção Visual e Conexão de Chicote',
        action:
          'Inspecionar o conector e chicote da bobina/vela do cilindro suspeito. Verificar se há óleo na cavidade da vela ou zinabre nos pinos.',
        toolsNeeded: ['Lanterna automotiva', 'Limpa-contatos elétrico'],
        targetComponent: details?.targetComponent || 'Chicote e bobina cil 1',
        expectedOutcomeNormal: 'Conectores travados firmes, sem oxidação ou óleo na vela.',
        expectedOutcomeFaulty:
          'Trava plástica quebrada, fiação esgarçada ou poça de óleo de tampa de válvula.',
        priority: 'ALTA',
      },
      {
        stepNumber: 2,
        title: 'Teste de Troca Cruzada (Cross-Swap) de Bobinas',
        action:
          'Inverter a bobina do cilindro 1 com a do cilindro 2 (ou 4). Repetir o teste de rodagem/leitura de falhas para verificar se o misfire migra para o cilindro vizinho.',
        toolsNeeded: ['Chave Torx/Catraca para remoção da bobina', 'Scanner Network Car 360'],
        targetComponent: 'Bobina de ignição individual',
        expectedOutcomeNormal:
          'Falha permanece no cil 1 → Bobina está boa; causa é vela, bico ou mecânica.',
        expectedOutcomeFaulty:
          'Falha migra para o cil 2 → Bobina defeituosa comprovada por teste cruzado.',
        priority: 'ALTA',
      },
      {
        stepNumber: 3,
        title: 'Inspeção do Eletrodo da Vela de Ignição',
        action:
          'Remover a vela do cilindro sob suspeita. Avaliar coloração (carbonização úmida, fuligem preta ou queima clara) e medir a folga dos eletrodos com calibre de lâminas.',
        toolsNeeded: ['Chave de vela articulada com imã', 'Calibre de folga de lâminas'],
        targetComponent: 'Vela de ignição',
        expectedOutcomeNormal:
          'Eletrodo central sem desgaste, folga entre 0.8mm e 1.0mm conforme montadora.',
        expectedOutcomeFaulty:
          'Eletrodo desgastado, porcelana trincada ou folga excessiva acima de 1.3mm.',
        priority: 'ALTA',
      },
      {
        stepNumber: 4,
        title: 'Medição da Resistência e Pulsagem do Eletroinjetor',
        action:
          'Com multímetro na escala de Ohms, medir a resistência da bobina do injetor correspondente (12-16 Ω em alta impedância). Utilizar caneta de polaridade/osciloscópio para atestar pulso negativo da ECU.',
        toolsNeeded: ['Multímetro automotivo', 'Caneta de polaridade de 12V'],
        targetComponent: 'Eletroinjetor de combustível',
        expectedOutcomeNormal: 'Resistência idêntica entre os 4 bicos (±0.3 Ω) e pulsagem nítida.',
        expectedOutcomeFaulty: 'Circuito aberto (resistor rompido) ou falta de pulso da ECU.',
        priority: 'MEDIA',
      },
      {
        stepNumber: 5,
        title: 'Teste de Compressão Relativa e Estanqueidade de Cilindros',
        action:
          'Realizar teste de compressão em manômetro mecânico ou teste de queda de tensão de partida com osciloscópio para descartar válvula presa, mola quebrada ou junta queimada.',
        toolsNeeded: ['Manômetro de compressão de motor com adaptador de rosca de vela'],
        targetComponent: 'Compressão do cilindro',
        expectedOutcomeNormal:
          'Compressão acima de 150 PSI em todos os cilindros, com variação menor que 10%.',
        expectedOutcomeFaulty:
          'Cilindro com compressão abaixo de 100 PSI indica falha mecânica interna.',
        priority: 'MEDIA',
      },
    ],
  }),

  LEAN_MIXTURE: (details) => ({
    protocolId: 'prot_lean_mixture',
    targetHypothesisId: 'hyp_lean_mixture_bank1',
    title: 'Protocolo de Investigação de Mistura Pobre (Excesso de Ar / Baixa Alimentação)',
    objective:
      'Confirmar se a mistura pobre (STFT/LTFT alto) é causada por entrada falsa de ar (vácuo), pressão insuficiente da bomba de combustível ou leitura adulterada do MAF/MAP, antes de trocar sensores de oxigênio.',
    estimatedDurationMin: 30,
    destructiveAlert:
      'Atenção: Não trocar a Sonda Lambda apenas pelo código P0171; na maioria dos casos a sonda está cumprindo seu papel e acusando ar excedente.',
    steps: [
      {
        stepNumber: 1,
        title: 'Varredura de Entrada Falsa de Ar com Máquina de Fumaça (Smoke Test)',
        action:
          'Injetar fumaça de teste na admissão após o corpo de borboleta. Inspecionar mangueiras de respiro do cárter (PCV), mangueira do hidrovácuo, cânister e juntas do coletor.',
        toolsNeeded: ['Máquina de fumaça automotiva (Smoke Machine) ou spray localizador de vácuo'],
        targetComponent: 'Tubulações de vácuo e coletor de admissão',
        expectedOutcomeNormal: 'Nenhum vazamento visível no circuito de admissão.',
        expectedOutcomeFaulty: 'Fumaça escapando pela junta do coletor ou mangueira fissurada.',
        priority: 'ALTA',
      },
      {
        stepNumber: 2,
        title: 'Aferição da Pressão e Vazão da Linha de Combustível',
        action:
          'Instalar manômetro na linha de combustível (flauta/bocal de engate rápido). Medir a pressão em marcha lenta e acelerando bruscamente para atestar regulador e filtro.',
        toolsNeeded: ['Manômetro de combustível com engates padrão e válvula de alívio'],
        targetComponent: 'Bomba de combustível e filtro',
        expectedOutcomeNormal:
          'Pressão estável entre 3.8 e 4.2 bar mesmo durante aceleração plena.',
        expectedOutcomeFaulty:
          'Pressão cai para menos de 3.0 bar ao acelerar (bomba cansada ou filtro obstruído).',
        priority: 'ALTA',
      },
      {
        stepNumber: 3,
        title: 'Verificação da Válvula de Purga do Cânister',
        action:
          'Desconectar e estancar temporariamente a entrada do cânister no coletor. Se o STFT normalizar instantaneamente, a válvula está travada aberta admitindo vapores sem controle.',
        toolsNeeded: ['Alicate de mangueira', 'Tampão de vácuo'],
        targetComponent: 'Válvula de purga do cânister (EVAP)',
        expectedOutcomeNormal: 'STFT permanece estável com ou sem mangueira isolada.',
        expectedOutcomeFaulty: 'STFT despenca de +22% para próximo de 0% com a purga isolada.',
        priority: 'MEDIA',
      },
    ],
  }),

  POWER_LOSS: () => ({
    protocolId: 'prot_power_loss',
    targetHypothesisId: 'hyp_power_loss_restriction',
    title: 'Protocolo de Investigação de Perda de Potência e Queda de Carga Sob Demanda',
    objective:
      'Verificar restrição de fluxo de admissão/escape (catalisador entupido), comando de borboleta e alimentação sem resposta sob alta exigência.',
    estimatedDurationMin: 40,
    destructiveAlert:
      'Atenção: Testes dinâmicos de alta carga devem ser conduzidos com veículo em condições seguras ou dinamômetro.',
    steps: [
      {
        stepNumber: 1,
        title: 'Aferição de Contrapressão no Escapamento (Catalisador Obstruído)',
        action:
          'Instalar manômetro de contrapressão no orifício da Sonda Lambda pré-catalisador. Acelerar o motor até 2.500 RPM.',
        toolsNeeded: ['Manômetro de contrapressão de escapamento automotivo'],
        targetComponent: 'Catalisador e tubulação de escape',
        expectedOutcomeNormal: 'Contrapressão abaixo de 0.15 bar (2.0 PSI) em 2.500 RPM.',
        expectedOutcomeFaulty:
          'Contrapressão superior a 0.35 bar (5.0 PSI) indica colapso/entupimento cerâmico.',
        priority: 'ALTA',
      },
      {
        stepNumber: 2,
        title: 'Teste de Resposta Angular do Corpo de Borboleta (TBI)',
        action:
          'Monitorar pista dupla do sensor de posição de borboleta (TPS 1 e TPS 2). Checar se há degrau ou travamento mecânico por carbonização na giclagem.',
        toolsNeeded: ['Scanner OBD Network Car 360 ou multímetro analógico'],
        targetComponent: 'Corpo de borboleta eletrônica (TBI)',
        expectedOutcomeNormal: 'Variação linear sem atraso ou degrau de 0% a 100%.',
        expectedOutcomeFaulty: 'Borboleta trava ou apresenta discrepância entre as pistas.',
        priority: 'ALTA',
      },
    ],
  }),

  ELECTRICAL_STABILITY: () => ({
    protocolId: 'prot_electrical_drop',
    targetHypothesisId: 'hyp_electrical_undervoltage',
    title: 'Protocolo de Investigação de Subtensão e Queda de Carga Elétrica',
    objective:
      'Identificar queda de tensão sob carga no alternador, aterramentos defeituosos ou fuga de corrente que induzem anomalias fantasmas em múltiplos sensores.',
    estimatedDurationMin: 20,
    destructiveAlert:
      'Cuidado: Desconexões de bateria com chave ligada podem corromper memórias não-voláteis de ECUs.',
    steps: [
      {
        stepNumber: 1,
        title: 'Teste de Queda de Tensão no Circuito de Aterramento (Ground Voltage Drop)',
        action:
          'Com motor ligado e todos os consumidores acionados (faróis, ar condicionado, desembaçador), medir com multímetro DC a diferença de potencial entre o borne negativo da bateria e a carcaça do motor/bloco.',
        toolsNeeded: ['Multímetro digital automotivo (True RMS)'],
        targetComponent: 'Malha de aterramento bloco/chassi',
        expectedOutcomeNormal: 'Queda de tensão menor que 0.10 V (100 mV).',
        expectedOutcomeFaulty:
          'Queda de tensão acima de 0.30 V indica cabo de terra frouxo, oxidado ou rompido.',
        priority: 'ALTA',
      },
      {
        stepNumber: 2,
        title: 'Teste do Regulador do Alternador e Ripple AC',
        action:
          'Medir tensão nos bornes da bateria em marcha lenta e em 2.500 RPM (esperado 13.8V a 14.5V). Na escala AC, verificar o ripple residual de retificação.',
        toolsNeeded: ['Multímetro na escala de AC Millivolts'],
        targetComponent: 'Alternador e placa de diodos',
        expectedOutcomeNormal: 'Tensão entre 13.8V e 14.4V com ripple AC menor que 0.05 V (50 mV).',
        expectedOutcomeFaulty:
          'Tensão inferior a 12.5V ou ripple AC acima de 0.3 V (diodo queimado).',
        priority: 'ALTA',
      },
    ],
  }),

  COMMUNICATION_RESILIENCE: () => ({
    protocolId: 'prot_comm_resilience',
    targetHypothesisId: 'hyp_comm_loss',
    title: 'Protocolo de Investigação de Perda de Comunicação e Timeouts no Barramento',
    objective:
      'Isolar se a perda de sinal ocorre no conector OBD físico (pinos frouxos), interferência de transientes eletromagnéticos ou mau contato no adaptador.',
    estimatedDurationMin: 15,
    destructiveAlert:
      'Atenção: Não forçar pontas de prova grossas nos pinos fêmea do conector OBD-II do veículo.',
    steps: [
      {
        stepNumber: 1,
        title: 'Inspeção de Retenção dos Pinos do Conector OBD-II (DLC)',
        action:
          'Testar tensão dos pinos 4 e 5 (terras) e pino 16 (12V permanente) com multímetro. Verificar se os pinos CAN High (6) e CAN Low (14) possuem resistência de terminação de ~60 Ω com bateria desligada.',
        toolsNeeded: ['Multímetro e breakout box OBD-II'],
        targetComponent: 'Conector de diagnóstico do veículo (DLC)',
        expectedOutcomeNormal:
          '12V estável no pino 16, continuidade sólida no pino 4/5 e 60 Ω no barramento CAN.',
        expectedOutcomeFaulty: 'Intermitência ao mexer no conector ou pinos recuados.',
        priority: 'ALTA',
      },
    ],
  }),

  SYSTEM_NORMAL: () => ({
    protocolId: 'prot_system_normal',
    targetHypothesisId: 'hyp_no_fault',
    title: 'Protocolo de Monitoramento Preventivo (Sistema em Conformidade)',
    objective:
      'Manter histórico preventivo de parâmetros e comparar telemetria em próximas sessões de rodagem periódica.',
    estimatedDurationMin: 10,
    destructiveAlert:
      'Nenhuma ação corretiva necessária. Veículo operando dentro de todos os parâmetros nominais.',
    steps: [
      {
        stepNumber: 1,
        title: 'Validação da Memória de Adaptação de Longo Prazo (LTFT)',
        action: 'Conferir se o LTFT se mantém dentro da faixa estreita de ±5% após condução mista.',
        toolsNeeded: ['Scanner OBD Network Car 360'],
        targetComponent: 'Parâmetros de autoadaptação da ECU',
        expectedOutcomeNormal: 'LTFT estável e ausência de códigos pendentes no Modo 07.',
        expectedOutcomeFaulty: 'Deriva contínua superior a 8%.',
        priority: 'BAIXA',
      },
    ],
  }),
}
