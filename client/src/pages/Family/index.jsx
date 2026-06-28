import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Plus, Pencil, Trash2, Users, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PageWrapper from '@/components/layout/PageWrapper'
import Modal from '@/components/shared/Modal'
import api from '@/services/api'

const RELATIONS = ['self', 'spouse', 'child', 'parent', 'sibling', 'other']

const RELATION_COLORS = {
  self:    'bg-blue-100 text-blue-700 border-blue-200',
  spouse:  'bg-pink-100 text-pink-700 border-pink-200',
  child:   'bg-green-100 text-green-700 border-green-200',
  parent:  'bg-purple-100 text-purple-700 border-purple-200',
  sibling: 'bg-amber-100 text-amber-700 border-amber-200',
  other:   'bg-slate-100 text-slate-700 border-slate-200',
}

function fmtDate(str) {
  if (!str) return null
  return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function DeleteButton({ onConfirm }) {
  const [confirming, setConfirming] = useState(false)
  if (confirming) {
    return (
      <span className="flex items-center gap-1.5 border border-destructive/40 bg-destructive/5 rounded-md px-2 py-1">
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

function MemberForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = !!initialData

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: {
      full_name: initialData?.full_name || '',
      relation:  initialData?.relation  || 'spouse',
      dob:       initialData?.dob       || '',
      pan:       initialData?.pan       || '',
    },
  })

  async function onSubmit(data) {
    const payload = {
      full_name: data.full_name.trim(),
      relation:  data.relation,
      dob:       data.dob || null,
      pan:       data.pan?.trim() || null,
    }
    if (isEdit) {
      await api.put(`/family/${initialData.id}`, payload)
    } else {
      await api.post('/family', payload)
    }
    qc.invalidateQueries({ queryKey: ['family-members'] })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Full Name *</Label>
        <Input {...register('full_name', { required: 'Name is required' })} placeholder="e.g. Priya Sharma" />
        {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label>Relation *</Label>
        <select
          {...register('relation', { required: true })}
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {RELATIONS.map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Date of Birth</Label>
          <Input type="date" {...register('dob')} />
        </div>
        <div className="space-y-1.5">
          <Label>PAN</Label>
          <Input {...register('pan')} placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isEdit ? 'Update' : 'Add Member'}
        </Button>
      </div>
    </form>
  )
}

export default function Family() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['family-members'],
    queryFn: () => api.get('/family').then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/family/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family-members'] })
      qc.invalidateQueries({ queryKey: ['family-members-header'] })
    },
  })

  return (
    <PageWrapper title="Family" description="Manage family members and view their assets">
      <div className="space-y-4">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''} added
          </p>
          <Button size="sm" onClick={() => setModal({ mode: 'add' })}>
            <Plus size={14} className="mr-1" />Add Member
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : members.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <Users size={32} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No family members added yet.</p>
              <p className="text-xs text-muted-foreground">Add a member to track their assets separately and view a consolidated family portfolio.</p>
              <Button size="sm" onClick={() => setModal({ mode: 'add' })}>
                <Plus size={14} className="mr-1" />Add First Member
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m) => (
              <Card key={m.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <User size={18} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.full_name}</span>
                        <Badge className={`${RELATION_COLORS[m.relation] || ''} text-[10px]`}>
                          {m.relation}
                        </Badge>
                      </div>
                      {m.dob && (
                        <p className="text-xs text-muted-foreground mt-0.5">DOB: {fmtDate(m.dob)}</p>
                      )}
                      {m.pan && (
                        <p className="text-xs text-muted-foreground font-mono">{m.pan}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        onClick={() => setModal({ mode: 'edit', data: m })}>
                        <Pencil size={13} />
                      </Button>
                      <DeleteButton onConfirm={() => deleteMutation.mutate(m.id)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tip */}
        {members.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Use the <span className="font-medium">member selector in the header</span> to filter the entire app to a specific family member's assets.
          </p>
        )}
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'add' ? 'Add Family Member' : 'Edit Family Member'}
          onClose={() => setModal(null)}
        >
          <MemberForm initialData={modal.data} onClose={() => setModal(null)} />
        </Modal>
      )}
    </PageWrapper>
  )
}
