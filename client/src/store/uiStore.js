import { create } from 'zustand'

const themeKey = (userId) => `assettrack-theme-${userId || 'guest'}`

function applyTheme(theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

const useUiStore = create((set) => ({
  sidebarOpen: true,
  activeModal: null,
  theme: 'system',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),

  // Called on login / app mount — reads saved preference for this user
  initTheme: (userId) => {
    const saved = localStorage.getItem(themeKey(userId)) || 'system'
    applyTheme(saved)
    set({ theme: saved })
  },

  // Called from Settings — saves and immediately applies
  setTheme: (theme, userId) => {
    localStorage.setItem(themeKey(userId), theme)
    applyTheme(theme)
    set({ theme })
  },

  // Legacy toggle kept for backward compat with Header button
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      return { theme: next }
    }),
}))

// Re-apply system theme when OS preference changes (for users on 'system' mode)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const theme = useUiStore.getState().theme
  if (theme === 'system') applyTheme('system')
})

export default useUiStore
