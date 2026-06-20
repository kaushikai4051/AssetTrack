import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import FDForm from './FDForm'
import RDForm from './RDForm'
import SavingsForm from './SavingsForm'
import { formatINR, formatCompact } from '@/utils/currency'
import api from '@/services/api'

const TABS = ['Fixed Deposits', 'Recurring Deposits', 'Savings Accounts']

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date()
  return Math.ceil(diff / 86400000)
}

function MaturityBadge({ dateStr }) {
  const days = daysUntil(dateStr)
  if (days < 0) return <Badge variant="outline" className="text-muted-foreground">Matured</Badge>
  if (days <= 30) return <Badge className="bg-red-100 text-red-700 border-red-200">{days}d left</Badge>
  if (days <= 60) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{days}d left</Badge>
  return <Badge variant="outline">{days}d left</Badge>
}

function EmptyState({ label, onAdd }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <p className="text-muted-foreground text-sm">No {label} added yet.</p>
        <Button size="sm" onClick={onAdd}><Plus size={14} className="mr-1" />Add {label.slice(0, -1)}</Button>
      </CardContent>
    </Card>
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

// ── Fixed Deposits tab ────────────────────────────────────────────────────────

function FDTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | { mode: 'add' | 'edit', data? }

  const { data = [], isLoading } = useQuery({
    queryKey: ['fixed-deposits'],
    queryFn: () => api.get('/assets/fixed-deposits').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/fixed-deposits/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-deposits'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>

  const total = data.reduce((s, r) => s + r.maturity_amount, 0)
  const totalPrincipal = data.reduce((s, r) => s + r.principal, 0)

  return (
    <>
      {!data.length ? (
        <EmptyState label="Fixed Deposits" onAdd={() => setModal({ mode: 'add' })} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {data.length} FD{data.length !== 1 ? 's' : ''} · Principal {formatCompact(totalPrincipal)} · Maturity {formatCompact(total)}
            </div>
            <Button size="sm" onClick={() => setModal({ mode: 'add' })}><Plus size={14} className="mr-1" />Add FD</Button>
          </div>

          <div className="space-y-2">
            {data.map((fd) => (
              <Card key={fd.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{fd.bank_name}</div>
                    {fd.account_number && <div className="text-xs text-muted-foreground">{fd.account_number}</div>}
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-muted-foreground">Principal</div>
                    <div className="text-sm font-medium">{formatINR(fd.principal)}</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-muted-foreground">{fd.interest_rate}% · {fd.compounding.replace('_', '-')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Maturity</div>
                    <div className="text-sm font-semibold text-green-700">{formatINR(fd.maturity_amount)}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <MaturityBadge dateStr={fd.maturity_date} />
                    <div className="text-xs text-muted-foreground mt-1">{fd.maturity_date}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setModal({ mode: 'edit', data: fd })}>
                      <Pencil size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(fd.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Fixed Deposit' : 'Edit Fixed Deposit'}
          onClose={() => setModal(null)}
        >
          <FDForm initialData={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}
    </>
  )
}

// ── Recurring Deposits tab ────────────────────────────────────────────────────

function RDTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['recurring-deposits'],
    queryFn: () => api.get('/assets/recurring-deposits').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/recurring-deposits/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recurring-deposits'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>

  const totalMonthly = data.reduce((s, r) => s + r.monthly_amount, 0)

  return (
    <>
      {!data.length ? (
        <EmptyState label="Recurring Deposits" onAdd={() => setModal({ mode: 'add' })} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {data.length} RD{data.length !== 1 ? 's' : ''} · {formatCompact(totalMonthly)}/mo
            </div>
            <Button size="sm" onClick={() => setModal({ mode: 'add' })}><Plus size={14} className="mr-1" />Add RD</Button>
          </div>

          <div className="space-y-2">
            {data.map((rd) => (
              <Card key={rd.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{rd.bank_name}</div>
                    {rd.account_number && <div className="text-xs text-muted-foreground">{rd.account_number}</div>}
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-muted-foreground">Monthly</div>
                    <div className="text-sm font-medium">{formatINR(rd.monthly_amount)}</div>
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs text-muted-foreground">{rd.interest_rate}% · {rd.tenure_months} mo</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Maturity</div>
                    <div className="text-sm font-semibold text-green-700">{formatINR(rd.maturity_amount)}</div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <MaturityBadge dateStr={rd.maturity_date} />
                    <div className="text-xs text-muted-foreground mt-1">{rd.maturity_date}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setModal({ mode: 'edit', data: rd })}>
                      <Pencil size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(rd.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Recurring Deposit' : 'Edit Recurring Deposit'}
          onClose={() => setModal(null)}
        >
          <RDForm initialData={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}
    </>
  )
}

// ── Savings Accounts tab ──────────────────────────────────────────────────────

function SavingsTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['savings-accounts'],
    queryFn: () => api.get('/assets/savings-accounts').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/savings-accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['savings-accounts'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  if (isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>

  const totalBalance = data.reduce((s, r) => s + r.current_value, 0)

  return (
    <>
      {!data.length ? (
        <EmptyState label="Savings Accounts" onAdd={() => setModal({ mode: 'add' })} />
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              {data.length} account{data.length !== 1 ? 's' : ''} · Total {formatCompact(totalBalance)}
            </div>
            <Button size="sm" onClick={() => setModal({ mode: 'add' })}><Plus size={14} className="mr-1" />Add Account</Button>
          </div>

          <div className="space-y-2">
            {data.map((sa) => (
              <Card key={sa.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{sa.bank_name}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {sa.account_type}{sa.account_number ? ` · ${sa.account_number}` : ''}
                    </div>
                  </div>
                  {sa.ifsc_code && (
                    <div className="text-right hidden md:block">
                      <div className="text-xs text-muted-foreground">IFSC</div>
                      <div className="text-sm font-mono">{sa.ifsc_code}</div>
                    </div>
                  )}
                  {sa.interest_rate > 0 && (
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-muted-foreground">Rate</div>
                      <div className="text-sm">{sa.interest_rate}%</div>
                    </div>
                  )}
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Balance</div>
                    <div className="text-sm font-semibold">{formatINR(sa.current_value)}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setModal({ mode: 'edit', data: sa })}>
                      <Pencil size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(sa.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Savings Account' : 'Edit Account'}
          onClose={() => setModal(null)}
        >
          <SavingsForm initialData={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BankAccounts() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <PageWrapper title="Bank Accounts" description="Fixed deposits, recurring deposits and savings accounts">
      <div className="flex gap-1 border-b">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === i
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {activeTab === 0 && <FDTab />}
        {activeTab === 1 && <RDTab />}
        {activeTab === 2 && <SavingsTab />}
      </div>
    </PageWrapper>
  )
}
