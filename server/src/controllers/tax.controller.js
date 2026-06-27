const { getRealizedGains, harvestSuggestions } = require('../tax/capitalGainsTax')
const { getDeductions } = require('../tax/deductions')

function currentFY() {
  const now   = new Date()
  const year  = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-${String(year + 1).slice(-2)}`
}

async function summary(request, reply) {
  const db     = request.server.db
  const userId = request.user.id
  const fy     = request.query.fy || currentFY()

  const [gains, deductions] = await Promise.all([
    getRealizedGains(db, userId, fy),
    getDeductions(db, userId, fy),
  ])

  return {
    fy,
    capital_gains: {
      equity_ltcg:   gains.tax.equity_ltcg,
      equity_stcg:   gains.tax.equity_stcg,
      debt_income:   gains.tax.debt_income,
      taxable_ltcg:  gains.tax.taxable_ltcg,
      total_cg_tax:  gains.tax.total_cg_tax,
    },
    deductions: {
      '80C':     { used: deductions['80C'].used, limit: deductions['80C'].limit },
      '80D':     { used: deductions['80D'].used, limit: deductions['80D'].limit },
      '24b':     { used: deductions['24b'].used, limit: deductions['24b'].limit },
      '80CCD1B': { used: deductions['80CCD1B'].used, limit: deductions['80CCD1B'].limit },
    },
  }
}

async function capitalGains(request, reply) {
  const db     = request.server.db
  const userId = request.user.id
  const fy     = request.query.fy || currentFY()

  return getRealizedGains(db, userId, fy)
}

async function deductions(request, reply) {
  const db     = request.server.db
  const userId = request.user.id
  const fy     = request.query.fy || currentFY()

  return getDeductions(db, userId, fy)
}

async function harvesting(request, reply) {
  const db     = request.server.db
  const userId = request.user.id

  return harvestSuggestions(db, userId)
}

module.exports = { summary, capitalGains, deductions, harvesting }
