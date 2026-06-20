import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Building2, TrendingUp, BarChart2, Gem,
  FileText, Shield, ShieldCheck, Home, CreditCard, Layers,
  Target, Calculator, FileBarChart, Users, Bell, Settings, ChevronLeft
} from 'lucide-react'
import useUiStore from '@/store/uiStore'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { type: 'section', label: 'Assets' },
  { label: 'Bank Accounts', icon: Building2, to: '/assets/bank-accounts' },
  { label: 'Mutual Funds', icon: TrendingUp, to: '/assets/mutual-funds' },
  { label: 'Stocks', icon: BarChart2, to: '/assets/stocks' },
  { label: 'Gold', icon: Gem, to: '/assets/gold' },
  { label: 'Bonds', icon: FileText, to: '/assets/bonds' },
  { label: 'Govt Schemes', icon: Shield, to: '/assets/govt-schemes' },
  { label: 'Insurance', icon: ShieldCheck, to: '/assets/insurance' },
  { label: 'Real Estate', icon: Home, to: '/assets/real-estate' },
  { label: 'Loans', icon: CreditCard, to: '/assets/loans' },
  { label: 'Alternatives', icon: Layers, to: '/assets/alternatives' },
  { type: 'section', label: 'Planning' },
  { label: 'Goals', icon: Target, to: '/goals' },
  { label: 'Tax', icon: Calculator, to: '/tax' },
  { label: 'Reports', icon: FileBarChart, to: '/reports' },
  { type: 'section', label: 'Account' },
  { label: 'Family', icon: Users, to: '/family' },
  { label: 'Alerts', icon: Bell, to: '/alerts' },
  { label: 'Settings', icon: Settings, to: '/settings' },
]

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUiStore()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-white border-r border-border flex flex-col transition-all duration-200 z-30',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-4 border-b border-border shrink-0">
        {sidebarOpen && (
          <span className="font-bold text-primary text-lg tracking-tight">AssetTrack</span>
        )}
        <button
          onClick={toggleSidebar}
          className={cn('ml-auto p-1 rounded hover:bg-accent transition-transform', !sidebarOpen && 'rotate-180 mx-auto')}
        >
          <ChevronLeft size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((item, i) => {
          if (item.type === 'section') {
            return sidebarOpen ? (
              <p key={i} className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {item.label}
              </p>
            ) : (
              <div key={i} className="my-2 border-t border-border" />
            )
          }
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  !sidebarOpen && 'justify-center px-2'
                )
              }
              title={!sidebarOpen ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>
    </aside>
  )
}
