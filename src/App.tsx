import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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

// Rota protegida em conformidade com auditoria NC-E4-SEC-01:
// - Exige autenticação válida para visualização de dados protegidos.
// - Timeout impede loader infinito, porém JAMAIS concede acesso anônimo/offline indevido.
// - Quando não autenticado (ou backend indisponível), redireciona explicitamente para /login.
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, backendStatus } = useAuth()

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

  // Falha de backend ou ausência de usuário: redireciona para Login
  // O componente Login renderiza o estado explícito de indisponibilidade ou formulário
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Quando autenticado, garante renderização imediata e segura dos filhos protegidos
  return <>{children}</>
}

// Rota pública para Login: se o usuário já estiver autenticado, redireciona para "/"
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth()

  // Se já há usuário autenticado no authStore, redireciona de imediato sem prender em loading
  if (user) {
    return <Navigate to="/" replace />
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

const App = () => (
  <BrowserRouter>
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
            <Route
              path="/drive"
              element={
                <ProtectedRoute>
                  <NetworkCarDrive />
                </ProtectedRoute>
              }
            />
            <Route path="/network-car-drive" element={<Navigate to="/drive" replace />} />

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
  </BrowserRouter>
)

export default App
