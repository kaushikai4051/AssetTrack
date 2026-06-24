import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { formatINR, formatCompact } from '@/utils/currency'
import api from '@/services/api'

export default function PrepaymentSimulator({ loan, onClose }) {
  const [amount, setAmount] = useState('')
  const [simulate, setSimulate] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['prepayment-sim', loan.id, amount],
    queryFn: () =>
      api.get(`/assets/loans/${loan.id}/prepayment-simulator?amount=${amount}`).then((r) => r.data),
    enabled: simulate && parseFloat(amount) > 0,
  })

  function handleSimulate(e) {
    e.preventDefault()
    setSimulate(true)
  }

  function handleAmountChange(e) {
    setAmount(e.target.value)
    setSimulate(false)
  }

  return (
    <div className="space-y-4">
      {/* Loan summary */}
      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-muted rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Outstanding</div>
          <div className="font-semibold">{formatCompact(loan.outstanding_amount)}</div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">Rate</div>
          <div className="font-semibold">{loan.interest_rate}%</div>
        </div>
        <div className="bg-muted rounded-lg p-3 text-center">
          <div className="text-xs text-muted-foreground mb-1">EMI / mo</div>
          <div className="font-semibold">{formatCompact(loan.emi_amount)}</div>
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSimulate} className="flex gap-3 items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="prepay_amount">Prepayment Amount (₹)</Label>
          <Input
            id="prepay_amount"
            type="number"
            step="1000"
            min={1}
            placeholder="e.g. 100000"
            value={amount}
            onChange={handleAmountChange}
          />
        </div>
        <Button type="submit" disabled={!amount || parseFloat(amount) <= 0}>
          Calculate
        </Button>
      </form>

      {/* Results */}
      {isLoading && <div className="text-sm text-muted-foreground text-center py-4">Calculating…</div>}

      {isError && <p className="text-xs text-destructive">Failed to calculate. Please try again.</p>}

      {data && !isLoading && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Months Saved</div>
                <div className="text-2xl font-bold text-primary">{data.months_saved}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {data.original_months} → {data.new_months} months
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">Interest Saved</div>
                <div className="text-2xl font-bold text-green-600">{formatCompact(data.interest_saved)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Net saving after prepayment
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="rounded-lg border p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prepayment amount</span>
              <span className="font-medium">{formatINR(parseFloat(amount))}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New outstanding</span>
              <span className="font-medium text-destructive">{formatINR(data.new_outstanding)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Original total interest</span>
              <span>{formatINR(data.original_total_interest)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New total interest</span>
              <span>{formatINR(data.new_total_interest)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total net benefit</span>
              <span className="text-green-600">
                {formatINR(data.interest_saved)} saved over {data.months_saved} months
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}
