import React, { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTelemetry } from '@/contexts/TelemetryContext'
import { useAuth } from '@/contexts/AuthContext'
import {
  Activity,
  Radio,
  Menu,
  X,
  LogOut,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DESKTOP_NAV_ITEMS,
  MOBILE_PRIMARY_ITEMS,
  MOBILE_SECONDARY_ITEMS,
  type NavItemConfig,
} from '@/lib/navigation'

export default function Layout() {
  const { telemetry } = useTelemetry()
  const { user, logout, isOfflineMode } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  const formatDuration = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000)
    const m = Math.floor(totalSecs / 60)
    const s = totalSecs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const isConnected = telemetry.connectionState === 'CONECTADO'
  const isRecording = telemetry.sessionState === 'TESTE ATIVO'

  // Verifica se a rota atual corresponde ao item (para destacar visualmente)
  const isItemActive = (item: NavItemConfig) => {
    if (item.end || item.to === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(item.to)
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F14] text-[#F2F5F7]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#131A22]/95 backdrop-blur border-b border-[#263340] safe-area-pt">
        <div className="max-w-[1440px] mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2">
          {/* Logo / Title + Mobile Trigger */}
          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            {/* Mobile Drawer Trigger (☰ Menu) — visível em todas as telas < xl */}
            <div className="xl:hidden flex items-center">
              <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Abrir menu de navegação"
                    className="h-10 px-2.5 bg-[#1A232E] border-[#263340] hover:bg-[#263340] text-[#FFB300] hover:text-white flex items-center gap-1.5 font-bold text-xs"
                  >
                    <Menu className="w-5 h-5 text-[#FFB300]" />
                    <span className="hidden xs:inline">Menu</span>
                  </Button>
                </SheetTrigger>

                <SheetContent
                  side="left"
                  className="w-[85vw] max-w-[380px] bg-[#0E141C] text-[#F2F5F7] border-r border-[#263340] p-0 flex flex-col h-full safe-area-pt safe-area-pb"
                >
                  {/* Drawer Header */}
                  <SheetHeader className="p-4 border-b border-[#263340] bg-[#131A22] text-left">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-9 h-9 rounded-lg bg-[#FFB300]/15 border border-[#FFB300]/40 flex items-center justify-center text-[#FFB300] flex-shrink-0">
                        <Activity className="w-5 h-5 animate-pulse" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <SheetTitle className="font-bold text-base tracking-wide text-white m-0">
                            Network Car
                          </SheetTitle>
                          <span className="text-[10px] bg-[#FFB300] text-black font-bold px-1.5 py-0.2 rounded">
                            360 PRO
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9AA7B4] truncate">
                          Diagnóstico 360 & Operação Oficina
                        </p>
                      </div>
                    </div>
                  </SheetHeader>

                  {/* Drawer Body — Lista de Navegação com Scroll Suave */}
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4 no-scrollbar">
                    {/* Seção 1: Módulos Principais Priorizados (Drive, Live, Diag 360, Clientes, Veículos) */}
                    <div>
                      <div className="flex items-center justify-between px-2 mb-2">
                        <span className="text-[10px] font-bold tracking-wider text-[#FFB300] uppercase flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Módulos Principais
                        </span>
                        <span className="text-[9px] text-[#9AA7B4] font-mono">1º NÍVEL</span>
                      </div>
                      <div className="space-y-1.5">
                        {MOBILE_PRIMARY_ITEMS.map((item) => {
                          const active = isItemActive(item)
                          const IconComponent = item.icon
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.end}
                              onClick={() => setDrawerOpen(false)}
                              className={`group flex items-center justify-between p-2.5 rounded-lg border transition-all text-left ${
                                active
                                  ? 'bg-[#1A232E] border-[#FFB300] text-white shadow-sm shadow-[#FFB300]/10 ring-1 ring-[#FFB300]'
                                  : 'bg-[#131A22]/90 border-[#263340] text-[#E0E6ED] hover:bg-[#1A232E] hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center space-x-3 min-w-0">
                                <div
                                  className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                                    active
                                      ? 'bg-[#FFB300] text-black font-bold'
                                      : item.highlight
                                        ? 'bg-[#FFB300]/15 text-[#FFB300] border border-[#FFB300]/30'
                                        : 'bg-[#1A232E] text-[#9AA7B4] group-hover:text-white'
                                  }`}
                                >
                                  <IconComponent className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center space-x-1.5">
                                    <span
                                      className={`text-sm font-semibold truncate ${
                                        active ? 'text-[#FFB300]' : 'text-white'
                                      }`}
                                    >
                                      {item.label}
                                    </span>
                                    {item.badge && (
                                      <span className="text-[9px] bg-blue-950 text-blue-300 border border-blue-700 px-1 py-0.2 rounded font-mono font-bold">
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  {item.description && (
                                    <p className="text-[11px] text-[#9AA7B4] line-clamp-1 leading-tight">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <ChevronRight
                                className={`w-4 h-4 flex-shrink-0 transition-transform ${
                                  active
                                    ? 'text-[#FFB300] translate-x-0.5'
                                    : 'text-[#9AA7B4] group-hover:text-white'
                                }`}
                              />
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>

                    {/* Seção 2: Mais Módulos da Oficina & Sistema */}
                    <div className="pt-2 border-t border-[#263340]/60">
                      <div className="flex items-center justify-between px-2 mb-2">
                        <span className="text-[10px] font-bold tracking-wider text-[#9AA7B4] uppercase flex items-center gap-1">
                          <Layers className="w-3 h-3 text-cyan-400" />
                          Mais Módulos & Gestão
                        </span>
                        <span className="text-[9px] text-[#9AA7B4] font-mono">
                          OFICINA / SISTEMA
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {MOBILE_SECONDARY_ITEMS.map((item) => {
                          const active = isItemActive(item)
                          const IconComponent = item.icon
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              end={item.end}
                              onClick={() => setDrawerOpen(false)}
                              className={`group flex items-center justify-between px-3 py-2 rounded-md transition-colors text-left ${
                                active
                                  ? 'bg-[#1A232E] text-[#FFB300] font-semibold border-l-2 border-[#FFB300]'
                                  : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/70'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5 min-w-0">
                                <IconComponent
                                  className={`w-4 h-4 flex-shrink-0 ${
                                    active
                                      ? 'text-[#FFB300]'
                                      : item.iconColorClass || 'text-[#9AA7B4]'
                                  }`}
                                />
                                <span className="text-xs truncate">{item.label}</span>
                                {item.badge && (
                                  <span className="text-[9px] bg-[#1A232E] text-gray-300 border border-[#263340] px-1 py-0.2 rounded font-mono">
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-[#9AA7B4]/60 flex-shrink-0" />
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer — Usuário e Logout */}
                  <div className="p-3 border-t border-[#263340] bg-[#131A22] space-y-2">
                    {user && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] text-gray-300 font-mono truncate block">
                            {user.email || user.name || 'Operador Autenticado'}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold block">
                            Sessão Ativa
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            logout()
                            setDrawerOpen(false)
                          }}
                          className="h-8 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40"
                        >
                          <LogOut className="w-3.5 h-3.5 mr-1" />
                          Sair
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-[#263340]/40">
                      <span>Network Car 360 PRO</span>
                      <span className="font-mono text-[#FFB300]">v0.0.21</span>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Logo Icon & Name */}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-[#FFB300]/15 border border-[#FFB300]/40 flex items-center justify-center text-[#FFB300] flex-shrink-0">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="font-bold text-sm sm:text-lg tracking-wide text-white truncate">
                  Network Car
                </span>
                <span className="text-[10px] sm:text-xs bg-[#FFB300] text-black font-semibold px-1.5 sm:px-2 py-0.5 rounded">
                  360 PRO
                </span>
                <span className="hidden sm:inline-block text-[10px] bg-blue-950 text-blue-300 border border-blue-700 px-1.5 py-0.5 rounded font-mono font-bold">
                  E5 OPERAÇÃO
                </span>
              </div>
              <p className="hidden md:block text-xs text-[#9AA7B4] truncate">
                Diagnóstico 360 & Operação Comercial da Oficina
              </p>
            </div>
          </div>

          {/* Desktop Nav Items (Preservado e Consumindo DESKTOP_NAV_ITEMS) */}
          <nav className="hidden xl:flex items-center space-x-1">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const IconComponent = item.icon
              const isHighlightDrive = item.to === '/drive'

              if (isHighlightDrive) {
                return (
                  <React.Fragment key={item.to}>
                    <span className="h-4 w-[1px] bg-[#263340] mx-1" />
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `px-2.5 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center space-x-1.5 bg-[#FFB300]/10 text-[#FFB300] border border-[#FFB300]/40 hover:bg-[#FFB300] hover:text-black ${
                          isActive ? 'bg-[#FFB300] text-black' : ''
                        }`
                      }
                    >
                      <IconComponent className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </NavLink>
                  </React.Fragment>
                )
              }

              // Divisor antes de Live
              const isFirstLiveItem = item.to === '/'

              return (
                <React.Fragment key={item.to}>
                  {isFirstLiveItem && <span className="h-4 w-[1px] bg-[#263340] mx-1" />}
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center space-x-1.5 ${
                        isActive
                          ? 'bg-[#1A232E] text-[#FFB300] border-b-2 border-[#FFB300]'
                          : 'text-[#9AA7B4] hover:text-white hover:bg-[#1A232E]/60'
                      }`
                    }
                  >
                    <IconComponent
                      className={`w-3.5 h-3.5 ${item.iconColorClass || 'text-[#9AA7B4]'}`}
                    />
                    <span>{item.shortLabel || item.label}</span>
                  </NavLink>
                </React.Fragment>
              )
            })}
          </nav>

          {/* Right Header Status Badges */}
          <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
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
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
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
              <span className="text-[11px] sm:text-xs">{telemetry.connectionState}</span>
            </div>

            {/* User / Offline info */}
            {user && (
              <div className="hidden lg:flex items-center space-x-2">
                <span className="text-xs text-gray-300 font-mono bg-[#1A232E] px-2 py-1 rounded border border-[#263340] max-w-[150px] truncate">
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
          </div>
        </div>

        {/* Thin Session Status Bar */}
        <div className="bg-[#1A232E] border-t border-[#263340] px-3 sm:px-4 py-1.5 text-xs text-[#9AA7B4]">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRecording ? 'bg-[#2ECC71] animate-pulse-live' : 'bg-[#9AA7B4]/40'
                  }`}
                />
                <span className="font-semibold text-white tracking-wider text-[11px] sm:text-xs">
                  {isRecording ? 'TESTE ATIVO' : 'SESSÃO INATIVA'}
                </span>
              </div>

              {isRecording && (
                <div className="flex items-center space-x-1.5 text-[#E53935] font-mono font-bold text-[11px] sm:text-xs">
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

            <div className="flex items-center space-x-3 sm:space-x-4 text-[11px] sm:text-xs flex-wrap">
              {isOfflineMode && (
                <span className="flex items-center text-amber-400 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Modo Local
                </span>
              )}
              <span className="hidden xs:inline">
                Freq:{' '}
                <strong className="text-white font-mono">
                  {telemetry.effectiveFreqHz > 0 ? `${telemetry.effectiveFreqHz} Hz` : '--'}
                </strong>
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
                  {telemetry.dtcList.length} {telemetry.milOn ? '(MIL)' : ''}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area (Fluid Container centered up to 1440px) */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto p-3 sm:p-4 md:p-6 pb-24 safe-area-pb">
        <Outlet />
      </main>

      {/* Quick Mobile Bottom Bar (Atalhos rápidos para módulos-chave de direção/diagnóstico) */}
      <nav
        aria-label="Atalhos rápidos de navegação inferior"
        className="xl:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#131A22]/95 backdrop-blur border-t border-[#263340] safe-area-pb"
      >
        <div className="grid grid-cols-5 h-14 max-w-lg mx-auto">
          {MOBILE_PRIMARY_ITEMS.map((item) => {
            const active = isItemActive(item)
            const IconComponent = item.icon
            return (
              <NavLink
                key={`bottom-${item.to}`}
                to={item.to}
                end={item.end}
                className={`flex flex-col items-center justify-center py-1 transition-colors ${
                  active
                    ? 'text-[#FFB300] font-bold bg-[#1A232E]/60'
                    : 'text-[#9AA7B4] hover:text-white'
                }`}
              >
                <IconComponent className={`w-5 h-5 ${active ? 'text-[#FFB300]' : ''}`} />
                <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[64px]">
                  {item.shortLabel || item.label}
                </span>
              </NavLink>
            )
          })}
        </div>
      </nav>

      {/* Footer */}
      <footer className="bg-[#131A22] border-t border-[#263340] py-4 text-xs text-[#9AA7B4] pb-20 xl:pb-4 safe-area-pb">
        <div className="max-w-[1440px] mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div>
            <strong>Network Soluções — Network Office</strong> • Telemetria Diagnóstico 360 Live
          </div>
          <div className="flex items-center space-x-3 justify-center">
            <span className="font-mono text-[#FFB300] bg-[#FFB300]/10 px-2 py-0.5 rounded border border-[#FFB300]/30">
              ME001-E5 — Etapa 5
            </span>
            <span>Versão 0.0.21 (Navegação Responsiva Mobile)</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
