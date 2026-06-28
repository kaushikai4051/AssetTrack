const { query, queryOne } = require('../models/db')
const { xirr } = require('../finance/xirr')

const LIABILITY_TYPES = [
  'home_loan', 'car_loan', 'personal_loan', 'education_loan',
  'lap_loan', 'gold_loan', 'credit_card_debt',
]

const CATEGORY_MAP = {
  fixed_deposit: 'Bank Accounts',
  recurring_deposit: 'Bank Accounts',
  savings_account: 'Bank Accounts',
  mutual_fund: 'Mutual Funds',
  stock: 'Stocks',
  gold: 'Gold',
  corporate_bond: 'Bonds',
  gsec_bond: 'Bonds',
  tax_free_bond: 'Bonds',
  ppf: 'Govt Schemes',
  nps: 'Govt Schemes',
  epf: 'Govt Schemes',
  ssy: 'Govt Schemes',
  nsc: 'Govt Schemes',
  scss: 'Govt Schemes',
  kvp: 'Govt Schemes',
  post_office: 'Govt Schemes',
  life_insurance: 'Insurance',
  health_insurance: 'Insurance',
  vehicle_insurance: 'Insurance',
  property: 'Real Estate',
  reit: 'Real Estate',
  crypto: 'Alternatives',
  chit_fund: 'Alternatives',
  p2p_lending: 'Alternatives',
  angel_investment: 'Alternatives',
  unlisted_shares: 'Alternatives',
}

// Liquidity classification
const LIQUID_TYPES = new Set([
  'savings_account', 'stock', 'mutual_fund', 'gold', 'crypto', 'reit',
])
const SEMI_LIQUID_TYPES = new Set([
  'fixed_deposit', 'recurring_deposit', 'corporate_bond', 'gsec_bond', 'tax_free_bond',
])
// Everything else = illiquid (ppf, nps, epf, insurance, property, alternatives, etc.)

async function overview(request, reply) {
  const userId = request.user.id
  const db = request.server.db

  const liabPh = LIABILITY_TYPES.map(() => '?').join(',')

  // Fetch all non-liability assets with name and created_at
  const assets = await query(db,
    `SELECT asset_name, asset_type, current_value, invested_amount, created_at
     FROM assets WHERE user_id = ? AND is_active = 1`,
    [userId]
  ).catch(() => [])

  const nonLiability = assets.filter((a) => !LIABILITY_TYPES.includes(a.asset_type))
  const totalCurrentValue = nonLiability.reduce((s, a) => s + parseFloat(a.current_value || 0), 0)
  const totalInvested = nonLiability.reduce((s, a) => s + parseFloat(a.invested_amount || 0), 0)
  const totalGain = totalCurrentValue - totalInvested
  const absoluteReturn = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0

  // ── 1. Category returns ────────────────────────────────────────────────────
  const catMap = {}
  nonLiability.forEach((a) => {
    const cat = CATEGORY_MAP[a.asset_type] || 'Other'
    if (!catMap[cat]) catMap[cat] = { invested: 0, current: 0 }
    catMap[cat].invested += parseFloat(a.invested_amount || 0)
    catMap[cat].current += parseFloat(a.current_value || 0)
  })

  const categoryReturns = Object.entries(catMap)
    .map(([name, v]) => ({
      name,
      invested: Math.round(v.invested),
      current: Math.round(v.current),
      gain: Math.round(v.current - v.invested),
      returnPct: v.invested > 0
        ? parseFloat(((v.current - v.invested) / v.invested * 100).toFixed(2))
        : 0,
    }))
    .sort((a, b) => b.current - a.current)

  // ── 2. Liquidity breakdown ─────────────────────────────────────────────────
  const liquidity = { liquid: 0, semiLiquid: 0, illiquid: 0 }
  nonLiability.forEach((a) => {
    const val = parseFloat(a.current_value || 0)
    if (LIQUID_TYPES.has(a.asset_type)) liquidity.liquid += val
    else if (SEMI_LIQUID_TYPES.has(a.asset_type)) liquidity.semiLiquid += val
    else liquidity.illiquid += val
  })
  liquidity.liquid = Math.round(liquidity.liquid)
  liquidity.semiLiquid = Math.round(liquidity.semiLiquid)
  liquidity.illiquid = Math.round(liquidity.illiquid)

  // ── 3. Concentration risk — top 5 by current value ────────────────────────
  const topRows = await query(db,
    `SELECT asset_name, asset_type, current_value
     FROM assets WHERE user_id = ? AND is_active = 1
       AND asset_type NOT IN (${liabPh})
     ORDER BY current_value DESC LIMIT 5`,
    [userId, ...LIABILITY_TYPES]
  ).catch(() => [])

  const concentrationRisk = topRows.map((a) => ({
    name: a.asset_name,
    type: CATEGORY_MAP[a.asset_type] || a.asset_type,
    value: Math.round(parseFloat(a.current_value || 0)),
    pct: totalCurrentValue > 0
      ? parseFloat((parseFloat(a.current_value) / totalCurrentValue * 100).toFixed(1))
      : 0,
  }))

  // ── 4. Portfolio XIRR (multi-cashflow approximation) ──────────────────────
  // Each asset contributes: outflow (-invested_amount) on its created_at date.
  // Terminal inflow: total current value of all assets today.
  const cashflows = []
  const dates = []
  const today = new Date()

  nonLiability
    .filter((a) => parseFloat(a.invested_amount) > 0)
    .forEach((a) => {
      cashflows.push(-parseFloat(a.invested_amount))
      dates.push(new Date(a.created_at))
    })

  let portfolioXirr = null
  if (cashflows.length > 0 && totalCurrentValue > 0) {
    cashflows.push(totalCurrentValue)
    dates.push(today)
    portfolioXirr = xirr(cashflows, dates)
    if (portfolioXirr !== null) {
      portfolioXirr = parseFloat((portfolioXirr * 100).toFixed(2))
    }
  }

  // ── 5. Benchmark comparison ────────────────────────────────────────────────
  const benchmarks = [
    { name: 'Your Portfolio', returnPct: parseFloat(absoluteReturn.toFixed(2)), highlight: true },
    { name: 'Nifty 50 (10yr avg)', returnPct: 13.0 },
    { name: 'Sensex (10yr avg)', returnPct: 12.5 },
    { name: 'PPF (current)', returnPct: 7.1 },
    { name: 'Bank FD (avg)', returnPct: 7.0 },
    { name: 'Inflation (CPI)', returnPct: 6.0 },
  ]

  return {
    summary: {
      totalCurrentValue: Math.round(totalCurrentValue),
      totalInvested: Math.round(totalInvested),
      totalGain: Math.round(totalGain),
      absoluteReturn: parseFloat(absoluteReturn.toFixed(2)),
      xirr: portfolioXirr,
    },
    categoryReturns,
    liquidity,
    concentrationRisk,
    benchmarks,
  }
}

module.exports = { overview }
