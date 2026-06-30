import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Home, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import PropertyForm from './PropertyForm'
import DocumentsPanel from '@/components/shared/DocumentsPanel'
import { formatINR, formatCompact } from '@/utils/currency'
import useFilterStore from '@/store/filterStore'
import api from '@/services/api'

const TABS = [
  { key: 'all',       label: 'All' },
  { key: 'flat',      label: 'Flat' },
  { key: 'villa',     label: 'Villa' },
  { key: 'plot',      label: 'Plot' },
  { key: 'commercial',label: 'Commercial' },
  { key: 'reit',      label: 'REIT' },
]

const TYPE_COLORS = {
  flat:       'bg-blue-100 text-blue-700 border-blue-200',
  villa:      'bg-green-100 text-green-700 border-green-200',
  plot:       'bg-amber-100 text-amber-700 border-amber-200',
  commercial: 'bg-violet-100 text-violet-700 border-violet-200',
  reit:       'bg-teal-100 text-teal-700 border-teal-200',
}

function leaseDaysLeft(dateStr) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function LeaseBadge({ endDate }) {
  if (!endDate) return null
  const days = leaseDaysLeft(endDate)
  if (days < 0)    return <Badge className="bg-red-100 text-red-700 border-red-200">Lease expired</Badge>
  if (days <= 30)  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Lease ends {days}d</Badge>
  return <Badge variant="outline" className="text-xs">Lease till {endDate}</Badge>
}

function EmptyState({ onAdd }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <Home size={32} className="text-muted-foreground" />
        <p className="text-muted-foreground text-sm">No properties added yet.</p>
        <Button size="sm" onClick={onAdd}><Plus size={14} className="mr-1" />Add Property</Button>
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

export default function RealEstate() {
  const qc = useQueryClient()
  const [activeType, setActiveType] = useState('all')
  const [modal, setModal] = useState(null)
  const [docsModal, setDocsModal] = useState(null)
  const activeMemberId = useFilterStore((s) => s.activeMemberId)
  const fmParam = activeMemberId === null ? '' : `?family_member_id=${activeMemberId === 0 ? 'self' : activeMemberId}`

  const { data = [], isLoading } = useQuery({
    queryKey: ['real-estate', activeType, activeMemberId],
    queryFn: () => api.get(`/assets/real-estate${fmParam}`).then((r) => r.data),
  })

  const filtered = activeType === 'all' ? data : data.filter((p) => p.property_type === activeType)

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/real-estate/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['real-estate'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const totalValue    = filtered.reduce((s, p) => s + p.current_value, 0)
  const totalCost     = filtered.reduce((s, p) => s + p.total_cost, 0)
  const totalMonthRent = filtered.filter((p) => p.is_rented).reduce((s, p) => s + (p.monthly_rent || 0), 0)
  const unrealized    = totalValue - totalCost

  return (
    <PageWrapper title="Real Estate" description="Properties, land and REITs">
      <div className="flex gap-1 border-b overflow-x-auto">
        {TABS.map((t) => (
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
      ) : !filtered.length ? (
        <EmptyState onAdd={() => setModal({ mode: 'add' })} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {filtered.length} propert{filtered.length !== 1 ? 'ies' : 'y'}
              {' · '}Value {formatCompact(totalValue)}
              {unrealized !== 0 && (
                <span className={unrealized > 0 ? ' text-green-600' : ' text-destructive'}>
                  {' '}({unrealized > 0 ? '+' : ''}{formatCompact(unrealized)})
                </span>
              )}
              {totalMonthRent > 0 && ` · Rental ${formatCompact(totalMonthRent)}/mo`}
            </div>
            <Button size="sm" onClick={() => setModal({ mode: 'add' })}><Plus size={14} className="mr-1" />Add Property</Button>
          </div>

          <div className="space-y-2">
            {filtered.map((prop) => (
              <Card key={prop.id}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{prop.property_name}</span>
                      <Badge className={TYPE_COLORS[prop.property_type] || ''}>
                        {prop.property_type.toUpperCase()}
                      </Badge>
                      {prop.is_rented && (
                        <Badge className="bg-green-100 text-green-700 border-green-200">Rented</Badge>
                      )}
                      {prop.ownership_percent < 100 && (
                        <Badge variant="outline" className="text-xs">{prop.ownership_percent}% owned</Badge>
                      )}
                    </div>
                    {prop.address && (
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{prop.address}</div>
                    )}
                    {prop.is_rented && prop.lease_end_date && (
                      <div className="mt-1"><LeaseBadge endDate={prop.lease_end_date} /></div>
                    )}
                  </div>

                  {prop.is_rented && prop.monthly_rent && (
                    <div className="text-right hidden md:block shrink-0">
                      <div className="text-xs text-muted-foreground">Rent / mo</div>
                      <div className="text-sm font-medium text-green-600">{formatINR(prop.monthly_rent)}</div>
                      {prop.rental_yield > 0 && (
                        <div className="text-xs text-muted-foreground">{prop.rental_yield}% yield</div>
                      )}
                    </div>
                  )}

                  <div className="text-right hidden sm:block shrink-0">
                    <div className="text-xs text-muted-foreground">Cost</div>
                    <div className="text-sm">{formatCompact(prop.total_cost)}</div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-muted-foreground">Current Value</div>
                    <div className="text-sm font-semibold">{formatCompact(prop.current_value)}</div>
                    {prop.current_value !== prop.total_cost && (
                      <div className={`text-xs ${prop.current_value > prop.total_cost ? 'text-green-600' : 'text-destructive'}`}>
                        {prop.current_value > prop.total_cost ? '+' : ''}
                        {formatCompact(prop.current_value - prop.total_cost)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      title="Documents"
                      onClick={() => setDocsModal(prop)}>
                      <Paperclip size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      onClick={() => setModal({ mode: 'edit', data: prop })}>
                      <Pencil size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(prop.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Add Property' : 'Edit Property'} onClose={() => setModal(null)}>
          <PropertyForm initialData={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}

      {docsModal && (
        <Modal title={`Documents — ${docsModal.property_name}`} onClose={() => setDocsModal(null)}>
          <DocumentsPanel assetType={docsModal.property_type === 'reit' ? 'reit' : 'property'} assetId={docsModal.id} />
        </Modal>
      )}
    </PageWrapper>
  )
}
