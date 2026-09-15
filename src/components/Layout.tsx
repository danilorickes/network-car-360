import React, { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  Activity,
  Radio,
  Cpu,
  History,
  PlayCircle,
  Settings,
  FileText,
  Menu,
  X,
  LogOut,
  ShieldAlert,
  Car,
  Users,
  LogIn,
  ClipboardList,
  Package,
  LayoutDashboard,
  PlaySquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Layout() {
  const { telemetry } = useTelemetry()
  const { user, logout, isOfflineMode } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000)
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isConnected = telemetry.connectionState === 'CONECTADO'
  const isRecording = telemetry.sessionState === 'TESTE ATIVO'

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F14] text-[#F2F5F7]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 bg-[#131A22]/95 backdrop-blur border-b border-[#263340]">
        <div className="max-w-[1440px] mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo / Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-[#FFB300]/15 border border-[#FFB300]/40 flex items-center justify-center text-[#FFB300]">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-wide text-white">Network Car</span>
                <span className="text-xs bg-[#FFB300] text-black font-semibold px-2 py-0.5 rounded">
                  360 PRO
                </span>
                <span className="text-[10px] bg-blue-950 text-blue-300 border border-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  E5 OPERAÇÃO
                </span>
              </div>
              <p className="text-xs text-[#9AA7B4]">
                Diagnóstico 360 & Operação Comercial da Oficina
              </p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <nav className="hidden xl:flex items-center space-x-1">
            <NavLink
              to="/painel-oficina"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#FFB300]" />
              <span>Painel Oficina</span>
            </NavLink>

            <NavLink
              to="/recepcao"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Recepção</span>
            </NavLink>

            <NavLink
              to="/ordens-servico"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>OS Comercial</span>
            </NavLink>

            <NavLink
              to="/clientes"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <Users className="w-3.5 h-3.5" />
              <span>Clientes</span>
            </NavLink>

            <NavLink
              to="/catalogos"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <Package className="w-3.5 h-3.5" />
              <span>Catálogos</span>
            </NavLink>

            <NavLink
              to="/simulador-operacional"
              className={({ isActive }) =>
                `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <PlaySquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulador E5</span>
            </NavLink>

            <span className="h-4 w-[1px] bg-[#263340] mx-1" />

            <NavLink
              to="/"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Live</span>
            </NavLink>

            <NavLink
              to="/replay"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Diag 360</span>
            </NavLink>

            <NavLink
              to="/veiculos"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <Car className="w-3.5 h-3.5" />
              <span>Veículos</span>
            </NavLink>

            <NavLink
              to="/sessoes"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <History className="w-3.5 h-3.5" />
              <span>Sessões</span>
            </NavLink>

            <NavLink
              to="/configuracoes"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Config</span>
            </NavLink>

            <NavLink
              to="/relatorio"
              className={({ isActive }) =>
                `px-2 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center space-x-1.5 ${
                  isActive
                    ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                    : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                }`
              }
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Relatório</span>
            </NavLink>
          </nav>

          {/* Right Header Status Badges */}
          <div className="flex items-center space-x-3">
            {/* Transport Badge */}
            <div
              className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${
                telemetry.transportType === 'SIMULADOR'
                  ? 'bg-blue-950/50 text-blue-400 border-blue-800'
                  : 'bg-purple-950/50 text-purple-400 border-purple-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{telemetry.transportType}</span>
            </div>

            {/* Connection Status Badge */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                isConnected
                  ? 'bg-emerald-950/60 text-[#2ECC71] border-emerald-700/60'
                  : telemetry.connectionState === 'CONECTANDO' ||
                      telemetry.connectionState === 'RECONECTANDO'
                    ? 'bg-amber-950/60 text-[#FFB300] border-amber-700/60'
                    : 'bg-red-950/60 text-[#E53935] border-red-800/60'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected
                    ? 'bg-[#2ECC71] animate-pulse-live'
                    : telemetry.connectionState === 'CONECTANDO' ||
                        telemetry.connectionState === 'RECONECTANDO'
                      ? 'bg-[#FFB300] animate-ping'
                      : 'bg-[#E53935]'
                }`}
              />
              <span>{telemetry.connectionState}</span>
            </div>

            {/* User / Offline info */}
            {user && (
              <div className="hidden lg:flex items-center space-x-2">
                <span className="text-xs text-gray-300 font-mono bg-[#1A232E] px-2 py-1 rounded border border-[#263340]">
                  {user.email || user.name || 'Operador Autenticado'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  title="Desconectar do sistema"
                  className="text-xs text-[#9AA7B4] hover:text-white hover:bg-[#1A232E] px-2"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  Sair
                </Button>
              </div>
            )}

            {/* Mobile menu trigger */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-[#9AA7B4] p-1.5"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Thin Session Status Bar */}
        <div className="bg-[#1A232E] border-t border-[#263340] px-4 py-1.5 text-xs text-[#9AA7B4]">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRecording ? 'bg-[#2ECC71] animate-pulse-live' : 'bg-[#9AA7B4]/40'
                  }`}
                />
                <span className="font-semibold text-white tracking-wider">
                  {isRecording ? 'TESTE ATIVO' : 'SESSÃO INATIVA'}
                </span>
              </div>

              {isRecording && (
                <div className="flex items-center space-x-1.5 text-[#E53935] font-mono font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E53935] animate-blink-rec inline-block" />
                  <span>REC {formatDuration(telemetry.durationMs)}</span>
                </div>
              )}

              {telemetry.activeSessionId && (
                <span className="hidden sm:inline text-xs text-gray-400 font-mono">
                  ID: {telemetry.activeSessionId}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4 text-xs">
              {isOfflineMode && (
                <span className="flex items-center text-amber-400 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Modo Local (Offline)
                </span>
              )}
              <span>
                Freq. Efetiva:{' '}
                <strong className="text-white font-mono">
                  {telemetry.effectiveFreqHz > 0 ? `${telemetry.effectiveFreqHz} Hz` : '--'}
                </strong>{' '}
                <span className="text-[#9AA7B4]">(alvo ≥{telemetry.targetFreqHz} Hz)</span>
              </span>
              <span>
                Eventos: <strong className="text-white font-mono">{telemetry.totalEvents}</strong>
              </span>
              <span>
                DTCs:{' '}
                <strong
                  className={`font-mono font-bold ${
                    telemetry.milOn || telemetry.dtcList.length > 0
                      ? 'text-[#FFB300]'
                      : 'text-[#2ECC71]'
                  }`}
                >
                  {telemetry.dtcList.length} {telemetry.milOn ? '(MIL ACESA)' : ''}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Mobile dropdown drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#131A22] border-b border-[#263340] px-4 py-3 space-y-2">
            <NavLink
              to="/painel-oficina"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#FFB300] font-bold hover:bg-[#1A232E]"
            >
              Painel Oficina
            </NavLink>
            <NavLink
              to="/recepcao"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Recepção / Entrada Rápida
            </NavLink>
            <NavLink
              to="/ordens-servico"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Ordens de Serviço Comercial
            </NavLink>
            <NavLink
              to="/clientes"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Clientes
            </NavLink>
            <NavLink
              to="/catalogos"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Catálogos Mestre
            </NavLink>
            <NavLink
              to="/simulador-operacional"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-amber-400 hover:bg-[#1A232E]"
            >
              Simulador E5
            </NavLink>
            <NavLink
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Painel Live
            </NavLink>
            <NavLink
              to="/veiculos"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Veículos & Timeline
            </NavLink>
            <NavLink
              to="/sessoes"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Sessões
            </NavLink>
            <NavLink
              to="/replay"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Replay & Diagnóstico 360
            </NavLink>
            <NavLink
              to="/configuracoes"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Configurações
            </NavLink>
            <NavLink
              to="/relatorio"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#F2F5F7] hover:bg-[#1A232E]"
            >
              Relatório / Evidências
            </NavLink>
            {user && (
              <div className="pt-2 border-t border-[#263340] flex items-center justify-between">
                <span className="text-xs text-gray-400 font-mono truncate max-w-[200px]">
                  {user.email || user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    logout()
                    setMobileMenuOpen(false)
                  }}
                  className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" />
                  Sair
                </Button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area (Fluid Container centered up to 1440px) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 md:p-6 pb-24">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#131A22] border-t border-[#263340] py-4 text-xs text-[#9AA7B4]">
        <div className="max-w-[1440px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>Network Soluções — Network Office</strong> • Telemetria Diagnóstico 360 Live
          </div>
          <div className="flex items-center space-x-3">
            <span className="font-mono text-[#FFB300] bg-[#FFB300]/10 px-2 py-0.5 rounded border border-[#FFB300]/30">
              ME001-E5 — Etapa 5
            </span>
            <span>Versão 0.0.9 (Operação da Oficina & OS Comercial)</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
