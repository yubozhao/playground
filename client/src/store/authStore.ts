import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthTokens } from '../types'
import { authApi } from '../services/api'
import toast from 'react-hot-toast'

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isLoading: boolean
  isAuthenticated: boolean
}

interface AuthActions {
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
  updateUser: (user: Partial<User>) => void
  initializeAuth: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authApi.login({ email, password })
          
          if (response.success) {
            const { user, accessToken, refreshToken } = response.data
            set({
              user,
              token: accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            })
            toast.success('Successfully logged in!')
            return true
          } else {
            toast.error(response.error || 'Login failed')
            set({ isLoading: false })
            return false
          }
        } catch (error) {
          console.error('Login error:', error)
          toast.error('Login failed. Please try again.')
          set({ isLoading: false })
          return false
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const response = await authApi.register({ email, password, confirmPassword: password })
          
          if (response.success) {
            const { user, accessToken, refreshToken } = response.data
            set({
              user,
              token: accessToken,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            })
            toast.success('Account created successfully!')
            return true
          } else {
            toast.error(response.error || 'Registration failed')
            set({ isLoading: false })
            return false
          }
        } catch (error) {
          console.error('Registration error:', error)
          toast.error('Registration failed. Please try again.')
          set({ isLoading: false })
          return false
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        })
        toast.success('Successfully logged out')
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return false

        try {
          const response = await authApi.refreshToken(refreshToken)
          
          if (response.success) {
            const { accessToken, refreshToken: newRefreshToken } = response.data
            set({
              token: accessToken,
              refreshToken: newRefreshToken,
            })
            return true
          } else {
            get().logout()
            return false
          }
        } catch (error) {
          console.error('Token refresh error:', error)
          get().logout()
          return false
        }
      },

      updateUser: (userData: Partial<User>) => {
        const { user } = get()
        if (user) {
          set({ user: { ...user, ...userData } })
        }
      },

      initializeAuth: () => {
        const { token, user } = get()
        if (token && user) {
          set({ isAuthenticated: true })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
    }
  )
)