import React from 'react'
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { TelemetryProvider } from '@/contexts/TelemetryContext'
import Index from './pages/Index'
import Sessoes from './pages/Sessoes'
import Replay from './pages/Replay'
import Veiculos from './pages/Veiculos'
import Configuracoes from './pages/Configuracoes'
import Relatorio from './pages/Relatorio'
import Login from './pages/Login'
import NotFound from './pages/NotFound'

// Novos módulos Etapa 5 — Operação da Oficina & OS Comercial
import Clientes from './pages/Clientes'
import Recepcao from './pages/Recepcao'
import OrdensServico from './pages/OrdensServico'
import Catalogos from './pages/Catalogos'
import PainelOficina from './pages/PainelOficina'
import SimuladorOperacional from './pages/SimuladorOperacional'
import Layout from './components/Layout'

// E6: Hardware Real, Modo Viagem, Homologação e Condução
import { NetworkCarDrive } from './pages/NetworkCarDrive'
import { HomologacaoHardware } from './pages/HomologacaoHardware'
import { SimuladorDrive } from './pages/SimuladorDrive'
import { DiagnosticoBluetooth } from './pages/DiagnosticoBluetooth'
import { getDriveStartupPreference } from './lib/drive-startup-pref'

// Rota protegida em conformidade com auditoria NC-E4-SEC-01:
// - Exige autenticação válida para visualização de dados protegidos.
// - Timeout impede loader infinito, porém JAMAIS concede acesso anônimo/offline indevido.
// - Quando não autenticado (ou backend indisponível), redireciona explicitamente para /login
//   preservando o caminho original pretendido (state: { from: location.pathname }).
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, backendStatus } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div
        data-testid="protected-route-loading"
        className="flex flex-col items-center justify-center min-h-screen bg-[#0B0F14] text-[#9AA7B4] text-xs font-mono space-y-3 p-4 text-center"
      >
        <div className="w-8 h-8 border-2 border-[#FFB300] border-t-transparent rounded-full animate-spin" />
        <span className="text-white font-semibold">Validando integridade e sessão técnica...</span>
        <span className="text-[11px] text-gray-500">Network Car Diagnóstico 360</span>
        {backendStatus === 'unavailable' && (
          <span className="text-[11px] text-amber-400 bg-amber-950/60 px-3 py-1 rounded border border-amber-800">
            Aguardando resposta do servidor ou redirecionando...
          </span>
        )}
      </div>
    )
  }

  // Falha de backend ou ausência de usuário: redireciona para Login preservando intenção de rota
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Quando autenticado, garante renderização imediata e segura dos filhos protegidos
  return <>{children}</>
}

// Rota pública para Login: se o usuário já estiver autenticado,
// redireciona para location.state?.from || (preferência de inicialização Drive ? '/network-car-drive' : '/')
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Se já há usuário autenticado no authStore, redireciona de imediato respeitando o retorno pretendido ou a preferência Drive
  if (user) {
    const fromPath = (location.state as any)?.from
    const defaultTarget = getDriveStartupPreference() ? '/network-car-drive' : '/'
    const target = fromPath && fromPath !== '/login' ? fromPath : defaultTarget
    return <Navigate to={target} replace />
  }

  if (loading) {
    return (
      <div
        data-testid="public-route-loading"
        className="flex flex-col items-center justify-center min-h-screen bg-[#0B0F14] text-[#9AA7B4] text-xs font-mono space-y-3 p-4 text-center"
      >
        <div className="w-8 h-8 border-2 border-[#FFB300] border-t-transparent rounded-full animate-spin" />
        <span className="text-white font-semibold">Carregando subsistema de autenticação...</span>
        <span className="text-[11px] text-gray-500">Network Car Diagnóstico 360</span>
      </div>
    )
  }

  return <>{children}</>
}

// Detecta se a aplicação está rodando encapsulada sob file:// (APK Android WebView ou Capacitor)
// Em file:///, o BrowserRouter falha ao tentar navegar e manipular history.pushState(/rota)
// Por isso, em file: usamos HashRouter (#/rota), preservando BrowserRouter 100% intacto no navegador web.
const isFileProtocol =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'file:' ||
    Boolean((window as any).__IS_ANDROID_NATIVE_CONTAINER) ||
    Boolean((window as any).AndroidOBD))

const RouterComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (isFileProtocol) {
    return <HashRouter>{children}</HashRouter>
  }
  return <BrowserRouter>{children}</BrowserRouter>
}

const App = () => (
  <RouterComponent>
    <AuthProvider>
      <TelemetryProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />

            {/* E6: Interface Automotiva Network Car Drive (Fullscreen / Standalone) */}
            {/* Item A da OS-ME001-E6.3.1: tanto /drive quanto /network-car-drive renderizam diretamente o componente, sem Navigate intermediário */}
            <Route
              path="/drive"
              element={
                <ProtectedRoute>
                  <NetworkCarDrive />
                </ProtectedRoute>
              }
            />
            <Route
              path="/network-car-drive"
              element={
                <ProtectedRoute>
                  <NetworkCarDrive />
                </ProtectedRoute>
              }
            />

            <Route element={<Layout />}>
              {/* E6: Homologação de Hardware e Simulador Drive Integrados ao Painel */}
              <Route
                path="/homologacao-hardware"
                element={
                  <ProtectedRoute>
                    <HomologacaoHardware />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/diagnostico-bluetooth"
                element={
                  <ProtectedRoute>
                    <DiagnosticoBluetooth />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/simulador-drive"
                element={
                  <ProtectedRoute>
                    <SimuladorDrive />
                  </ProtectedRoute>
                }
              />
              {/* E5: Módulos Operacionais e Comerciais */}
              <Route
                path="/painel-oficina"
                element={
                  <ProtectedRoute>
                    <PainelOficina />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/recepcao"
                element={
                  <ProtectedRoute>
                    <Recepcao />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ordens-servico"
                element={
                  <ProtectedRoute>
                    <OrdensServico />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/clientes"
                element={
                  <ProtectedRoute>
                    <Clientes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/catalogos"
                element={
                  <ProtectedRoute>
                    <Catalogos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/simulador-operacional"
                element={
                  <ProtectedRoute>
                    <SimuladorOperacional />
                  </ProtectedRoute>
                }
              />
              {/* Módulos E1 - E4 Preservados */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sessoes"
                element={
                  <ProtectedRoute>
                    <Sessoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/replay"
                element={
                  <ProtectedRoute>
                    <Replay />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/veiculos"
                element={
                  <ProtectedRoute>
                    <Veiculos />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <Configuracoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorio"
                element={
                  <ProtectedRoute>
                    <Relatorio />
                  </ProtectedRoute>
                }
              />{' '}
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </TelemetryProvider>
    </AuthProvider>
  </RouterComponent>
)

export default App
