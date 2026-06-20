import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoggedIn: false,

      login: (user, accessToken) => set({ user, accessToken, isLoggedIn: true }),

      logout: () => set({ user: null, accessToken: null, isLoggedIn: false }),

      setAccessToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isLoggedIn: state.isLoggedIn }),
    }
  )
)

export default useAuthStore
