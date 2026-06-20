// Maturity / estimate calculations for government schemes

// NSC: compounded half-yearly (5-year tenure default)
function calcNSCMaturity(principal, annualRatePct, years = 5) {
  return principal * Math.pow(1 + annualRatePct / 200, years * 2)
}

// KVP: doubles at maturity (interest embedded in doubling period)
function calcKVPMaturity(principal) {
  return principal * 2
}

// Post Office Time Deposit: compounded annually
function calcPOTDMaturity(principal, annualRatePct, tenureYears) {
  return principal * Math.pow(1 + annualRatePct / 100, tenureYears)
}

// Post Office RD: future value of annuity (monthly, compounded quarterly)
// Standard PO RD formula: M = R × [ (1+i)^n - 1 ] / (1-(1+i)^(-1/3))
// where i = quarterly rate, n = quarters
// Simplified: treat as monthly annuity compounding at annual_rate/12
function calcPORDMaturity(monthlyAmt, annualRatePct, tenureMonths) {
  const r = annualRatePct / 1200 // monthly rate
  return monthlyAmt * ((Math.pow(1 + r, tenureMonths) - 1) / r) * (1 + r)
}

// SSY: compounded annually on variable contributions — estimates lump-sum growth
function calcSSYEstimate(totalInvested, annualRatePct, yearsRemaining) {
  return totalInvested * Math.pow(1 + annualRatePct / 100, yearsRemaining)
}

// PPF estimate treating total invested as lump sum (actual grows with contributions)
function calcPPFEstimate(totalInvested, annualRatePct, yearsElapsed) {
  return totalInvested * Math.pow(1 + annualRatePct / 100, yearsElapsed)
}

// SCSS: quarterly interest payout (not compounding) → principal stays same at maturity
// current_value = principal (interest paid out quarterly, not accumulated)

// Given start_date and scheme_type, derive maturity_date if not provided
function defaultMaturityDate(schemeType, startDate, tenureYears) {
  if (!startDate) return null
  const d = new Date(startDate)
  const y = tenureYears || {
    ppf: 15, nsc: 5, ssy: 21, scss: 5, kvp: 10, po_td: 5, po_mis: 5, po_rd: 5,
  }[schemeType]
  if (!y) return null
  d.setFullYear(d.getFullYear() + y)
  return d.toISOString().slice(0, 10)
}

module.exports = { calcNSCMaturity, calcKVPMaturity, calcPOTDMaturity, calcPORDMaturity, calcSSYEstimate, calcPPFEstimate, defaultMaturityDate }
