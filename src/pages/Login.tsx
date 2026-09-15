import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Activity,
  Lock,
  Mail,
  KeyRound,
  AlertTriangle,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  Shield,
  ServerOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function Login() {
  const { login, backendStatus, backendError, checkBackendHealth } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkingServer, setCheckingServer] = useState(false)

  const isServerUnavailable = backendStatus === 'unavailable'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (!email.trim() || !password) {
      setErrorMessage('Por favor, preencha o e-mail e a senha.')
      return
    }

    setSubmitting(true)
    const result = await login(email, password)
    setSubmitting(false)

    if (!result.success) {
      setErrorMessage(result.error || 'Falha ao autenticar. Verifique suas credenciais.')
    }
  }

  const handleRetryServer = async () => {
    setCheckingServer(true)
    setErrorMessage(null)
    const ok = await checkBackendHealth()
    setCheckingServer(false)
    if (!ok) {
      setErrorMessage('Servidor continua inacessível. Verifique a conectividade de rede.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#F2F5F7] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header com identidade Network Car */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FFB300]/15 border border-[#FFB300]/40 text-[#FFB300] shadow-lg shadow-[#FFB300]/10">
            <Activity className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide text-white">Network Car</h1>
            <p className="text-xs text-[#FFB300] font-semibold tracking-wider uppercase">
              Diagnóstico 360 Live • Plataforma Técnica
            </p>
          </div>
          <p className="text-xs text-[#9AA7B4] max-w-sm mx-auto">
            Acesso restrito a técnicos e mecânicos autorizados. Autenticação obrigatória para acesso
            à telemetria e prontuários.
          </p>
        </div>

        {/* Banner de Indisponibilidade Técnica do Backend */}
        {isServerUnavailable && (
          <Alert
            data-testid="backend-unavailable-banner"
            className="bg-amber-950/40 border-amber-600/60 text-amber-200"
          >
            <ServerOff className="h-4 w-4 text-amber-400" />
            <AlertTitle className="font-bold flex items-center justify-between">
              <span>Backend Técnico Indisponível</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                Offline
              </span>
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-300/90 space-y-2 mt-1">
              <p>
                O servidor backend de telemetria e autenticação não respondeu à verificação de
                integridade. O acesso a dados protegidos permanece bloqueado conforme norma de
                segurança.
              </p>
              {backendError && (
                <p className="font-mono text-[11px] text-amber-400/80 bg-black/40 p-2 rounded border border-amber-800/40">
                  Diag: {backendError}
                </p>
              )}
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetryServer}
                  disabled={checkingServer}
                  className="border-amber-600/60 text-amber-200 hover:bg-amber-900/40 text-xs h-7"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 mr-1.5 ${checkingServer ? 'animate-spin' : ''}`}
                  />
                  {checkingServer ? 'Reverificando...' : 'Reconectar ao Servidor'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Formulário de Login */}
        <div className="bg-[#131A22] border border-[#263340] rounded-xl p-6 shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-[#263340] pb-3">
            <div className="flex items-center space-x-2 text-white font-semibold text-sm">
              <Lock className="w-4 h-4 text-[#FFB300]" />
              <span>Credenciais do Operador</span>
            </div>
            <span className="text-[11px] text-[#9AA7B4] font-mono flex items-center">
              <Shield className="w-3 h-3 mr-1 text-[#2ECC71]" />
              Sessão Segura
            </span>
          </div>

          {errorMessage && (
            <Alert
              data-testid="auth-error-alert"
              className="bg-red-950/40 border-red-800 text-red-200 py-2 text-xs"
            >
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9AA7B4] flex items-center">
                <Mail className="w-3.5 h-3.5 mr-1 text-gray-400" />
                E-mail do Técnico / Mecânico:
              </label>
              <Input
                type="email"
                required
                autoComplete="email"
                placeholder="tecnico@oficina.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="bg-[#0B0F14] border-[#263340] text-white text-sm focus:border-[#FFB300] placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#9AA7B4] flex items-center">
                <KeyRound className="w-3.5 h-3.5 mr-1 text-gray-400" />
                Senha de Acesso:
              </label>
              <Input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="bg-[#0B0F14] border-[#263340] text-white text-sm focus:border-[#FFB300] placeholder:text-gray-600"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#FFB300] hover:bg-[#e5a000] text-black font-bold text-sm h-10 transition-colors"
            >
              {submitting ? (
                <span className="flex items-center space-x-2">
                  <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Validando credenciais...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <span>Entrar no Sistema</span>
                  <CheckCircle2 className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="text-[11px] text-center text-[#9AA7B4] pt-2 border-t border-[#263340]/60">
            <p>
              Em conformidade com a auditoria de segurança{' '}
              <strong className="text-gray-300">NC-E4-SEC-01</strong>. Nenhuma credencial é
              transmitida ou salva em bundle cliente.
            </p>
          </div>
        </div>

        {/* Rodapé técnico */}
        <div className="text-center text-[11px] text-gray-500 font-mono">
          Network Soluções • Diagnóstico 360 • Terminal Homologado
        </div>
      </div>
    </div>
  )
}
