import { useForm, useWatch } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const LOAN_TYPE_OPTIONS = [
  { value: 'home',        label: 'Home Loan' },
  { value: 'car',         label: 'Car / Vehicle Loan' },
  { value: 'personal',    label: 'Personal Loan' },
  { value: 'education',   label: 'Education Loan' },
  { value: 'lap',         label: 'Loan Against Property (LAP)' },
  { value: 'gold',        label: 'Gold Loan' },
  { value: 'credit_card', label: 'Credit Card Debt' },
]

export default function LoanForm({ initialData, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(initialData)

  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: initialData || {
      loan_type: 'home',
      rate_type: 'fixed',
      emi_due_day: 1,
      moratorium_months: 0,
    },
  })

  const loanType = useWatch({ control, name: 'loan_type' })
  const isCreditCard = loanType === 'credit_card'
  const isEducation  = loanType === 'education'
  const isHome       = loanType === 'home'

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit
        ? api.put(`/assets/loans/${initialData.id}`, data).then((r) => r.data)
        : api.post('/assets/loans', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">

        {/* Loan type */}
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="loan_type">Loan Type *</Label>
          <Select id="loan_type" {...register('loan_type', { required: 'Required' })}>
            {LOAN_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </div>

        {/* Lender */}
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="lender">Lender / Bank *</Label>
          <Input id="lender" placeholder="SBI, HDFC, Axis Bank…" {...register('lender', { required: 'Required' })} />
          {errors.lender && <p className="text-xs text-destructive">{errors.lender.message}</p>}
        </div>

        {/* Loan account number */}
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="loan_account_number">Loan Account Number</Label>
          <Input id="loan_account_number" placeholder="Optional" {...register('loan_account_number')} />
        </div>

        {/* Principal amount */}
        <div className="space-y-1.5">
          <Label htmlFor="principal_amount">
            {isCreditCard ? 'Total Outstanding (₹) *' : 'Original Loan Amount (₹) *'}
          </Label>
          <Input
            id="principal_amount" type="number" step="0.01" placeholder="500000"
            {...register('principal_amount', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })}
          />
          {errors.principal_amount && <p className="text-xs text-destructive">{errors.principal_amount.message}</p>}
        </div>

        {/* Outstanding amount (only for non-credit-card on edit, or for all loans to track current) */}
        {!isCreditCard && (
          <div className="space-y-1.5">
            <Label htmlFor="outstanding_amount">Current Outstanding (₹) *</Label>
            <Input
              id="outstanding_amount" type="number" step="0.01" placeholder="Same as loan amount if new"
              {...register('outstanding_amount', { required: 'Required', min: { value: 0, message: 'Must be ≥ 0' } })}
            />
            {errors.outstanding_amount && <p className="text-xs text-destructive">{errors.outstanding_amount.message}</p>}
          </div>
        )}

        {/* Interest rate */}
        <div className="space-y-1.5">
          <Label htmlFor="interest_rate">Interest Rate (% p.a.) *</Label>
          <Input
            id="interest_rate" type="number" step="0.01" placeholder="8.5"
            {...register('interest_rate', { required: 'Required', min: { value: 0, message: 'Must be ≥ 0' } })}
          />
          {errors.interest_rate && <p className="text-xs text-destructive">{errors.interest_rate.message}</p>}
        </div>

        {/* Rate type */}
        {!isCreditCard && (
          <div className="space-y-1.5">
            <Label htmlFor="rate_type">Rate Type</Label>
            <Select id="rate_type" {...register('rate_type')}>
              <option value="fixed">Fixed</option>
              <option value="floating">Floating</option>
            </Select>
          </div>
        )}

        {/* Tenure */}
        {!isCreditCard && (
          <div className="space-y-1.5">
            <Label htmlFor="tenure_months">Tenure (months) *</Label>
            <Input
              id="tenure_months" type="number" placeholder="240"
              {...register('tenure_months', { required: 'Required', min: { value: 1, message: 'Must be ≥ 1' } })}
            />
            {errors.tenure_months && <p className="text-xs text-destructive">{errors.tenure_months.message}</p>}
          </div>
        )}

        {/* Disbursement / start date */}
        <div className="space-y-1.5">
          <Label htmlFor="disbursement_date">
            {isCreditCard ? 'Statement Date *' : 'Disbursement Date *'}
          </Label>
          <Input
            id="disbursement_date" type="date"
            {...register('disbursement_date', { required: 'Required' })}
          />
          {errors.disbursement_date && <p className="text-xs text-destructive">{errors.disbursement_date.message}</p>}
        </div>

        {/* EMI due day */}
        {!isCreditCard && (
          <div className="space-y-1.5">
            <Label htmlFor="emi_due_day">EMI Due Day (1–28)</Label>
            <Input
              id="emi_due_day" type="number" min={1} max={28}
              {...register('emi_due_day', { min: 1, max: 28 })}
            />
          </div>
        )}

        {/* Credit card specific */}
        {isCreditCard && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="credit_limit">Credit Limit (₹)</Label>
              <Input id="credit_limit" type="number" step="0.01" {...register('credit_limit')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="minimum_due">Minimum Due (₹)</Label>
              <Input id="minimum_due" type="number" step="0.01" {...register('minimum_due')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_due_date">Payment Due Date</Label>
              <Input id="payment_due_date" type="date" {...register('payment_due_date')} />
            </div>
          </>
        )}

        {/* Education loan moratorium */}
        {isEducation && (
          <div className="space-y-1.5">
            <Label htmlFor="moratorium_months">Moratorium Period (months)</Label>
            <Input id="moratorium_months" type="number" min={0} {...register('moratorium_months')} />
          </div>
        )}

        {/* Home loan — property address */}
        {isHome && (
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="property_address">Property Address</Label>
            <Input id="property_address" placeholder="Optional" {...register('property_address')} />
          </div>
        )}

        {/* Notes */}
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
          {mutation.isPending ? 'Saving…' : isEdit ? 'Update Loan' : 'Add Loan'}
        </Button>
      </div>
    </form>
  )
}
