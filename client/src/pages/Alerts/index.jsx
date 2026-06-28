import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Calendar, ShieldCheck, CreditCard, Target, BookOpen,
  AlertTriangle, AlertCircle, Info, Bell, BellOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PageWrapper from '@/components/layout/PageWrapper'
import api from '@/services/api'

// ── Config ────────────────────────────────────────────────────────────────────

const DAYS_OPTIONS = [30, 60, 90]

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'maturity', label: 'Maturity' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'emi', label: 'EMI' },
  { key: 'goal', label: 'Goals' },
  { key: 'contribution', label: 'Contributions' },
]

const CATEGORY_ICON = {
  maturity: Calendar,
  insurance: ShieldCheck,
  emi: CreditCard,
  goal: Target,
  contribution: BookOpen,
}

const PRIORITY_CONFIG = {
  urgent: {
    icon: AlertTriangle,
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    borderClass: 'border-l-red-500',
    label: 'Urgent',
  },
  warning: {
    icon: AlertCircle,
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    borderClass: 'border-l-amber-500',
    label: 'Soon',
  },
  info: {
    icon: Info,
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    borderClass: 'border-l-blue-400',
    label: 'Upcoming',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function daysLabel(n) {
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  return `${n} days`
}

// ── Alert card ────────────────────────────────────────────────────────────────

function AlertCard({ alert }) {
  const pConf = PRIORITY_CONFIG[alert.priority]
  const CatIcon = CATEGORY_ICON[alert.category] || Calendar
  const PriorityIcon = pConf.icon

  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border border-border border-l-4 ${pConf.borderClass} bg-card`}>
      <div className="shrink-0 mt-0.5">
        <CatIcon size={18} className="text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-snug">{alert.title}</p>
        {alert.detail && (
          <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{formatDate(alert.date)}</p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <Badge className={`text-[10px] border ${pConf.badgeClass}`} variant="outline">
          <PriorityIcon size={10} className="mr-1" />
          {pConf.label}
        </Badge>
        <span className="text-xs font-semibold text-muted-foreground">
          {daysLabel(alert.daysLeft)}
        </span>
      </div>
    </div>
  )
}

// ── Summary chips ─────────────────────────────────────────────────────────────

function SummaryChips({ alerts }) {
  const urgent = alerts.filter((a) => a.priority === 'urgent').length
  const warning = alerts.filter((a) => a.priority === 'warning').length
  return (
    <div className="flex gap-2 flex-wrap">
      {urgent > 0 && (
        <Badge className="bg-red-100 text-red-700 border border-red-200">
          <AlertTriangle size={11} className="mr-1" /> {urgent} urgent
        </Badge>
      )}
      {warning > 0 && (
        <Badge className="bg-amber-100 text-amber-700 border border-amber-200">
          <AlertCircle size={11} className="mr-1" /> {warning} upcoming soon
        </Badge>
      )}
      {urgent === 0 && warning === 0 && alerts.length > 0 && (
        <Badge className="bg-blue-100 text-blue-700 border border-blue-200">
          <Info size={11} className="mr-1" /> {alerts.length} upcoming
        </Badge>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Alerts() {
  const [days, setDays] = useState(60)
  const [activeCategory, setActiveCategory] = useState('all')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['alerts', 'all', days],
    queryFn: () => api.get(`/alerts/all?days=${days}`).then((r) => r.data),
    retry: false,
  })

  const allAlerts = data?.alerts ?? []
  const filtered = activeCategory === 'all'
    ? allAlerts
    : allAlerts.filter((a) => a.category === activeCategory)

  const countFor = (cat) =>
    cat === 'all' ? allAlerts.length : allAlerts.filter((a) => a.category === cat).length

  return (
    <PageWrapper
      title="Alerts & Notifications"
      description="Upcoming maturities, due dates, and financial reminders"
    >
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SummaryChips alerts={allAlerts} />

        {/* Days selector */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map((cat) => {
          const count = countFor(cat.key)
          const active = activeCategory === cat.key
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {cat.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs ${active ? 'opacity-80' : 'text-muted-foreground'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Alert list */}
      {isError ? (
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle size={18} />
            <span>Could not load alerts. Make sure the server is running.</span>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <BellOff size={32} />
            <p className="font-medium">
              {allAlerts.length === 0
                ? `No alerts in the next ${days} days`
                : `No ${activeCategory} alerts in the next ${days} days`}
            </p>
            <p className="text-sm">Add assets to start receiving reminders.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
