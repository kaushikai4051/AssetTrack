import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const BOND_TYPE_OPTIONS = [
  { value: 'corporate',  label: 'Corporate Bond' },
  { value: 'ncd',        label: 'NCD (Non-Convertible Debenture)' },
  { value: 'gsec',       label: 'G-Sec (Government Security)' },
  { value: 'tbill',      label: 'T-Bill (Treasury Bill)' },
  { value: 'sdl',        label: 'SDL (State Development Loan)' },
  { value: 'tax_free',   label: 'Tax-Free Bond (NHAI / REC / PFC)' },
]

const FREQ_OPTIONS = [
  { value: 'monthly',     label: 'Monthly' },
  { value: 'quarterly',   label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'yearly',      label: 'Yearly' },
  { value: 'on_maturity', label: 'On Maturity (Zero Coupon)' },
]

export default function BondForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: initialData || {
      bond_type: 'corporate',
      coupon_frequency: 'half_yearly',
      units: 1,
      is_secured: true,
      is_listed: true,
    },
  })

  const bondType = useWatch({ control, name: 'bond_type' })
  const isTBill  = bondType === 'tbill'

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/assets/bonds/${initialData.id}`, data).then((r) => r.data)
        : api.post('/assets/bonds', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bonds'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="bond_type">Bond Type *</Label>
          <Select id="bond_type" {...register('bond_type', { required: 'Required' })}>
            {BOND_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="issuer">Issuer Name *</Label>
          <Input id="issuer" placeholder="HDFC Ltd, NHAI, Govt of India…"
            {...register('issuer', { required: 'Required' })} />
          {errors.issuer && <p className="text-xs text-destructive">{errors.issuer.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="isin">ISIN</Label>
          <Input id="isin" placeholder="INE000A01036" {...register('isin')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="credit_rating">Credit Rating</Label>
          <Input id="credit_rating" placeholder="AAA, AA+, A1+…" {...register('credit_rating')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="face_value">Face Value per Unit (₹) *</Label>
          <Input id="face_value" type="number" step="0.01" placeholder="1000"
            {...register('face_value', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
          {errors.face_value && <p className="text-xs text-destructive">{errors.face_value.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="units">Units / Quantity *</Label>
          <Input id="units" type="number" step="0.0001" placeholder="10"
            {...register('units', { required: 'Required', min: { value: 0.0001, message: 'Must be > 0' } })} />
          {errors.units && <p className="text-xs text-destructive">{errors.units.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="purchase_price">Total Purchase Price (₹) *</Label>
          <Input id="purchase_price" type="number" step="0.01" placeholder="9800"
            {...register('purchase_price', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
          {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
        </div>

        {!isTBill && (
          <div className="space-y-1.5">
            <Label htmlFor="coupon_rate">Coupon Rate (% p.a.)</Label>
            <Input id="coupon_rate" type="number" step="0.01" placeholder="8.50"
              {...register('coupon_rate', { min: { value: 0, message: 'Must be ≥ 0' } })} />
          </div>
        )}

        {!isTBill && (
          <div className="space-y-1.5">
            <Label htmlFor="coupon_frequency">Coupon Frequency</Label>
            <Select id="coupon_frequency" {...register('coupon_frequency')}>
              {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="purchase_date">Purchase Date *</Label>
          <Input id="purchase_date" type="date"
            {...register('purchase_date', { required: 'Required' })} />
          {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="maturity_date">Maturity Date *</Label>
          <Input id="maturity_date" type="date"
            {...register('maturity_date', { required: 'Required' })} />
          {errors.maturity_date && <p className="text-xs text-destructive">{errors.maturity_date.message}</p>}
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" placeholder="Optional" {...register('notes')} />
        </div>

        <div className="flex items-center gap-2">
          <input id="is_secured" type="checkbox" className="h-4 w-4" {...register('is_secured')} />
          <Label htmlFor="is_secured" className="font-normal cursor-pointer">Secured</Label>
        </div>

        <div className="flex items-center gap-2">
          <input id="is_listed" type="checkbox" className="h-4 w-4" {...register('is_listed')} />
          <Label htmlFor="is_listed" className="font-normal cursor-pointer">Exchange Listed</Label>
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
          {mutation.isPending ? 'Saving…' : isEdit ? 'Update Bond' : 'Add Bond'}
        </Button>
      </div>
    </form>
  )
}
