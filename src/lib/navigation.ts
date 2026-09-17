import {
  Activity,
  Radio,
  Cpu,
  History,
  PlayCircle,
  Settings,
  FileText,
  ShieldAlert,
  Car,
  Users,
  LogIn,
  ClipboardList,
  Package,
  LayoutDashboard,
  PlaySquare,
  Terminal,
  type LucideIcon,
} from 'lucide-react'

export interface NavItemConfig {
  to: string
  label: string
  shortLabel?: string
  description?: string
  icon: LucideIcon
  badge?: string
  highlight?: boolean
  primaryMobile?: boolean // Prioridade alta no mobile (Drive, Live, Diagnóstico 360, Clientes, Veículos)
  category?: 'primary' | 'workshop' | 'diagnostic' | 'system'
  iconColorClass?: string
  end?: boolean
}

/**
 * Fonte única de verdade da navegação do Network Car Diagnóstico 360 PRO.
 * Consumida de forma idêntica tanto pelo menu desktop quanto pelo drawer/painel mobile,
 * garantindo coerência estrita de rotas, labels, ícones e permissões.
 */
export const NAV_ITEMS: NavItemConfig[] = [
  // --- Módulos Prioritários Principais (Mobile 1º nível) ---
  {
    to: '/drive',
    label: 'Drive E6',
    shortLabel: 'Drive',
    description: 'Interface de cockpit automotivo e telemetria veicular em tempo real',
    icon: Car,
    badge: 'E6',
    highlight: true,
    primaryMobile: true,
    category: 'primary',
    iconColorClass: 'text-[#FFB300]',
  },
  {
    to: '/',
    label: 'Live OBD-II',
    shortLabel: 'Live',
    description: 'Painel de telemetria ao vivo, PIDs, sensores e captura de dados',
    icon: Cpu,
    primaryMobile: true,
    category: 'primary',
    iconColorClass: 'text-emerald-400',
    end: true,
  },
  {
    to: '/replay',
    label: 'Diagnóstico 360',
    shortLabel: 'Diag 360',
    description: 'Investigação profunda de anomalias, hipóteses e testes de confirmação',
    icon: PlayCircle,
    primaryMobile: true,
    category: 'primary',
    iconColorClass: 'text-amber-400',
  },
  {
    to: '/clientes',
    label: 'Clientes',
    shortLabel: 'Clientes',
    description: 'Gestão de clientes, histórico de veículos vinculados e contatos',
    icon: Users,
    primaryMobile: true,
    category: 'primary',
    iconColorClass: 'text-blue-400',
  },
  {
    to: '/veiculos',
    label: 'Veículos',
    shortLabel: 'Veículos',
    description: 'Cadastro veicular, timeline técnica, assinatura OBD e conexão direta',
    icon: Car,
    primaryMobile: true,
    category: 'primary',
    iconColorClass: 'text-cyan-400',
  },

  // --- Operação da Oficina (Etapa 5) ---
  {
    to: '/painel-oficina',
    label: 'Painel Oficina',
    shortLabel: 'Oficina',
    description: 'Visão executiva do fluxo de trabalho, pátio e produtividade técnica',
    icon: LayoutDashboard,
    primaryMobile: false,
    category: 'workshop',
    iconColorClass: 'text-[#FFB300]',
  },
  {
    to: '/recepcao',
    label: 'Recepção',
    shortLabel: 'Recepção',
    description: 'Check-in rápido, queixa do cliente e triagem de entrada',
    icon: LogIn,
    primaryMobile: false,
    category: 'workshop',
    iconColorClass: 'text-emerald-400',
  },
  {
    to: '/ordens-servico',
    label: 'OS Comercial',
    shortLabel: 'OS Comercial',
    description: 'Ordens de serviço, orçamentos, aprovação e fechamento',
    icon: ClipboardList,
    primaryMobile: false,
    category: 'workshop',
    iconColorClass: 'text-amber-400',
  },
  {
    to: '/catalogos',
    label: 'Catálogos',
    shortLabel: 'Catálogos',
    description: 'Tabela de serviços e catálogo de peças de reposição',
    icon: Package,
    primaryMobile: false,
    category: 'workshop',
    iconColorClass: 'text-purple-400',
  },
  {
    to: '/simulador-operacional',
    label: 'Simulador E5',
    shortLabel: 'Sim E5',
    description: 'Simulação interativa da rotina de oficina e fluxo comercial',
    icon: PlaySquare,
    badge: 'E5',
    primaryMobile: false,
    category: 'workshop',
    iconColorClass: 'text-amber-400',
  },

  // --- Diagnóstico & Homologação ---
  {
    to: '/homologacao-hardware',
    label: 'Homologação',
    shortLabel: 'Homologação',
    description: 'Bancada de validação de adaptadores OBD-II (vLinker, ELM327, BLE/Serial)',
    icon: ShieldAlert,
    badge: 'E6',
    primaryMobile: false,
    category: 'diagnostic',
    iconColorClass: 'text-cyan-400',
  },
  {
    to: '/diagnostico-bluetooth',
    label: 'Diag BT OBD',
    shortLabel: 'Diag BT',
    description: 'Ferramenta mínima de isolamento e diagnóstico da Web Serial RFCOMM',
    icon: Terminal,
    badge: 'E6.6',
    primaryMobile: false,
    category: 'diagnostic',
    iconColorClass: 'text-[#FFB300]',
  },
  {
    to: '/simulador-drive',
    label: 'Simulador Drive',
    shortLabel: 'Sim Drive',
    description: 'Cenários virtuais de condução urbana, rodoviária e de anomalias',
    icon: PlaySquare,
    badge: 'E6',
    primaryMobile: false,
    category: 'diagnostic',
    iconColorClass: 'text-blue-400',
  },
  {
    to: '/sessoes',
    label: 'Sessões',
    shortLabel: 'Sessões',
    description: 'Histórico de gravações de telemetria e exportações CSV/JSON',
    icon: History,
    primaryMobile: false,
    category: 'diagnostic',
    iconColorClass: 'text-indigo-400',
  },

  // --- Sistema & Configurações ---
  {
    to: '/relatorio',
    label: 'Relatório',
    shortLabel: 'Relatório',
    description: 'Dossiê técnico e laudos de evidências para o proprietário',
    icon: FileText,
    primaryMobile: false,
    category: 'system',
    iconColorClass: 'text-teal-400',
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    shortLabel: 'Config',
    description: 'Preferências de hardware, assistente de voz e telemetria',
    icon: Settings,
    primaryMobile: false,
    category: 'system',
    iconColorClass: 'text-gray-400',
  },
]

/**
 * Itens desktop na ordem exata original em que eram exibidos:
 * Painel Oficina, Recepção, OS Comercial, Clientes, Catálogos, Simulador E5,
 * Drive E6, Homologação, Simulador Drive,
 * Live, Diag 360, Veículos, Sessões, Config, Relatório
 */
export const DESKTOP_NAV_ITEMS: NavItemConfig[] = [
  NAV_ITEMS.find((i) => i.to === '/painel-oficina')!,
  NAV_ITEMS.find((i) => i.to === '/recepcao')!,
  NAV_ITEMS.find((i) => i.to === '/ordens-servico')!,
  NAV_ITEMS.find((i) => i.to === '/clientes')!,
  NAV_ITEMS.find((i) => i.to === '/catalogos')!,
  NAV_ITEMS.find((i) => i.to === '/simulador-operacional')!,
  NAV_ITEMS.find((i) => i.to === '/drive')!,
  NAV_ITEMS.find((i) => i.to === '/homologacao-hardware')!,
  NAV_ITEMS.find((i) => i.to === '/diagnostico-bluetooth')!,
  NAV_ITEMS.find((i) => i.to === '/simulador-drive')!,
  NAV_ITEMS.find((i) => i.to === '/')!,
  NAV_ITEMS.find((i) => i.to === '/replay')!,
  NAV_ITEMS.find((i) => i.to === '/veiculos')!,
  NAV_ITEMS.find((i) => i.to === '/sessoes')!,
  NAV_ITEMS.find((i) => i.to === '/configuracoes')!,
  NAV_ITEMS.find((i) => i.to === '/relatorio')!,
]

/**
 * Itens mobile primários (1º nível de prioridade):
 * Drive, Live, Diagnóstico 360, Clientes, Veículos
 */
export const MOBILE_PRIMARY_ITEMS: NavItemConfig[] = NAV_ITEMS.filter((i) => i.primaryMobile)

/**
 * Demais itens na seção "Mais Módulos" do menu mobile
 */
export const MOBILE_SECONDARY_ITEMS: NavItemConfig[] = NAV_ITEMS.filter((i) => !i.primaryMobile)
