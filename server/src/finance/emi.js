/**
 * EMI = P × r × (1+r)^n / ((1+r)^n − 1)
 * where r = monthly rate, n = tenure in months
 */
function calcEMI(principal, annualRatePercent, tenureMonths) {
  const P = parseFloat(principal)
  const n = parseInt(tenureMonths)
  const r = parseFloat(annualRatePercent) / (12 * 100)

  if (n <= 0) return 0
  if (r === 0) return Math.round((P / n) * 100) / 100

  const emi = P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
  return Math.round(emi * 100) / 100
}

/**
 * Generates full amortization schedule starting from a given outstanding balance.
 * Returns array of { month, date, emi, principal, interest, balance }.
 */
function generateAmortization(outstanding, annualRatePercent, tenureMonths, startDate, emiAmount) {
  const r = parseFloat(annualRatePercent) / (12 * 100)
  const n = parseInt(tenureMonths)
  const emi = emiAmount ? parseFloat(emiAmount) : calcEMI(outstanding, annualRatePercent, n)

  let balance = parseFloat(outstanding)
  const schedule = []
  const base = new Date(startDate)

  for (let i = 1; i <= n && balance > 0.005; i++) {
    const dueDate = new Date(base)
    dueDate.setMonth(dueDate.getMonth() + i)

    const interest = Math.round(balance * r * 100) / 100
    let principal = Math.round((emi - interest) * 100) / 100

    if (principal > balance) principal = Math.round(balance * 100) / 100
    balance = Math.round((balance - principal) * 100) / 100

    schedule.push({
      month: i,
      date: dueDate.toISOString().slice(0, 10),
      emi: Math.round((principal + interest) * 100) / 100,
      principal,
      interest,
      balance,
    })
  }

  return schedule
}

/**
 * Calculates interest saved and new closure month when a lump-sum prepayment is made.
 * Assumes prepayment reduces principal immediately (EMI stays the same, tenure reduces).
 */
function calcPrepaymentSavings(outstanding, annualRatePercent, remainingMonths, emiAmount, prepaymentAmount) {
  const prepay = parseFloat(prepaymentAmount)
  const newOutstanding = Math.max(0, parseFloat(outstanding) - prepay)

  const originalSchedule = generateAmortization(outstanding, annualRatePercent, remainingMonths, new Date().toISOString().slice(0, 10), emiAmount)
  const newSchedule = generateAmortization(newOutstanding, annualRatePercent, remainingMonths, new Date().toISOString().slice(0, 10), emiAmount)

  const originalTotalInterest = originalSchedule.reduce((s, r) => s + r.interest, 0)
  const newTotalInterest = newSchedule.reduce((s, r) => s + r.interest, 0)

  return {
    original_months: originalSchedule.length,
    new_months: newSchedule.length,
    months_saved: originalSchedule.length - newSchedule.length,
    original_total_interest: Math.round(originalTotalInterest * 100) / 100,
    new_total_interest: Math.round(newTotalInterest * 100) / 100,
    interest_saved: Math.round((originalTotalInterest - newTotalInterest) * 100) / 100,
    new_outstanding: Math.round(newOutstanding * 100) / 100,
  }
}

module.exports = { calcEMI, generateAmortization, calcPrepaymentSavings }
