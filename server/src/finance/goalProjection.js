/**
 * SIP required to reach a goal:
 *   PMT = FV * r / ((1+r)^n - 1)
 * where FV = gap (target - current), r = monthly rate, n = months remaining.
 */
function sipRequired(gap, monthsLeft, annualReturnPct) {
  if (monthsLeft <= 0 || gap <= 0) return 0
  const r = annualReturnPct / 100 / 12
  if (r === 0) return gap / monthsLeft
  const factor = Math.pow(1 + r, monthsLeft)
  return (gap * r) / (factor - 1)
}

/**
 * Future value of current invested amount after n months at annualReturnPct.
 */
function futureValue(presentValue, monthsLeft, annualReturnPct) {
  if (monthsLeft <= 0) return presentValue
  const r = annualReturnPct / 100 / 12
  return presentValue * Math.pow(1 + r, monthsLeft)
}

/**
 * Returns projection data for a goal.
 *
 * @param {object} goal       - { target_amount, target_date, assumed_return }
 * @param {number} currentValue - sum of linked assets' current_value
 * @returns {object}
 */
function projectGoal(goal, currentValue) {
  const now = new Date()
  const target = new Date(goal.target_date)
  const monthsLeft = Math.max(0,
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth())
  )

  const targetAmount = parseFloat(goal.target_amount)
  const assumedReturn = parseFloat(goal.assumed_return)
  const fvOfCurrent = futureValue(currentValue, monthsLeft, assumedReturn)
  const gap = Math.max(0, targetAmount - fvOfCurrent)
  const sip = sipRequired(gap, monthsLeft, assumedReturn)
  const progressPct = Math.min(100, (currentValue / targetAmount) * 100)

  // Achievement probability: 100% if current FV already covers target,
  // otherwise scale linearly by how much the FV covers.
  const achievementPct = Math.min(100, (fvOfCurrent / targetAmount) * 100)

  return {
    months_left:          monthsLeft,
    current_value:        parseFloat(currentValue.toFixed(2)),
    future_value_current: parseFloat(fvOfCurrent.toFixed(2)),
    gap:                  parseFloat(gap.toFixed(2)),
    sip_required:         parseFloat(sip.toFixed(2)),
    progress_pct:         parseFloat(progressPct.toFixed(1)),
    achievement_pct:      parseFloat(achievementPct.toFixed(1)),
    on_track:             fvOfCurrent >= targetAmount,
  }
}

module.exports = { projectGoal }
