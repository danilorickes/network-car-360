import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export type BackendStatus = 'checking' | 'available' | 'unavailable'

interface AuthContextType {
  user: RecordModel | null
  loading: boolean
  backendStatus: BackendStatus
  backendError: string | null
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  checkBackendHealth: () => Promise<boolean>
  // Mantido para compatibilidade com o Layout e outros componentes
  isOfflineMode: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const HEALTH_TIMEOUT_MS = 3000

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<RecordModel | null>(() => {
    return pb.authStore.isValid ? pb.authStore.record : null
  })
  const [loading, setLoading] = useState(true)
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking')
  const [backendError, setBackendError] = useState<string | null>(null)

  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    let timerId: any = null
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          reject(new Error('Timeout de comunicação com o backend (tempo limite excedido).'))
        }, HEALTH_TIMEOUT_MS)
      })

      // health check nativo do PocketBase
      const healthPromise = pb.health.check()
      await Promise.race([healthPromise, timeoutPromise])

      if (timerId) clearTimeout(timerId)
      setBackendStatus('available')
      setBackendError(null)
      return true
    } catch (err: any) {
      if (timerId) clearTimeout(timerId)
      const msg = err?.message || 'Servidor backend não respondeu à sondagem de integridade.'
      setBackendStatus('unavailable')
      setBackendError(msg)
      return false
    }
  }, [])

  // Helper para identificar falha definitiva de autenticação (401 / 403 / token revogado)
  // versus falha temporária de rede (status 0, timeout, Failed to fetch, offline)
  const isDefinitiveAuthFailure = (err: any): boolean => {
    const status = err?.status
    if (status === 401 || status === 403) return true
    if (err?.data?.message?.includes('The request requires valid record authorization token'))
      return true
    // Se for status 0, abort, timeout ou erro de rede, NÃO é falha definitiva
    if (
      status === 0 ||
      err?.isAbort ||
      err?.message?.includes('Failed to fetch') ||
      err?.message?.includes('NetworkError') ||
      err?.message?.includes('timeout') ||
      err?.message?.includes('Timeout')
    ) {
      return false
    }
    return false
  }

  // Renovação preventiva do token quando há sessão ativa
  const performTokenRefresh = useCallback(async (): Promise<void> => {
    if (!pb.authStore.isValid || !pb.authStore.token) return

    try {
      const res = await pb.collection('users').authRefresh()
      setUser(res.record)
      setBackendStatus('available')
      setBackendError(null)
    } catch (err: any) {
      if (isDefinitiveAuthFailure(err)) {
        // Falha definitiva: credenciais revogadas ou expiradas de fato
        console.warn(
          '[AuthContext] Sessão definitivamente inválida ou revogada pelo servidor. Limpando authStore.',
        )
        pb.authStore.clear()
        setUser(null)
      } else {
        // Falha transitória de rede (offline, timeout, dados móveis oscilando):
        // Retém a sessão local intacta para não derrubar a operação técnica em andamento
        console.warn(
          '[AuthContext] Falha transitória de rede durante renovação de token. Sessão local preservada:',
          err?.message,
        )
        setBackendStatus('unavailable')
        setBackendError('Perda momentânea de conexão com o servidor. Operação local mantida.')
      }
    }
  }, [])

  useEffect(() => {
    // Escuta mudanças no authStore (ex.: login/logout manual)
    const unsub = pb.authStore.onChange((_token, model) => {
      setUser(model)
    })

    let isCancelled = false

    // Se não há token no authStore desde o início, não há sessão prévia para validar
    if (!pb.authStore.isValid) {
      setUser(null)
      setLoading(false)
      // Ainda checa saúde em background sem travar tela do visitante
      checkBackendHealth().catch(() => {})
      return () => {
        isCancelled = true
        unsub()
      }
    }

    // Com token prévio: preserva user do cache imediatamente e valida em background
    setUser(pb.authStore.record)

    // Sondagem de integridade com timeout de proteção quando há token prévio
    checkBackendHealth()
      .then((isHealthy) => {
        if (isCancelled) return
        if (isHealthy && pb.authStore.isValid) {
          // Valida se o token em cache ainda é aceito pelo backend
          pb.collection('users')
            .authRefresh()
            .then((res) => {
              if (!isCancelled) {
                setUser(res.record)
              }
            })
            .catch((err) => {
              if (isCancelled) return
              if (isDefinitiveAuthFailure(err)) {
                // Token expirou ou foi revogado
                pb.authStore.clear()
                setUser(null)
              } else {
                // Falha de rede: preserva usuário logado
                console.warn(
                  '[AuthContext] Falha de rede no authRefresh inicial, preservando sessão local.',
                )
              }
            })
            .finally(() => {
              if (!isCancelled) {
                setLoading(false)
              }
            })
        } else {
          // Backend indisponível com token prévio: encerra loading preservando a sessão local
          if (!isCancelled) {
            setLoading(false)
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setLoading(false)
        }
      })

    // Timeout de segurança máximo para NUNCA travar em loader infinito,
    // mas JAMAIS conceder autenticação caso não haja token válido.
    const safetyTimer = setTimeout(() => {
      if (!isCancelled) {
        setLoading((prev) => {
          if (prev) {
            setBackendStatus((st) => (st === 'checking' ? 'unavailable' : st))
            setBackendError(
              (prevErr) => prevErr || 'Tempo limite esgotado ao inicializar subsistema.',
            )
            return false
          }
          return false
        })
      }
    }, HEALTH_TIMEOUT_MS + 500)

    // Agendamento periódico de renovação preventiva (a cada 10 minutos)
    const REFRESH_INTERVAL_MS = 10 * 60 * 1000
    const refreshTimer = setInterval(() => {
      if (!isCancelled && pb.authStore.isValid) {
        performTokenRefresh().catch(() => {})
      }
    }, REFRESH_INTERVAL_MS)

    return () => {
      isCancelled = true
      clearTimeout(safetyTimer)
      clearInterval(refreshTimer)
      unsub()
    }
  }, [checkBackendHealth, performTokenRefresh])

  const login = async (
    email: string,
    pass: string,
  ): Promise<{ success: boolean; error?: string }> => {
    // Se o backend estiver sabidamente indisponível, tenta checar novamente antes
    if (backendStatus === 'unavailable') {
      const alive = await checkBackendHealth()
      if (!alive) {
        return {
          success: false,
          error:
            'Servidor backend de autenticação está offline/indisponível. Não é possível validar credenciais.',
        }
      }
    }

    try {
      const res = await pb.collection('users').authWithPassword(email.trim(), pass)
      setUser(res.record)
      setBackendStatus('available')
      setBackendError(null)
      return { success: true }
    } catch (err: any) {
      const isNetworkError =
        err?.status === 0 ||
        err?.isAbort ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('NetworkError') ||
        (err?.name === 'ClientResponseError' && err?.status === 0)

      if (isNetworkError) {
        setBackendStatus('unavailable')
        setBackendError('Servidor indisponível no momento. Tente novamente mais tarde.')
        return {
          success: false,
          error: 'Falha de comunicação: servidor backend não respondeu.',
        }
      }

      return {
        success: false,
        error: err?.message || 'Credenciais inválidas. Verifique o e-mail e a senha digitados.',
      }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  const isOfflineMode = backendStatus === 'unavailable'

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        backendStatus,
        backendError,
        login,
        logout,
        checkBackendHealth,
        isOfflineMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
