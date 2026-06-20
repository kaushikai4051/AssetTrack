import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import GoldForm from './GoldForm'
import { formatINR, formatCompact, formatReturn } from '@/utils/currency'
import api from '@/services/api'

const TYPE_LABEL = { physical: 'Physical', digital: 'Digital', etf: 'ETF', sgb: 'SGB' }
const TYPE_COLOR = {
  physical: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  digital:  'bg-blue-100 text-blue-800 border-blue-200',
  etf:      'bg-purple-100 text-purple-800 border-purple-200',
  sgb:      'bg-green-100 text-green-800 border-green-200',
}
const ALL_TYPES = ['All', 'physical', 'digital', 'etf', 'sgb']

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

function quantityLabel(h) {
  if (h.gold_type === 'etf')  return `${Number(h.quantity).toFixed(4)} units`
  if (h.gold_type === 'sgb')  return `${Number(h.quantity).toFixed(0)} bonds`
  return `${Number(h.quantity).toFixed(4)} g`
}

export default function Gold() {
  const qc = useQueryClient()
  const [modal, setModal]         = useState(null) // null | { type: 'add' }
  const [activeType, setActiveType] = useState('All')
  const [refreshing, setRefreshing] = useState(false)

  const { data = [], isLoading } = useQuery({
    queryKey: ['gold'],
    queryFn: () => api.get('/assets/gold').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/gold/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gold'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  // Refresh price for physical/digital/sgb (one call updates all of user's holdings)
  const refreshGoldPrice = async () => {
    setRefreshing(true)
    try {
      await api.get('/market/gold-price')
      qc.invalidateQueries({ queryKey: ['gold'] })
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }

  // Refresh ETF price individually via stock-price endpoint
  const refreshEtfPrice = async (h) => {
    try {
      await api.get(`/market/stock-price/${h.ticker}?exchange=NSE`)
      qc.invalidateQueries({ queryKey: ['gold'] })
    } catch { /* silent */ }
  }

  const totalValue    = data.reduce((s, h) => s + (h.current_value || 0), 0)
  const totalInvested = data.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalPnl      = totalValue - totalInvested
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  const presentTypes = new Set(data.map((h) => h.gold_type))
  const typeFilters  = ALL_TYPES.filter((t) => t === 'All' || presentTypes.has(t))
  const filtered     = activeType === 'All' ? data : data.filter((h) => h.gold_type === activeType)

  return (
    <PageWrapper
      title="Gold"
      description="Physical, digital, ETF, and sovereign gold bond holdings"
      actions={
        <div className="flex gap-2">
          {data.some((h) => ['physical','digital','sgb'].includes(h.gold_type)) && (
            <Button size="sm" variant="outline" onClick={refreshGoldPrice} disabled={refreshing}>
              <RefreshCw size={14} className={`mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh Gold Price'}
            </Button>
          )}
          <Button size="sm" onClick={() => setModal({ type: 'add' })}>
            <Plus size={14} className="mr-1" />Add Gold
          </Button>
        </div>
      }
    >
      {/* Summary strip */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Current Value',  value: formatCompact(totalValue) },
            { label: 'Invested',       value: formatCompact(totalInvested) },
            { label: 'Unrealised P&L', value: formatCompact(totalPnl), color: totalPnl >= 0 ? 'text-green-700' : 'text-red-600' },
            { label: 'Overall Return', value: formatReturn(totalPnlPct), color: totalPnlPct >= 0 ? 'text-green-700' : 'text-red-600' },
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

      {/* Type filter tabs */}
      {typeFilters.length > 2 && (
        <div className="flex gap-1 flex-wrap">
          {typeFilters.map((t) => (
            <button key={t} onClick={() => setActiveType(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeType === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-input text-muted-foreground hover:text-foreground'
              }`}>
              {t === 'All' ? 'All' : TYPE_LABEL[t]}
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
            <p className="text-muted-foreground text-sm">No gold holdings added yet.</p>
            <Button size="sm" onClick={() => setModal({ type: 'add' })}>
              <Plus size={14} className="mr-1" />Add Gold
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => (
            <Card key={h.asset_id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Identity */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{h.name}</span>
                      <Badge className={`text-xs ${TYPE_COLOR[h.gold_type]}`}>
                        {TYPE_LABEL[h.gold_type]}
                      </Badge>
                      {h.purity && <Badge variant="outline" className="text-xs">{h.purity}</Badge>}
                      {h.ticker && <Badge variant="outline" className="text-xs font-mono">{h.ticker}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quantityLabel(h)}
                      {h.last_price
                        ? ` · ₹${Number(h.last_price).toFixed(2)}/${h.gold_type === 'etf' ? 'unit' : 'g'}`
                        : ''}
                      {h.platform ? ` · ${h.platform}` : ''}
                      {h.broker   ? ` · ${h.broker}`   : ''}
                    </p>
                    {h.gold_type === 'sgb' && h.maturity_date && (
                      <p className="text-xs text-muted-foreground">
                        {h.sgb_series} · Matures {h.maturity_date?.slice(0, 10)}
                        {` · ${Number(h.coupon_rate).toFixed(2)}% p.a. coupon`}
                      </p>
                    )}
                    {h.gold_type === 'physical' && h.storage_location && (
                      <p className="text-xs text-muted-foreground">{h.storage_location}</p>
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
                      title={h.gold_type === 'etf' ? 'Refresh ETF price' : 'Refresh gold price'}
                      onClick={() => h.gold_type === 'etf' ? refreshEtfPrice(h) : refreshGoldPrice()}>
                      <RefreshCw size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(h.asset_id)} />
                  </div>
                </div>

                {/* Mobile P&L */}
                <div className="flex items-center gap-2 mt-2 md:hidden">
                  <PnlBadge pct={h.pnl_pct} />
                  <span className="text-xs text-muted-foreground">{formatINR(h.pnl)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modal?.type === 'add' && (
        <Modal title="Add Gold Holding" onClose={() => setModal(null)}>
          <GoldForm onClose={() => setModal(null)} />
        </Modal>
      )}
    </PageWrapper>
  )
}
