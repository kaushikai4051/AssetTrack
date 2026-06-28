import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, RefreshCw, PlusCircle, History, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import ImportWizard from '@/components/shared/ImportWizard'
import useFilterStore from '@/store/filterStore'
import MutualFundForm from './MutualFundForm'
import TransactionForm from './TransactionForm'
import { formatINR, formatCompact, formatReturn } from '@/utils/currency'
import api from '@/services/api'

const TX_TYPE_LABEL = {
  purchase:           'Purchase',
  redemption:         'Redemption',
  dividend_reinvest:  'Div. Reinvest',
  switch_in:          'Switch In',
  switch_out:         'Switch Out',
}
const TX_TYPE_COLOR = {
  purchase:           'bg-blue-100 text-blue-700',
  redemption:         'bg-red-100 text-red-700',
  dividend_reinvest:  'bg-green-100 text-green-700',
  switch_in:          'bg-purple-100 text-purple-700',
  switch_out:         'bg-orange-100 text-orange-700',
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

function TransactionHistory({ fund, onAddTx }) {
  const qc = useQueryClient()

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ['mf-txns', fund.asset_id],
    queryFn: () => api.get(`/assets/mutual-funds/${fund.asset_id}/transactions`).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (txId) => api.delete(`/assets/mutual-funds/${fund.asset_id}/transactions/${txId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mf-txns', fund.asset_id] })
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
    },
  })

  const totalUnits   = txs.reduce((s, t) => s + (t.type === 'redemption' || t.type === 'switch_out' ? -t.units : t.units), 0)
  const totalInvested = txs.filter((t) => t.type === 'purchase' || t.type === 'switch_in' || t.type === 'dividend_reinvest')
                           .reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary row */}
      {txs.length > 0 && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-muted/50 rounded-md p-2">
            <div className="text-xs text-muted-foreground">Transactions</div>
            <div className="text-sm font-semibold">{txs.length}</div>
          </div>
          <div className="bg-muted/50 rounded-md p-2">
            <div className="text-xs text-muted-foreground">Total Invested</div>
            <div className="text-sm font-semibold">{formatINR(totalInvested)}</div>
          </div>
          <div className="bg-muted/50 rounded-md p-2">
            <div className="text-xs text-muted-foreground">Units Held</div>
            <div className="text-sm font-semibold">{totalUnits.toFixed(4)}</div>
          </div>
        </div>
      )}

      {/* Transaction table */}
      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !txs.length ? (
        <div className="py-6 text-center text-sm text-muted-foreground">No transactions found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 pr-3 font-medium">Date</th>
                <th className="text-left py-2 pr-3 font-medium">Type</th>
                <th className="text-left py-2 pr-3 font-medium">Source</th>
                <th className="text-right py-2 pr-3 font-medium">Units</th>
                <th className="text-right py-2 pr-3 font-medium">NAV (₹)</th>
                <th className="text-right py-2 pr-3 font-medium">Amount (₹)</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {txs.map((t) => {
                const isOut = t.type === 'redemption' || t.type === 'switch_out'
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-3 whitespace-nowrap">{t.transaction_date}</td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TX_TYPE_COLOR[t.type] || ''}`}>
                        {TX_TYPE_LABEL[t.type] || t.type}
                      </span>
                    </td>
                    <td className="py-2 pr-3 capitalize text-muted-foreground">{t.source || '—'}</td>
                    <td className={`py-2 pr-3 text-right font-mono ${isOut ? 'text-red-600' : ''}`}>
                      {isOut ? '−' : '+'}{Number(t.units).toFixed(4)}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono">{Number(t.nav).toFixed(4)}</td>
                    <td className={`py-2 pr-3 text-right font-mono font-medium ${isOut ? 'text-red-600' : 'text-green-700'}`}>
                      {isOut ? '−' : '+'}{formatINR(t.amount)}
                    </td>
                    <td className="py-2">
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

function ReturnBadge({ pct }) {
  if (pct == null) return null
  const positive = pct >= 0
  return (
    <Badge className={positive ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}>
      {formatReturn(pct)}
    </Badge>
  )
}

function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span className="flex items-center gap-2 border border-destructive/40 bg-destructive/5 rounded-md px-2 py-1">
        <span className="text-xs text-destructive font-medium whitespace-nowrap">Delete?</span>
        <Button size="sm" variant="destructive" className="h-6 px-2 text-xs" onClick={onConfirm}>Yes</Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirming(false)}>No</Button>
      </span>
    )
  }
  return (
    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setConfirming(true)}>
      <Trash2 size={14} />
    </Button>
  )
}

export default function MutualFunds() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | {type:'add-fund'} | {type:'add-tx',fund} | {type:'history',fund}
  const activeMemberId = useFilterStore((s) => s.activeMemberId)
  const fmParam = activeMemberId === null ? '' : `?family_member_id=${activeMemberId === 0 ? 'self' : activeMemberId}`

  const { data = [], isLoading } = useQuery({
    queryKey: ['mutual-funds', activeMemberId],
    queryFn: () => api.get(`/assets/mutual-funds${fmParam}`).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/mutual-funds/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const refreshNav = async (fund) => {
    try {
      await api.get(`/market/mf-nav/${fund.scheme_code}`)
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
    } catch {
      // silently ignore — user sees stale NAV
    }
  }

  const totalValue    = data.reduce((s, f) => s + (f.current_value || 0), 0)
  const totalInvested = data.reduce((s, f) => s + (f.invested_amount || 0), 0)
  const totalGain     = totalValue - totalInvested

  return (
    <PageWrapper
      title="Mutual Funds"
      description="SIP and lumpsum investments with XIRR tracking"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setModal({ type: 'import' })}>
            <Upload size={13} className="mr-1" />Import CSV
          </Button>
          <Button size="sm" onClick={() => setModal({ type: 'add-fund' })}>
            <Plus size={14} className="mr-1" />Add Fund
          </Button>
        </div>
      }
    >
      {/* Summary strip */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Current Value', value: formatCompact(totalValue) },
            { label: 'Invested',      value: formatCompact(totalInvested) },
            { label: 'Gain / Loss',   value: formatCompact(totalGain), color: totalGain >= 0 ? 'text-green-700' : 'text-red-600' },
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

      {/* Fund list */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !data.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-muted-foreground text-sm">No mutual funds added yet.</p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setModal({ type: 'add-fund' })}>
                <Plus size={14} className="mr-1" />Add Fund
              </Button>
              <Button size="sm" variant="outline" onClick={() => setModal({ type: 'import' })}>
                <Upload size={13} className="mr-1" />Import CSV
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((fund) => (
            <Card key={fund.asset_id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Fund info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm line-clamp-1">{fund.scheme_name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {fund.plan_type?.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {fund.fund_house || fund.scheme_code}
                      {fund.folio_number ? ` · Folio: ${fund.folio_number}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fund.units_held?.toFixed(4)} units
                      {fund.last_nav ? ` · NAV ₹${fund.last_nav}` : ''}
                      {fund.last_nav_date ? ` (${fund.last_nav_date})` : ''}
                    </p>
                  </div>

                  {/* Financials */}
                  <div className="text-right hidden sm:block shrink-0">
                    <div className="text-xs text-muted-foreground">Invested</div>
                    <div className="text-sm">{formatINR(fund.invested_amount)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Current</div>
                    <div className="text-sm font-semibold">{formatINR(fund.current_value)}</div>
                  </div>
                  <div className="text-right hidden md:block shrink-0 space-y-1">
                    <ReturnBadge pct={fund.abs_return} />
                    {fund.xirr != null && (
                      <div className="text-xs text-muted-foreground">{fund.xirr}% XIRR</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      title="Refresh NAV" onClick={() => refreshNav(fund)}>
                      <RefreshCw size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      title="Transaction history" onClick={() => setModal({ type: 'history', fund })}>
                      <History size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      title="Add transaction" onClick={() => setModal({ type: 'add-tx', fund })}>
                      <PlusCircle size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(fund.asset_id)} />
                  </div>
                </div>

                {/* Mobile financials */}
                <div className="flex items-center gap-3 mt-2 md:hidden">
                  <ReturnBadge pct={fund.abs_return} />
                  {fund.xirr != null && (
                    <span className="text-xs text-muted-foreground">{fund.xirr}% XIRR</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'import' && (
        <Modal title="Import Mutual Funds from CSV" onClose={() => setModal(null)}>
          <ImportWizard
            type="mutual-fund"
            onDone={() => {
              setModal(null)
              qc.invalidateQueries({ queryKey: ['mutual-funds'] })
              qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
            }}
          />
        </Modal>
      )}
      {modal?.type === 'add-fund' && (
        <Modal title="Add Mutual Fund" onClose={() => setModal(null)}>
          <MutualFundForm onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'add-tx' && (
        <Modal title={`Add Transaction — ${modal.fund.scheme_name}`} onClose={() => setModal(null)}>
          <TransactionForm
            fundId={modal.fund.asset_id}
            schemeCode={modal.fund.scheme_code}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'history' && (
        <Modal title={`Transaction History — ${modal.fund.scheme_name}`} onClose={() => setModal(null)}>
          <TransactionHistory
            fund={modal.fund}
            onAddTx={() => setModal({ type: 'add-tx', fund: modal.fund })}
          />
        </Modal>
      )}
    </PageWrapper>
  )
}
