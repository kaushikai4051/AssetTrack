import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

export default function TransactionForm({ fundId, schemeCode, onClose }) {
  const qc    = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: { type: 'purchase', source: 'sip', transaction_date: today },
  })

  const amount = parseFloat(watch('amount')) || 0
  const nav    = parseFloat(watch('nav'))    || 0

  // Units = Amount ÷ NAV (auto-calculated)
  const computedUnits = amount > 0 && nav > 0 ? (amount / nav).toFixed(4) : ''

  // Fetch today's NAV for the scheme and pre-fill
  const { data: navData, isFetching: navLoading } = useQuery({
    queryKey: ['mf-nav', schemeCode],
    queryFn:  () => api.get(`/market/mf-nav/${schemeCode}`).then((r) => r.data),
    enabled:  Boolean(schemeCode),
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  })
  useEffect(() => {
    if (navData?.nav) setValue('nav', navData.nav)
  }, [navData, setValue])

  const mutation = useMutation({
    mutationFn: (data) => api.post(`/assets/mutual-funds/${fundId}/transactions`, {
      ...data,
      nav:    parseFloat(data.nav),
      amount: parseFloat(data.amount),
      units:  parseFloat(computedUnits),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
      qc.invalidateQueries({ queryKey: ['mf-txns', fundId] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  const txType = watch('type')

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Type */}
        <div className="space-y-1.5">
          <Label>Transaction Type *</Label>
          <Select {...register('type', { required: true })}>
            <option value="purchase">Purchase</option>
            <option value="redemption">Redemption</option>
            <option value="dividend_reinvest">Dividend Reinvest</option>
            <option value="switch_in">Switch In</option>
            <option value="switch_out">Switch Out</option>
          </Select>
        </div>

        {/* Source */}
        {(txType === 'purchase' || txType === 'dividend_reinvest') && (
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select {...register('source')}>
              <option value="sip">SIP</option>
              <option value="lumpsum">Lumpsum</option>
              <option value="dividend">Dividend</option>
            </Select>
          </div>
        )}

        {/* Date */}
        <div className="space-y-1.5 col-span-2 sm:col-span-1">
          <Label>Date *</Label>
          <Input type="date"
            {...register('transaction_date', { required: 'Required' })} />
          {errors.transaction_date && (
            <p className="text-xs text-destructive">{errors.transaction_date.message}</p>
          )}
        </div>

        {/* Amount — mandatory */}
        <div className="space-y-1.5">
          <Label>Amount (₹) *</Label>
          <Input type="number" step="0.01" min="0.01" placeholder="e.g. 5000"
            {...register('amount', {
              required: 'Amount is required',
              min: { value: 0.01, message: 'Must be > 0' },
            })} />
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          )}
        </div>

        {/* NAV — mandatory */}
        <div className="space-y-1.5">
          <Label>NAV (₹) *</Label>
          <div className="relative">
            <Input type="number" step="0.0001" min="0.0001" placeholder="e.g. 42.5000"
              {...register('nav', {
                required: 'NAV is required',
                min: { value: 0.0001, message: 'Must be > 0' },
              })} />
            {navLoading && (
              <span className="absolute right-2 top-2 text-xs text-muted-foreground">fetching…</span>
            )}
          </div>
          {navData && (
            <p className="text-xs text-muted-foreground">Latest: ₹{navData.nav} ({navData.date})</p>
          )}
          {errors.nav && (
            <p className="text-xs text-destructive">{errors.nav.message}</p>
          )}
        </div>

        {/* Units — auto-calculated, read-only */}
        <div className="space-y-1.5">
          <Label>Units (auto-calculated)</Label>
          <Input
            readOnly
            tabIndex={-1}
            value={computedUnits}
            placeholder="Calculated from Amount ÷ NAV"
            className="bg-muted/50 cursor-default"
          />
          {computedUnits && (
            <p className="text-xs text-muted-foreground">{computedUnits} units @ ₹{nav}</p>
          )}
        </div>

        {/* Notes */}
        <div className="col-span-2 space-y-1.5">
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
        <Button type="submit" disabled={mutation.isPending || !computedUnits}>
          {mutation.isPending ? 'Saving…' : 'Add Transaction'}
        </Button>
      </div>
    </form>
  )
}
