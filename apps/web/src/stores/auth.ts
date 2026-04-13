import { create } from 'zustand'
import { api, ApiError } from '@/lib/api'

export interface Me {
  id: string
  email: string
  name: string | null
}

interface AuthState {
  me: Me | null
  loading: boolean
  loaded: boolean
  fetchMe: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
}

export const useAuth = create<AuthState>((set) => ({
  me: null,
  loading: false,
  loaded: false,
  async fetchMe() {
    set({ loading: true })
    try {
      const me = await api.get<Me>('/auth/me')
      set({ me, loaded: true })
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        set({ me: null, loaded: true })
      } else {
        throw e
      }
    } finally {
      set({ loading: false })
    }
  },
  async login(email, password) {
    const me = await api.post<Me>('/auth/login', { email, password })
    set({ me, loaded: true })
  },
  async signup(email, password, name) {
    const me = await api.post<Me>('/auth/signup', { email, password, name })
    set({ me, loaded: true })
  },
  async logout() {
    await api.post('/auth/logout')
    set({ me: null })
  },
}))
