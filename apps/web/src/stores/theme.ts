import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'cuepoint-theme'

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

function readInitial(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {}
  return 'system'
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

export const useTheme = create<ThemeState>((set) => ({
  theme: readInitial(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {}
    applyTheme(theme)
    set({ theme })
  },
}))

// Apply on load & listen for system changes.
applyTheme(readInitial())
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useTheme.getState()
    if (theme === 'system') applyTheme('system')
  })
}
