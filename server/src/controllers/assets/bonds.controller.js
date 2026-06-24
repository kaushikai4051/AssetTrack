const { query, queryOne, insert } = require('../../models/db')
const { calcYTM, generateCouponSchedule } = require('../../finance/ytm')

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : d
}

const BOND_ASSET_TYPE = {
  corporate: 'corporate_bond',
  ncd:       'corporate_bond',
  gsec:      'gsec_bond',
  tbill:     'gsec_bond',
  sdl:       'gsec_bond',
  tax_free:  'tax_free_bond',
}

function parseBond(r) {
  return {
    ...r,
    purchase_date:   fmtDate(r.purchase_date),
    maturity_date:   fmtDate(r.maturity_date),
    face_value:      parseFloat(r.face_value),
    units:           parseFloat(r.units),
    coupon_rate:     parseFloat(r.coupon_rate),
    purchase_price:  parseFloat(r.purchase_price),
    current_value:   parseFloat(r.current_value),
    ytm:             r.ytm != null ? parseFloat(r.ytm) : null,
    is_secured:      Boolean(r.is_secured),
    is_listed:       Boolean(r.is_listed),
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

async function bondList(request, reply) {
  const db = request.server.db
  const { type } = request.query

  let sql = `SELECT a.id, a.asset_name, a.notes, a.family_member_id, a.current_value,
                    b.bond_type, b.issuer, b.isin, b.credit_rating, b.face_value, b.units,
                    b.coupon_rate, b.coupon_frequency, b.purchase_price, b.purchase_date,
                    b.maturity_date, b.is_secured, b.is_listed, b.ytm
             FROM assets a JOIN bond_holdings b ON b.asset_id = a.id
             WHERE a.user_id = ? AND a.is_active = 1`
  const params = [request.user.id]

  if (type) { sql += ' AND b.bond_type = ?'; params.push(type) }
  sql += ' ORDER BY b.maturity_date'

  const rows = await query(db, sql, params)
  return rows.map(parseBond)
}

// ── Create ────────────────────────────────────────────────────────────────────

async function bondCreate(request, reply) {
  const db = request.server.db
  const {
    bond_type, issuer, isin, credit_rating, face_value, units,
    coupon_rate, coupon_frequency, purchase_price, purchase_date,
    maturity_date, is_secured, is_listed, notes, family_member_id,
  } = request.body

  const ytm = calcYTM(face_value, units || 1, coupon_rate, coupon_frequency, purchase_price, purchase_date, maturity_date)
  const currentValue = parseFloat(purchase_price)
  const fv = parseFloat(face_value) * parseFloat(units || 1)
  const asset_type = BOND_ASSET_TYPE[bond_type] || 'corporate_bond'
  const asset_name = `${issuer}${isin ? ` (${isin})` : ''}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [ar] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency,
                           current_value, invested_amount, notes)
       VALUES (?, ?, ?, ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, asset_type, asset_name, currentValue, currentValue, notes || null]
    )
    const assetId = ar.insertId

    await conn.execute(
      `INSERT INTO bond_holdings (asset_id, bond_type, issuer, isin, credit_rating,
                                   face_value, units, coupon_rate, coupon_frequency,
                                   purchase_price, purchase_date, maturity_date,
                                   is_secured, is_listed, ytm)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, bond_type, issuer, isin || null, credit_rating || null,
       parseFloat(face_value), parseFloat(units || 1), parseFloat(coupon_rate),
       coupon_frequency || 'half_yearly', parseFloat(purchase_price),
       purchase_date, maturity_date,
       is_secured !== false ? 1 : 0, is_listed !== false ? 1 : 0, ytm]
    )
    await conn.commit()
    return reply.code(201).send({ id: assetId, ytm })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ── Get ───────────────────────────────────────────────────────────────────────

async function bondGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id, a.current_value,
            b.bond_type, b.issuer, b.isin, b.credit_rating, b.face_value, b.units,
            b.coupon_rate, b.coupon_frequency, b.purchase_price, b.purchase_date,
            b.maturity_date, b.is_secured, b.is_listed, b.ytm
     FROM assets a JOIN bond_holdings b ON b.asset_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Bond not found' })
  return parseBond(row)
}

// ── Update ────────────────────────────────────────────────────────────────────

async function bondUpdate(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const {
    bond_type, issuer, isin, credit_rating, face_value, units,
    coupon_rate, coupon_frequency, purchase_price, purchase_date,
    maturity_date, is_secured, is_listed, notes, family_member_id,
  } = request.body

  const existing = await queryOne(db, 'SELECT id FROM assets WHERE id=? AND user_id=? AND is_active=1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Bond not found' })

  const ytm = calcYTM(face_value, units || 1, coupon_rate, coupon_frequency, purchase_price, purchase_date, maturity_date)
  const currentValue = parseFloat(purchase_price)
  const asset_name = `${issuer}${isin ? ` (${isin})` : ''}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, current_value=?, invested_amount=?, notes=?, family_member_id=? WHERE id=?`,
      [asset_name, currentValue, currentValue, notes || null, family_member_id || null, id]
    )
    await conn.execute(
      `UPDATE bond_holdings SET issuer=?, isin=?, credit_rating=?, face_value=?, units=?,
       coupon_rate=?, coupon_frequency=?, purchase_price=?, purchase_date=?, maturity_date=?,
       is_secured=?, is_listed=?, ytm=? WHERE asset_id=?`,
      [issuer, isin || null, credit_rating || null, parseFloat(face_value), parseFloat(units || 1),
       parseFloat(coupon_rate), coupon_frequency || 'half_yearly', parseFloat(purchase_price),
       purchase_date, maturity_date,
       is_secured !== false ? 1 : 0, is_listed !== false ? 1 : 0, ytm, id]
    )
    await conn.commit()
    return { id: parseInt(id), ytm }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function bondDelete(request, reply) {
  const db = request.server.db
  const result = await insert(db,
    'UPDATE assets SET is_active=0 WHERE id=? AND user_id=?',
    [request.params.id, request.user.id]
  )
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Bond not found' })
  return reply.code(204).send()
}

// ── Coupon schedule ───────────────────────────────────────────────────────────

async function couponSchedule(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT b.face_value, b.units, b.coupon_rate, b.coupon_frequency, b.purchase_date, b.maturity_date
     FROM bond_holdings b JOIN assets a ON a.id = b.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Bond not found' })

  const schedule = generateCouponSchedule(
    row.face_value, row.units, row.coupon_rate,
    row.coupon_frequency, row.purchase_date, row.maturity_date
  )
  const totalCoupon = schedule.reduce((s, c) => s + c.amount, 0)
  return {
    schedule,
    summary: {
      total_coupons: schedule.length,
      total_coupon_income: Math.round(totalCoupon * 100) / 100,
      annual_coupon: Math.round((parseFloat(row.coupon_rate) / 100) * parseFloat(row.face_value) * parseFloat(row.units) * 100) / 100,
    },
  }
}

// ── Coupon payments (received log) ────────────────────────────────────────────

async function couponList(request, reply) {
  const db = request.server.db
  const ownership = await queryOne(db,
    'SELECT b.id FROM bond_holdings b JOIN assets a ON a.id = b.asset_id WHERE a.id=? AND a.user_id=? AND a.is_active=1',
    [request.params.id, request.user.id]
  )
  if (!ownership) return reply.code(404).send({ message: 'Bond not found' })

  const rows = await query(db,
    `SELECT id, payment_date, amount, is_received, notes
     FROM bond_coupon_payments WHERE bond_id=? ORDER BY payment_date DESC`,
    [ownership.id]
  )
  return rows.map((r) => ({
    ...r,
    payment_date: fmtDate(r.payment_date),
    amount: parseFloat(r.amount),
    is_received: Boolean(r.is_received),
  }))
}

async function couponCreate(request, reply) {
  const db = request.server.db
  const bond = await queryOne(db,
    'SELECT b.id FROM bond_holdings b JOIN assets a ON a.id = b.asset_id WHERE a.id=? AND a.user_id=? AND a.is_active=1',
    [request.params.id, request.user.id]
  )
  if (!bond) return reply.code(404).send({ message: 'Bond not found' })

  const { payment_date, amount, is_received, notes } = request.body
  const [res] = await db.execute(
    `INSERT INTO bond_coupon_payments (bond_id, payment_date, amount, is_received, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [bond.id, payment_date, parseFloat(amount), is_received ? 1 : 0, notes || null]
  )
  return reply.code(201).send({ id: res.insertId })
}

module.exports = {
  bondList, bondCreate, bondGet, bondUpdate, bondDelete,
  couponSchedule, couponList, couponCreate,
}
