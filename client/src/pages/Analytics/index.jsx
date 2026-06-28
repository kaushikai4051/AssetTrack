import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, ResponsiveContainer, LabelList,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Zap, AlertCircle, Droplets,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import { formatCompact, formatINR } from '@/utils/currency'
import api from '@/services/api'

// ── helpers ───────────────────────────────────────────────────────────────────

function pct(v) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
}

// ── Summary stat cards ────────────────────────────────────────────────────────

function SummaryCards({ data }) {
  const { totalGain, absoluteReturn, xirr } = data.summary
  const positive = totalGain >= 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Gain / Loss</CardTitle>
          {positive ? <TrendingUp size={18} className="text-green-600" /> : <TrendingDown size={18} className="text-red-500" />}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${positive ? 'text-green-600' : 'text-red-500'}`}>
            {formatINR(totalGain)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">unrealised gain/loss</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Absolute Return</CardTitle>
          <TrendingUp size={18} className="text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${absoluteReturn >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {pct(absoluteReturn)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">invested vs current</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio XIRR</CardTitle>
          <Zap size={18} className="text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {xirr !== null ? (
            <>
              <div className={`text-2xl font-bold ${xirr >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {pct(xirr)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">annualised return (approx)</p>
            </>
          ) : (
            <div className="text-2xl font-bold text-muted-foreground">—</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Category returns chart ────────────────────────────────────────────────────

const CAT_TOOLTIP_COLORS = { Invested: '#94a3b8', Current: '#6366f1' }

function CategoryTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded shadow-md px-3 py-2 text-sm space-y-1">
      <p className="font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: ₹{Number(p.value).toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  )
}

function CategoryReturns({ data }) {
  const chartData = data.map((c) => ({
    name: c.name,
    Invested: c.invested,
    Current: c.current,
    returnPct: c.returnPct,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Returns by Category</CardTitle>
        <CardDescription className="text-xs">Invested vs current value</CardDescription>
      </CardHeader>
      <CardContent>
        {!chartData.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No asset data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 52)}>
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 4, right: 64, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis
                type="number"
                tickFormatter={(v) => formatCompact(v)}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CategoryTooltip />} />
              <Legend
                iconType="square"
                iconSize={10}
                wrapperStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="Invested" fill="#94a3b8" radius={[0, 3, 3, 0]} barSize={10} />
              <Bar dataKey="Current" fill="#6366f1" radius={[0, 3, 3, 0]} barSize={10}>
                <LabelList
                  dataKey="returnPct"
                  position="right"
                  formatter={(v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`}
                  style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

// ── Benchmark comparison ──────────────────────────────────────────────────────

function BenchmarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{label}</p>
      <p style={{ color: payload[0].fill }}>{payload[0].value.toFixed(1)}%</p>
    </div>
  )
}

function BenchmarkComparison({ data }) {
  const chartData = data.map((b) => ({
    name: b.name,
    Return: b.returnPct,
    highlight: b.highlight,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Benchmark Comparison</CardTitle>
        <CardDescription className="text-xs">Your absolute return vs market benchmarks</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<BenchmarkTooltip />} />
            <Bar dataKey="Return" radius={[0, 3, 3, 0]} barSize={12}>
              {chartData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.highlight ? '#6366f1' : '#e2e8f0'}
                />
              ))}
              <LabelList
                dataKey="Return"
                position="right"
                formatter={(v) => `${v.toFixed(1)}%`}
                style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── Liquidity breakdown ───────────────────────────────────────────────────────

const LIQUIDITY_COLORS = ['#10b981', '#f59e0b', '#ef4444']
const LIQUIDITY_LABELS = [
  { key: 'liquid', label: 'Liquid', desc: 'Accessible in T+3 or less', color: '#10b981' },
  { key: 'semiLiquid', label: 'Semi-liquid', desc: 'Premature withdrawal possible', color: '#f59e0b' },
  { key: 'illiquid', label: 'Illiquid', desc: 'Locked or long-term', color: '#ef4444' },
]

function LiquidityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{payload[0].name}</p>
      <p className="text-muted-foreground">₹{Number(payload[0].value).toLocaleString('en-IN')}</p>
    </div>
  )
}

function LiquidityBreakdown({ data }) {
  const total = data.liquid + data.semiLiquid + data.illiquid
  const slices = LIQUIDITY_LABELS
    .map((l) => ({ name: l.label, value: data[l.key] }))
    .filter((s) => s.value > 0)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Droplets size={16} /> Liquidity Breakdown
        </CardTitle>
        <CardDescription className="text-xs">How quickly can you access your money?</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No assets yet.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={slices}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {slices.map((_, i) => (
                    <Cell key={i} fill={LIQUIDITY_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip content={<LiquidityTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <ul className="flex-1 space-y-3">
              {LIQUIDITY_LABELS.map((l) => {
                const val = data[l.key]
                const share = total > 0 ? (val / total) * 100 : 0
                return (
                  <li key={l.key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: l.color }} />
                        {l.label}
                      </span>
                      <span className="font-medium">
                        {formatCompact(val)} <span className="text-muted-foreground font-normal">({share.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${share}%`, background: l.color }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{l.desc}</p>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Concentration risk ────────────────────────────────────────────────────────

function ConcentrationRisk({ data }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Concentration Risk</CardTitle>
        <CardDescription className="text-xs">Top 5 holdings as % of total portfolio</CardDescription>
      </CardHeader>
      <CardContent>
        {!data.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No holdings yet.</p>
        ) : (
          <ul className="space-y-4">
            {data.map((h, i) => {
              const high = h.pct >= 30
              const mid = h.pct >= 15
              const barColor = high ? '#ef4444' : mid ? '#f59e0b' : '#6366f1'
              return (
                <li key={i}>
                  <div className="flex justify-between items-center text-sm mb-1.5">
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{h.name}</span>
                      <Badge variant="secondary" className="text-[10px] mt-0.5">{h.type}</Badge>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <span className="font-semibold">{h.pct.toFixed(1)}%</span>
                      <p className="text-xs text-muted-foreground">₹{formatCompact(h.value)}</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, h.pct)}%`, background: barColor }}
                    />
                  </div>
                  {high && (
                    <p className="text-[10px] text-red-500 mt-0.5">High concentration — consider diversifying</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => api.get('/analytics/overview').then((r) => r.data),
    retry: false,
  })

  if (isError) {
    return (
      <PageWrapper title="Portfolio Analytics">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle size={18} />
            <span>Could not load analytics. Make sure the server is running.</span>
          </CardContent>
        </Card>
      </PageWrapper>
    )
  }

  if (isLoading) {
    return (
      <PageWrapper title="Portfolio Analytics" description="Deeper insights into your portfolio performance">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
        <Card><CardContent className="p-6"><div className="h-48 bg-muted rounded animate-pulse" /></CardContent></Card>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper title="Portfolio Analytics" description="Deeper insights into your portfolio performance">

      {/* Row 1 — summary stats */}
      <SummaryCards data={data} />

      {/* Row 2 — category returns (full width) */}
      <CategoryReturns data={data.categoryReturns} />

      {/* Row 3 — benchmark + liquidity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BenchmarkComparison data={data.benchmarks} />
        <LiquidityBreakdown data={data.liquidity} />
      </div>

      {/* Row 4 — concentration risk */}
      <ConcentrationRisk data={data.concentrationRisk} />

    </PageWrapper>
  )
}
