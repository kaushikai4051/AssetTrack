const COMPOUNDING_FREQ = { monthly: 12, quarterly: 4, half_yearly: 2, yearly: 1 }

function calcFDMaturity(principal, annualRatePercent, compounding, startDate, maturityDate) {
  const p = parseFloat(principal)
  const r = parseFloat(annualRatePercent) / 100
  const tYears = (new Date(maturityDate) - new Date(startDate)) / (365.25 * 86400000)

  if (tYears <= 0 || r <= 0) return p

  if (compounding === 'simple') {
    return Math.round(p * (1 + r * tYears) * 100) / 100
  }

  const n = COMPOUNDING_FREQ[compounding] ?? 4
  return Math.round(p * Math.pow(1 + r / n, n * tYears) * 100) / 100
}

// Standard future-value of annuity with monthly compounding
function calcRDMaturity(monthlyAmount, annualRatePercent, tenureMonths) {
  const R = parseFloat(monthlyAmount)
  const n = parseInt(tenureMonths)
  const i = parseFloat(annualRatePercent) / (12 * 100)

  if (n <= 0) return 0
  if (i === 0) return Math.round(R * n * 100) / 100

  return Math.round(R * ((Math.pow(1 + i, n) - 1) / i) * (1 + i) * 100) / 100
}

module.exports = { calcFDMaturity, calcRDMaturity }
