const { query, queryOne, insert } = require('../../models/db')
const { xirr } = require('../../finance/xirr')

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d)
}

function parseTx(t) {
  return {
    ...t,
    transaction_date: fmtDate(t.transaction_date),
    units: parseFloat(t.units),
    nav: parseFloat(t.nav),
    amount: parseFloat(t.amount),
  }
}

const INFLOW_TYPES = new Set(['purchase', 'dividend_reinvest', 'switch_in'])

// Recalculates units_held, avg_cost_nav, and syncs assets row.
async function recalcFund(conn, fundId) {
  const [agg] = await conn.execute(
    `SELECT
       COALESCE(SUM(CASE WHEN type IN ('purchase','dividend_reinvest','switch_in') THEN units  ELSE -units  END), 0) AS units_held,
       COALESCE(SUM(CASE WHEN type IN ('purchase','dividend_reinvest','switch_in') THEN units  ELSE 0 END), 0)        AS purchase_units,
       COALESCE(SUM(CASE WHEN type IN ('purchase','dividend_reinvest','switch_in') THEN amount ELSE 0 END), 0)        AS purchase_amount,
       COALESCE(SUM(CASE WHEN type IN ('purchase','dividend_reinvest','switch_in') THEN amount ELSE 0 END), 0)        AS total_invested,
       COALESCE(SUM(CASE WHEN type IN ('redemption','switch_out')                 THEN amount ELSE 0 END), 0)        AS total_redeemed
     FROM mutual_fund_transactions WHERE fund_id = ?`,
    [fundId]
  )
  const r = agg[0]
  const unitsHeld      = parseFloat(r.units_held)     || 0
  const purchaseUnits  = parseFloat(r.purchase_units)  || 0
  const purchaseAmount = parseFloat(r.purchase_amount) || 0
  const netInvested    = Math.max(0, parseFloat(r.total_invested) - parseFloat(r.total_redeemed))
  const avgCostNav     = purchaseUnits > 0 ? purchaseAmount / purchaseUnits : 0

  const [fundRows] = await conn.execute('SELECT last_nav, asset_id FROM mutual_funds WHERE id = ?', [fundId])
  const fund = fundRows[0]
  const lastNav = parseFloat(fund.last_nav) || 0
  const currentValue = lastNav > 0 ? unitsHeld * lastNav : netInvested

  await conn.execute('UPDATE mutual_funds SET units_held = ?, avg_cost_nav = ? WHERE id = ?', [unitsHeld, avgCostNav, fundId])
  await conn.execute('UPDATE assets SET current_value = ?, invested_amount = ? WHERE id = ?', [currentValue, netInvested, fund.asset_id])
}

// Build XIRR for a fund given its raw transaction rows and current portfolio state
function computeXirr(txRows, unitsHeld, lastNav) {
  if (!txRows.length || unitsHeld <= 0 || !lastNav) return null
  const cashflows = []
  const dates = []
  for (const t of txRows) {
    cashflows.push(INFLOW_TYPES.has(t.type) ? -parseFloat(t.amount) : parseFloat(t.amount))
    dates.push(new Date(t.transaction_date))
  }
  cashflows.push(unitsHeld * lastNav)
  dates.push(new Date())
  return xirr(cashflows, dates)
}

// ── Fund CRUD ────────────────────────────────────────────────────────────────

async function list(request, reply) {
  const db = request.server.db
  const userId = request.user.id

  const funds = await query(db,
    `SELECT mf.id, mf.scheme_name, mf.scheme_code, mf.isin, mf.fund_house, mf.category,
            mf.plan_type, mf.folio_number, mf.units_held, mf.avg_cost_nav,
            mf.last_nav, mf.last_nav_date,
            a.id AS asset_id, a.current_value, a.invested_amount
     FROM mutual_funds mf
     JOIN assets a ON a.id = mf.asset_id
     WHERE a.user_id = ? AND a.is_active = 1
     ORDER BY a.current_value DESC`,
    [userId]
  )
  if (!funds.length) return []

  const fundIds = funds.map((f) => f.id)
  const placeholders = fundIds.map(() => '?').join(',')
  const txRows = await query(db,
    `SELECT fund_id, type, transaction_date, units, nav, amount
     FROM mutual_fund_transactions
     WHERE fund_id IN (${placeholders})
     ORDER BY fund_id, transaction_date`,
    fundIds
  )

  const txByFund = {}
  for (const t of txRows) {
    ;(txByFund[t.fund_id] = txByFund[t.fund_id] || []).push(t)
  }

  return funds.map((f) => {
    const txs = txByFund[f.id] || []
    const unitsHeld    = parseFloat(f.units_held) || 0
    const lastNav      = parseFloat(f.last_nav) || 0
    const currentValue = parseFloat(f.current_value) || 0
    const invested     = parseFloat(f.invested_amount) || 0
    const absReturn    = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0
    const xirrVal      = computeXirr(txs, unitsHeld, lastNav)
    return {
      ...f,
      last_nav_date: fmtDate(f.last_nav_date),
      units_held: unitsHeld,
      avg_cost_nav: parseFloat(f.avg_cost_nav) || 0,
      last_nav: lastNav,
      current_value: currentValue,
      invested_amount: invested,
      abs_return: Math.round(absReturn * 100) / 100,
      xirr: xirrVal !== null ? Math.round(xirrVal * 10000) / 100 : null, // as %
      tx_count: txs.length,
    }
  })
}

async function create(request, reply) {
  const db = request.server.db
  const {
    scheme_name, scheme_code, isin, fund_house, category, plan_type,
    folio_number, family_member_id, notes,
    // first transaction (required)
    tx_type, tx_source, tx_date, tx_units, tx_nav, tx_amount,
  } = request.body

  const nav    = parseFloat(tx_nav)
  const amount = parseFloat(tx_amount)
  const units  = parseFloat(tx_units) || (amount > 0 && nav > 0 ? parseFloat((amount / nav).toFixed(4)) : 0)

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [assetRes] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency, current_value, invested_amount, notes)
       VALUES (?, ?, 'mutual_fund', ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, scheme_name, amount, amount, notes || null]
    )
    const assetId = assetRes.insertId

    const [mfRes] = await conn.execute(
      `INSERT INTO mutual_funds (asset_id, scheme_name, scheme_code, isin, fund_house, category, plan_type, folio_number, units_held, avg_cost_nav, last_nav, last_nav_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, scheme_name, scheme_code, isin || null, fund_house || null, category || null,
       plan_type || 'growth', folio_number || null, units, nav, nav, tx_date]
    )
    const fundId = mfRes.insertId

    await conn.execute(
      `INSERT INTO mutual_fund_transactions (fund_id, type, source, transaction_date, units, nav, amount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fundId, tx_type || 'purchase', tx_source || 'lumpsum', tx_date, units, nav, amount]
    )

    await conn.commit()
    return reply.code(201).send({ id: assetId, fund_id: fundId })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function get(request, reply) {
  const db = request.server.db
  const fund = await queryOne(db,
    `SELECT mf.*, a.id AS asset_id, a.current_value, a.invested_amount, a.notes
     FROM mutual_funds mf JOIN assets a ON a.id = mf.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!fund) return reply.code(404).send({ message: 'Fund not found' })

  const txs = await query(db,
    'SELECT * FROM mutual_fund_transactions WHERE fund_id = ? ORDER BY transaction_date',
    [fund.id]
  )
  return {
    ...fund,
    last_nav_date: fmtDate(fund.last_nav_date),
    units_held: parseFloat(fund.units_held),
    avg_cost_nav: parseFloat(fund.avg_cost_nav),
    last_nav: parseFloat(fund.last_nav) || null,
    transactions: txs.map(parseTx),
  }
}

async function update(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const { scheme_name, isin, fund_house, category, plan_type, folio_number, notes, family_member_id } = request.body

  const existing = await queryOne(db, 'SELECT mf.id FROM mutual_funds mf JOIN assets a ON a.id = mf.asset_id WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Fund not found' })

  await db.execute('UPDATE assets SET asset_name = ?, notes = ?, family_member_id = ? WHERE id = ?', [scheme_name, notes || null, family_member_id || null, id])
  await db.execute('UPDATE mutual_funds SET scheme_name = ?, isin = ?, fund_house = ?, category = ?, plan_type = ?, folio_number = ? WHERE asset_id = ?',
    [scheme_name, isin || null, fund_house || null, category || null, plan_type || 'growth', folio_number || null, id])

  return { id: parseInt(id) }
}

async function remove(request, reply) {
  const db = request.server.db
  const result = await insert(db, 'UPDATE assets SET is_active = 0 WHERE id = ? AND user_id = ?', [request.params.id, request.user.id])
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Fund not found' })
  return reply.code(204).send()
}

// ── Transaction endpoints ─────────────────────────────────────────────────────

async function listTransactions(request, reply) {
  const db = request.server.db
  const fund = await queryOne(db,
    `SELECT mf.id FROM mutual_funds mf JOIN assets a ON a.id = mf.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!fund) return reply.code(404).send({ message: 'Fund not found' })

  const txs = await query(db,
    'SELECT * FROM mutual_fund_transactions WHERE fund_id = ? ORDER BY transaction_date',
    [fund.id]
  )
  return txs.map(parseTx)
}

async function addTransaction(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const { type, source, transaction_date, units, nav, amount, notes } = request.body

  const fund = await queryOne(db,
    `SELECT mf.id FROM mutual_funds mf JOIN assets a ON a.id = mf.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [id, request.user.id]
  )
  if (!fund) return reply.code(404).send({ message: 'Fund not found' })

  const u = parseFloat(units)
  const n = parseFloat(nav)
  const amt = parseFloat(amount || (u * n).toFixed(2))

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()

    const [res] = await conn.execute(
      'INSERT INTO mutual_fund_transactions (fund_id, type, source, transaction_date, units, nav, amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [fund.id, type, source || 'lumpsum', transaction_date, u, n, amt, notes || null]
    )

    // Update last_nav if this transaction is newer
    await conn.execute(
      `UPDATE mutual_funds SET last_nav = ?, last_nav_date = ?
       WHERE id = ? AND (last_nav_date IS NULL OR last_nav_date <= ?)`,
      [n, transaction_date, fund.id, transaction_date]
    )

    await recalcFund(conn, fund.id)
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

  const fund = await queryOne(db,
    `SELECT mf.id FROM mutual_funds mf JOIN assets a ON a.id = mf.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [id, request.user.id]
  )
  if (!fund) return reply.code(404).send({ message: 'Fund not found' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [res] = await conn.execute('DELETE FROM mutual_fund_transactions WHERE id = ? AND fund_id = ?', [txId, fund.id])
    if (res.affectedRows === 0) { await conn.rollback(); return reply.code(404).send({ message: 'Transaction not found' }) }
    await recalcFund(conn, fund.id)
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
