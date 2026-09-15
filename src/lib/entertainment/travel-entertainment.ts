export interface AudioTrackInfo {
  id: string
  title: string
  artist: string
  source: 'SPOTIFY' | 'YOUTUBE_MUSIC' | 'RADIO' | 'LOCAL'
  externalUrl?: string
  durationSec: number
}

export interface TravelQuizQuestion {
  id: string
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  funFact: string
}

export const TRAVEL_QUIZ_QUESTIONS: TravelQuizQuestion[] = [
  {
    id: 'quiz_1',
    question: 'Qual é a velocidade máxima teórica do som ao nível do mar?',
    options: ['1.234 km/h', '850 km/h', '1.600 km/h', '2.000 km/h'],
    correctIndex: 0,
    explanation:
      'A velocidade do som no ar seco a 20 °C é de aproximadamente 1.234 km/h (343 m/s).',
    funFact: 'O Concorde voava a mais que o dobro dessa velocidade!',
  },
  {
    id: 'quiz_2',
    question: 'Qual país tem a maior malha rodoviária pavimentada da América do Sul?',
    options: ['Argentina', 'Brasil', 'Chile', 'Colômbia'],
    correctIndex: 1,
    explanation:
      'O Brasil possui a maior extensão rodoviária total do continente, ultrapassando 1,7 milhão de quilômetros.',
    funFact: 'A rodovia BR-101 tem mais de 4.500 km cortando o litoral brasileiro.',
  },
  {
    id: 'quiz_3',
    question: 'O que significa a sigla OBD nos veículos modernos?',
    options: [
      'On-Board Diagnostics',
      'Optimal Battery Drive',
      'Operational Brake Device',
      'Order Business Delivery',
    ],
    correctIndex: 0,
    explanation:
      'OBD significa On-Board Diagnostics (Diagnóstico a Bordo), padronizado globalmente como OBD-II desde 1996.',
    funFact: 'O conector OBD possui 16 pinos e conecta-se diretamente à rede CAN do carro.',
  },
  {
    id: 'quiz_4',
    question: 'Qual o principal benefício de calibrar os pneus na pressão correta antes de viajar?',
    options: [
      'Aumenta a velocidade máxima',
      'Economiza combustível e evita desgaste irregular',
      'Melhora o sinal de rádio',
      'Faz o motor esquentar mais rápido',
    ],
    correctIndex: 1,
    explanation:
      'Pneus calibrados reduzem a resistência ao rolamento, economizando até 3% de combustível e garantindo estabilidade nas curvas.',
    funFact: 'A pressão deve ser verificada sempre com os pneus frios!',
  },
  {
    id: 'quiz_5',
    question: 'Qual é o maior estado brasileiro em extensão territorial?',
    options: ['Mato Grosso', 'Amazonas', 'Minas Gerais', 'Bahia'],
    correctIndex: 1,
    explanation:
      'O Amazonas possui mais de 1,5 milhão de km², sendo maior que vários países europeus juntos.',
    funFact: 'Se fosse um país, o Amazonas seria o 16º maior do mundo.',
  },
]

export const EXTERNAL_MEDIA_SHORTCUTS = [
  {
    name: 'Spotify',
    url: 'https://open.spotify.com',
    iconColor: '#1DB954',
    desc: 'Abrir player ou app nativo',
  },
  {
    name: 'YouTube Music',
    url: 'https://music.youtube.com',
    iconColor: '#FF0000',
    desc: 'Streaming de músicas e podcasts',
  },
  {
    name: 'Rádios Online / Notícias',
    url: 'https://radios.com.br',
    iconColor: '#FFB300',
    desc: 'Emissoras de trânsito e notícias',
  },
]
