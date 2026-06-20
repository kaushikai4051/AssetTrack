import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Wallet, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import PageWrapper from '@/components/layout/PageWrapper'
import { formatCompact, formatINR } from '@/utils/currency'
import api from '@/services/api'

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

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => api.get('/dashboard/summary').then((r) => r.data),
    retry: false,
  })

  if (isLoading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </PageWrapper>
    )
  }

  if (isError) {
    return (
      <PageWrapper title="Dashboard">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle size={18} />
            <span>Could not load dashboard data. Make sure the server is running.</span>
          </CardContent>
        </Card>
      </PageWrapper>
    )
  }

  const summary = data || {}

  return (
    <PageWrapper
      title="Dashboard"
      description="Your complete financial overview"
    >
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Net Worth"
          value={formatCompact(summary.netWorth ?? 0)}
          sub={`Assets: ${formatCompact(summary.totalAssets ?? 0)} · Liabilities: ${formatCompact(summary.totalLiabilities ?? 0)}`}
          icon={Wallet}
          trend={summary.overallReturn}
        />
        <StatCard
          title="Total Invested"
          value={formatCompact(summary.totalInvested ?? 0)}
          icon={TrendingUp}
        />
        <StatCard
          title="Total Gain / Loss"
          value={formatINR(summary.totalGain ?? 0)}
          icon={summary.totalGain >= 0 ? TrendingUp : TrendingDown}
        />
        <StatCard
          title="Active Assets"
          value={summary.assetCount ?? 0}
          sub="across all categories"
          icon={Wallet}
        />
      </div>

      {/* Upcoming events */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Events</CardTitle>
          <CardDescription>Maturities, due dates and reminders in the next 60 days</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.upcomingEvents?.length ? (
            <ul className="space-y-2">
              {summary.upcomingEvents.map((ev, i) => (
                <li key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span>{ev.label}</span>
                  <span className="text-muted-foreground">{ev.date}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming events. Add assets to get started.</p>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
