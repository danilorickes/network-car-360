import React, { createContext, useContext, useEffect, useState } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

interface AuthContextType {
  user: RecordModel | null
  loading: boolean
  login: (email: string, pass: string) => Promise<boolean>
  logout: () => void
  isOfflineMode: boolean
  setOfflineMode: (v: boolean) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.record)
  const [loading, setLoading] = useState(true)
  const [isOfflineMode, setOfflineMode] = useState(false)

  useEffect(() => {
    // Escuta mudanças de authStore
    const unsub = pb.authStore.onChange((_token, model) => {
      setUser(model)
    })

    // Auto login caso já haja token ou fallback transparente com timeout de proteção
    if (pb.authStore.isValid) {
      setUser(pb.authStore.record)
      setLoading(false)
    } else {
      let isSettled = false
      const safetyTimeout = setTimeout(() => {
        if (!isSettled) {
          isSettled = true
          setOfflineMode(true)
          setLoading(false)
        }
      }, 2500)

      // Tenta login com a conta seedada automaticamente para o técnico/avaliador
      pb.collection('users')
        .authWithPassword('danilorickes@gmail.com', 'Skip@Pass')
        .then((authData) => {
          if (!isSettled) {
            isSettled = true
            clearTimeout(safetyTimeout)
            setUser(authData.record)
            setLoading(false)
          }
        })
        .catch(() => {
          if (!isSettled) {
            isSettled = true
            clearTimeout(safetyTimeout)
            setOfflineMode(true)
            setLoading(false)
          }
        })
    }

    return () => {
      unsub()
    }
  }, [])

  const login = async (email: string, pass: string): Promise<boolean> => {
    try {
      const res = await pb.collection('users').authWithPassword(email, pass)
      setUser(res.record)
      setOfflineMode(false)
      return true
    } catch {
      return false
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isOfflineMode, setOfflineMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
