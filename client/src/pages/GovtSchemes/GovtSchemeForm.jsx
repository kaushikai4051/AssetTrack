import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

const SCHEME_TYPES = [
  { value: 'ppf',    label: 'PPF — Public Provident Fund' },
  { value: 'nps',    label: 'NPS — National Pension System' },
  { value: 'epf',    label: 'EPF — Employees Provident Fund' },
  { value: 'nsc',    label: 'NSC — National Savings Certificate' },
  { value: 'ssy',    label: 'SSY — Sukanya Samriddhi Yojana' },
  { value: 'scss',   label: 'SCSS — Senior Citizens Savings Scheme' },
  { value: 'kvp',    label: 'KVP — Kisan Vikas Patra' },
  { value: 'po_td',  label: 'Post Office Time Deposit' },
  { value: 'po_mis', label: 'Post Office MIS' },
  { value: 'po_rd',  label: 'Post Office RD' },
]

const FUND_MANAGERS = ['SBI Pension Fund','LIC Pension Fund','HDFC Pension Fund',
  'ICICI Pru Pension Fund','Kotak Mahindra Pension Fund','UTI Retirement Solutions',
  'Aditya Birla Sun Life Pension Fund']

const today = new Date().toISOString().slice(0, 10)

function toDateStr(val) {
  if (!val) return ''
  return String(val).slice(0, 10)
}

// holding = existing row when editing, undefined when adding
export default function GovtSchemeForm({ onClose, holding }) {
  const qc      = useQueryClient()
  const isEdit  = Boolean(holding)

  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: isEdit ? {
      scheme_type:            holding.scheme_type,
      account_number:         holding.account_number  || '',
      institution:            holding.institution      || '',
      start_date:             toDateStr(holding.start_date),
      maturity_date:          toDateStr(holding.maturity_date),
      interest_rate:          holding.interest_rate    ?? '',
      nominee:                holding.nominee          || '',
      notes:                  holding.notes            || '',
      invested_amount:        holding.invested_amount  ?? '',
      current_value:          holding.current_value    ?? '',
      // NPS
      pran:                   holding.pran             || '',
      nps_account_type:       holding.nps_account_type || 'tier1',
      fund_manager:           holding.fund_manager     || '',
      // EPF
      uan:                    holding.uan              || '',
      employee_share:         holding.employee_share   ?? '',
      employer_share:         holding.employer_share   ?? '',
      eps_balance:            holding.eps_balance      ?? '',
      // SSY
      beneficiary_name:       holding.beneficiary_name || '',
      beneficiary_dob:        toDateStr(holding.beneficiary_dob),
      // KVP
      maturity_period_months: holding.maturity_period_months || '',
    } : {
      scheme_type: 'ppf',
      start_date: today,
    },
  })

  const type = watch('scheme_type')

  const mutation = useMutation({
    mutationFn: (data) => isEdit
      ? api.put(`/assets/govt-schemes/${holding.asset_id}`, data)
      : api.post('/assets/govt-schemes', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['govt-schemes'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  const onSubmit = (data) => {
    mutation.mutate({
      ...data,
      name:           data.account_number
                        ? `${data.scheme_type.toUpperCase()} ${data.account_number}`
                        : data.scheme_type.toUpperCase(),
      invested_amount:        parseFloat(data.invested_amount) || 0,
      current_value:          data.current_value ? parseFloat(data.current_value) : undefined,
      interest_rate:          data.interest_rate ? parseFloat(data.interest_rate) : undefined,
      employee_share:         data.employee_share ? parseFloat(data.employee_share) : undefined,
      employer_share:         data.employer_share ? parseFloat(data.employer_share) : undefined,
      eps_balance:            data.eps_balance ? parseFloat(data.eps_balance) : undefined,
      maturity_period_months: data.maturity_period_months ? parseInt(data.maturity_period_months) : undefined,
    })
  }

  const isPPF     = type === 'ppf'
  const isNPS     = type === 'nps'
  const isEPF     = type === 'epf'
  const isSSY     = type === 'ssy'
  const isKVP     = type === 'kvp'
  const needsRate = !isNPS && !isEPF && !isKVP

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Scheme type — locked when editing */}
      <div>
        <Label htmlFor="scheme_type">Scheme Type *</Label>
        <Select id="scheme_type" disabled={isEdit} {...register('scheme_type', { required: true })}>
          {SCHEME_TYPES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      {/* NPS */}
      {isNPS && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pran">PRAN *</Label>
              <Input id="pran" placeholder="12-digit PRAN"
                {...register('pran', { required: isNPS ? 'PRAN required' : false })} />
              {errors.pran && <p className="text-xs text-red-500 mt-1">{errors.pran.message}</p>}
            </div>
            <div>
              <Label htmlFor="nps_account_type">Account Type</Label>
              <Select id="nps_account_type" {...register('nps_account_type')}>
                <option value="tier1">Tier 1 (Pension)</option>
                <option value="tier2">Tier 2 (Savings)</option>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="fund_manager">Fund Manager</Label>
            <Select id="fund_manager" {...register('fund_manager')}>
              <option value="">— Select fund manager —</option>
              {FUND_MANAGERS.map((fm) => <option key={fm} value={fm}>{fm}</option>)}
            </Select>
          </div>
        </>
      )}

      {/* EPF */}
      {isEPF && (
        <div>
          <Label htmlFor="uan">UAN</Label>
          <Input id="uan" placeholder="12-digit UAN" {...register('uan')} />
        </div>
      )}

      {/* SSY */}
      {isSSY && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="beneficiary_name">Beneficiary (Girl's Name)</Label>
            <Input id="beneficiary_name" placeholder="Daughter's name"
              {...register('beneficiary_name')} />
          </div>
          <div>
            <Label htmlFor="beneficiary_dob">Date of Birth</Label>
            <Input id="beneficiary_dob" type="date" {...register('beneficiary_dob')} />
          </div>
        </div>
      )}

      {/* KVP */}
      {isKVP && (
        <div>
          <Label htmlFor="maturity_period_months">Maturity Period (months)</Label>
          <Input id="maturity_period_months" type="number" placeholder="e.g. 115"
            {...register('maturity_period_months')} />
        </div>
      )}

      {/* Common */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="account_number">Account / Certificate Number</Label>
          <Input id="account_number" placeholder="Account number" {...register('account_number')} />
        </div>
        <div>
          <Label htmlFor="institution">Bank / Post Office / Employer</Label>
          <Input id="institution" placeholder="e.g. SBI, India Post" {...register('institution')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start_date">Start / Opening Date</Label>
          <Input id="start_date" type="date" {...register('start_date')} />
        </div>
        {!isEPF && !isNPS && (
          <div>
            <Label htmlFor="maturity_date">Maturity Date</Label>
            <Input id="maturity_date" type="date" {...register('maturity_date')} />
          </div>
        )}
      </div>

      {needsRate && (
        <div>
          <Label htmlFor="interest_rate">
            Interest Rate (% p.a.)
            <span className="text-muted-foreground font-normal">
              {isPPF        ? ' — current: 7.1%'  :
               type==='nsc' ? ' — current: 7.7%'  :
               type==='ssy' ? ' — current: 8.2%'  :
               type==='scss'? ' — current: 8.2%'  :
               type==='kvp' ? ' — current: 7.5%'  :
               type==='po_td'?  ' — current: 7.5%':
               type==='po_mis'? ' — current: 7.4%':
               type==='po_rd'?  ' — current: 6.7%': ''}
            </span>
          </Label>
          <Input id="interest_rate" type="number" step="0.01" min="0" max="30"
            placeholder="e.g. 7.1" {...register('interest_rate')} />
        </div>
      )}

      {/* Amounts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="invested_amount">
            {isEPF ? 'Employee Contributions (Total) *' : 'Amount Invested / Principal *'}
          </Label>
          <Input id="invested_amount" type="number" step="0.01" min="0"
            {...register('invested_amount', { required: 'Amount is required' })} />
          {errors.invested_amount && <p className="text-xs text-red-500 mt-1">{errors.invested_amount.message}</p>}
        </div>
        <div>
          <Label htmlFor="current_value">Current Balance</Label>
          <Input id="current_value" type="number" step="0.01" min="0"
            placeholder={isEdit ? '' : 'Optional — auto-estimated if blank'}
            {...register('current_value')} />
        </div>
      </div>

      {/* EPF breakdown */}
      {isEPF && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="employee_share">Employee Share (₹)</Label>
            <Input id="employee_share" type="number" step="0.01" min="0" {...register('employee_share')} />
          </div>
          <div>
            <Label htmlFor="employer_share">Employer Share (₹)</Label>
            <Input id="employer_share" type="number" step="0.01" min="0" {...register('employer_share')} />
          </div>
          <div>
            <Label htmlFor="eps_balance">EPS Balance (₹)</Label>
            <Input id="eps_balance" type="number" step="0.01" min="0" {...register('eps_balance')} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="nominee">Nominee</Label>
          <Input id="nominee" placeholder="Nominee name" {...register('nominee')} />
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" placeholder="Optional" {...register('notes')} />
        </div>
      </div>

      {mutation.isError && (
        <p className="text-sm text-red-500">
          {mutation.error?.response?.data?.message || 'Failed to save. Please try again.'}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Scheme'}
        </Button>
      </div>
    </form>
  )
}
