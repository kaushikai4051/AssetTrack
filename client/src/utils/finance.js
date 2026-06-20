// Client-side finance helpers for display only.
// Heavy calculations (XIRR, capital gains) are done server-side.

export function absoluteReturn(currentValue, investedAmount) {
  if (!investedAmount || investedAmount === 0) return 0
  return ((currentValue - investedAmount) / investedAmount) * 100
}

export function emi(principal, annualRate, tenureMonths) {
  const r = annualRate / 12 / 100
  if (r === 0) return principal / tenureMonths
  return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1)
}

export function fdMaturity(principal, annualRate, tenureMonths, type = 'cumulative') {
  if (type === 'cumulative') {
    const r = annualRate / 100
    const t = tenureMonths / 12
    // Quarterly compounding
    return principal * Math.pow(1 + r / 4, 4 * t)
  }
  // Simple interest for payout FDs (shows only maturity of principal)
  return principal
}

export function isPositive(value) {
  return value >= 0
}
