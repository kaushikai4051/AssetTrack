import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, PlusCircle, Pencil, History, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import ImportWizard from '@/components/shared/ImportWizard'
import GovtSchemeForm from './GovtSchemeForm'
import GovtSchemeTransactionForm from './GovtSchemeTransactionForm'
import { formatINR, formatCompact, formatReturn } from '@/utils/currency'
import api from '@/services/api'

const SCHEME_NAMES = {
  ppf: 'PPF', nps: 'NPS', epf: 'EPF',
  nsc: 'NSC', ssy: 'SSY', scss: 'SCSS',
  kvp: 'KVP', po_td: 'PO TD', po_mis: 'PO MIS', po_rd: 'PO RD',
}

const TABS = [
  { key: 'ppf',    label: 'PPF',    types: ['ppf'] },
  { key: 'nps',    label: 'NPS',    types: ['nps'] },
  { key: 'epf',    label: 'EPF',    types: ['epf'] },
  { key: 'others', label: 'Others', types: ['nsc','ssy','scss','kvp','po_td','po_mis','po_rd'] },
]

// Days between now and maturity_date
function daysToMaturity(dateStr) {
  if (!dateStr) return null
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / 86400000)
}

function MaturityBadge({ dateStr }) {
  const days = daysToMaturity(dateStr)
  if (days == null) return null
  if (days < 0)   return <Badge variant="outline" className="text-xs text-muted-foreground">Matured</Badge>
  if (days < 30)  return <Badge className="text-xs bg-red-100 text-red-700 border-red-200">{days}d left</Badge>
  if (days < 90)  return <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">{days}d left</Badge>
  return <Badge variant="outline" className="text-xs">{dateStr?.slice(0, 10)}</Badge>
}

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
  deposit:              { label: 'Deposit',              color: 'bg-blue-100 text-blue-700',   sign: +1 },
  employer_contribution:{ label: 'Employer Contribution',color: 'bg-purple-100 text-purple-700', sign: +1 },
  interest:             { label: 'Interest Credit',      color: 'bg-green-100 text-green-700', sign: +1 },
  withdrawal:           { label: 'Withdrawal',           color: 'bg-red-100 text-red-700',     sign: -1 },
  maturity:             { label: 'Maturity Payout',      color: 'bg-amber-100 text-amber-700', sign: +1 },
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

function SchemeTransactionHistory({ holding, onAddTx }) {
  const qc = useQueryClient()

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ['scheme-txns', holding.asset_id],
    queryFn:  () => api.get(`/assets/govt-schemes/${holding.asset_id}/transactions`).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (txId) => api.delete(`/assets/govt-schemes/${holding.asset_id}/transactions/${txId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheme-txns', holding.asset_id] })
      qc.invalidateQueries({ queryKey: ['govt-schemes'] })
    },
  })

  // Mini dashboard aggregates — computed from live transaction list
  const totalDeposits  = txs.filter((t) => t.tx_type === 'deposit' || t.tx_type === 'employer_contribution')
                            .reduce((s, t) => s + Number(t.amount), 0)
  const totalWithdrawn = txs.filter((t) => t.tx_type === 'withdrawal')
                            .reduce((s, t) => s + Number(t.amount), 0)
  const totalInterest  = txs.filter((t) => t.tx_type === 'interest')
                            .reduce((s, t) => s + Number(t.amount), 0)

  // Read current_value from live cache so it reflects the latest transactions
  const allSchemes = qc.getQueryData(['govt-schemes']) || []
  const liveHolding = allSchemes.find((h) => h.asset_id === holding.asset_id) || holding
  const netBalance  = Number(liveHolding.current_value) || 0

  const summaryCards = [
    { label: 'Total Deposits',   value: formatINR(totalDeposits),  color: 'text-blue-700' },
    { label: 'Total Withdrawn',  value: formatINR(totalWithdrawn), color: 'text-red-600' },
    { label: 'Total Interest',   value: formatINR(totalInterest),  color: 'text-green-700' },
    { label: 'Current Balance',  value: formatINR(netBalance),     color: 'text-foreground font-semibold' },
  ]

  return (
    <div className="space-y-4">
      {/* Mini dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        <div className="py-6 text-center text-sm text-muted-foreground">
          No transactions recorded yet. Add your first transaction below.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="border-b text-muted-foreground">
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Type</th>
                <th className="text-right px-3 py-2 font-medium">Amount (₹)</th>
                <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Description</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {txs.map((t) => {
                const meta = TX_TYPE_META[t.tx_type] || { label: t.tx_type, color: '', sign: 1 }
                const amt  = Number(t.amount)
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {String(t.tx_date).slice(0, 10)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className={`px-3 py-2 text-right font-mono font-medium ${
                      meta.sign < 0 ? 'text-red-600' : 'text-green-700'
                    }`}>
                      {meta.sign < 0 ? '−' : '+'}{formatINR(amt)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">
                      {t.description || '—'}
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

function HoldingCard({ h, onAddTx, onViewHistory, onEdit, onDelete }) {
  const hasTx = h.scheme_type === 'ppf' || h.scheme_type === 'epf'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{h.asset_name || SCHEME_NAMES[h.scheme_type]}</span>
              <Badge variant="outline" className="text-xs">{SCHEME_NAMES[h.scheme_type]}</Badge>
              {h.interest_rate && (
                <Badge variant="outline" className="text-xs">{Number(h.interest_rate).toFixed(2)}% p.a.</Badge>
              )}
            </div>

            {/* Type-specific detail row */}
            <p className="text-xs text-muted-foreground mt-0.5">
              {h.account_number ? `A/C ${h.account_number}` : ''}
              {h.institution    ? ` · ${h.institution}` : ''}
              {h.pran           ? ` · PRAN ${h.pran}` : ''}
              {h.uan            ? ` · UAN ${h.uan}` : ''}
              {h.nps_account_type ? ` · ${h.nps_account_type === 'tier1' ? 'Tier 1' : 'Tier 2'}` : ''}
              {h.fund_manager   ? ` · ${h.fund_manager}` : ''}
            </p>

            {/* EPF breakdown */}
            {h.scheme_type === 'epf' && (h.employee_share || h.employer_share) && (
              <p className="text-xs text-muted-foreground">
                Employee {formatINR(h.employee_share)} · Employer {formatINR(h.employer_share)}
                {h.eps_balance ? ` · EPS ${formatINR(h.eps_balance)}` : ''}
              </p>
            )}

            {/* SSY beneficiary */}
            {h.scheme_type === 'ssy' && h.beneficiary_name && (
              <p className="text-xs text-muted-foreground">For {h.beneficiary_name}</p>
            )}

            {/* Maturity info */}
            {h.maturity_date && (
              <div className="flex items-center gap-2 mt-1">
                <MaturityBadge dateStr={h.maturity_date} />
                {h.maturity_amount && (
                  <span className="text-xs text-muted-foreground">
                    Maturity: {formatINR(h.maturity_amount)}
                  </span>
                )}
              </div>
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
              title="Edit" onClick={() => onEdit(h)}>
              <Pencil size={13} />
            </Button>
            {hasTx && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                  title="Transaction history" onClick={() => onViewHistory(h)}>
                  <History size={13} />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                  title="Add transaction" onClick={() => onAddTx(h)}>
                  <PlusCircle size={13} />
                </Button>
              </>
            )}
            <DeleteButton onConfirm={() => onDelete(h.asset_id)} />
          </div>
        </div>

        {/* Mobile P&L */}
        <div className="flex items-center gap-2 mt-2 md:hidden">
          <PnlBadge pct={h.pnl_pct} />
          <span className="text-xs text-muted-foreground">{formatINR(h.pnl)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function GovtSchemes() {
  const qc = useQueryClient()
  const [modal, setModal]   = useState(null)
  const [activeTab, setActiveTab] = useState('ppf')

  const { data = [], isLoading } = useQuery({
    queryKey: ['govt-schemes'],
    queryFn: () => api.get('/assets/govt-schemes').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/govt-schemes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['govt-schemes'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const totalValue    = data.reduce((s, h) => s + (h.current_value || 0), 0)
  const totalInvested = data.reduce((s, h) => s + (h.invested_amount || 0), 0)
  const totalPnl      = totalValue - totalInvested
  const totalPnlPct   = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

  const currentTab = TABS.find((t) => t.key === activeTab)
  const tabData    = data.filter((h) => currentTab?.types.includes(h.scheme_type))

  // Show only tabs that have data or are 'ppf' (always show primary tabs)
  const primaryTabs = ['ppf','nps','epf']
  const visibleTabs = TABS.filter((t) => primaryTabs.includes(t.key) || data.some((h) => t.types.includes(h.scheme_type)))

  return (
    <PageWrapper
      title="Govt Schemes"
      description="PPF, NPS, EPF, and small savings schemes"
      actions={
        <Button size="sm" onClick={() => setModal({ type: 'add' })}>
          <Plus size={14} className="mr-1" />Add Scheme
        </Button>
      }
    >
      {/* Summary */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Current Value',  value: formatCompact(totalValue) },
            { label: 'Invested',       value: formatCompact(totalInvested) },
            { label: 'Interest Earned',value: formatCompact(totalPnl), color: totalPnl >= 0 ? 'text-green-700' : 'text-red-600' },
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

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {visibleTabs.map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {tab.label}
            {data.filter((h) => tab.types.includes(h.scheme_type)).length > 0 && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {data.filter((h) => tab.types.includes(h.scheme_type)).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !tabData.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <p className="text-muted-foreground text-sm">
              No {currentTab?.label} holdings added yet.
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setModal({ type: 'add' })}>
                <Plus size={14} className="mr-1" />Add {currentTab?.label}
              </Button>
              {activeTab === 'ppf' && (
                <Button size="sm" variant="outline" onClick={() => setModal({ type: 'import' })}>
                  <Upload size={13} className="mr-1" />Import CSV
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {activeTab === 'ppf' && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setModal({ type: 'import' })}>
                <Upload size={13} className="mr-1" />Import PPF from CSV
              </Button>
            </div>
          )}
          {tabData.map((h) => (
            <HoldingCard key={h.asset_id} h={h}
              onEdit={(holding) => setModal({ type: 'edit', holding })}
              onViewHistory={(holding) => setModal({ type: 'history', holding })}
              onAddTx={(holding) => setModal({ type: 'tx', holding })}
              onDelete={(id) => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      {modal?.type === 'import' && (
        <Modal title="Import PPF Accounts from CSV" onClose={() => setModal(null)}>
          <ImportWizard
            type="ppf"
            onDone={() => {
              setModal(null)
              qc.invalidateQueries({ queryKey: ['govt-schemes'] })
              qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
            }}
          />
        </Modal>
      )}
      {modal?.type === 'add' && (
        <Modal title="Add Govt Scheme" onClose={() => setModal(null)}>
          <GovtSchemeForm onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal title={`Edit — ${SCHEME_NAMES[modal.holding.scheme_type]}`} onClose={() => setModal(null)}>
          <GovtSchemeForm holding={modal.holding} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'tx' && (
        <Modal
          title={`Add Transaction — ${SCHEME_NAMES[modal.holding.scheme_type]}`}
          onClose={() => setModal(null)}>
          <GovtSchemeTransactionForm
            assetId={modal.holding.asset_id}
            schemeType={modal.holding.scheme_type}
            onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'history' && (
        <Modal
          title={`Transaction History — ${SCHEME_NAMES[modal.holding.scheme_type]}`}
          onClose={() => setModal(null)}>
          <SchemeTransactionHistory
            holding={modal.holding}
            onAddTx={() => setModal({ type: 'tx', holding: modal.holding })} />
        </Modal>
      )}
    </PageWrapper>
  )
}
