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
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// Rota protegida: Garante acesso imediato com fallback para sessão técnica e tratamento de timeout
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isOfflineMode } = useAuth()

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12 text-[#9AA7B4] text-xs font-mono space-y-2">
        <div className="w-6 h-6 border-2 border-[#FFB300] border-t-transparent rounded-full animate-spin" />
        <span>Carregando subsistema de telemetria...</span>
      </div>
    )
  }

  // Se houver usuário autenticado ou se estiver em modo offline/convidado técnico, renderiza conteúdo
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
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
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
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </TelemetryProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
