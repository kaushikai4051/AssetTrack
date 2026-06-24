import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import BondForm from './BondForm'
import { formatINR, formatCompact } from '@/utils/currency'
import api from '@/services/api'

const BOND_TABS = [
  { key: 'all',       label: 'All Bonds' },
  { key: 'corporate', label: 'Corporate' },
  { key: 'ncd',       label: 'NCD' },
  { key: 'gsec',      label: 'G-Sec' },
  { key: 'tbill',     label: 'T-Bill' },
  { key: 'sdl',       label: 'SDL' },
  { key: 'tax_free',  label: 'Tax-Free' },
]

const TYPE_COLORS = {
  corporate: 'bg-blue-100 text-blue-700 border-blue-200',
  ncd:       'bg-violet-100 text-violet-700 border-violet-200',
  gsec:      'bg-green-100 text-green-700 border-green-200',
  tbill:     'bg-teal-100 text-teal-700 border-teal-200',
  sdl:       'bg-emerald-100 text-emerald-700 border-emerald-200',
  tax_free:  'bg-amber-100 text-amber-700 border-amber-200',
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function MaturityBadge({ dateStr }) {
  const days = daysUntil(dateStr)
  if (days < 0)   return <Badge variant="outline" className="text-muted-foreground">Matured</Badge>
  if (days <= 30) return <Badge className="bg-red-100 text-red-700 border-red-200">{days}d left</Badge>
  if (days <= 90) return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{days}d left</Badge>
  return <Badge variant="outline">{days}d left</Badge>
}

function EmptyState({ onAdd }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <p className="text-muted-foreground text-sm">No bonds added yet.</p>
        <Button size="sm" onClick={onAdd}><Plus size={14} className="mr-1" />Add Bond</Button>
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

export default function Bonds() {
  const qc = useQueryClient()
  const [activeType, setActiveType] = useState('all')
  const [modal, setModal] = useState(null)

  const { data = [], isLoading } = useQuery({
    queryKey: ['bonds', activeType],
    queryFn: () => {
      const params = activeType !== 'all' ? `?type=${activeType}` : ''
      return api.get(`/assets/bonds${params}`).then((r) => r.data)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/bonds/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonds'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const totalInvested = data.reduce((s, b) => s + b.purchase_price, 0)
  const totalAnnualCoupon = data.reduce((s, b) => {
    const fv = b.face_value * b.units
    return s + (b.coupon_rate / 100) * fv
  }, 0)

  return (
    <PageWrapper title="Bonds & Fixed Income" description="Corporate bonds, G-Secs, T-Bills and tax-free bonds">
      <div className="flex gap-1 border-b overflow-x-auto">
        {BOND_TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveType(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeType === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : !data.length ? (
        <EmptyState onAdd={() => setModal({ mode: 'add' })} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {data.length} bond{data.length !== 1 ? 's' : ''}
              {' · '}Invested {formatCompact(totalInvested)}
              {totalAnnualCoupon > 0 && ` · Annual coupon ${formatCompact(totalAnnualCoupon)}`}
            </div>
            <Button size="sm" onClick={() => setModal({ mode: 'add' })}><Plus size={14} className="mr-1" />Add Bond</Button>
          </div>

          <div className="space-y-2">
            {data.map((bond) => (
              <Card key={bond.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{bond.issuer}</span>
                      <Badge className={TYPE_COLORS[bond.bond_type] || ''}>
                        {bond.bond_type.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {bond.credit_rating && (
                        <Badge variant="outline" className="text-xs font-mono">{bond.credit_rating}</Badge>
                      )}
                      {bond.bond_type === 'tax_free' && (
                        <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Tax-Free</Badge>
                      )}
                    </div>
                    {bond.isin && <div className="text-xs text-muted-foreground mt-0.5 font-mono">{bond.isin}</div>}
                  </div>

                  <div className="text-right hidden md:block shrink-0">
                    <div className="text-xs text-muted-foreground">Coupon</div>
                    <div className="text-sm">{bond.coupon_rate}% · {bond.coupon_frequency?.replace('_', '-')}</div>
                  </div>

                  <div className="text-right hidden sm:block shrink-0">
                    <div className="text-xs text-muted-foreground">YTM</div>
                    <div className="text-sm font-medium text-primary">
                      {bond.ytm != null ? `${(bond.ytm * 100).toFixed(2)}%` : '—'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Invested</div>
                    <div className="text-sm font-semibold">{formatINR(bond.purchase_price)}</div>
                  </div>

                  <div className="text-right hidden sm:block shrink-0">
                    <MaturityBadge dateStr={bond.maturity_date} />
                    <div className="text-xs text-muted-foreground mt-1">{bond.maturity_date}</div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      onClick={() => setModal({ mode: 'edit', data: bond })}>
                      <Pencil size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(bond.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Add Bond' : 'Edit Bond'} onClose={() => setModal(null)}>
          <BondForm initialData={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}
    </PageWrapper>
  )
}
