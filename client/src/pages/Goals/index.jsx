import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Target, TrendingUp, CalendarClock, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import GoalForm from './GoalForm'
import { formatINR, formatCompact } from '@/utils/currency'
import api from '@/services/api'

const GOAL_ICONS = {
  retirement:     '🏖️',
  education:      '🎓',
  home:           '🏠',
  car:            '🚗',
  vacation:       '✈️',
  emergency_fund: '🛡️',
  wedding:        '💍',
  other:          '🎯',
}

const GOAL_TYPE_LABELS = {
  retirement:     'Retirement',
  education:      'Education',
  home:           'Home Purchase',
  car:            'Car Purchase',
  vacation:       'Vacation',
  emergency_fund: 'Emergency Fund',
  wedding:        'Wedding',
  other:          'Other',
}

function ProgressBar({ pct, onTrack }) {
  const clampedPct = Math.min(100, Math.max(0, pct))
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all ${onTrack ? 'bg-green-500' : 'bg-amber-500'}`}
        style={{ width: `${clampedPct}%` }}
      />
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Target size={40} className="text-muted-foreground/40" />
        <p className="text-muted-foreground text-sm">No financial goals yet. Start by adding one.</p>
        <Button size="sm" onClick={onAdd}><Plus size={14} className="mr-1" />Add Goal</Button>
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

function yearsMonths(months) {
  if (months <= 0) return 'Overdue'
  const y = Math.floor(months / 12)
  const m = months % 12
  if (y === 0) return `${m}mo`
  if (m === 0) return `${y}yr`
  return `${y}yr ${m}mo`
}

function GoalCard({ goal, onEdit, onDelete, onManageAssets }) {
  const icon = GOAL_ICONS[goal.goal_type] || '🎯'
  const typeLabel = GOAL_TYPE_LABELS[goal.goal_type] || 'Goal'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <div>
              <CardTitle className="text-base leading-tight">{goal.name}</CardTitle>
              <span className="text-xs text-muted-foreground">{typeLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onManageAssets(goal)}>
              <Link2 size={14} />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(goal)}>
              <Pencil size={14} />
            </Button>
            <DeleteButton onConfirm={() => onDelete(goal.id)} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="font-semibold">{formatCompact(goal.target_amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current Value</p>
            <p className="font-semibold">{formatCompact(goal.current_value)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{goal.progress_pct.toFixed(1)}% achieved</span>
            <span className="flex items-center gap-1">
              <CalendarClock size={12} />
              {yearsMonths(goal.months_left)} left
            </span>
          </div>
          <ProgressBar pct={goal.progress_pct} onTrack={goal.on_track} />
        </div>

        {/* Projection stats */}
        <div className="grid grid-cols-2 gap-3 text-sm border-t pt-3">
          <div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp size={11} /> SIP Required
            </p>
            <p className="font-medium text-sm">
              {goal.sip_required > 0 ? formatINR(goal.sip_required) + '/mo' : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">On Track</p>
            <Badge
              className={`text-xs ${goal.on_track
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-amber-100 text-amber-700 border-amber-200'}`}
            >
              {goal.on_track ? 'Yes' : 'No — needs SIP'}
            </Badge>
          </div>
        </div>

        {goal.target_date && (
          <p className="text-xs text-muted-foreground">
            Target date: {new Date(goal.target_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function LinkAssetsModal({ goal, onClose }) {
  const qc = useQueryClient()

  const { data: allAssets = [] } = useQuery({
    queryKey: ['assets-list'],
    queryFn: () => api.get('/assets').then((r) => r.data),
  })

  const { data: goalDetail } = useQuery({
    queryKey: ['goal', goal.id],
    queryFn: () => api.get(`/goals/${goal.id}`).then((r) => r.data),
  })

  const linkedIds = new Set((goalDetail?.linked_assets || []).map((a) => a.id))

  const linkMutation = useMutation({
    mutationFn: (assetId) => api.post(`/goals/${goal.id}/assets`, { asset_id: assetId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal', goal.id] })
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (assetId) => api.delete(`/goals/${goal.id}/assets/${assetId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal', goal.id] })
      qc.invalidateQueries({ queryKey: ['goals'] })
    },
  })

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Link assets whose current value counts towards this goal's progress.
      </p>
      <div className="max-h-72 overflow-y-auto space-y-2">
        {allAssets.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No assets found.</p>
        )}
        {allAssets.map((asset) => {
          const linked = linkedIds.has(asset.id)
          return (
            <div key={asset.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{asset.asset_name}</span>
                <span className="ml-2 text-xs text-muted-foreground">{formatINR(asset.current_value)}</span>
              </div>
              <Button
                size="sm"
                variant={linked ? 'destructive' : 'outline'}
                className="h-6 px-2 text-xs"
                onClick={() => linked ? unlinkMutation.mutate(asset.id) : linkMutation.mutate(asset.id)}
                disabled={linkMutation.isPending || unlinkMutation.isPending}
              >
                {linked ? 'Unlink' : 'Link'}
              </Button>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end pt-2">
        <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}

export default function Goals() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'add' | 'edit' | 'assets'
  const [selected, setSelected] = useState(null)

  const { data: goals = [], isLoading, isError } = useQuery({
    queryKey: ['goals'],
    queryFn: () => api.get('/goals').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/goals/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })

  function openAdd() { setSelected(null); setModal('add') }
  function openEdit(g) { setSelected(g); setModal('edit') }
  function openAssets(g) { setSelected(g); setModal('assets') }
  function closeModal() { setModal(null); setSelected(null) }

  const totalTarget  = goals.reduce((s, g) => s + g.target_amount, 0)
  const totalCurrent = goals.reduce((s, g) => s + g.current_value, 0)
  const onTrackCount = goals.filter((g) => g.on_track).length

  return (
    <PageWrapper
      title="Financial Goals"
      actions={
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} className="mr-1" /> Add Goal
        </Button>
      }
    >
      {/* Summary strip */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Total Target</p>
              <p className="text-lg font-bold">{formatCompact(totalTarget)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Invested So Far</p>
              <p className="text-lg font-bold">{formatCompact(totalCurrent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Goals On Track</p>
              <p className="text-lg font-bold">{onTrackCount} / {goals.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading && <p className="text-muted-foreground text-sm">Loading goals…</p>}
      {isError && <p className="text-destructive text-sm">Failed to load goals.</p>}

      {!isLoading && goals.length === 0 && <EmptyState onAdd={openAdd} />}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            onEdit={openEdit}
            onDelete={(id) => deleteMutation.mutate(id)}
            onManageAssets={openAssets}
          />
        ))}
      </div>

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal
          title={modal === 'edit' ? 'Edit Goal' : 'Add Goal'}
          onClose={closeModal}
        >
          <GoalForm initialData={modal === 'edit' ? selected : null} onClose={closeModal} />
        </Modal>
      )}

      {/* Link assets modal */}
      {modal === 'assets' && selected && (
        <Modal title={`Link Assets — ${selected.name}`} onClose={closeModal}>
          <LinkAssetsModal goal={selected} onClose={closeModal} />
        </Modal>
      )}
    </PageWrapper>
  )
}
