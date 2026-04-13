import { useAuth } from '@/stores/auth'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button, Card } from '@/components/ui'
import { useNavigate } from 'react-router-dom'

export function DashboardPage() {
  const me = useAuth((s) => s.me)
  const logout = useAuth((s) => s.logout)
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary" />
          <h1 className="text-lg font-semibold">CuePoint</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button onClick={handleLogout} className="bg-muted text-foreground hover:opacity-80">
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <Card>
          <h2 className="text-xl font-semibold">Welcome{me?.name ? `, ${me.name}` : ''}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This is your control center. Room and timer tools ship in the next phase.
          </p>
        </Card>
      </main>
    </div>
  )
}
