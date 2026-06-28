import { useQuery } from '@tanstack/react-query'
import {
  TrendingUp, TrendingDown, Wallet, BarChart2, AlertCircle,
  Calendar, ShieldCheck, CreditCard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import NetWorthLine from '@/components/charts/NetWorthLine'
import AllocationPie from '@/components/charts/AllocationPie'
import TopHoldings from '@/components/charts/TopHoldings'
import { formatCompact, formatINR } from '@/utils/currency'
import api from '@/services/api'

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, trend }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon size={18} className="text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend != null && (
          <p className={`text-xs mt-1 flex items-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? '+' : ''}{trend.toFixed(2)}% overall return
          </p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Event type helpers ─────────────────────────────────────────────────────────

const EVENT_ICON = {
  maturity: Calendar,
  insurance: ShieldCheck,
  emi: CreditCard,
}

const EVENT_COLOR = {
  maturity: 'text-amber-600',
  insurance: 'text-blue-600',
  emi: 'text-purple-600',
}

function daysUntil(dateStr) {
  const diff = Math.ceil((new Date(dateStr) - new Date()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return `${diff}d`
}

function UpcomingEvents() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'upcoming-events'],
    queryFn: () => api.get('/dashboard/upcoming-events').then((r) => r.data),
  })

  const events = data?.events ?? []

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Upcoming Events</CardTitle>
        <CardDescription className="text-xs">Maturities, EMIs &amp; renewals in the next 60 days</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="h-48 m-6 bg-muted rounded animate-pulse" />
        ) : !events.length ? (
          <p className="text-sm text-muted-foreground px-6 py-4">No upcoming events.</p>
        ) : (
          <ul>
            {events.map((ev, i) => {
              const Icon = EVENT_ICON[ev.type] || Calendar
              const colorClass = EVENT_COLOR[ev.type] || 'text-muted-foreground'
              return (
                <li key={i} className="flex items-center gap-3 px-6 py-2.5 border-b last:border-0 text-sm">
                  <Icon size={15} className={`shrink-0 ${colorClass}`} />
                  <span className="flex-1 truncate">{ev.label}</span>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {daysUntil(ev.date)}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ── Dashboard page ─────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data),
    retry: false,
  })

  if (isError) {
    return (
      <PageWrapper title="Dashboard">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle size={18} />
            <span>Could not load dashboard. Make sure the server is running.</span>
          </CardContent>
        </Card>
      </PageWrapper>
    )
  }

  const s = data || {}

  return (
    <PageWrapper title="Dashboard" description="Your complete financial overview">

      {/* Row 1 — stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Net Worth"
              value={formatCompact(s.netWorth ?? 0)}
              sub={`Assets ${formatCompact(s.totalAssets ?? 0)} · Liabilities ${formatCompact(s.totalLiabilities ?? 0)}`}
              icon={Wallet}
              trend={s.overallReturn}
            />
            <StatCard
              title="Total Invested"
              value={formatCompact(s.totalInvested ?? 0)}
              icon={TrendingUp}
            />
            <StatCard
              title="Total Gain / Loss"
              value={formatINR(s.totalGain ?? 0)}
              sub={s.totalGain >= 0 ? 'unrealised gain' : 'unrealised loss'}
              icon={s.totalGain >= 0 ? TrendingUp : TrendingDown}
            />
            <StatCard
              title="Active Assets"
              value={s.assetCount ?? 0}
              sub="across all categories"
              icon={BarChart2}
            />
          </>
        )}
      </div>

      {/* Row 2 — charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3">
          <NetWorthLine />
        </div>
        <div className="lg:col-span-2">
          <AllocationPie />
        </div>
      </div>

      {/* Row 3 — holdings + events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopHoldings />
        <UpcomingEvents />
      </div>

    </PageWrapper>
  )
}
