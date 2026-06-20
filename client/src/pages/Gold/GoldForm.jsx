import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const GOLD_TYPES = [
  { value: 'physical', label: 'Physical Gold' },
  { value: 'digital',  label: 'Digital Gold' },
  { value: 'etf',      label: 'Gold ETF' },
  { value: 'sgb',      label: 'Sovereign Gold Bond (SGB)' },
]

const PURITY_OPTIONS = ['24k','22k','18k','999','995','916']

const PLATFORMS_DIGITAL = ['MMTC-PAMP','SafeGold','Paytm Gold','PhonePe Gold','Google Pay Gold']

const today = new Date().toISOString().slice(0, 10)

export default function GoldForm({ onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      gold_type: 'physical', purity: '22k', coupon_rate: 2.50,
      purchase_date: today,
    },
  })
  const goldType = watch('gold_type')

  const mutation = useMutation({
    mutationFn: (data) => api.post('/assets/gold', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gold'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      quantity:       parseFloat(data.quantity),
      purchase_price: parseFloat(data.purchase_price) || null,
      face_value:     data.face_value ? parseFloat(data.face_value) : null,
      coupon_rate:    data.coupon_rate ? parseFloat(data.coupon_rate) : 2.50,
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Gold Type */}
      <div>
        <Label>Gold Type *</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {GOLD_TYPES.map(({ value, label }) => {
            const active = goldType === value
            return (
              <label key={value}
                className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer text-sm transition-colors ${
                  active ? 'border-primary bg-primary/5 font-medium' : 'border-input'
                }`}>
                <input type="radio" value={value} {...register('gold_type')} className="sr-only" />
                {label}
              </label>
            )
          })}
        </div>
      </div>

      {/* Name */}
      <div>
        <Label htmlFor="name">Description / Name *</Label>
        <Input id="name" placeholder={
          goldType === 'physical' ? 'e.g. 22k Gold Coin 10g' :
          goldType === 'digital'  ? 'e.g. MMTC-PAMP Digital Gold' :
          goldType === 'etf'      ? 'e.g. GOLDBEES' :
                                   'e.g. SGB 2023-24 Series I'
        } {...register('name', { required: 'Name is required' })} />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      {/* Quantity */}
      <div>
        <Label htmlFor="quantity">
          {goldType === 'etf' ? 'Units *' : goldType === 'sgb' ? 'Number of Bonds *' : 'Weight (grams) *'}
        </Label>
        <Input id="quantity" type="number" step="0.0001" min="0.0001"
          placeholder={goldType === 'physical' || goldType === 'digital' ? 'e.g. 10.0000' : 'e.g. 50'}
          {...register('quantity', { required: 'Quantity is required', min: { value: 0.0001, message: 'Must be > 0' } })} />
        {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>}
      </div>

      {/* Physical — purity, storage */}
      {goldType === 'physical' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="purity">Purity</Label>
            <Select id="purity" {...register('purity')}>
              {PURITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="storage_location">Storage Location</Label>
            <Input id="storage_location" placeholder="e.g. Bank locker / Home"
              {...register('storage_location')} />
          </div>
        </div>
      )}

      {/* ETF — ticker, broker */}
      {goldType === 'etf' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ticker">Ticker *</Label>
            <Input id="ticker" placeholder="e.g. GOLDBEES" style={{ textTransform: 'uppercase' }}
              {...register('ticker', { required: goldType === 'etf' ? 'Ticker required' : false })} />
            {errors.ticker && <p className="text-xs text-red-500 mt-1">{errors.ticker.message}</p>}
          </div>
          <div>
            <Label htmlFor="broker">Broker</Label>
            <Input id="broker" placeholder="e.g. Zerodha" {...register('broker')} />
          </div>
        </div>
      )}

      {/* SGB — series, face value, maturity, coupon */}
      {goldType === 'sgb' && (
        <>
          <div>
            <Label htmlFor="sgb_series">SGB Series *</Label>
            <Input id="sgb_series" placeholder="e.g. SGB 2023-24 Series I"
              {...register('sgb_series', { required: goldType === 'sgb' ? 'Series name required' : false })} />
            {errors.sgb_series && <p className="text-xs text-red-500 mt-1">{errors.sgb_series.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input id="issue_date" type="date" {...register('issue_date')} />
            </div>
            <div>
              <Label htmlFor="maturity_date">Maturity Date</Label>
              <Input id="maturity_date" type="date" {...register('maturity_date')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="face_value">Issue Price (₹/gram)</Label>
              <Input id="face_value" type="number" step="0.01" min="0"
                placeholder="e.g. 5923" {...register('face_value')} />
            </div>
            <div>
              <Label htmlFor="coupon_rate">Coupon Rate (%)</Label>
              <Input id="coupon_rate" type="number" step="0.01" min="0"
                placeholder="2.50" {...register('coupon_rate')} />
            </div>
          </div>
        </>
      )}

      {/* Digital — platform */}
      {goldType === 'digital' && (
        <div>
          <Label htmlFor="platform">Platform</Label>
          <Select id="platform" {...register('platform')}>
            <option value="">— Select platform —</option>
            {PLATFORMS_DIGITAL.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </div>
      )}

      {/* Physical / Digital — platform as free text (jeweler or provider) */}
      {goldType === 'physical' && (
        <div>
          <Label htmlFor="platform">Jeweler / Source</Label>
          <Input id="platform" placeholder="e.g. PC Jeweller" {...register('platform')} />
        </div>
      )}

      {/* Purchase info — all types */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="purchase_price">
            {goldType === 'etf'           ? 'Purchase Price (₹/unit)' :
             goldType === 'sgb'           ? 'Purchase Price (₹/bond)' :
                                           'Purchase Price (₹/gram)'}
          </Label>
          <Input id="purchase_price" type="number" step="0.01" min="0"
            placeholder="e.g. 6200" {...register('purchase_price')} />
        </div>
        <div>
          <Label htmlFor="purchase_date">Purchase Date</Label>
          <Input id="purchase_date" type="date" {...register('purchase_date')} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" placeholder="Optional notes" {...register('notes')} />
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-500">
          {mutation.error?.response?.data?.message || 'Failed to save. Please try again.'}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Add Gold Holding'}
        </Button>
      </div>
    </form>
  )
}
