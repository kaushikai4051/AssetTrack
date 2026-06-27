import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Receipt, TrendingDown, TrendingUp, Lightbulb, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PageWrapper from '@/components/layout/PageWrapper'
import { formatINR, formatCompact } from '@/utils/currency'
import api from '@/services/api'

function buildFYOptions() {
  const now = new Date()
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 4 }, (_, i) => {
    const y = currentFYStart - i
    return `${y}-${String(y + 1).slice(-2)}`
  })
}
const FY_OPTIONS = buildFYOptions()

// ── FY selector ───────────────────────────────────────────────────────────────

function FYSelector({ fy, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Financial Year</span>
      <select
        className="border rounded px-2 py-1 text-sm bg-background"
        value={fy}
        onChange={(e) => onChange(e.target.value)}
      >
        {FY_OPTIONS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>
    </div>
  )
}

// ── Deduction progress bar ────────────────────────────────────────────────────

function DeductionBar({ label, used, limit, items }) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.min(100, (used / limit) * 100)
  const color = pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">Section {label}</span>
          <span className="text-xs text-muted-foreground ml-2">
            Limit: {formatINR(limit)}
          </span>
        </div>
        <div className="text-right">
          <span className="font-semibold text-green-600">{formatINR(used)}</span>
          <span className="text-muted-foreground text-sm"> / {formatINR(limit)}</span>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {items.length > 0 && (
        <>
          <button
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide' : 'Show'} breakdown
          </button>
          {expanded && (
            <div className="mt-2 space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span>{formatINR(item.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {pct >= 100 && (
        <Badge className="text-xs bg-green-100 text-green-700">Limit Exhausted</Badge>
      )}
      {pct < 100 && (
        <p className="text-xs text-muted-foreground">
          {formatINR(limit - used)} remaining to invest
        </p>
      )}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = ['Deductions', 'Capital Gains', 'Tax Harvesting']

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TaxPage() {
  const [fy, setFy] = useState(FY_OPTIONS[0])
  const [tab, setTab] = useState('Deductions')

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['tax-summary', fy],
    queryFn: () => api.get(`/tax/summary?fy=${fy}`).then((r) => r.data),
  })

  const { data: deductions, isLoading: loadingDed } = useQuery({
    queryKey: ['tax-deductions', fy],
    queryFn: () => api.get(`/tax/deductions?fy=${fy}`).then((r) => r.data),
    enabled: tab === 'Deductions',
  })

  const { data: gains, isLoading: loadingGains } = useQuery({
    queryKey: ['tax-capital-gains', fy],
    queryFn: () => api.get(`/tax/capital-gains?fy=${fy}`).then((r) => r.data),
    enabled: tab === 'Capital Gains',
  })

  const { data: harvest, isLoading: loadingHarvest } = useQuery({
    queryKey: ['tax-harvesting'],
    queryFn: () => api.get('/tax/harvesting-suggestions').then((r) => r.data),
    enabled: tab === 'Tax Harvesting',
  })

  return (
    <PageWrapper title="Tax" subtitle="Capital gains, deductions & tax harvesting">
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <FYSelector fy={fy} onChange={setFy} />
        </div>

        {/* Summary cards */}
        {!loadingSummary && summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Equity LTCG</p>
                <p className="text-lg font-semibold">{formatCompact(summary.capital_gains.equity_ltcg)}</p>
                <p className="text-xs text-muted-foreground">12.5% above ₹1.25L</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">Equity STCG</p>
                <p className="text-lg font-semibold">{formatCompact(summary.capital_gains.equity_stcg)}</p>
                <p className="text-xs text-muted-foreground">20% flat</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">CG Tax Estimate</p>
                <p className="text-lg font-semibold text-red-600">{formatCompact(summary.capital_gains.total_cg_tax)}</p>
                <p className="text-xs text-muted-foreground">Equity only</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground">80C Used</p>
                <p className="text-lg font-semibold text-green-600">{formatINR(summary.deductions['80C'].used)}</p>
                <p className="text-xs text-muted-foreground">of {formatINR(summary.deductions['80C'].limit)}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 border-b">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── Deductions tab ─────────────────────────────────────────────── */}
        {tab === 'Deductions' && (
          <>
            {loadingDed && <p className="text-sm text-muted-foreground">Loading…</p>}
            {deductions && (
              <div className="space-y-3">
                <DeductionBar label="80C" {...deductions['80C']} />
                <DeductionBar label="80D" {...deductions['80D']} />
                <DeductionBar label="24b (Home Loan Interest)" {...deductions['24b']} />
                <DeductionBar label="80CCD(1B) — NPS" {...deductions['80CCD1B']} />
              </div>
            )}
            {deductions && !deductions['80C'].items.length && !deductions['80D'].items.length && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No deduction data found for FY {fy}. Add PPF deposits, ELSS investments, or insurance policies.
              </p>
            )}
          </>
        )}

        {/* ── Capital Gains tab ──────────────────────────────────────────── */}
        {tab === 'Capital Gains' && (
          <>
            {loadingGains && <p className="text-sm text-muted-foreground">Loading…</p>}
            {gains && (
              <div className="space-y-4">
                {/* Tax summary */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Tax Computation — FY {gains.fy}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Equity LTCG</span>
                      <span className={gains.tax.equity_ltcg >= 0 ? 'text-green-600' : 'text-red-500'}>{formatINR(gains.tax.equity_ltcg)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">LTCG Exemption</span>
                      <span className="text-muted-foreground">− {formatINR(gains.tax.equity_ltcg_exempt)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t pt-2">
                      <span>Taxable LTCG @ 12.5%</span>
                      <span>{formatINR(gains.tax.taxable_ltcg)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equity STCG @ 20%</span>
                      <span>{formatINR(gains.tax.equity_stcg)}</span>
                    </div>
                    {gains.tax.debt_income > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Debt MF Gains (Slab)</span>
                        <span>{formatINR(gains.tax.debt_income)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-red-600 border-t pt-2">
                      <span>Estimated CG Tax</span>
                      <span>{formatINR(gains.tax.total_cg_tax)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Per-asset breakdown */}
                {(gains.stocks.length > 0 || gains.mutual_funds.length > 0) ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4">Asset</th>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4 text-right">LTCG</th>
                          <th className="py-2 pr-4 text-right">STCG</th>
                          <th className="py-2 text-right">Lots</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gains.stocks.map((s, i) => (
                          <tr key={i} className="border-b hover:bg-muted/50">
                            <td className="py-2 pr-4 font-medium">{s.company_name || s.name} <span className="text-xs text-muted-foreground">{s.ticker}</span></td>
                            <td className="py-2 pr-4"><Badge variant="outline" className="text-xs">Stock</Badge></td>
                            <td className={`py-2 pr-4 text-right ${s.ltcg >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatINR(s.ltcg)}</td>
                            <td className={`py-2 pr-4 text-right ${s.stcg >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatINR(s.stcg)}</td>
                            <td className="py-2 text-right text-muted-foreground">{s.lots}</td>
                          </tr>
                        ))}
                        {gains.mutual_funds.map((m, i) => (
                          <tr key={i} className="border-b hover:bg-muted/50">
                            <td className="py-2 pr-4 font-medium">{m.name}</td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs">{m.category || 'MF'}</Badge>
                            </td>
                            <td className={`py-2 pr-4 text-right ${m.ltcg >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatINR(m.ltcg)}</td>
                            <td className={`py-2 pr-4 text-right ${m.stcg >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatINR(m.stcg)}</td>
                            <td className="py-2 text-right text-muted-foreground">{m.lots}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No realized gains in FY {fy}. Sell transactions will appear here.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Tax Harvesting tab ─────────────────────────────────────────── */}
        {tab === 'Tax Harvesting' && (
          <>
            {loadingHarvest && <p className="text-sm text-muted-foreground">Loading…</p>}
            {harvest && (
              <div className="space-y-4">
                {/* Summary banner */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Harvestable Loss</p>
                      <p className="text-lg font-semibold text-red-500">
                        − {formatCompact(harvest.total_harvestable_loss)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Unrealized Gain</p>
                      <p className="text-lg font-semibold text-green-600">
                        {formatCompact(harvest.total_unrealized_gain)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-xs text-muted-foreground">Potential Tax Saving</p>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatCompact(harvest.potential_tax_saving)}
                      </p>
                      <p className="text-xs text-muted-foreground">at 20% STCG rate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Tip */}
                <div className="flex gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm">
                  <Lightbulb size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-amber-800 dark:text-amber-200">
                    Sell loss-making positions to offset gains. Re-buy after 30 days to maintain allocation. Losses can offset gains of the same type (STCG offsets STCG; LTCG offsets LTCG).
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Losers */}
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <TrendingDown size={14} className="text-red-500" /> Positions to Harvest
                    </h3>
                    {harvest.losers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No unrealized losses</p>
                    ) : (
                      <div className="space-y-2">
                        {harvest.losers.map((l, i) => (
                          <div key={i} className="border rounded p-3 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">{l.name}</span>
                              <span className="text-red-500">{formatINR(l.unrealized_gain)}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>LTCG {formatINR(l.ltcg)}</span>
                              <span>STCG {formatINR(l.stcg)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gainers */}
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <TrendingUp size={14} className="text-green-600" /> Positions with Gains
                    </h3>
                    {harvest.gainers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No unrealized gains</p>
                    ) : (
                      <div className="space-y-2">
                        {harvest.gainers.map((g, i) => (
                          <div key={i} className="border rounded p-3 text-sm">
                            <div className="flex justify-between">
                              <span className="font-medium">{g.name}</span>
                              <span className="text-green-600">{formatINR(g.unrealized_gain)}</span>
                            </div>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>LTCG {formatINR(g.ltcg)}</span>
                              <span>STCG {formatINR(g.stcg)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageWrapper>
  )
}
