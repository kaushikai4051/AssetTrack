const { query, queryOne, insert } = require('../../models/db')
const { classifyLots }            = require('../../finance/capitalGains')

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d)
}

function parseTx(t) {
  return {
    ...t,
    transaction_date: fmtDate(t.transaction_date),
    shares:    parseFloat(t.shares),
    price:     parseFloat(t.price),
    amount:    parseFloat(t.amount),
    brokerage: parseFloat(t.brokerage),
  }
}

// ── Recalculate holding stats from transactions ───────────────────────────────

async function recalcHolding(conn, holdingId) {
  const [txns] = await conn.execute(
    'SELECT type, transaction_date, shares, price, brokerage FROM stock_transactions WHERE holding_id = ? ORDER BY transaction_date, id',
    [holdingId]
  )

  let sharesHeld = 0
  let totalCost  = 0 // running cost basis for avg calculation

  for (const t of txns) {
    const s = parseFloat(t.shares)
    const p = parseFloat(t.price) || 0

    switch (t.type) {
      case 'buy':
        totalCost  += s * p
        sharesHeld += s
        break
      case 'sell':
        if (sharesHeld > 0) totalCost *= (sharesHeld - s) / sharesHeld
        sharesHeld -= s
        break
      case 'bonus':
        sharesHeld += s
        // totalCost unchanged — bonus reduces avg cost
        break
      case 'split': {
        const ratio = s // shares field stores ratio
        sharesHeld  *= ratio
        // totalCost unchanged — avg cost reduces proportionally
        break
      }
    }
  }

  sharesHeld = Math.max(0, Math.round(sharesHeld * 10000) / 10000)
  const avgCost = sharesHeld > 0 ? totalCost / sharesHeld : 0

  const [[holdRows]] = await conn.execute(
    'SELECT last_price, asset_id FROM stock_holdings WHERE id = ?', [holdingId]
  )
  const lastPrice    = parseFloat(holdRows.last_price) || 0
  const currentValue = lastPrice > 0 ? sharesHeld * lastPrice : sharesHeld * avgCost
  const netInvested  = sharesHeld * avgCost

  await conn.execute(
    'UPDATE stock_holdings SET shares_held = ?, avg_cost_price = ? WHERE id = ?',
    [sharesHeld, avgCost, holdingId]
  )
  await conn.execute(
    'UPDATE assets SET current_value = ?, invested_amount = ? WHERE id = ?',
    [currentValue, netInvested, holdRows.asset_id]
  )
}

// ── Holdings CRUD ─────────────────────────────────────────────────────────────

async function list(request, reply) {
  const db     = request.server.db
  const userId = request.user.id

  const holdings = await query(db,
    `SELECT sh.id, sh.ticker, sh.company_name, sh.exchange, sh.sector, sh.isin,
            sh.broker, sh.shares_held, sh.avg_cost_price, sh.last_price, sh.last_price_date,
            a.id AS asset_id, a.current_value, a.invested_amount
     FROM stock_holdings sh
     JOIN assets a ON a.id = sh.asset_id
     WHERE a.user_id = ? AND a.is_active = 1
     ORDER BY a.current_value DESC`,
    [userId]
  )
  if (!holdings.length) return []

  const holdingIds  = holdings.map((h) => h.id)
  const placeholders = holdingIds.map(() => '?').join(',')
  const txRows = await query(db,
    `SELECT holding_id, type, transaction_date, shares, price, brokerage, amount
     FROM stock_transactions WHERE holding_id IN (${placeholders})
     ORDER BY holding_id, transaction_date`,
    holdingIds
  )

  const txByHolding = {}
  for (const t of txRows) {
    ;(txByHolding[t.holding_id] = txByHolding[t.holding_id] || []).push(t)
  }

  return holdings.map((h) => {
    const txs       = txByHolding[h.id] || []
    const sharesHeld = parseFloat(h.shares_held) || 0
    const lastPrice  = parseFloat(h.last_price) || 0
    const avgCost    = parseFloat(h.avg_cost_price) || 0
    const invested   = parseFloat(h.invested_amount) || 0
    const current    = parseFloat(h.current_value) || 0
    const pnl        = current - invested
    const pnlPct     = invested > 0 ? (pnl / invested) * 100 : 0
    const { ltcgShares, stcgShares, ltcgGain, stcgGain } = classifyLots(txs, lastPrice)

    return {
      ...h,
      last_price_date: fmtDate(h.last_price_date),
      shares_held:  sharesHeld,
      avg_cost_price: avgCost,
      last_price:   lastPrice,
      current_value: current,
      invested_amount: invested,
      pnl:          Math.round(pnl * 100) / 100,
      pnl_pct:      Math.round(pnlPct * 100) / 100,
      ltcg_shares:  ltcgShares,
      stcg_shares:  stcgShares,
      ltcg_gain:    ltcgGain,
      stcg_gain:    stcgGain,
      tx_count:     txs.length,
    }
  })
}

async function create(request, reply) {
  const db = request.server.db
  const {
    ticker, company_name, exchange, sector, isin, broker,
    family_member_id, notes,
    tx_date, tx_shares, tx_price, tx_brokerage,
  } = request.body

  const shares    = parseFloat(tx_shares)
  const price     = parseFloat(tx_price)
  const brokerage = parseFloat(tx_brokerage || 0)
  const amount    = shares * price + brokerage

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [assetRes] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency, current_value, invested_amount, notes)
       VALUES (?, ?, 'stock', ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, company_name,
       shares * price, shares * price, notes || null]
    )
    const assetId = assetRes.insertId

    const [shRes] = await conn.execute(
      `INSERT INTO stock_holdings (asset_id, ticker, company_name, exchange, sector, isin, broker, shares_held, avg_cost_price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, ticker.toUpperCase(), company_name, exchange || 'NSE',
       sector || null, isin || null, broker || null, shares, price]
    )
    const holdingId = shRes.insertId

    await conn.execute(
      `INSERT INTO stock_transactions (holding_id, type, transaction_date, shares, price, amount, brokerage)
       VALUES (?, 'buy', ?, ?, ?, ?, ?)`,
      [holdingId, tx_date, shares, price, amount, brokerage]
    )

    await conn.commit()
    return reply.code(201).send({ id: assetId, holding_id: holdingId })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function get(request, reply) {
  const db = request.server.db
  const holding = await queryOne(db,
    `SELECT sh.*, a.id AS asset_id, a.current_value, a.invested_amount, a.notes
     FROM stock_holdings sh JOIN assets a ON a.id = sh.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!holding) return reply.code(404).send({ message: 'Holding not found' })

  const txs = await query(db,
    'SELECT * FROM stock_transactions WHERE holding_id = ? ORDER BY transaction_date',
    [holding.id]
  )
  return {
    ...holding,
    last_price_date: fmtDate(holding.last_price_date),
    shares_held:    parseFloat(holding.shares_held),
    avg_cost_price: parseFloat(holding.avg_cost_price),
    last_price:     parseFloat(holding.last_price) || null,
    transactions:   txs.map(parseTx),
  }
}

async function update(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const { company_name, sector, isin, broker, notes, family_member_id } = request.body

  const existing = await queryOne(db,
    'SELECT sh.id FROM stock_holdings sh JOIN assets a ON a.id = sh.asset_id WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1',
    [id, request.user.id]
  )
  if (!existing) return reply.code(404).send({ message: 'Holding not found' })

  await db.execute('UPDATE assets SET asset_name = ?, notes = ?, family_member_id = ? WHERE id = ?',
    [company_name, notes || null, family_member_id || null, id])
  await db.execute('UPDATE stock_holdings SET company_name = ?, sector = ?, isin = ?, broker = ? WHERE asset_id = ?',
    [company_name, sector || null, isin || null, broker || null, id])

  return { id: parseInt(id) }
}

async function remove(request, reply) {
  const db = request.server.db
  const result = await insert(db, 'UPDATE assets SET is_active = 0 WHERE id = ? AND user_id = ?',
    [request.params.id, request.user.id])
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Holding not found' })
  return reply.code(204).send()
}

// ── Transactions ──────────────────────────────────────────────────────────────

async function listTransactions(request, reply) {
  const db = request.server.db
  const holding = await queryOne(db,
    `SELECT sh.id FROM stock_holdings sh JOIN assets a ON a.id = sh.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!holding) return reply.code(404).send({ message: 'Holding not found' })

  const txs = await query(db,
    'SELECT * FROM stock_transactions WHERE holding_id = ? ORDER BY transaction_date',
    [holding.id]
  )
  return txs.map(parseTx)
}

async function addTransaction(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const { type, transaction_date, shares, price, brokerage, notes } = request.body

  const holding = await queryOne(db,
    `SELECT sh.id FROM stock_holdings sh JOIN assets a ON a.id = sh.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [id, request.user.id]
  )
  if (!holding) return reply.code(404).send({ message: 'Holding not found' })

  const s   = parseFloat(shares)
  const p   = parseFloat(price) || 0
  const brk = parseFloat(brokerage) || 0
  const amt = type === 'buy'
    ? s * p + brk
    : type === 'sell' ? s * p - brk : 0

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [res] = await conn.execute(
      'INSERT INTO stock_transactions (holding_id, type, transaction_date, shares, price, amount, brokerage, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [holding.id, type, transaction_date, s, p, amt, brk, notes || null]
    )
    await recalcHolding(conn, holding.id)
    await conn.commit()
    return reply.code(201).send({ id: res.insertId })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function deleteTransaction(request, reply) {
  const db = request.server.db
  const { id, txId } = request.params

  const holding = await queryOne(db,
    `SELECT sh.id FROM stock_holdings sh JOIN assets a ON a.id = sh.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [id, request.user.id]
  )
  if (!holding) return reply.code(404).send({ message: 'Holding not found' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [res] = await conn.execute(
      'DELETE FROM stock_transactions WHERE id = ? AND holding_id = ?', [txId, holding.id]
    )
    if (res.affectedRows === 0) { await conn.rollback(); return reply.code(404).send({ message: 'Transaction not found' }) }
    await recalcHolding(conn, holding.id)
    await conn.commit()
    return reply.code(204).send()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

module.exports = { list, create, get, update, remove, listTransactions, addTransaction, deleteTransaction }
