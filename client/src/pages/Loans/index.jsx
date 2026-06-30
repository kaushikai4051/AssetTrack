import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Calculator, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import LoanForm from './LoanForm'
import PrepaymentSimulator from './PrepaymentSimulator'
import DocumentsPanel from '@/components/shared/DocumentsPanel'
import { formatINR, formatCompact } from '@/utils/currency'
import useFilterStore from '@/store/filterStore'
import api from '@/services/api'

const LOAN_TYPES = [
  { key: 'all',         label: 'All Loans' },
  { key: 'home',        label: 'Home' },
  { key: 'car',         label: 'Car' },
  { key: 'personal',    label: 'Personal' },
  { key: 'education',   label: 'Education' },
  { key: 'lap',         label: 'LAP' },
  { key: 'gold',        label: 'Gold' },
  { key: 'credit_card', label: 'Credit Card' },
]

const TYPE_COLORS = {
  home:        'bg-blue-100 text-blue-700 border-blue-200',
  car:         'bg-violet-100 text-violet-700 border-violet-200',
  personal:    'bg-orange-100 text-orange-700 border-orange-200',
  education:   'bg-cyan-100 text-cyan-700 border-cyan-200',
  lap:         'bg-amber-100 text-amber-700 border-amber-200',
  gold:        'bg-yellow-100 text-yellow-700 border-yellow-200',
  credit_card: 'bg-red-100 text-red-700 border-red-200',
}

function nextDueDate(disbursementDate, emiDueDay) {
  const today = new Date()
  const due = new Date(today.getFullYear(), today.getMonth(), emiDueDay)
  if (due <= today) due.setMonth(due.getMonth() + 1)
  return due.toISOString().slice(0, 10)
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function DueBadge({ dueDay }) {
  if (!dueDay) return null
  const dateStr = nextDueDate(null, dueDay)
  const days = daysUntil(dateStr)
  if (days <= 3)  return <Badge className="bg-red-100 text-red-700 border-red-200">Due in {days}d</Badge>
  if (days <= 7)  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Due in {days}d</Badge>
  return <Badge variant="outline">Due {dateStr}</Badge>
}

function EmptyState({ onAdd }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <p className="text-muted-foreground text-sm">No loans added yet.</p>
        <Button size="sm" onClick={onAdd}><Plus size={14} className="mr-1" />Add Loan</Button>
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

function paidPercent(loan) {
  if (!loan.principal_amount) return 0
  const paid = loan.principal_amount - loan.outstanding_amount
  return Math.min(100, Math.round((paid / loan.principal_amount) * 100))
}

export default function Loans() {
  const qc = useQueryClient()
  const [activeType, setActiveType] = useState('all')
  const [formModal, setFormModal]   = useState(null)
  const [simModal, setSimModal]     = useState(null)
  const [docsModal, setDocsModal]   = useState(null)
  const activeMemberId = useFilterStore((s) => s.activeMemberId)

  const { data = [], isLoading } = useQuery({
    queryKey: ['loans', activeType, activeMemberId],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (activeType !== 'all') qs.set('type', activeType)
      if (activeMemberId !== null) qs.set('family_member_id', activeMemberId === 0 ? 'self' : activeMemberId)
      const params = qs.toString() ? `?${qs}` : ''
      return api.get(`/assets/loans${params}`).then((r) => r.data)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/loans/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const totalOutstanding = data.reduce((s, l) => s + l.outstanding_amount, 0)
  const totalEMI = data.filter((l) => l.loan_type !== 'credit_card').reduce((s, l) => s + (l.emi_amount || 0), 0)

  return (
    <PageWrapper title="Loans & Liabilities" description="Track all outstanding loans and their repayment progress">
      {/* Tabs */}
      <div className="flex gap-1 border-b overflow-x-auto">
        {LOAN_TYPES.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveType(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeType === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !data.length ? (
        <EmptyState onAdd={() => setFormModal({ mode: 'add' })} />
      ) : (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {data.length} loan{data.length !== 1 ? 's' : ''}
              {' · '}Outstanding {formatCompact(totalOutstanding)}
              {totalEMI > 0 && ` · EMI ${formatCompact(totalEMI)}/mo`}
            </div>
            <Button size="sm" onClick={() => setFormModal({ mode: 'add' })}>
              <Plus size={14} className="mr-1" />Add Loan
            </Button>
          </div>

          {/* Loan cards */}
          <div className="space-y-2">
            {data.map((loan) => {
              const paid = paidPercent(loan)
              const isCreditCard = loan.loan_type === 'credit_card'

              return (
                <Card key={loan.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Name + type */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{loan.lender}</span>
                          <Badge className={TYPE_COLORS[loan.loan_type] || ''}>
                            {loan.loan_type.replace('_', ' ')}
                          </Badge>
                          {loan.rate_type === 'floating' && (
                            <Badge variant="outline" className="text-xs">Floating</Badge>
                          )}
                        </div>
                        {loan.loan_account_number && (
                          <div className="text-xs text-muted-foreground mt-0.5">{loan.loan_account_number}</div>
                        )}
                      </div>

                      {/* Rate */}
                      <div className="text-right hidden md:block shrink-0">
                        <div className="text-xs text-muted-foreground">Rate</div>
                        <div className="text-sm">{loan.interest_rate}% p.a.</div>
                      </div>

                      {/* EMI or Credit info */}
                      {!isCreditCard ? (
                        <div className="text-right hidden sm:block shrink-0">
                          <div className="text-xs text-muted-foreground">EMI / mo</div>
                          <div className="text-sm font-medium">{formatINR(loan.emi_amount)}</div>
                        </div>
                      ) : (
                        <div className="text-right hidden sm:block shrink-0">
                          <div className="text-xs text-muted-foreground">Min Due</div>
                          <div className="text-sm font-medium">{loan.minimum_due ? formatINR(loan.minimum_due) : '—'}</div>
                        </div>
                      )}

                      {/* Outstanding */}
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Outstanding</div>
                        <div className="text-sm font-semibold text-destructive">{formatINR(loan.outstanding_amount)}</div>
                      </div>

                      {/* Due badge */}
                      {!isCreditCard && (
                        <div className="hidden sm:block shrink-0">
                          <DueBadge dueDay={loan.emi_due_day} />
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {!isCreditCard && (
                          <Button
                            size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="Prepayment simulator"
                            onClick={() => setSimModal(loan)}
                          >
                            <Calculator size={14} />
                          </Button>
                        )}
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          title="Documents"
                          onClick={() => setDocsModal(loan)}
                        >
                          <Paperclip size={13} />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => setFormModal({ mode: 'edit', data: loan })}
                        >
                          <Pencil size={13} />
                        </Button>
                        <DeleteButton onConfirm={() => deleteMutation.mutate(loan.id)} />
                      </div>
                    </div>

                    {/* Progress bar — not for credit card */}
                    {!isCreditCard && loan.principal_amount > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Paid {paid}%</span>
                          <span>Principal {formatCompact(loan.principal_amount)}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${paid}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {formModal && (
        <Modal
          title={formModal.mode === 'add' ? 'Add Loan' : 'Edit Loan'}
          onClose={() => setFormModal(null)}
        >
          <LoanForm initialData={formModal.data} onClose={() => setFormModal(null)} />
        </Modal>
      )}

      {simModal && (
        <Modal title="Prepayment Simulator" onClose={() => setSimModal(null)}>
          <PrepaymentSimulator loan={simModal} onClose={() => setSimModal(null)} />
        </Modal>
      )}

      {docsModal && (
        <Modal title={`Documents — ${docsModal.lender}`} onClose={() => setDocsModal(null)}>
          <DocumentsPanel assetType={docsModal.loan_type + '_loan'} assetId={docsModal.id} />
        </Modal>
      )}
    </PageWrapper>
  )
}
