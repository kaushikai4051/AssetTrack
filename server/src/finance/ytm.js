/**
 * Yield to Maturity via Newton-Raphson iteration.
 *
 * Bond price = sum(C / (1+r)^t) + FV / (1+r)^n
 *   C  = periodic coupon payment
 *   FV = face value × units
 *   n  = total coupon periods remaining
 *   r  = periodic rate (what we solve for)
 *
 * Returns annualised YTM as a decimal (e.g. 0.0825 for 8.25%).
 */
function calcYTM(faceValue, units, couponRate, couponFrequency, purchasePrice, purchaseDate, maturityDate) {
  const FREQ_MAP = { monthly: 12, quarterly: 4, half_yearly: 2, yearly: 1, on_maturity: 1 }
  const freq = FREQ_MAP[couponFrequency] ?? 2

  const FV = parseFloat(faceValue) * parseFloat(units)
  const price = parseFloat(purchasePrice)
  const annualCoupon = (parseFloat(couponRate) / 100) * FV
  const C = annualCoupon / freq

  const yearsToMaturity = (new Date(maturityDate) - new Date(purchaseDate)) / (365.25 * 86400000)
  const n = Math.round(yearsToMaturity * freq)

  if (n <= 0) return 0
  if (couponFrequency === 'on_maturity') {
    // Zero-coupon / on-maturity: YTM = (FV/Price)^(1/years) - 1
    return Math.pow(FV / price, 1 / yearsToMaturity) - 1
  }

  // Newton-Raphson: f(r) = price - sum(C/(1+r)^t) - FV/(1+r)^n
  let r = (annualCoupon / price) / freq
  for (let i = 0; i < 200; i++) {
    const d1r = Math.pow(1 + r, n)
    const pv = C * (1 - 1 / d1r) / r + FV / d1r
    const dpv = C * (
      (1 / (r * r)) * (1 - 1 / d1r) - n / (r * Math.pow(1 + r, n + 1))
    ) - n * FV / (Math.pow(1 + r, n + 1))

    const delta = (pv - price) / dpv
    r -= delta
    if (Math.abs(delta) < 1e-10) break
  }

  return Math.round(r * freq * 10000) / 10000  // annualised, 4 decimal places
}

/**
 * Generates upcoming coupon schedule for a bond.
 * Returns array of { payment_date, amount } for all future coupons.
 */
function generateCouponSchedule(faceValue, units, couponRate, couponFrequency, purchaseDate, maturityDate) {
  const FREQ_MAP = { monthly: 12, quarterly: 4, half_yearly: 2, yearly: 1 }
  const freq = FREQ_MAP[couponFrequency]
  if (!freq) return []  // on_maturity — no periodic coupons

  const FV = parseFloat(faceValue) * parseFloat(units)
  const annualCoupon = (parseFloat(couponRate) / 100) * FV
  const couponAmount = Math.round((annualCoupon / freq) * 100) / 100

  const monthsPerPeriod = Math.round(12 / freq)
  const maturity = new Date(maturityDate)
  const schedule = []

  const start = new Date(purchaseDate)
  start.setMonth(start.getMonth() + monthsPerPeriod)

  while (start <= maturity) {
    schedule.push({ payment_date: start.toISOString().slice(0, 10), amount: couponAmount })
    start.setMonth(start.getMonth() + monthsPerPeriod)
  }

  return schedule
}

module.exports = { calcYTM, generateCouponSchedule }
