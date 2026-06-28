import { useQuery } from '@tanstack/react-query'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCompact } from '@/utils/currency'
import api from '@/services/api'

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
]

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  return (
    <div className="bg-background border rounded shadow-md px-3 py-2 text-sm">
      <p className="font-medium">{name}</p>
      <p className="text-muted-foreground">₹{Number(value).toLocaleString('en-IN')}</p>
    </div>
  )
}

function CustomLegend({ payload }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
      {payload.map((entry) => (
        <li key={entry.value} className="flex items-center gap-1 text-xs text-muted-foreground">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          {entry.value}
        </li>
      ))}
    </ul>
  )
}

export default function AllocationPie() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'allocation'],
    queryFn: () => api.get('/dashboard/allocation').then((r) => r.data),
  })

  const slices = data?.allocation ?? []

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Asset Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 bg-muted rounded animate-pulse" />
        ) : !slices.length ? (
          <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
            No assets to display.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {slices.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
