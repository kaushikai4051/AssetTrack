import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import api from '@/services/api'

// ── Search mode sub-component ─────────────────────────────────────────────────

function FundSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    setError(null)
    clearTimeout(timerRef.current)
    if (val.length < 3) { setResults([]); return }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(`/market/mf-search?q=${encodeURIComponent(val)}`)
        const list = res.data || []
        setResults(list)
        if (!list.length) setError('No results. Try a different name or use Manual Entry.')
      } catch {
        setResults([])
        setError('Search failed. Use Manual Entry instead.')
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  const handleSelect = (fund) => {
    setQuery(fund.schemeName)
    setResults([])
    setError(null)
    onSelect(fund)
  }

  return (
    <div className="relative">
      <Input value={query} onChange={handleChange} placeholder="Type fund name… (min 3 chars)" />
      {searching && (
        <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow mt-1 px-3 py-2 text-sm text-muted-foreground">
          Searching…
        </div>
      )}
      {results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 bg-background border rounded-md shadow-lg mt-1 max-h-52 overflow-y-auto">
          {results.map((r) => (
            <button key={r.schemeCode} type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0"
              onClick={() => handleSelect(r)}>
              <span className="font-medium line-clamp-1">{r.schemeName}</span>
              <span className="text-xs text-muted-foreground ml-2">#{r.schemeCode}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function MutualFundForm({ onClose }) {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)

  const [mode, setMode] = useState('search')        // 'search' | 'manual'
  const [searchDone, setSearchDone] = useState(false) // true once a fund is selected in search mode
  const [navLoading, setNavLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    defaultValues: { plan_type: 'growth', tx_type: 'purchase', tx_source: 'lumpsum', tx_date: today },
  })

  const txAmount = watch('tx_amount')
  const txNav    = watch('tx_nav')

  // Auto-calculate units from amount ÷ NAV
  const computedUnits =
    parseFloat(txAmount) > 0 && parseFloat(txNav) > 0
      ? (parseFloat(txAmount) / parseFloat(txNav)).toFixed(4)
      : ''

  // Called when user picks a result in search mode
  const handleFundSelect = async (fund) => {
    setValue('scheme_name', fund.schemeName)
    setValue('scheme_code', String(fund.schemeCode))
    setSearchDone(true)

    setNavLoading(true)
    try {
      const res = await api.get(`/market/mf-nav/${fund.schemeCode}`)
      const { nav, meta } = res.data
      setValue('tx_nav', nav)
      if (meta?.fund_house)       setValue('fund_house', meta.fund_house)
      if (meta?.scheme_category)  setValue('category', meta.scheme_category)
    } catch {
      // NAV unavailable — user types manually
    } finally {
      setNavLoading(false)
    }
  }

  const switchMode = (next) => {
    setMode(next)
    setSearchDone(false)
    reset({ plan_type: 'growth', tx_type: 'purchase', tx_source: 'lumpsum', tx_date: today })
  }

  const fundDetailsReady = mode === 'manual' || searchDone

  const mutation = useMutation({
    mutationFn: (data) => api.post('/assets/mutual-funds', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mutual-funds'] })
      qc.invalidateQueries({ queryKey: ['dashboard', 'summary'] })
      onClose()
    },
  })

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate({ ...d, tx_units: parseFloat(computedUnits) }))} className="space-y-5">

      {/* Mode toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-md p-1 w-fit">
        {['search', 'manual'].map((m) => (
          <button key={m} type="button"
            className={`px-3 py-1 text-sm rounded transition-colors ${mode === m ? 'bg-background shadow font-medium' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => switchMode(m)}>
            {m === 'search' ? 'Search MFAPI' : 'Manual Entry'}
          </button>
        ))}
      </div>

      {/* ── Search mode ── */}
      {mode === 'search' && (
        <div className="space-y-1.5">
          <Label>Search Fund *</Label>
          <FundSearch onSelect={handleFundSelect} />
          {!searchDone && (
            <p className="text-xs text-muted-foreground">
              Needs internet. If search fails, switch to <strong>Manual Entry</strong>.
            </p>
          )}
          {searchDone && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-md text-sm mt-2">
              <div><span className="text-muted-foreground">Code: </span><strong>{watch('scheme_code')}</strong></div>
              <div className="col-span-2 line-clamp-1"><span className="text-muted-foreground">Fund House: </span>{watch('fund_house') || '—'}</div>
              <div className="col-span-2"><span className="text-muted-foreground">Category: </span>{watch('category') || '—'}</div>
            </div>
          )}
          {/* Keep hidden so react-hook-form submits them */}
          <input type="hidden" {...register('scheme_name')} />
          <input type="hidden" {...register('scheme_code')} />
          <input type="hidden" {...register('fund_house')} />
          <input type="hidden" {...register('category')} />
        </div>
      )}

      {/* ── Manual mode ── */}
      {mode === 'manual' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Fund / Scheme Name *</Label>
            <Input placeholder="e.g. HDFC Mid-Cap Opportunities Fund"
              {...register('scheme_name', { required: 'Required' })} />
            {errors.scheme_name && <p className="text-xs text-destructive">{errors.scheme_name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Scheme Code</Label>
            <Input placeholder="e.g. 118989 (optional)" {...register('scheme_code')} />
          </div>

          <div className="space-y-1.5">
            <Label>ISIN</Label>
            <Input placeholder="INF… (optional)" {...register('isin')} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Fund House</Label>
            <Input placeholder="e.g. HDFC Mutual Fund" {...register('fund_house')} />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label>Category</Label>
            <Input placeholder="e.g. Equity - Mid Cap" {...register('category')} />
          </div>
        </div>
      )}

      {/* ── Common fields (shown once fund is ready) ── */}
      {fundDetailsReady && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Plan Type</Label>
              <Select {...register('plan_type')}>
                <option value="growth">Growth</option>
                <option value="idcw">IDCW (Dividend)</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Folio Number</Label>
              <Input placeholder="Optional" {...register('folio_number')} />
            </div>
          </div>

          <hr className="border-dashed" />
          <p className="text-sm font-medium text-muted-foreground">First Transaction</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select {...register('tx_type')}>
                <option value="purchase">Purchase</option>
                <option value="switch_in">Switch In</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select {...register('tx_source')}>
                <option value="lumpsum">Lumpsum</option>
                <option value="sip">SIP</option>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" {...register('tx_date', { required: 'Required' })} />
              {errors.tx_date && <p className="text-xs text-destructive">{errors.tx_date.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>NAV (₹) *</Label>
              <Input type="number" step="0.0001" placeholder={navLoading ? 'Fetching…' : '0.0000'}
                disabled={navLoading}
                {...register('tx_nav', { required: 'Required', min: { value: 0.0001, message: 'Must be > 0' } })} />
              {errors.tx_nav && <p className="text-xs text-destructive">{errors.tx_nav.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Amount (₹) *</Label>
              <Input type="number" step="0.01" min="0.01" placeholder="e.g. 5000"
                {...register('tx_amount', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })} />
              {errors.tx_amount && <p className="text-xs text-destructive">{errors.tx_amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Units (auto-calculated)</Label>
              <Input readOnly tabIndex={-1} value={computedUnits}
                placeholder="Calculated from Amount ÷ NAV"
                className="bg-muted/50 cursor-default" />
              {computedUnits && (
                <p className="text-xs text-muted-foreground">{computedUnits} units @ ₹{txNav}</p>
              )}
            </div>
          </div>
        </>
      )}

      {mutation.isError && (
        <p className="text-xs text-destructive">
          {mutation.error?.response?.data?.message || 'Something went wrong'}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending || !fundDetailsReady || !computedUnits}>
          {mutation.isPending ? 'Saving…' : 'Add Fund'}
        </Button>
      </div>
    </form>
  )
}
