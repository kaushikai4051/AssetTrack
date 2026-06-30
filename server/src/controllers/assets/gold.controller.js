const { query, insert } = require('../../models/db')
const { familyFilter } = require('../../utils/familyFilter')

// INR purity factors for physical gold
const PURITY_FACTOR = {
  '24k': 1.0, '999': 0.999, '995': 0.995,
  '22k': 0.9167, '916': 0.916, '18k': 0.75,
}
function getPurityFactor(purity) { return PURITY_FACTOR[purity] ?? 1.0 }

// current_value formula:
//   physical/digital: quantity × purity_factor × last_price
//   sgb:              quantity × last_price          (1 bond = 1g, purity = 1)
//   etf:              quantity × last_price          (unit price)
function calcCurrentValue(row) {
  const price = Number(row.last_price || row.purchase_price || 0)
  const qty   = Number(row.quantity)
  if (row.gold_type === 'physical') return qty * getPurityFactor(row.purity) * price
  return qty * price
}

async function list(request, reply) {
  const ff = familyFilter(request)
  const rows = await query(request.server.db,
    `SELECT gh.*, a.current_value, a.invested_amount, a.notes
     FROM gold_holdings gh
     JOIN assets a ON a.id = gh.asset_id
     WHERE a.user_id = ? AND a.is_active = 1${ff.sql}
     ORDER BY a.created_at DESC`,
    [request.user.id, ...ff.params]
  )
  return rows.map((r) => {
    const current_value   = Number(r.current_value)
    const invested_amount = Number(r.invested_amount)
    return {
      ...r,
      current_value,
      invested_amount,
      pnl:     current_value - invested_amount,
      pnl_pct: invested_amount > 0 ? ((current_value - invested_amount) / invested_amount) * 100 : null,
    }
  })
}

async function create(request, reply) {
  const {
    gold_type, name, quantity, purchase_price, purchase_date, notes,
    purity, platform, storage_location,
    ticker, broker,
    sgb_series, face_value, issue_date, maturity_date, coupon_rate,
  } = request.body

  const purchaseFloat = Number(purchase_price || 0)
  const qty           = Number(quantity)
  const purityFactor  = gold_type === 'physical' ? getPurityFactor(purity) : 1.0
  const currentValue  = qty * purityFactor * purchaseFloat

  const conn = await request.server.db.getConnection()
  try {
    await conn.beginTransaction()

    const [assetRes] = await conn.execute(
      `INSERT INTO assets (user_id, asset_type, asset_name, invested_amount, current_value, notes)
       VALUES (?, 'gold', ?, ?, ?, ?)`,
      [request.user.id, name, currentValue, currentValue, notes || null]
    )
    const assetId = assetRes.insertId

    await conn.execute(
      `INSERT INTO gold_holdings
         (asset_id, gold_type, name, quantity, purchase_price, purchase_date,
          purity, platform, storage_location, ticker, broker,
          sgb_series, face_value, issue_date, maturity_date, coupon_rate,
          last_price, last_price_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetId, gold_type, name, qty, purchaseFloat || null, purchase_date || null,
        purity || null, platform || null, storage_location || null,
        ticker ? ticker.toUpperCase() : null, broker || null,
        sgb_series || null, face_value || null, issue_date || null,
        maturity_date || null, coupon_rate ?? 2.50,
        purchaseFloat || null, purchase_date || null,
      ]
    )

    await conn.commit()
    return reply.code(201).send({ asset_id: assetId })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function get(request, reply) {
  const [row] = await query(request.server.db,
    `SELECT gh.*, a.current_value, a.invested_amount, a.notes
     FROM gold_holdings gh
     JOIN assets a ON a.id = gh.asset_id
     WHERE gh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Not found' })
  return row
}

async function update(request, reply) {
  const {
    name, quantity, purchase_price, purchase_date, notes,
    purity, platform, storage_location,
    ticker, broker,
    sgb_series, face_value, issue_date, maturity_date, coupon_rate,
  } = request.body

  const [holding] = await query(request.server.db,
    `SELECT gh.gold_type, gh.last_price FROM gold_holdings gh
     JOIN assets a ON a.id = gh.asset_id
     WHERE gh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!holding) return reply.code(404).send({ message: 'Not found' })

  const qty          = Number(quantity)
  const pricePer     = Number(holding.last_price || purchase_price || 0)
  const purityFactor = holding.gold_type === 'physical' ? getPurityFactor(purity) : 1.0
  const currentValue = qty * purityFactor * pricePer
  const invested     = qty * Number(purchase_price || 0)

  const conn = await request.server.db.getConnection()
  try {
    await conn.beginTransaction()

    await conn.execute(
      `UPDATE assets SET asset_name=?, invested_amount=?, current_value=?, notes=? WHERE id=?`,
      [name, invested, currentValue, notes || null, request.params.id]
    )
    await conn.execute(
      `UPDATE gold_holdings SET
         name=?, quantity=?, purchase_price=?, purchase_date=?,
         purity=?, platform=?, storage_location=?,
         ticker=?, broker=?,
         sgb_series=?, face_value=?, issue_date=?, maturity_date=?, coupon_rate=?
       WHERE asset_id=?`,
      [
        name, qty, purchase_price || null, purchase_date || null,
        purity || null, platform || null, storage_location || null,
        ticker ? ticker.toUpperCase() : null, broker || null,
        sgb_series || null, face_value || null, issue_date || null,
        maturity_date || null, coupon_rate ?? 2.50,
        request.params.id,
      ]
    )

    await conn.commit()
    return { success: true }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function remove(request, reply) {
  const [row] = await query(request.server.db,
    `SELECT gh.asset_id FROM gold_holdings gh
     JOIN assets a ON a.id = gh.asset_id
     WHERE gh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Not found' })
  await insert(request.server.db,
    `UPDATE assets SET is_active = 0 WHERE id = ?`, [request.params.id]
  )
  return { success: true }
}

module.exports = { list, create, get, update, remove }
