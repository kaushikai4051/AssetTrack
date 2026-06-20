import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

export default function SavingsForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: initialData
      ? { ...initialData, balance: initialData.current_value }
      : { account_type: 'savings', interest_rate: 0 },
  })

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/assets/savings-accounts/${initialData.id}`, data).then((r) => r.data)
        : api.post('/assets/savings-accounts', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['savings-accounts'] })
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
          <Label htmlFor="account_type">Account Type *</Label>
          <Select id="account_type" {...register('account_type', { required: 'Required' })}>
            <option value="savings">Savings</option>
            <option value="current">Current</option>
            <option value="salary">Salary</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="account_number">Account Number</Label>
          <Input id="account_number" placeholder="Optional" {...register('account_number')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="balance">Current Balance (₹) *</Label>
          <Input id="balance" type="number" step="0.01" placeholder="25000" {...register('balance', { required: 'Required', min: { value: 0, message: 'Must be ≥ 0' } })} />
          {errors.balance && <p className="text-xs text-destructive">{errors.balance.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="interest_rate">Interest Rate (% p.a.)</Label>
          <Input id="interest_rate" type="number" step="0.01" placeholder="3.50" {...register('interest_rate')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ifsc_code">IFSC Code</Label>
          <Input id="ifsc_code" placeholder="SBIN0001234" {...register('ifsc_code')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="branch_name">Branch</Label>
          <Input id="branch_name" placeholder="Optional" {...register('branch_name')} />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" placeholder="Optional" {...register('notes')} />
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
          {mutation.isPending ? 'Saving…' : isEdit ? 'Update Account' : 'Add Account'}
        </Button>
      </div>
    </form>
  )
}
