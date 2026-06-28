import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCompact } from '@/utils/currency'
import api from '@/services/api'

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border rounded shadow-md px-3 py-2 text-sm">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-primary">₹{Number(payload[0].value).toLocaleString('en-IN')}</p>
    </div>
  )
}

export default function NetWorthLine() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'net-worth-history'],
    queryFn: () => api.get('/dashboard/net-worth-history').then((r) => r.data),
  })

  const history = data?.history ?? []
  const hasData = history.some((d) => d.netWorth > 0)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Net Worth Trend</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 bg-muted rounded animate-pulse" />
        ) : !hasData ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            Add assets to see your net worth trend.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nwGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompact(v)}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#nwGradient)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
