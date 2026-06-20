// Newton-Raphson XIRR solver.
// cashflows: number[] (negative = outflow, positive = inflow)
// dates:     Date[]   (same length, ascending order preferred)
// returns:   annualised rate as a decimal (e.g. 0.12 = 12%), or null on failure
function xirr(cashflows, dates, guess = 0.1) {
  if (cashflows.length < 2) return null

  const hasPos = cashflows.some((c) => c > 0)
  const hasNeg = cashflows.some((c) => c < 0)
  if (!hasPos || !hasNeg) return null

  const t0 = dates[0].getTime()
  const t = dates.map((d) => (d.getTime() - t0) / (365.25 * 86_400_000))

  const npv = (r) =>
    cashflows.reduce((s, cf, i) => s + cf / Math.pow(1 + r, t[i]), 0)

  const dnpv = (r) =>
    cashflows.reduce((s, cf, i) => s - (t[i] * cf) / Math.pow(1 + r, t[i] + 1), 0)

  let r = guess
  for (let i = 0; i < 100; i++) {
    const f = npv(r)
    const df = dnpv(r)
    if (Math.abs(df) < 1e-12) break
    const rNew = r - f / df
    if (Math.abs(rNew - r) < 1e-7) return Math.round(rNew * 10000) / 10000
    r = rNew
    if (r <= -1) r = -0.9999
  }
  return null
}

module.exports = { xirr }
