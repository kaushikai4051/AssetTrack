import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const TYPE_OPTIONS = [
  { value: 'flat',       label: 'Flat / Apartment' },
  { value: 'villa',      label: 'Villa / Independent House' },
  { value: 'plot',       label: 'Plot / Land' },
  { value: 'commercial', label: 'Commercial Property' },
  { value: 'reit',       label: 'REIT (Real Estate Investment Trust)' },
]

export default function PropertyForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: initialData || {
      property_type: 'flat',
      ownership_percent: 100,
      is_rented: false,
    },
  })

  const propertyType = useWatch({ control, name: 'property_type' })
  const isRented     = useWatch({ control, name: 'is_rented' })
  const isREIT       = propertyType === 'reit'

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/assets/real-estate/${initialData.id}`, data).then((r) => r.data)
        : api.post('/assets/real-estate', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['real-estate'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="property_type">Property Type *</Label>
          <Select id="property_type" {...register('property_type', { required: 'Required' })}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="property_name">
            {isREIT ? 'REIT Name *' : 'Property Name *'}
          </Label>
          <Input id="property_name" placeholder={isREIT ? 'Embassy Office Parks REIT' : 'My Flat, 2BHK Andheri…'}
            {...register('property_name', { required: 'Required' })} />
          {errors.property_name && <p className="text-xs text-destructive">{errors.property_name.message}</p>}
        </div>

        {!isREIT && (
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" placeholder="Flat 4B, Tower A, XYZ Society, Mumbai" {...register('address')} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="purchase_date">Purchase Date *</Label>
          <Input id="purchase_date" type="date" {...register('purchase_date', { required: 'Required' })} />
          {errors.purchase_date && <p className="text-xs text-destructive">{errors.purchase_date.message}</p>}
        </div>

        {isREIT ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="units">Units Held *</Label>
              <Input id="units" type="number" step="0.0001" placeholder="100"
                {...register('units', { required: 'Required', min: { value: 0.0001, message: 'Must be > 0' } })} />
              {errors.units && <p className="text-xs text-destructive">{errors.units.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buy_price_per_unit">Buy Price / Unit (₹) *</Label>
              <Input id="buy_price_per_unit" type="number" step="0.01" placeholder="350"
                {...register('buy_price_per_unit', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
              {errors.buy_price_per_unit && <p className="text-xs text-destructive">{errors.buy_price_per_unit.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase_price">Total Purchase Amount (₹) *</Label>
              <Input id="purchase_price" type="number" step="0.01"
                {...register('purchase_price', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
              {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
            </div>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="purchase_price">Purchase Price (₹) *</Label>
              <Input id="purchase_price" type="number" step="0.01" placeholder="5000000"
                {...register('purchase_price', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
              {errors.purchase_price && <p className="text-xs text-destructive">{errors.purchase_price.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="registration_charges">Registration Charges (₹)</Label>
              <Input id="registration_charges" type="number" step="0.01" {...register('registration_charges')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stamp_duty">Stamp Duty (₹)</Label>
              <Input id="stamp_duty" type="number" step="0.01" {...register('stamp_duty')} />
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="current_value">Current Market Value (₹)</Label>
          <Input id="current_value" type="number" step="0.01" placeholder="Leave blank to use purchase price"
            {...register('current_value')} />
        </div>

        {!isREIT && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="ownership_percent">Your Ownership (%)</Label>
              <Input id="ownership_percent" type="number" step="0.01" min={1} max={100}
                {...register('ownership_percent')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co_owner_name">Co-Owner Name</Label>
              <Input id="co_owner_name" placeholder="Optional" {...register('co_owner_name')} />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input id="is_rented" type="checkbox" className="h-4 w-4" {...register('is_rented')} />
              <Label htmlFor="is_rented" className="font-normal cursor-pointer">Currently Rented Out</Label>
            </div>

            {isRented && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="monthly_rent">Monthly Rent (₹)</Label>
                  <Input id="monthly_rent" type="number" step="0.01" {...register('monthly_rent')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tenant_name">Tenant Name</Label>
                  <Input id="tenant_name" placeholder="Optional" {...register('tenant_name')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lease_start_date">Lease Start</Label>
                  <Input id="lease_start_date" type="date" {...register('lease_start_date')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lease_end_date">Lease End</Label>
                  <Input id="lease_end_date" type="date" {...register('lease_end_date')} />
                </div>
              </>
            )}
          </>
        )}

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
          {mutation.isPending ? 'Saving…' : isEdit ? 'Update Property' : 'Add Property'}
        </Button>
      </div>
    </form>
  )
}
