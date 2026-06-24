import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const TYPE_OPTIONS = [
  { value: 'term',              label: 'Life — Term Plan' },
  { value: 'endowment',         label: 'Life — Endowment / Money-Back' },
  { value: 'money_back',        label: 'Life — Money-Back' },
  { value: 'ulip',              label: 'Life — ULIP' },
  { value: 'lic',               label: 'LIC Policy' },
  { value: 'health',            label: 'Health Insurance' },
  { value: 'vehicle',           label: 'Vehicle Insurance' },
  { value: 'critical_illness',  label: 'Critical Illness / Accident' },
]

const FREQ_OPTIONS = [
  { value: 'monthly',     label: 'Monthly' },
  { value: 'quarterly',   label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'yearly',      label: 'Yearly' },
  { value: 'single',      label: 'Single Premium' },
]

export default function InsuranceForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: initialData || {
      insurance_type: 'term',
      premium_frequency: 'yearly',
      ins_type_vehicle: 'comprehensive',
      family_floater: false,
    },
  })

  const insuranceType = useWatch({ control, name: 'insurance_type' })
  const isLife    = ['term', 'endowment', 'money_back', 'ulip', 'lic'].includes(insuranceType)
  const isHealth  = ['health', 'critical_illness'].includes(insuranceType)
  const isVehicle = insuranceType === 'vehicle'
  const isULIP    = insuranceType === 'ulip'

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/assets/insurance/${initialData.id}`, data).then((r) => r.data)
        : api.post('/assets/insurance', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insurance'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="insurance_type">Insurance Type *</Label>
          <Select id="insurance_type" {...register('insurance_type', { required: 'Required' })}>
            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="insurer">Insurer / Company *</Label>
          <Input id="insurer" placeholder="LIC, HDFC Life, Star Health…"
            {...register('insurer', { required: 'Required' })} />
          {errors.insurer && <p className="text-xs text-destructive">{errors.insurer.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="plan_name">Plan Name</Label>
          <Input id="plan_name" placeholder="Term Shield, Star Comprehensive…" {...register('plan_name')} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="policy_number">Policy Number</Label>
          <Input id="policy_number" placeholder="Optional" {...register('policy_number')} />
        </div>

        {/* Sum assured */}
        {!isVehicle && (
          <div className="space-y-1.5">
            <Label htmlFor="sum_assured">
              {isHealth ? 'Sum Insured (₹) *' : 'Sum Assured (₹) *'}
            </Label>
            <Input id="sum_assured" type="number" step="1000" placeholder="5000000"
              {...register('sum_assured', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
            {errors.sum_assured && <p className="text-xs text-destructive">{errors.sum_assured.message}</p>}
          </div>
        )}

        {/* Annual premium */}
        <div className="space-y-1.5">
          <Label htmlFor="annual_premium">Annual Premium (₹) *</Label>
          <Input id="annual_premium" type="number" step="0.01" placeholder="12000"
            {...register('annual_premium', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })} />
          {errors.annual_premium && <p className="text-xs text-destructive">{errors.annual_premium.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="premium_frequency">Premium Frequency</Label>
          <Select id="premium_frequency" {...register('premium_frequency')}>
            {FREQ_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="start_date">Start / Inception Date *</Label>
          <Input id="start_date" type="date" {...register('start_date', { required: 'Required' })} />
          {errors.start_date && <p className="text-xs text-destructive">{errors.start_date.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="renewal_date">
            {isVehicle ? 'Expiry Date' : 'Next Renewal Date'}
          </Label>
          <Input id="renewal_date" type="date" {...register('renewal_date')} />
        </div>

        {/* Policy term — life insurance */}
        {isLife && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="policy_term_years">Policy Term (years)</Label>
              <Input id="policy_term_years" type="number" min={1} {...register('policy_term_years')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="premium_term_years">Premium Paying Term (years)</Label>
              <Input id="premium_term_years" type="number" min={1} {...register('premium_term_years')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bonus_accumulated">Bonus Accumulated (₹)</Label>
              <Input id="bonus_accumulated" type="number" step="0.01" {...register('bonus_accumulated')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="surrender_value">Surrender Value (₹)</Label>
              <Input id="surrender_value" type="number" step="0.01" {...register('surrender_value')} />
            </div>
          </>
        )}

        {/* ULIP fund value */}
        {isULIP && (
          <div className="space-y-1.5">
            <Label htmlFor="fund_value">Current Fund Value (₹)</Label>
            <Input id="fund_value" type="number" step="0.01" {...register('fund_value')} />
          </div>
        )}

        {/* Health insurance */}
        {isHealth && (
          <>
            <div className="col-span-2 flex items-center gap-2">
              <input id="family_floater" type="checkbox" className="h-4 w-4" {...register('family_floater')} />
              <Label htmlFor="family_floater" className="font-normal cursor-pointer">Family Floater Policy</Label>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="members_covered">Members Covered</Label>
              <Input id="members_covered" placeholder="Self, Spouse, Child 1…" {...register('members_covered')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="no_claim_bonus">No-Claim Bonus (%)</Label>
              <Input id="no_claim_bonus" type="number" step="0.01" min={0} {...register('no_claim_bonus')} />
            </div>
          </>
        )}

        {/* Vehicle insurance */}
        {isVehicle && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="vehicle_number">Vehicle Number</Label>
              <Input id="vehicle_number" placeholder="MH12AB1234" {...register('vehicle_number')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ins_type_vehicle">Cover Type</Label>
              <Select id="ins_type_vehicle" {...register('ins_type_vehicle')}>
                <option value="comprehensive">Comprehensive</option>
                <option value="third_party">Third Party</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="idv">IDV — Insured Declared Value (₹)</Label>
              <Input id="idv" type="number" step="0.01" {...register('idv')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ncb_percent">NCB (%)</Label>
              <Input id="ncb_percent" type="number" step="0.01" min={0} max={50} {...register('ncb_percent')} />
            </div>
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
          {mutation.isPending ? 'Saving…' : isEdit ? 'Update Policy' : 'Add Policy'}
        </Button>
      </div>
    </form>
  )
}
