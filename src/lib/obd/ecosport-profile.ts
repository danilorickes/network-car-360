import { EcoSportHomologationProfile } from '@/types/etapa6'

export const ECOSPORT_2020_HOMOLOGATION_PROFILE: EcoSportHomologationProfile = {
  profileId: 'ECOSPORT_2020_15_DRAGON',
  vehicleName: 'Ford EcoSport 2020 — 1.5 Dragon Flex',
  engineType: '1.5 Ti-VCT Dragon 3 Cilindros',
  protocolExpected: 'ISO 15765-4 (CAN 11/500)',
  steps: [
    {
      id: 'step_1_off',
      title: '1. Motor Desligado / Ignição Desligada',
      description:
        'Conectar adaptador na tomada OBD sob a coluna de direção. Verificar alimentação.',
      targetState: 'Alimentação +12V detectada no pino 16 da tomada OBD.',
      expectedRpmRange: [0, 0],
      validationCriteria:
        'Comunicação sem erro com o adaptador; RPM = 0; Tensão de bateria entre 12.0 e 12.8V.',
      status: 'PENDENTE',
    },
    {
      id: 'step_2_ignition',
      title: '2. Ignição Ligada / Motor Desligado (Modo KOEO)',
      description:
        'Girar chave para posição II ou pressionar botão Start sem pisar na embreagem/freio.',
      targetState: 'ECU PCM responde a comandos OBD.',
      expectedRpmRange: [0, 0],
      validationCriteria:
        'Descoberta de protocolo CAN 11/500 kbps, leitura de VIN 9BF... e varredura de PIDs Modo 01.',
      status: 'PENDENTE',
    },
    {
      id: 'step_3_crank',
      title: '3. Partida e Motor Ligado',
      description: 'Dar a partida no motor 1.5 Dragon de 3 cilindros.',
      targetState: 'RPM sobe rapidamente e estabiliza acima de 600.',
      expectedRpmRange: [800, 1400],
      validationCriteria:
        'Sem perda de conexão OBD durante a queda de tensão momentânea do motor de arranque.',
      status: 'PENDENTE',
    },
    {
      id: 'step_4_cold_idle',
      title: '4. Marcha Lenta Fria',
      description: 'Manter em ponto morto com motor frio (ECT < 70 °C).',
      targetState: 'Aquecimento rápido do catalisador.',
      expectedRpmRange: [1000, 1350],
      expectedTempRange: [20, 69],
      validationCriteria: 'STFT compensando enriquecimento inicial; taxa de amostragem >= 5 Hz.',
      status: 'PENDENTE',
    },
    {
      id: 'step_5_warm_idle',
      title: '5. Marcha Lenta Quente',
      description: 'Aguardar termostato abrir e temperatura estabilizar (ECT >= 85 °C).',
      targetState: 'Marcha lenta estabilizada característica do 3 cilindros.',
      expectedRpmRange: [720, 880],
      expectedTempRange: [85, 96],
      validationCriteria:
        'STFT oscilando entre -8% e +8%; MAP entre 32 e 42 kPa; RPM estável com oscilação normal < 50 RPM.',
      status: 'PENDENTE',
    },
    {
      id: 'step_6_light_accel',
      title: '6. Aceleração Leve Estática',
      description:
        'Elevar a rotação para 2.000 - 2.500 RPM suavemente por 15 segundos em ponto morto.',
      targetState: 'Resposta proporcional do sensor TPS e avanço de ignição.',
      expectedRpmRange: [2000, 2600],
      validationCriteria: 'TPS e RPM subindo sincronizados; sem falha de combustão (misfire).',
      status: 'PENDENTE',
    },
    {
      id: 'step_7_urban_drive',
      title: '7. Rodagem Urbana',
      description:
        'Deslocamento em circuito urbano com arrancadas, trocas de marcha e paradas em semáforos.',
      targetState: 'Velocidade entre 0 e 50 km/h com marchas 1ª a 3ª.',
      expectedSpeedRange: [0, 50],
      validationCriteria:
        'Detecção dinâmica do contexto TRANSITO_URBANO; cálculo de baseline específico.',
      status: 'PENDENTE',
    },
    {
      id: 'step_8_highway_cruise',
      title: '8. Velocidade Estável / Rodovia',
      description: 'Manter velocidade de cruzeiro estabilizada (80 - 100 km/h) em pista aberta.',
      targetState: 'Regime de cruzeiro econômico.',
      expectedSpeedRange: [75, 110],
      validationCriteria:
        'Detecção do contexto ESTRADA; LTFT estabilizado; integridade de pacotes OBD > 95%.',
      status: 'PENDENTE',
    },
    {
      id: 'step_9_decel_stop',
      title: '9. Desaceleração e Encerramento',
      description: 'Desaceleração com cut-off (freio-motor), parada final segura e desligamento.',
      targetState: 'Cut-off de injeção e encerramento da gravação.',
      expectedRpmRange: [750, 900],
      validationCriteria:
        'Geração do relatório final de homologação técnica com parâmetros medidos e assinatura.',
      status: 'PENDENTE',
    },
  ],
}
