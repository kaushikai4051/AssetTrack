import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCompact } from '@/utils/currency'
import api from '@/services/api'

const TYPE_LABEL = {
  fixed_deposit: 'FD',
  recurring_deposit: 'RD',
  savings_account: 'Savings',
  mutual_fund: 'MF',
  stock: 'Stock',
  gold: 'Gold',
  corporate_bond: 'Bond',
  gsec_bond: 'G-Sec',
  tax_free_bond: 'Bond',
  ppf: 'PPF',
  nps: 'NPS',
  epf: 'EPF',
  ssy: 'SSY',
  nsc: 'NSC',
  scss: 'SCSS',
  kvp: 'KVP',
  post_office: 'Post Office',
  life_insurance: 'Life Ins.',
  health_insurance: 'Health Ins.',
  vehicle_insurance: 'Vehicle Ins.',
  property: 'Property',
  reit: 'REIT',
  crypto: 'Crypto',
  chit_fund: 'Chit Fund',
  p2p_lending: 'P2P',
  angel_investment: 'Angel',
  unlisted_shares: 'Unlisted',
}

export default function TopHoldings() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'top-holdings'],
    queryFn: () => api.get('/dashboard/top-holdings').then((r) => r.data),
  })

  const holdings = data?.holdings ?? []

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Top Holdings</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="h-48 m-6 bg-muted rounded animate-pulse" />
        ) : !holdings.length ? (
          <p className="text-sm text-muted-foreground px-6 py-4">No assets yet.</p>
        ) : (
          <ul>
            {holdings.map((h, i) => {
              const ret = parseFloat(h.return_pct)
              const positive = ret >= 0
              return (
                <li
                  key={i}
                  className="flex items-center justify-between px-6 py-2.5 border-b last:border-0 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{h.asset_name}</p>
                      <Badge variant="secondary" className="text-xs mt-0.5">
                        {TYPE_LABEL[h.asset_type] || h.asset_type}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold">₹{formatCompact(h.current_value)}</p>
                    {parseFloat(h.invested_amount) > 0 && (
                      <p className={`flex items-center justify-end gap-0.5 text-xs ${positive ? 'text-green-600' : 'text-red-500'}`}>
                        {positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {positive ? '+' : ''}{ret.toFixed(1)}%
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
