import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, RefreshCw, PlusCircle, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import StockForm from './StockForm'
import StockTransactionForm from './StockTransactionForm'
import { formatINR, formatCompact, formatReturn } from '@/utils/currency'
import useFilterStore from '@/store/filterStore'
import api from '@/services/api'

function PnlBadge({ pct }) {
  if (pct == null) return null
  const pos = pct >= 0
  return (
    <Badge className={pos
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-red-100 text-red-700 border-red-200'}>
      {formatReturn(pct)}
    </Badge>
  )
}

function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) return (
    <span className="flex items-center gap-2 border border-destructive/40 bg-destructive/5 rounded-md px-2 py-1">
      <span className="text-xs text-destructive font-medium whitespace-nowrap">Delete?</span>
      <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={onConfirm}>Yes</Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirming(false)}>No</Button>
    </span>
  )
  return (
    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}><Trash2 size={14} /></Button>
  )
}

const TX_TYPE_META = {
  buy:   { label: 'Buy',   color: 'bg-green-100 text-green-700' },
  sell:  { label: 'Sell',  color: 'bg-red-100 text-red-700'   },
  bonus: { label: 'Bonus', color: 'bg-blue-100 text-blue-700'  },
  split: { label: 'Split', color: 'bg-purple-100 text-purple-700' },
}

function TxDeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) return (
    <span className="flex items-center gap-1">
      <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={onConfirm}>Yes</Button>
      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirming(false)}>No</Button>
    </span>
  )
  return (
    <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive"
      onClick={() => setConfirming(true)}><Trash2 size={12} /></Button>
  )
}

function StockTransactionHistory({ holding, onAddTx }) {
  const qc = useQueryClient()

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ['stock-txns', holding.asset_id],
    queryFn:  () => api.get(`/assets/stocks/${holding.asset_id}/transactions`).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (txId) => api.delete(`/assets/stocks/${holding.asset_id}/transactions/${txId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-txns', holding.asset_id] })
      qc.invalidateQueries({ queryKey: ['stocks'] })
    },
  })

  // Mini dashboard
  const totalInvested  = txs.filter((t) => t.type === 'buy')
                            .reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalRealised  = txs.filter((t) => t.type === 'sell')
                            .reduce((s, t) => s + Number(t.amount || 0), 0)
  const totalBrokerage = txs.filter((t) => t.type === 'buy' || t.type === 'sell')
                            .reduce((s, t) => s + Number(t.brokerage || 0), 0)
  const bonusShares    = txs.filter((t) => t.type === 'bonus')
                            .reduce((s, t) => s + Number(t.shares || 0), 0)

  // Read live avg cost + shares from cache
  const allStocks   = qc.getQueryData(['stocks']) || []
  const live        = allStocks.find((s) => s.asset_id === holding.asset_id) || holding
  const sharesHeld  = Number(live.shares_held  || holding.shares_held  || 0)
  const avgCost     = Number(live.avg_cost_price || holding.avg_cost_price || 0)

  const summaryCards = [
    { label: 'Total Invested',   value: formatINR(totalInvested),  color: 'text-blue-700'  },
    { label: 'Total Realised',   value: formatINR(totalRealised),  color: 'text-green-700' },
    { label: 'Brokerage / STT',  value: formatINR(totalBrokerage), color: 'text-amber-700' },
    { label: 'Shares Held',      value: sharesHeld.toFixed(4),     color: 'text-foreground font-semibold' },
    { label: 'Avg Cost (₹)',     value: avgCost.toFixed(2),        color: 'text-foreground' },
    ...(bonusShares > 0 ? [{ label: 'Bonus Shares', value: bonusShares.toFixed(0), color: 'text-purple-700' }] : []),
  ]

  return (
    <div className="space-y-4">
      {/* Mini dashboard */}
      <div className="grid grid-cols-3 gap-3">
        {summaryCards.map(({ label, value, color }) => (
          <div key={label} className="bg-muted/50 rounded-md p-3 text-center">
            <div className="text-xs text-muted-foreground mb-1">{label}</div>
            <div className={`text-sm font-medium ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Transaction table */}
      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !txs.length ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No transactions recorded yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="border-b text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Shares</th>
                <th className="text-right px-3 py-2 font-medium hidden sm:table-cell">Price (₹)</th>
                <th className="text-right px-3 py-2 font-medium hidden md:table-cell">Brokerage (₹)</th>
                <th className="text-right px-3 py-2 font-medium">Amount (₹)</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {txs.map((t) => {
                const meta      = TX_TYPE_META[t.type] || { label: t.type, color: '' }
                const isBonusSplit = t.type === 'bonus' || t.type === 'split'
                const isSell    = t.type === 'sell'
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {String(t.transaction_date).slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {t.type === 'split'
                        ? `${Number(t.shares)}:1`
                        : Number(t.shares).toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono hidden sm:table-cell">
                      {isBonusSplit ? '—' : `₹${Number(t.price).toFixed(2)}`}
                    </td>
                    <td className="px-3 py-2 text-right font-mono hidden md:table-cell text-muted-foreground">
                      {isBonusSplit ? '—' : `₹${Number(t.brokerage || 0).toFixed(2)}`}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-medium ${
                      isBonusSplit ? 'text-muted-foreground' : isSell ? 'text-green-700' : 'text-red-600'
                    }`}>
                      {isBonusSplit ? '—' : `${isSell ? '+' : '−'}${formatINR(Number(t.amount || 0))}`}
                    </td>
                    <td className="px-2 py-2">
                      <TxDeleteButton onConfirm={() => deleteMutation.mutate(t.id)} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end pt-1 border-t">
        <Button size="sm" onClick={onAddTx}>
          <PlusCircle size={13} className="mr-1" />Add Transaction
        </Button>
      </div>
    </div>
  )
}

// Group holdings by sector for display
function groupBySector(holdings) {
  const groups = {}
  for (const h of holdings) {
    const s = h.sector || 'Other'
    ;(groups[s] = groups[s] || []).push(h)
  }
  return groups
}

export default function Stocks() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | {type:'add'} | {type:'tx',holding} | {type:'history',holding}
  const [activeSector, setActiveSector] = useState('All')
  const [refreshing, setRefreshing] = useState(new Set()) // asset_ids currently fetching price
  const [refreshError, setRefreshError] = useState(null)  // { assetId, message }
  const activeMemberId = useFilterStore((s) => s.activeMemberId)
  const fmParam = activeMemberId === null ? '' : `?family_member_id=${activeMemberId === 0 ? 'self' : activeMemberId}`

  const { data = [], isLoading } = useQuery({
    queryKey: ['stocks', activeMemberId],
    queryFn: () => api.get(`/assets/stocks${fmParam}`).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/stocks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const refreshPrice = async (holding) => {
    setRefreshing((prev) => new Set(prev).add(holding.asset_id))
    setRefreshError(null)
    try {
      await api.get(`/market/stock-price/${holding.ticker}?exchange=${holding.exchange}`)
      qc.invalidateQueries({ queryKey: ['stocks'] })
    } catch (err) {
      const msg = err?.response?.data?.message || 'Could not fetch price. Yahoo Finance may be unavailable.'
      setRefreshError({ assetId: holding.asset_id, message: msg })
    } finally {
      setRefreshing((prev) => {
        const next = new Set(prev)
        next.delete(holding.asset_id)
        return next
      })
    }
  }

  const totalValue    = data.reduce((s, h) => s + (h.current_value || 0), 0)
  const totalInvested = data.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalPnl      = totalValue - totalInvested
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  const sectors   = ['All', ...Array.from(new Set(data.map((h) => h.sector || 'Other')))]
  const filtered  = activeSector === 'All' ? data : data.filter((h) => (h.sector || 'Other') === activeSector)

  return (
    <PageWrapper
      title="Stocks"
      description="Indian and international equity holdings with capital gains tracking"
      actions={
        <Button size="sm" onClick={() => setModal({ type: 'add' })}>
          <Plus size={14} className="mr-1" />Add Stock
        </Button>
      }
    >
      {/* Summary */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Current Value',   value: formatCompact(totalValue) },
            { label: 'Invested',        value: formatCompact(totalInvested) },
            { label: 'Unrealised P&L',  value: formatCompact(totalPnl), color: totalPnl >= 0 ? 'text-green-700' : 'text-red-600' },
            { label: 'Overall Return',  value: formatReturn(totalPnlPct), color: totalPnlPct >= 0 ? 'text-green-700' : 'text-red-600' },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-lg font-bold ${color || ''}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sector filter tabs */}
      {sectors.length > 2 && (
        <div className="flex gap-1 flex-wrap">
          {sectors.map((s) => (
            <button key={s} onClick={() => setActiveSector(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeSector === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input text-muted-foreground hover:text-foreground'
              }`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Holdings list */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !data.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-muted-foreground text-sm">No stocks added yet.</p>
            <Button size="sm" onClick={() => setModal({ type: 'add' })}>
              <Plus size={14} className="mr-1" />Add Stock
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => {
            const cmp     = h.last_price || h.avg_cost_price
            const hasCMP  = Boolean(h.last_price)
            return (
              <Card key={h.asset_id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{h.company_name}</span>
                        <Badge variant="outline" className="text-xs font-mono">{h.ticker}</Badge>
                        <Badge variant="outline" className="text-xs">{h.exchange}</Badge>
                      </div>
                      {h.sector && <p className="text-xs text-muted-foreground mt-0.5">{h.sector}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {h.shares_held} shares · Avg ₹{h.avg_cost_price?.toFixed(2)}
                        {hasCMP ? ` · CMP ₹${h.last_price}` : ' · No price'}
                        {h.broker ? ` · ${h.broker}` : ''}
                      </p>
                      {refreshError?.assetId === h.asset_id && (
                        <p className="text-xs text-destructive mt-1">{refreshError.message}</p>
                      )}
                    </div>

                    {/* Financials */}
                    <div className="text-right hidden sm:block shrink-0">
                      <div className="text-xs text-muted-foreground">Invested</div>
                      <div className="text-sm">{formatINR(h.invested_amount)}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">Current</div>
                      <div className="text-sm font-semibold">{formatINR(h.current_value)}</div>
                    </div>
                    <div className="text-right hidden md:block shrink-0 space-y-1">
                      <PnlBadge pct={h.pnl_pct} />
                      <div className="text-xs text-muted-foreground">{formatINR(h.pnl)}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        title="Refresh price" disabled={refreshing.has(h.asset_id)}
                        onClick={() => refreshPrice(h)}>
                        <RefreshCw size={13} className={refreshing.has(h.asset_id) ? 'animate-spin' : ''} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        title="Transaction history" onClick={() => setModal({ type: 'history', holding: h })}>
                        <History size={13} />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        title="Add transaction" onClick={() => setModal({ type: 'tx', holding: h })}>
                        <PlusCircle size={13} />
                      </Button>
                      <DeleteButton onConfirm={() => deleteMutation.mutate(h.asset_id)} />
                    </div>
                  </div>

                  {/* LTCG / STCG row */}
                  {(h.ltcg_shares > 0 || h.stcg_shares > 0) && (
                    <div className="flex gap-4 mt-2 pt-2 border-t text-xs text-muted-foreground">
                      {h.ltcg_shares > 0 && (
                        <span>LTCG {h.ltcg_shares} shares
                          {h.ltcg_gain !== 0 && (
                            <span className={h.ltcg_gain >= 0 ? ' text-green-600' : ' text-red-600'}>
                              {' '}({h.ltcg_gain >= 0 ? '+' : ''}{formatINR(h.ltcg_gain)})
                            </span>
                          )}
                        </span>
                      )}
                      {h.stcg_shares > 0 && (
                        <span>STCG {h.stcg_shares} shares
                          {h.stcg_gain !== 0 && (
                            <span className={h.stcg_gain >= 0 ? ' text-green-600' : ' text-red-600'}>
                              {' '}({h.stcg_gain >= 0 ? '+' : ''}{formatINR(h.stcg_gain)})
                            </span>
                          )}
                        </span>
                      )}
                      <span className="ml-auto">{h.tx_count} transaction{h.tx_count !== 1 ? 's' : ''}</span>
                    </div>
                  )}

                  {/* Mobile P&L */}
                  <div className="flex items-center gap-2 mt-2 md:hidden">
                    <PnlBadge pct={h.pnl_pct} />
                    <span className="text-xs text-muted-foreground">{formatINR(h.pnl)}</span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {modal?.type === 'add' && (
        <Modal title="Add Stock" onClose={() => setModal(null)}>
          <StockForm onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'tx' && (
        <Modal title={`Add Transaction — ${modal.holding.company_name}`} onClose={() => setModal(null)}>
          <StockTransactionForm holdingId={modal.holding.asset_id} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'history' && (
        <Modal title={`Transaction History — ${modal.holding.company_name} (${modal.holding.ticker})`} onClose={() => setModal(null)}>
          <StockTransactionHistory
            holding={modal.holding}
            onAddTx={() => setModal({ type: 'tx', holding: modal.holding })} />
        </Modal>
      )}
    </PageWrapper>
  )
}
