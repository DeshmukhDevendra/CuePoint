import { useTheme, type Theme } from '@/stores/theme'
import { cn } from '@/lib/cn'

const OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'Auto' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <div className="inline-flex items-center rounded-lg border bg-card p-1 text-sm">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setTheme(opt.value)}
          className={cn(
            'rounded-md px-3 py-1 transition-colors',
            theme === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
