import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ShieldCheck, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import InsuranceForm from './InsuranceForm'
import DocumentsPanel from '@/components/shared/DocumentsPanel'
import { formatINR, formatCompact } from '@/utils/currency'
import useFilterStore from '@/store/filterStore'
import api from '@/services/api'

const INS_ASSET_TYPE = {
  term: 'life_insurance', endowment: 'life_insurance', money_back: 'life_insurance',
  ulip: 'life_insurance', lic: 'life_insurance',
  health: 'health_insurance', critical_illness: 'health_insurance',
  vehicle: 'vehicle_insurance',
}

const TABS = [
  { key: 'all',             label: 'All' },
  { key: 'term',            label: 'Term' },
  { key: 'endowment',       label: 'Endowment' },
  { key: 'money_back',      label: 'Money-Back' },
  { key: 'ulip',            label: 'ULIP' },
  { key: 'lic',             label: 'LIC' },
  { key: 'health',          label: 'Health' },
  { key: 'vehicle',         label: 'Vehicle' },
  { key: 'critical_illness',label: 'Critical Illness' },
]

const TYPE_COLORS = {
  term:             'bg-blue-100 text-blue-700 border-blue-200',
  endowment:        'bg-violet-100 text-violet-700 border-violet-200',
  money_back:       'bg-purple-100 text-purple-700 border-purple-200',
  ulip:             'bg-indigo-100 text-indigo-700 border-indigo-200',
  lic:              'bg-orange-100 text-orange-700 border-orange-200',
  health:           'bg-green-100 text-green-700 border-green-200',
  vehicle:          'bg-teal-100 text-teal-700 border-teal-200',
  critical_illness: 'bg-red-100 text-red-700 border-red-200',
}

function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000)
}

function RenewalBadge({ dateStr }) {
  if (!dateStr) return null
  const days = daysUntil(dateStr)
  if (days < 0)    return <Badge className="bg-red-100 text-red-700 border-red-200">Expired</Badge>
  if (days <= 15)  return <Badge className="bg-red-100 text-red-700 border-red-200">Due in {days}d</Badge>
  if (days <= 30)  return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Due in {days}d</Badge>
  return <Badge variant="outline">{dateStr}</Badge>
}

function EmptyState({ onAdd }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <ShieldCheck size={32} className="text-muted-foreground" />
        <p className="text-muted-foreground text-sm">No insurance policies added yet.</p>
        <Button size="sm" onClick={onAdd}><Plus size={14} className="mr-1" />Add Policy</Button>
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

export default function Insurance() {
  const qc = useQueryClient()
  const [activeType, setActiveType] = useState('all')
  const [modal, setModal] = useState(null)
  const [docsModal, setDocsModal] = useState(null)

  const activeMemberId = useFilterStore((s) => s.activeMemberId)

  const { data = [], isLoading } = useQuery({
    queryKey: ['insurance', activeType, activeMemberId],
    queryFn: () => {
      const qs = new URLSearchParams()
      if (activeType !== 'all') qs.set('type', activeType)
      if (activeMemberId !== null) qs.set('family_member_id', activeMemberId === 0 ? 'self' : activeMemberId)
      const params = qs.toString() ? `?${qs}` : ''
      return api.get(`/assets/insurance${params}`).then((r) => r.data)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/assets/insurance/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
    },
  })

  const totalPremium    = data.reduce((s, p) => s + p.annual_premium, 0)
  const totalCoverage   = data.reduce((s, p) => s + (p.sum_assured || 0), 0)
  const lifePolicies    = data.filter((p) => ['term','endowment','money_back','ulip','lic'].includes(p.insurance_type))
  const healthPolicies  = data.filter((p) => ['health','critical_illness'].includes(p.insurance_type))

  return (
    <PageWrapper title="Insurance" description="Life, health, vehicle and critical illness policies">
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
      ) : !data.length ? (
        <EmptyState onAdd={() => setModal({ mode: 'add' })} />
      ) : (
        <>
          {/* Coverage summary cards */}
          {activeType === 'all' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Total Policies</div>
                <div className="text-2xl font-bold mt-1">{data.length}</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Annual Premium</div>
                <div className="text-xl font-bold mt-1">{formatCompact(totalPremium)}</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Life Cover</div>
                <div className="text-xl font-bold mt-1">{lifePolicies.length > 0 ? formatCompact(lifePolicies.reduce((s,p)=>s+(p.sum_assured||0),0)) : '—'}</div>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <div className="text-xs text-muted-foreground">Health Cover</div>
                <div className="text-xl font-bold mt-1">{healthPolicies.length > 0 ? formatCompact(healthPolicies.reduce((s,p)=>s+(p.sum_assured||0),0)) : '—'}</div>
              </CardContent></Card>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {data.length} polic{data.length !== 1 ? 'ies' : 'y'}
              {totalCoverage > 0 && ` · Total cover ${formatCompact(totalCoverage)}`}
              {` · Premium ${formatCompact(totalPremium)}/yr`}
            </div>
            <Button size="sm" onClick={() => setModal({ mode: 'add' })}><Plus size={14} className="mr-1" />Add Policy</Button>
          </div>

          <div className="space-y-2">
            {data.map((policy) => (
              <Card key={policy.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{policy.insurer}</span>
                      <Badge className={TYPE_COLORS[policy.insurance_type] || ''}>
                        {policy.insurance_type.replace('_', ' ')}
                      </Badge>
                      {policy.family_floater && (
                        <Badge variant="outline" className="text-xs">Floater</Badge>
                      )}
                    </div>
                    {policy.plan_name && (
                      <div className="text-xs text-muted-foreground mt-0.5">{policy.plan_name}</div>
                    )}
                    {policy.policy_number && (
                      <div className="text-xs text-muted-foreground font-mono">{policy.policy_number}</div>
                    )}
                  </div>

                  {policy.sum_assured != null && (
                    <div className="text-right hidden md:block shrink-0">
                      <div className="text-xs text-muted-foreground">Coverage</div>
                      <div className="text-sm font-medium">{formatCompact(policy.sum_assured)}</div>
                    </div>
                  )}

                  <div className="text-right hidden sm:block shrink-0">
                    <div className="text-xs text-muted-foreground">Premium</div>
                    <div className="text-sm font-medium">{formatINR(policy.annual_premium)}/yr</div>
                  </div>

                  <div className="text-right hidden sm:block shrink-0">
                    <div className="text-xs text-muted-foreground mb-1">Renewal</div>
                    <RenewalBadge dateStr={policy.renewal_date} />
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      title="Documents"
                      onClick={() => setDocsModal(policy)}>
                      <Paperclip size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      onClick={() => setModal({ mode: 'edit', data: policy })}>
                      <Pencil size={13} />
                    </Button>
                    <DeleteButton onConfirm={() => deleteMutation.mutate(policy.id)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {modal && (
        <Modal title={modal.mode === 'add' ? 'Add Insurance Policy' : 'Edit Policy'} onClose={() => setModal(null)}>
          <InsuranceForm initialData={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}

      {docsModal && (
        <Modal title={`Documents — ${docsModal.insurer}`} onClose={() => setDocsModal(null)}>
          <DocumentsPanel assetType={INS_ASSET_TYPE[docsModal.insurance_type] || 'life_insurance'} assetId={docsModal.id} />
        </Modal>
      )}
    </PageWrapper>
  )
}
