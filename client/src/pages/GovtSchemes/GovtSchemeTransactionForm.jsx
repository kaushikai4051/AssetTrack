import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const TX_TYPES = {
  ppf:     ['deposit','withdrawal','interest'],
  epf:     ['deposit','employer_contribution','interest','withdrawal'],
  default: ['deposit','withdrawal','interest'],
}

const TX_LABELS = {
  deposit:              'Deposit / Contribution',
  withdrawal:           'Withdrawal',
  interest:             'Interest Credit',
  employer_contribution:'Employer Contribution',
  maturity:             'Maturity Payout',
}

const today = new Date().toISOString().slice(0, 10)

export default function GovtSchemeTransactionForm({ assetId, schemeType, onClose }) {
  const qc = useQueryClient()
  const types = TX_TYPES[schemeType] || TX_TYPES.default

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { tx_date: today, tx_type: types[0] },
  })

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/assets/govt-schemes/${assetId}/transactions`, {
      ...data,
      amount: parseFloat(data.amount),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['govt-schemes'] })
      qc.invalidateQueries({ queryKey: ['scheme-txns', assetId] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div>
        <Label htmlFor="tx_type">Transaction Type *</Label>
        <Select id="tx_type" {...register('tx_type', { required: true })}>
          {types.map((t) => <option key={t} value={t}>{TX_LABELS[t]}</option>)}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="tx_date">Date *</Label>
          <Input id="tx_date" type="date" {...register('tx_date', { required: 'Date required' })} />
          {errors.tx_date && <p className="text-xs text-red-500 mt-1">{errors.tx_date.message}</p>}
        </div>
        <div>
          <Label htmlFor="amount">Amount (₹) *</Label>
          <Input id="amount" type="number" step="0.01" min="0.01"
            {...register('amount', { required: 'Amount required', min: { value: 0.01, message: 'Must be > 0' } })} />
          {errors.amount && <p className="text-xs text-red-500 mt-1">{errors.amount.message}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description / Remarks</Label>
        <Input id="description" placeholder="e.g. FY 2024-25 deposit" {...register('description')} />
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-500">
          {mutation.error?.response?.data?.message || 'Failed to save. Please try again.'}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Add Transaction'}
        </Button>
      </div>
    </form>
  )
}
