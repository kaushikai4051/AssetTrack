const { getNav, searchFunds } = require('../market/mfNav')
const { getStockPrice }       = require('../market/stockPrice')
const { getGoldPrice }        = require('../market/goldPrice')
const { query, insert }       = require('../models/db')

const PURITY_FACTOR = {
  '24k': 1.0, '999': 0.999, '995': 0.995,
  '22k': 0.9167, '916': 0.916, '18k': 0.75,
}

async function mfNav(request, reply) {
  const { schemeCode } = request.params
  const redis = request.server.redisAvailable ? request.server.redis : null

  try {
    const data = await getNav(schemeCode, redis)

    // Best-effort: update last_nav in mutual_funds if this scheme is in the user's portfolio
    insert(request.server.db,
      `UPDATE mutual_funds mf
       JOIN assets a ON a.id = mf.asset_id
       SET mf.last_nav = ?, mf.last_nav_date = CURDATE(),
           a.current_value = mf.units_held * ?
       WHERE mf.scheme_code = ? AND a.user_id = ? AND a.is_active = 1`,
      [data.nav, data.nav, schemeCode, request.user.id]
    ).catch(() => null)

    return data
  } catch (err) {
    return reply.code(502).send({ message: err.message })
  }
}

async function mfSearch(request, reply) {
  const q = request.query.q || ''
  if (q.length < 3) return []
  try {
    const results = await searchFunds(q)
    return results.slice(0, 15)
  } catch (err) {
    return reply.code(502).send({ message: 'Fund search failed. Check your internet connection.' })
  }
}

async function stockPrice(request, reply) {
  const { ticker } = request.params
  const exchange   = request.query.exchange || 'NSE'
  const redis      = request.server.redisAvailable ? request.server.redis : null

  try {
    const data = await getStockPrice(ticker, exchange, redis)

    // Best-effort: update last_price in stock_holdings for this user
    insert(request.server.db,
      `UPDATE stock_holdings sh
       JOIN assets a ON a.id = sh.asset_id
       SET sh.last_price = ?, sh.last_price_date = CURDATE(),
           a.current_value = sh.shares_held * ?
       WHERE sh.ticker = ? AND a.user_id = ? AND a.is_active = 1`,
      [data.price, data.price, ticker.toUpperCase(), request.user.id]
    ).catch(() => null)

    return data
  } catch (err) {
    return reply.code(502).send({ message: err.message })
  }
}

async function goldPrice(request, reply) {
  const redis = request.server.redisAvailable ? request.server.redis : null

  try {
    const data = await getGoldPrice(redis)

    // Best-effort: update all physical/digital/sgb gold holdings for this user
    // Each row may have a different purity — fetch holdings and update individually
    const holdings = await query(request.server.db,
      `SELECT gh.asset_id, gh.gold_type, gh.quantity, gh.purity
       FROM gold_holdings gh
       JOIN assets a ON a.id = gh.asset_id
       WHERE gh.gold_type IN ('physical','digital','sgb')
         AND a.user_id = ? AND a.is_active = 1`,
      [request.user.id]
    ).catch(() => [])

    for (const h of holdings) {
      const factor = h.gold_type === 'physical' ? (PURITY_FACTOR[h.purity] ?? 1.0) : 1.0
      const newValue = Number(h.quantity) * factor * data.price_per_gram
      insert(request.server.db,
        `UPDATE gold_holdings gh
         JOIN assets a ON a.id = gh.asset_id
         SET gh.last_price = ?, gh.last_price_date = CURDATE(), a.current_value = ?
         WHERE gh.asset_id = ?`,
        [data.price_per_gram, newValue, h.asset_id]
      ).catch(() => null)
    }

    return data
  } catch (err) {
    return reply.code(502).send({ message: err.message })
  }
}

module.exports = { mfNav, mfSearch, stockPrice, goldPrice }
