import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  UserCheck, UserX, ShieldCheck, Plus, Pencil, Trash2,
  AlertCircle, ChevronDown, ChevronUp, X,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PageWrapper from '@/components/layout/PageWrapper'
import api from '@/services/api'

// ── Constants ─────────────────────────────────────────────────────────────────

const RELATIONSHIPS = [
  'Spouse', 'Son', 'Daughter', 'Father', 'Mother',
  'Brother', 'Sister', 'Guardian', 'Self', 'Other',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—'
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function coverageColor(pct) {
  if (pct >= 80) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function coverageBg(pct) {
  if (pct >= 80) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
  if (pct >= 50) return 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
  return 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
}

// ── Nominee form modal ────────────────────────────────────────────────────────

function NomineeModal({ assetId, assetName, nominee, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!nominee

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: nominee?.name || '',
      relationship: nominee?.relationship || '',
      percentage: nominee?.percentage ?? 100,
      phone: nominee?.phone || '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/nominees/${nominee.id}`, data).then((r) => r.data)
        : api.post('/nominees', { asset_id: assetId, ...data }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['nominees'] })
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm">
            {isEdit ? 'Edit Nominee' : 'Add Nominee'} — {assetName}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit((d) => mutation.mutate({
            ...d,
            percentage: Number(d.percentage),
          }))}
          className="p-5 space-y-4"
        >
          <div className="space-y-1.5">
            <Label>Full Name *</Label>
            <Input
              placeholder="Nominee's full name"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Relationship *</Label>
            <select
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              {...register('relationship', { required: 'Relationship is required' })}
            >
              <option value="">Select relationship</option>
              {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.relationship && <p className="text-xs text-destructive">{errors.relationship.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Share % *</Label>
            <Input
              type="number"
              min="1"
              max="100"
              step="0.01"
              {...register('percentage', {
                required: 'Percentage is required',
                min: { value: 1, message: 'Must be at least 1%' },
                max: { value: 100, message: 'Cannot exceed 100%' },
              })}
            />
            {errors.percentage && <p className="text-xs text-destructive">{errors.percentage.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Phone (optional)</Label>
            <Input
              type="tel"
              placeholder="Mobile number"
              {...register('phone')}
            />
          </div>

          {mutation.isError && (
            <p className="text-xs text-destructive">
              {mutation.error?.response?.data?.message || 'Something went wrong'}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Update' : 'Add Nominee'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Asset card ────────────────────────────────────────────────────────────────

function AssetNomineeCard({ asset }) {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'add' | nominee object

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/nominees/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['nominees'] }),
  })

  const totalPct = asset.nominees.reduce((s, n) => s + n.percentage, 0)
  const hasNominees = asset.nominees.length > 0

  return (
    <>
      {modal && (
        <NomineeModal
          assetId={asset.asset_id}
          assetName={asset.asset_name}
          nominee={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
        />
      )}

      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-sm">{asset.asset_name}</p>
            <p className="text-xs text-muted-foreground">{asset.type_label} · {fmt(asset.current_value)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasNominees ? (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <UserCheck size={13} /> Covered
              </span>
            ) : (
              <span className="text-xs text-red-500 font-medium flex items-center gap-1">
                <UserX size={13} /> No Nominee
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => setModal('add')}
              disabled={totalPct >= 100}
              title={totalPct >= 100 ? '100% already allocated' : 'Add nominee'}
            >
              <Plus size={12} /> Add
            </Button>
          </div>
        </div>

        {hasNominees && (
          <div className="space-y-1.5">
            {asset.nominees.map((n) => (
              <div key={n.id} className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{n.name}</span>
                  <span className="text-xs text-muted-foreground">{n.relationship}</span>
                  {n.phone && <span className="text-xs text-muted-foreground">{n.phone}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">{n.percentage}%</span>
                  <button
                    onClick={() => setModal(n)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(n.id)}
                    className="text-muted-foreground hover:text-destructive"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {totalPct < 100 && (
              <p className="text-xs text-amber-500">
                ⚠ {100 - totalPct}% share unassigned
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Coverage summary cards ────────────────────────────────────────────────────

function SummaryCards({ summary }) {
  const { totalAssets, coveredAssets, uncoveredAssets, coveragePercent } = summary

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Assets</p>
          <p className="text-2xl font-bold">{totalAssets}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Covered</p>
          <p className="text-2xl font-bold text-emerald-600">{coveredAssets}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Missing Nominee</p>
          <p className="text-2xl font-bold text-red-500">{uncoveredAssets}</p>
        </CardContent>
      </Card>
      <Card className={`border ${coverageBg(coveragePercent)}`}>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-1">Coverage</p>
          <p className={`text-2xl font-bold ${coverageColor(coveragePercent)}`}>
            {coveragePercent}%
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left mb-3"
      >
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{count}</span>
        {open ? <ChevronUp size={14} className="ml-auto text-muted-foreground" /> : <ChevronDown size={14} className="ml-auto text-muted-foreground" />}
      </button>
      {open && <div className="space-y-2">{children}</div>}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Nominees() {
  const summaryQ = useQuery({
    queryKey: ['nominees', 'summary'],
    queryFn: () => api.get('/nominees/summary').then((r) => r.data),
  })

  const listQ = useQuery({
    queryKey: ['nominees', 'list'],
    queryFn: () => api.get('/nominees').then((r) => r.data),
  })

  if (summaryQ.isError || listQ.isError) {
    return (
      <PageWrapper title="Nominees">
        <Card>
          <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
            <AlertCircle size={18} />
            <span>Could not load nominees. Make sure the server is running.</span>
          </CardContent>
        </Card>
      </PageWrapper>
    )
  }

  if (summaryQ.isLoading || listQ.isLoading) {
    return (
      <PageWrapper title="Nominees">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardContent className="p-6"><div className="h-16 bg-muted rounded animate-pulse" /></CardContent></Card>
          ))}
        </div>
      </PageWrapper>
    )
  }

  const summary = summaryQ.data
  const assets = listQ.data

  const covered = assets.filter((a) => a.nominees.length > 0)
  const uncovered = assets.filter((a) => a.nominees.length === 0)

  return (
    <PageWrapper
      title="Nominees"
      description="Assign and track nominees across all your assets"
    >
      <div className="space-y-6">
        <SummaryCards summary={summary} />

        {summary.coveragePercent < 100 && uncovered.length > 0 && (
          <div className={`flex items-start gap-3 p-4 rounded-lg border text-sm ${coverageBg(summary.coveragePercent)}`}>
            <ShieldCheck size={18} className="shrink-0 mt-0.5 text-amber-500" />
            <p>
              <span className="font-medium">{uncovered.length} asset{uncovered.length > 1 ? 's' : ''} without a nominee.</span>
              {' '}Nominees ensure your assets pass on smoothly — add them below.
            </p>
          </div>
        )}

        {uncovered.length > 0 && (
          <Section title="Missing Nominee" count={uncovered.length} defaultOpen={true}>
            {uncovered.map((a) => <AssetNomineeCard key={a.asset_id} asset={a} />)}
          </Section>
        )}

        {covered.length > 0 && (
          <Section title="Nominees Assigned" count={covered.length} defaultOpen={uncovered.length === 0}>
            {covered.map((a) => <AssetNomineeCard key={a.asset_id} asset={a} />)}
          </Section>
        )}

        {assets.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <UserX size={36} />
              <p className="font-medium">No assets found</p>
              <p className="text-sm">Add assets first to assign nominees.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  )
}
