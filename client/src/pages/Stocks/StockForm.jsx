import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const SECTORS = [
  'Auto & Auto Components', 'Banking & Financial Services', 'Capital Goods',
  'Chemicals & Petrochemicals', 'Consumer Goods (FMCG)', 'Energy & Power',
  'Healthcare & Pharma', 'IT & Technology', 'Infrastructure',
  'Media & Entertainment', 'Metals & Mining', 'Real Estate', 'Telecom',
  'Textile', 'Other',
]

export default function StockForm({ onClose }) {
  const qc    = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: { exchange: 'NSE', tx_date: today, tx_brokerage: 0 },
  })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/assets/stocks', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stocks'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-5">
      {/* Stock details */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label>Company Name *</Label>
          <Input placeholder="e.g. Reliance Industries Ltd"
            {...register('company_name', { required: 'Required' })} />
          {errors.company_name && <p className="text-xs text-destructive">{errors.company_name.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Ticker Symbol *</Label>
          <Input placeholder="e.g. RELIANCE"
            {...register('ticker', { required: 'Required' })}
            style={{ textTransform: 'uppercase' }} />
          {errors.ticker && <p className="text-xs text-destructive">{errors.ticker.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Exchange *</Label>
          <Select {...register('exchange', { required: true })}>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="NYSE">NYSE</option>
            <option value="OTHER">Other</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Sector</Label>
          <Select {...register('sector')}>
            <option value="">— Select —</option>
            {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Broker</Label>
          <Input placeholder="e.g. Zerodha" {...register('broker')} />
        </div>

        <div className="space-y-1.5">
          <Label>ISIN</Label>
          <Input placeholder="INE… (optional)" {...register('isin')} />
        </div>
      </div>

      <hr className="border-dashed" />
      <p className="text-sm font-medium text-muted-foreground">First Buy Transaction</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Buy Date *</Label>
          <Input type="date" {...register('tx_date', { required: 'Required' })} />
          {errors.tx_date && <p className="text-xs text-destructive">{errors.tx_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Shares *</Label>
          <Input type="number" step="0.0001" placeholder="10"
            {...register('tx_shares', { required: 'Required', min: { value: 0.0001, message: 'Must be > 0' } })} />
          {errors.tx_shares && <p className="text-xs text-destructive">{errors.tx_shares.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Buy Price per Share (₹) *</Label>
          <Input type="number" step="0.01" placeholder="0.00"
            {...register('tx_price', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
          {errors.tx_price && <p className="text-xs text-destructive">{errors.tx_price.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Brokerage / STT (₹)</Label>
          <Input type="number" step="0.01" placeholder="0.00" {...register('tx_brokerage')} />
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
          {mutation.isPending ? 'Saving…' : 'Add Stock'}
        </Button>
      </div>
    </form>
  )
}
