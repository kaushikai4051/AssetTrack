import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

export default function StockTransactionForm({ holdingId, onClose }) {
  const qc    = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { type: 'buy', transaction_date: today, brokerage: 0 },
  })

  const txType  = watch('type')
  const shares  = watch('shares')
  const price   = watch('price')

  // Auto-calc amount for buy/sell
  useEffect(() => {
    const s = parseFloat(shares)
    const p = parseFloat(price)
    const b = parseFloat(watch('brokerage')) || 0
    if (s > 0 && p > 0) {
      setValue('amount', txType === 'buy' ? (s * p + b).toFixed(2) : (s * p - b).toFixed(2))
    }
  }, [shares, price, txType, setValue, watch])

  const isSplit = txType === 'split'
  const isBonusOrSplit = txType === 'bonus' || isSplit

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/assets/stocks/${holdingId}/transactions`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['stock-txns', holdingId] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Transaction Type *</Label>
          <Select {...register('type', { required: true })}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
            <option value="bonus">Bonus</option>
            <option value="split">Split</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Date *</Label>
          <Input type="date" {...register('transaction_date', { required: 'Required' })} />
          {errors.transaction_date && <p className="text-xs text-destructive">{errors.transaction_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>{isSplit ? 'Split Ratio *' : 'Shares *'}</Label>
          <Input type="number" step="0.0001"
            placeholder={isSplit ? 'e.g. 2 for 2-for-1' : '0'}
            {...register('shares', { required: 'Required', min: { value: 0.0001, message: 'Must be > 0' } })} />
          {isSplit && <p className="text-xs text-muted-foreground">Each existing share becomes this many shares</p>}
          {errors.shares && <p className="text-xs text-destructive">{errors.shares.message}</p>}
        </div>

        {!isBonusOrSplit && (
          <div className="space-y-1.5">
            <Label>Price per Share (₹) *</Label>
            <Input type="number" step="0.01" placeholder="0.00"
              {...register('price', { required: !isBonusOrSplit ? 'Required' : false, min: { value: 0.01, message: 'Must be > 0' } })} />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message}</p>}
          </div>
        )}

        {(txType === 'buy' || txType === 'sell') && (
          <div className="space-y-1.5">
            <Label>Brokerage / STT (₹)</Label>
            <Input type="number" step="0.01" placeholder="0.00" {...register('brokerage')} />
          </div>
        )}

        {!isBonusOrSplit && (
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" step="0.01" placeholder="Auto-calculated" {...register('amount')} />
            <p className="text-xs text-muted-foreground">= shares × price ± brokerage</p>
          </div>
        )}

        <div className={`space-y-1.5 ${isBonusOrSplit ? '' : 'col-span-2'}`}>
          <Label>Notes</Label>
          <Input placeholder="Optional" {...register('notes')} />
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
          {mutation.isPending ? 'Saving…' : 'Add Transaction'}
        </Button>
      </div>
    </form>
  )
}
