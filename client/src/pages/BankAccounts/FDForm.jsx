import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const COMPOUNDING_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'simple', label: 'Simple Interest' },
]

export default function FDForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialData || { compounding: 'quarterly', is_auto_renew: false },
  })

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/assets/fixed-deposits/${initialData.id}`, data).then((r) => r.data)
        : api.post('/assets/fixed-deposits', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fixed-deposits'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="bank_name">Bank Name *</Label>
          <Input id="bank_name" placeholder="SBI, HDFC, ICICI…" {...register('bank_name', { required: 'Required' })} />
          {errors.bank_name && <p className="text-xs text-destructive">{errors.bank_name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account_number">Account / FD Number</Label>
          <Input id="account_number" placeholder="Optional" {...register('account_number')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="nominee_name">Nominee</Label>
          <Input id="nominee_name" placeholder="Optional" {...register('nominee_name')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="principal">Principal (₹) *</Label>
          <Input id="principal" type="number" step="0.01" placeholder="100000" {...register('principal', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
          {errors.principal && <p className="text-xs text-destructive">{errors.principal.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="interest_rate">Interest Rate (% p.a.) *</Label>
          <Input id="interest_rate" type="number" step="0.01" placeholder="7.25" {...register('interest_rate', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
          {errors.interest_rate && <p className="text-xs text-destructive">{errors.interest_rate.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="compounding">Compounding *</Label>
          <Select id="compounding" {...register('compounding', { required: 'Required' })}>
            {COMPOUNDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="start_date">Start Date *</Label>
          <Input id="start_date" type="date" {...register('start_date', { required: 'Required' })} />
          {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maturity_date">Maturity Date *</Label>
          <Input id="maturity_date" type="date" {...register('maturity_date', { required: 'Required' })} />
          {errors.maturity_date && <p className="text-xs text-destructive">{errors.maturity_date.message}</p>}
        </div>

        <div className="space-y-1.5 col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" placeholder="Optional" {...register('notes')} />
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <input id="is_auto_renew" type="checkbox" className="h-4 w-4" {...register('is_auto_renew')} />
          <Label htmlFor="is_auto_renew" className="font-normal cursor-pointer">Auto-renew on maturity</Label>
        </div>
      </div>

      {mutation.isError && (
        <p className="text-xs text-destructive">
          {mutation.error?.response?.data?.message || 'Something went wrong'}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Update FD' : 'Add FD'}
        </Button>
      </div>
    </form>
  )
}
