const { query, queryOne } = require('../models/db')

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

async function summary(request, reply) {
  const userId = request.user.id
  const db = request.server.db

  const cacheKey = `cache:dashboard:${userId}`
  const cached = request.server.redisAvailable
    ? await request.server.redis.get(cacheKey).catch(() => null)
    : null
  if (cached) return JSON.parse(cached)

  const liabilityPlaceholders = LIABILITY_TYPES.map(() => '?').join(',')

  const [assetRow, liabilityRow, countRow] = await Promise.all([
    queryOne(db,
      `SELECT COALESCE(SUM(current_value), 0) AS total, COALESCE(SUM(invested_amount), 0) AS invested
       FROM assets WHERE user_id = ? AND is_active = 1
       AND asset_type NOT IN (${liabilityPlaceholders})`,
      [userId, ...LIABILITY_TYPES]
    ),
    queryOne(db,
      `SELECT COALESCE(SUM(current_value), 0) AS total
       FROM assets WHERE user_id = ? AND is_active = 1
       AND asset_type IN (${liabilityPlaceholders})`,
      [userId, ...LIABILITY_TYPES]
    ),
    queryOne(db, 'SELECT COUNT(*) AS cnt FROM assets WHERE user_id = ? AND is_active = 1', [userId]),
  ])

  const totalAssets = parseFloat(assetRow?.total || 0)
  const totalInvested = parseFloat(assetRow?.invested || 0)
  const totalLiabilities = parseFloat(liabilityRow?.total || 0)
  const netWorth = totalAssets - totalLiabilities
  const totalGain = totalAssets - totalInvested
  const overallReturn = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0

  const result = {
    netWorth,
    totalAssets,
    totalLiabilities,
    totalInvested,
    totalGain,
    overallReturn,
    assetCount: countRow?.cnt || 0,
  }

  if (request.server.redisAvailable) {
    await request.server.redis.set(cacheKey, JSON.stringify(result), 'EX', 300).catch(() => null)
  }
  return result
}

async function netWorthHistory(request, reply) {
  const userId = request.user.id
  const db = request.server.db

  const liabilityPlaceholders = LIABILITY_TYPES.map(() => '?').join(',')

  // Build 12 monthly data points using assets' created_at as the entry point.
  // For each past month-end, sum current_value of assets that existed at that point.
  // This uses current values as a proxy (no historical price data), giving a
  // reasonable curve showing how the portfolio grew as assets were added.
  const rows = await query(db,
    `WITH months AS (
       SELECT 0 AS n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
       UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7
       UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11
     )
     SELECT
       DATE_FORMAT(LAST_DAY(DATE_SUB(CURDATE(), INTERVAL n MONTH)), '%b %Y') AS month,
       LAST_DAY(DATE_SUB(CURDATE(), INTERVAL n MONTH)) AS month_end,
       COALESCE(SUM(CASE WHEN a.asset_type NOT IN (${liabilityPlaceholders}) THEN a.current_value ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN a.asset_type IN (${liabilityPlaceholders}) THEN a.current_value ELSE 0 END), 0) AS net_worth
     FROM months
     LEFT JOIN assets a
       ON a.user_id = ?
       AND a.is_active = 1
       AND DATE(a.created_at) <= LAST_DAY(DATE_SUB(CURDATE(), INTERVAL n MONTH))
     GROUP BY n, month, month_end
     ORDER BY month_end ASC`,
    [...LIABILITY_TYPES, ...LIABILITY_TYPES, userId]
  ).catch(() => [])

  return {
    history: rows.map((r) => ({
      month: r.month,
      netWorth: parseFloat(r.net_worth || 0),
    })),
  }
}

async function upcomingEvents(request, reply) {
  const userId = request.user.id
  const db = request.server.db
  const events = []

  const [fds, rds, insurances, loans] = await Promise.all([
    // FD maturities in next 60 days
    query(db,
      `SELECT a.asset_name, fd.maturity_date AS event_date, 'FD Maturity' AS event_type
       FROM fixed_deposits fd
       JOIN assets a ON a.id = fd.asset_id
       WHERE a.user_id = ? AND a.is_active = 1
         AND fd.maturity_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
       ORDER BY fd.maturity_date`,
      [userId]
    ).catch(() => []),

    // RD maturities in next 60 days
    query(db,
      `SELECT a.asset_name, rd.maturity_date AS event_date, 'RD Maturity' AS event_type
       FROM recurring_deposits rd
       JOIN assets a ON a.id = rd.asset_id
       WHERE a.user_id = ? AND a.is_active = 1
         AND rd.maturity_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
       ORDER BY rd.maturity_date`,
      [userId]
    ).catch(() => []),

    // Insurance premium due dates in next 60 days
    query(db,
      `SELECT a.asset_name, ip.next_due_date AS event_date, 'Insurance Due' AS event_type
       FROM insurance_policies ip
       JOIN assets a ON a.id = ip.asset_id
       WHERE a.user_id = ? AND a.is_active = 1
         AND ip.next_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
       ORDER BY ip.next_due_date`,
      [userId]
    ).catch(() => []),

    // Loan EMIs due this month or next month (based on emi_due_day)
    query(db,
      `SELECT a.asset_name, l.emi_due_day, l.emi_amount
       FROM loans l
       JOIN assets a ON a.id = l.asset_id
       WHERE a.user_id = ? AND a.is_active = 1 AND l.is_closed = 0
         AND l.emi_due_day IS NOT NULL`,
      [userId]
    ).catch(() => []),
  ])

  fds.forEach((r) => events.push({ label: `${r.asset_name} — FD Maturity`, date: r.event_date, type: 'maturity' }))
  rds.forEach((r) => events.push({ label: `${r.asset_name} — RD Maturity`, date: r.event_date, type: 'maturity' }))
  insurances.forEach((r) => events.push({ label: `${r.asset_name} — Premium Due`, date: r.event_date, type: 'insurance' }))

  // Build next EMI date from emi_due_day
  const today = new Date()
  loans.forEach((loan) => {
    const day = loan.emi_due_day
    let next = new Date(today.getFullYear(), today.getMonth(), day)
    if (next < today) next = new Date(today.getFullYear(), today.getMonth() + 1, day)
    const diffDays = Math.ceil((next - today) / 86400000)
    if (diffDays <= 60) {
      events.push({
        label: `${loan.asset_name} — EMI ₹${Number(loan.emi_amount).toLocaleString('en-IN')}`,
        date: next.toISOString().slice(0, 10),
        type: 'emi',
      })
    }
  })

  events.sort((a, b) => new Date(a.date) - new Date(b.date))
  return { events }
}

async function topHoldings(request, reply) {
  const userId = request.user.id
  const liabilityPlaceholders = LIABILITY_TYPES.map(() => '?').join(',')
  const rows = await query(request.server.db,
    `SELECT asset_name, asset_type, current_value, invested_amount,
            CASE WHEN invested_amount > 0
                 THEN ROUND(((current_value - invested_amount) / invested_amount) * 100, 2)
                 ELSE 0 END AS return_pct
     FROM assets
     WHERE user_id = ? AND is_active = 1 AND asset_type NOT IN (${liabilityPlaceholders})
     ORDER BY current_value DESC LIMIT 8`,
    [userId, ...LIABILITY_TYPES]
  ).catch(() => [])
  return { holdings: rows }
}

async function allocation(request, reply) {
  const userId = request.user.id
  const liabilityPlaceholders = LIABILITY_TYPES.map(() => '?').join(',')
  const rows = await query(request.server.db,
    `SELECT asset_type, SUM(current_value) AS value
     FROM assets
     WHERE user_id = ? AND is_active = 1 AND asset_type NOT IN (${liabilityPlaceholders})
     GROUP BY asset_type
     HAVING value > 0
     ORDER BY value DESC`,
    [userId, ...LIABILITY_TYPES]
  ).catch(() => [])

  // Aggregate into human-readable categories
  const categoryTotals = {}
  rows.forEach((r) => {
    const cat = CATEGORY_MAP[r.asset_type] || 'Other'
    categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(r.value || 0)
  })

  const allocation = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return { allocation }
}

module.exports = { summary, netWorthHistory, upcomingEvents, topHoldings, allocation }
