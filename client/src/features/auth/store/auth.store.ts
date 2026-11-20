import { create } from 'zustand'
import type { User } from '@/lib/types'

interface Session {
  user: User
  accessToken: string
  refreshToken: string
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  sessionNotice: string | null
  setSession: (session: Session) => void
  setAccessToken: (accessToken: string) => void
  updateUser: (partialUser: Partial<User>) => void
  clearSession: (message?: string) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  sessionNotice: null,
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  setSession: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    set({ user, accessToken, refreshToken, sessionNotice: null })
  },
  setAccessToken: (accessToken) => {
    localStorage.setItem('accessToken', accessToken)
    set({ accessToken })
  },
  updateUser: (partialUser) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...partialUser } : null
    }))
  },
  clearSession: (message) => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      sessionNotice: message ?? null
    })
  }
}))
