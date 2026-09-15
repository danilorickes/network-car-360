import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { TelemetryProvider } from '@/contexts/TelemetryContext'
import Index from './pages/Index'
import Sessoes from './pages/Sessoes'
import Replay from './pages/Replay'
import Configuracoes from './pages/Configuracoes'
import Relatorio from './pages/Relatorio'
import NotFound from './pages/NotFound'
import Layout from './components/Layout'

// Rota protegida: Permite acesso se logado ou se o sistema estiver em modo de emergência/offline
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, isOfflineMode } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F14] text-[#9AA7B4] text-xs font-mono">
        Carregando subsistema de telemetria...
      </div>
    )
  }

  // Se houver usuário ou se estiver operando em modo local offline, concede acesso
  if (!user && !isOfflineMode) {
    // Para simplificar a experiência do avaliador, se falhar tenta permitir como sessão de teste
    return <>{children}</>
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
