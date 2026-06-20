const { query, queryOne } = require('../models/db')

async function summary(request, reply) {
  const userId = request.user.id
  const db = request.server.db

  // Cache check (skipped if Redis unavailable)
  const cacheKey = `cache:dashboard:${userId}`
  const cached = request.server.redisAvailable
    ? await request.server.redis.get(cacheKey).catch(() => null)
    : null
  if (cached) return JSON.parse(cached)

  const [assetRow, liabilityRow, countRow] = await Promise.all([
    queryOne(db,
      `SELECT COALESCE(SUM(current_value), 0) AS total, COALESCE(SUM(invested_amount), 0) AS invested
       FROM assets WHERE user_id = ? AND is_active = 1
       AND asset_type NOT IN ('home_loan','car_loan','personal_loan','education_loan','lap_loan','gold_loan','credit_card_debt')`,
      [userId]
    ),
    queryOne(db,
      `SELECT COALESCE(SUM(current_value), 0) AS total
       FROM assets WHERE user_id = ? AND is_active = 1
       AND asset_type IN ('home_loan','car_loan','personal_loan','education_loan','lap_loan','gold_loan','credit_card_debt')`,
      [userId]
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
    upcomingEvents: [],
  }

  if (request.server.redisAvailable) {
    await request.server.redis.set(cacheKey, JSON.stringify(result), 'EX', 300).catch(() => null)
  }
  return result
}

async function netWorthHistory(request, reply) {
  // Stub — will populate when net worth snapshots are stored
  return { history: [] }
}

async function upcomingEvents(request, reply) {
  const userId = request.user.id
  const db = request.server.db

  const events = []

  // FD maturities in next 60 days
  const fds = await query(db,
    `SELECT a.asset_name, fd.maturity_date
     FROM fixed_deposits fd
     JOIN assets a ON a.id = fd.asset_id
     WHERE a.user_id = ? AND fd.maturity_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
     ORDER BY fd.maturity_date`,
    [userId]
  ).catch(() => [])

  fds.forEach((fd) => events.push({ label: `FD Maturity: ${fd.asset_name}`, date: fd.maturity_date }))

  return { events }
}

async function topHoldings(request, reply) {
  const userId = request.user.id
  const rows = await query(request.server.db,
    `SELECT asset_name, asset_type, current_value
     FROM assets WHERE user_id = ? AND is_active = 1
     ORDER BY current_value DESC LIMIT 10`,
    [userId]
  ).catch(() => [])
  return { holdings: rows }
}

async function allocation(request, reply) {
  const userId = request.user.id
  const rows = await query(request.server.db,
    `SELECT asset_type, SUM(current_value) AS value
     FROM assets WHERE user_id = ? AND is_active = 1
     GROUP BY asset_type ORDER BY value DESC`,
    [userId]
  ).catch(() => [])
  return { allocation: rows }
}

module.exports = { summary, netWorthHistory, upcomingEvents, topHoldings, allocation }
