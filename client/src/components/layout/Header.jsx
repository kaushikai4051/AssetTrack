import { Bell, User } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import useAuthStore from '@/store/authStore'
import useFilterStore from '@/store/filterStore'
import { FINANCIAL_YEARS } from '@/utils/constants'
import api from '@/services/api'

export default function Header() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const { activeFY, setActiveFY, activeMemberId, setActiveMember } = useFilterStore()

  const { data: members = [] } = useQuery({
    queryKey: ['family-members-header'],
    queryFn: () => api.get('/family').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <header className="h-14 border-b border-border bg-background flex items-center px-6 gap-4 shrink-0">
      {/* FY selector */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">FY</span>
        <select
          value={activeFY}
          onChange={(e) => setActiveFY(e.target.value)}
          className="border border-input rounded px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {FINANCIAL_YEARS.map((fy) => (
            <option key={fy} value={fy}>{fy}</option>
          ))}
        </select>
      </div>

      {/* Family member selector — only shown when members exist */}
      {members.length > 0 && (
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground hidden sm:inline">Viewing</span>
          <select
            value={activeMemberId === null ? 'all' : activeMemberId === 0 ? 'self' : String(activeMemberId)}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'all')  setActiveMember(null)
              else if (v === 'self') setActiveMember(0)
              else setActiveMember(parseInt(v))
            }}
            className="border border-input rounded px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Members</option>
            <option value="self">Self</option>
            {members.map((m) => (
              <option key={m.id} value={String(m.id)}>{m.full_name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-destructive rounded-full" />
        </Button>

        {/* User menu */}
        <div className="flex items-center gap-2 pl-2 border-l border-border">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <User size={14} className="text-primary" />
          </div>
          {user && (
            <span className="text-sm font-medium hidden sm:block">
              {user.full_name || user.email}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground text-xs">
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
