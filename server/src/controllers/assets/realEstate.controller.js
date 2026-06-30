const { query, queryOne, insert } = require('../../models/db')
const { familyFilter } = require('../../utils/familyFilter')

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : d
}

function parseProperty(r) {
  const totalCost = parseFloat(r.purchase_price) + parseFloat(r.registration_charges || 0) + parseFloat(r.stamp_duty || 0)
  const currentVal = r.current_value != null ? parseFloat(r.current_value) : totalCost
  const annualRent = r.monthly_rent ? parseFloat(r.monthly_rent) * 12 : 0
  const rentalYield = currentVal > 0 && annualRent > 0 ? Math.round((annualRent / currentVal) * 10000) / 100 : 0

  return {
    ...r,
    purchase_date:    fmtDate(r.purchase_date),
    lease_start_date: fmtDate(r.lease_start_date),
    lease_end_date:   fmtDate(r.lease_end_date),
    purchase_price:   parseFloat(r.purchase_price),
    registration_charges: parseFloat(r.registration_charges || 0),
    stamp_duty:       parseFloat(r.stamp_duty || 0),
    total_cost:       Math.round(totalCost * 100) / 100,
    current_value:    Math.round(currentVal * 100) / 100,
    monthly_rent:     r.monthly_rent ? parseFloat(r.monthly_rent) : null,
    ownership_percent: parseFloat(r.ownership_percent || 100),
    units:            r.units ? parseFloat(r.units) : null,
    buy_price_per_unit: r.buy_price_per_unit ? parseFloat(r.buy_price_per_unit) : null,
    is_rented:        Boolean(r.is_rented),
    rental_yield:     rentalYield,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

async function propertyList(request, reply) {
  const db = request.server.db
  const ff = familyFilter(request)
  const rows = await query(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id,
            p.property_type, p.property_name, p.address,
            p.purchase_date, p.purchase_price, p.registration_charges, p.stamp_duty,
            p.current_value, p.is_rented, p.monthly_rent,
            p.tenant_name, p.lease_start_date, p.lease_end_date,
            p.ownership_percent, p.co_owner_name,
            p.units, p.buy_price_per_unit
     FROM assets a JOIN properties p ON p.asset_id = a.id
     WHERE a.user_id = ? AND a.is_active = 1${ff.sql}
     ORDER BY p.purchase_date DESC`,
    [request.user.id, ...ff.params]
  )
  return rows.map(parseProperty)
}

// ── Create ────────────────────────────────────────────────────────────────────

async function propertyCreate(request, reply) {
  const db = request.server.db
  const {
    property_type, property_name, address,
    purchase_date, purchase_price, registration_charges, stamp_duty,
    current_value, is_rented, monthly_rent,
    tenant_name, lease_start_date, lease_end_date,
    ownership_percent, co_owner_name,
    units, buy_price_per_unit,
    notes, family_member_id,
  } = request.body

  const totalCost = parseFloat(purchase_price) + parseFloat(registration_charges || 0) + parseFloat(stamp_duty || 0)
  const curVal    = current_value ? parseFloat(current_value) : totalCost
  const asset_type = property_type === 'reit' ? 'reit' : 'property'
  const asset_name = property_name

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [ar] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency,
                           current_value, invested_amount, notes)
       VALUES (?, ?, ?, ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, asset_type, asset_name, curVal, totalCost, notes || null]
    )
    const assetId = ar.insertId

    await conn.execute(
      `INSERT INTO properties
         (asset_id, property_type, property_name, address,
          purchase_date, purchase_price, registration_charges, stamp_duty, current_value,
          is_rented, monthly_rent, tenant_name, lease_start_date, lease_end_date,
          ownership_percent, co_owner_name, units, buy_price_per_unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, property_type, property_name, address || null,
       purchase_date, parseFloat(purchase_price),
       parseFloat(registration_charges || 0), parseFloat(stamp_duty || 0),
       curVal,
       is_rented ? 1 : 0, monthly_rent ? parseFloat(monthly_rent) : null,
       tenant_name || null, lease_start_date || null, lease_end_date || null,
       parseFloat(ownership_percent || 100), co_owner_name || null,
       units ? parseFloat(units) : null,
       buy_price_per_unit ? parseFloat(buy_price_per_unit) : null]
    )
    await conn.commit()
    return reply.code(201).send({ id: assetId })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ── Get ───────────────────────────────────────────────────────────────────────

async function propertyGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id,
            p.property_type, p.property_name, p.address,
            p.purchase_date, p.purchase_price, p.registration_charges, p.stamp_duty,
            p.current_value, p.is_rented, p.monthly_rent,
            p.tenant_name, p.lease_start_date, p.lease_end_date,
            p.ownership_percent, p.co_owner_name, p.units, p.buy_price_per_unit
     FROM assets a JOIN properties p ON p.asset_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Property not found' })
  return parseProperty(row)
}

// ── Update ────────────────────────────────────────────────────────────────────

async function propertyUpdate(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const {
    property_type, property_name, address,
    purchase_date, purchase_price, registration_charges, stamp_duty,
    current_value, is_rented, monthly_rent,
    tenant_name, lease_start_date, lease_end_date,
    ownership_percent, co_owner_name,
    units, buy_price_per_unit,
    notes, family_member_id,
  } = request.body

  const existing = await queryOne(db, 'SELECT id FROM assets WHERE id=? AND user_id=? AND is_active=1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Property not found' })

  const totalCost = parseFloat(purchase_price) + parseFloat(registration_charges || 0) + parseFloat(stamp_duty || 0)
  const curVal    = current_value ? parseFloat(current_value) : totalCost

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, current_value=?, invested_amount=?, notes=?, family_member_id=? WHERE id=?`,
      [property_name, curVal, totalCost, notes || null, family_member_id || null, id]
    )
    await conn.execute(
      `UPDATE properties SET
         property_name=?, address=?, purchase_date=?, purchase_price=?,
         registration_charges=?, stamp_duty=?, current_value=?,
         is_rented=?, monthly_rent=?, tenant_name=?, lease_start_date=?, lease_end_date=?,
         ownership_percent=?, co_owner_name=?, units=?, buy_price_per_unit=?
       WHERE asset_id=?`,
      [property_name, address || null, purchase_date, parseFloat(purchase_price),
       parseFloat(registration_charges || 0), parseFloat(stamp_duty || 0), curVal,
       is_rented ? 1 : 0, monthly_rent ? parseFloat(monthly_rent) : null,
       tenant_name || null, lease_start_date || null, lease_end_date || null,
       parseFloat(ownership_percent || 100), co_owner_name || null,
       units ? parseFloat(units) : null,
       buy_price_per_unit ? parseFloat(buy_price_per_unit) : null,
       id]
    )
    await conn.commit()
    return { id: parseInt(id) }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function propertyDelete(request, reply) {
  const db = request.server.db
  const result = await insert(db, 'UPDATE assets SET is_active=0 WHERE id=? AND user_id=?', [request.params.id, request.user.id])
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Property not found' })
  return reply.code(204).send()
}

module.exports = { propertyList, propertyCreate, propertyGet, propertyUpdate, propertyDelete }
