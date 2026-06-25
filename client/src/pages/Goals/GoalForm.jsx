import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const GOAL_TYPE_OPTIONS = [
  { value: 'retirement',     label: 'Retirement' },
  { value: 'education',      label: 'Education' },
  { value: 'home',           label: 'Home Purchase' },
  { value: 'car',            label: 'Car Purchase' },
  { value: 'vacation',       label: 'Vacation' },
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'wedding',        label: 'Wedding' },
  { value: 'other',          label: 'Other' },
]

export default function GoalForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialData
      ? {
          ...initialData,
          target_date: initialData.target_date?.slice(0, 10),
        }
      : {
          goal_type:      'other',
          assumed_return: 12,
        },
  })

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/goals/${initialData.id}`, data).then((r) => r.data)
        : api.post('/goals', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="name">Goal Name *</Label>
          <Input
            id="name"
            placeholder="e.g. Child's Education Fund"
            {...register('name', { required: 'Required' })}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="goal_type">Goal Type *</Label>
          <Select id="goal_type" {...register('goal_type', { required: 'Required' })}>
            {GOAL_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="target_date">Target Date *</Label>
          <Input
            id="target_date"
            type="date"
            {...register('target_date', { required: 'Required' })}
          />
          {errors.target_date && <p className="text-xs text-destructive">{errors.target_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="target_amount">Target Amount (₹) *</Label>
          <Input
            id="target_amount"
            type="number"
            min="1"
            step="1"
            placeholder="50,00,000"
            {...register('target_amount', { required: 'Required', valueAsNumber: true, min: 1 })}
          />
          {errors.target_amount && <p className="text-xs text-destructive">{errors.target_amount.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assumed_return">Assumed Annual Return (%)</Label>
          <Input
            id="assumed_return"
            type="number"
            min="0"
            max="50"
            step="0.5"
            {...register('assumed_return', { valueAsNumber: true })}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" placeholder="Optional notes" {...register('notes')} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Update Goal' : 'Add Goal'}
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">
          {mutation.error?.response?.data?.message || 'Something went wrong.'}
        </p>
      )}
    </form>
  )
}
