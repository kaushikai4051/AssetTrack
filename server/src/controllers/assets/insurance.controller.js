const { query, queryOne, insert } = require('../../models/db')

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : d
}

const { familyFilter } = require('../../utils/familyFilter')

const INS_ASSET_TYPE = {
  term:               'life_insurance',
  endowment:          'life_insurance',
  money_back:         'life_insurance',
  ulip:               'life_insurance',
  lic:                'life_insurance',
  health:             'health_insurance',
  vehicle:            'vehicle_insurance',
  critical_illness:   'health_insurance',
}

function parsePolicy(r) {
  return {
    ...r,
    start_date:       fmtDate(r.start_date),
    renewal_date:     fmtDate(r.renewal_date),
    annual_premium:   parseFloat(r.annual_premium),
    sum_assured:      r.sum_assured != null ? parseFloat(r.sum_assured) : null,
    bonus_accumulated: parseFloat(r.bonus_accumulated || 0),
    surrender_value:  r.surrender_value != null ? parseFloat(r.surrender_value) : null,
    no_claim_bonus:   parseFloat(r.no_claim_bonus || 0),
    ncb_percent:      parseFloat(r.ncb_percent || 0),
    idv:              r.idv != null ? parseFloat(r.idv) : null,
    fund_value:       r.fund_value != null ? parseFloat(r.fund_value) : null,
    family_floater:   Boolean(r.family_floater),
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

async function policyList(request, reply) {
  const db = request.server.db
  const { type } = request.query

  let sql = `SELECT a.id, a.asset_name, a.notes, a.family_member_id,
                    ip.insurance_type, ip.insurer, ip.policy_number, ip.plan_name,
                    ip.sum_assured, ip.annual_premium, ip.premium_frequency,
                    ip.start_date, ip.renewal_date, ip.policy_term_years,
                    ip.bonus_accumulated, ip.surrender_value,
                    ip.family_floater, ip.members_covered, ip.no_claim_bonus,
                    ip.vehicle_number, ip.idv, ip.ncb_percent, ip.ins_type_vehicle,
                    ip.fund_value
             FROM assets a JOIN insurance_policies ip ON ip.asset_id = a.id
             WHERE a.user_id = ? AND a.is_active = 1`
  const params = [request.user.id]

  if (type) { sql += ' AND ip.insurance_type = ?'; params.push(type) }
  const ff = familyFilter(request)
  sql += ff.sql; params.push(...ff.params)
  sql += ' ORDER BY ip.renewal_date ASC'

  const rows = await query(db, sql, params)
  return rows.map(parsePolicy)
}

// ── Create ────────────────────────────────────────────────────────────────────

async function policyCreate(request, reply) {
  const db = request.server.db
  const {
    insurance_type, insurer, policy_number, plan_name,
    sum_assured, annual_premium, premium_frequency,
    start_date, renewal_date, policy_term_years, premium_term_years,
    bonus_accumulated, surrender_value,
    family_floater, members_covered, no_claim_bonus,
    vehicle_number, idv, ncb_percent, ins_type_vehicle,
    fund_value, notes, family_member_id,
  } = request.body

  const asset_type = INS_ASSET_TYPE[insurance_type] || 'life_insurance'
  const asset_name = `${plan_name || insurance_type} — ${insurer}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [ar] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency,
                           current_value, invested_amount, notes)
       VALUES (?, ?, ?, ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, asset_type, asset_name,
       parseFloat(annual_premium), parseFloat(annual_premium), notes || null]
    )
    const assetId = ar.insertId

    await conn.execute(
      `INSERT INTO insurance_policies
         (asset_id, insurance_type, insurer, policy_number, plan_name,
          sum_assured, annual_premium, premium_frequency,
          start_date, renewal_date, policy_term_years, premium_term_years,
          bonus_accumulated, surrender_value,
          family_floater, members_covered, no_claim_bonus,
          vehicle_number, idv, ncb_percent, ins_type_vehicle, fund_value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, insurance_type, insurer, policy_number || null, plan_name || null,
       sum_assured ? parseFloat(sum_assured) : null,
       parseFloat(annual_premium), premium_frequency || 'yearly',
       start_date, renewal_date || null,
       policy_term_years ? parseInt(policy_term_years) : null,
       premium_term_years ? parseInt(premium_term_years) : null,
       parseFloat(bonus_accumulated || 0),
       surrender_value ? parseFloat(surrender_value) : null,
       family_floater ? 1 : 0, members_covered || null,
       parseFloat(no_claim_bonus || 0),
       vehicle_number || null,
       idv ? parseFloat(idv) : null,
       parseFloat(ncb_percent || 0),
       ins_type_vehicle || 'comprehensive',
       fund_value ? parseFloat(fund_value) : null]
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

async function policyGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id,
            ip.insurance_type, ip.insurer, ip.policy_number, ip.plan_name,
            ip.sum_assured, ip.annual_premium, ip.premium_frequency,
            ip.start_date, ip.renewal_date, ip.policy_term_years, ip.premium_term_years,
            ip.bonus_accumulated, ip.surrender_value,
            ip.family_floater, ip.members_covered, ip.no_claim_bonus,
            ip.vehicle_number, ip.idv, ip.ncb_percent, ip.ins_type_vehicle, ip.fund_value
     FROM assets a JOIN insurance_policies ip ON ip.asset_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Policy not found' })
  return parsePolicy(row)
}

// ── Update ────────────────────────────────────────────────────────────────────

async function policyUpdate(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const {
    insurance_type, insurer, policy_number, plan_name,
    sum_assured, annual_premium, premium_frequency,
    start_date, renewal_date, policy_term_years, premium_term_years,
    bonus_accumulated, surrender_value,
    family_floater, members_covered, no_claim_bonus,
    vehicle_number, idv, ncb_percent, ins_type_vehicle,
    fund_value, notes, family_member_id,
  } = request.body

  const existing = await queryOne(db, 'SELECT id FROM assets WHERE id=? AND user_id=? AND is_active=1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Policy not found' })

  const asset_name = `${plan_name || insurance_type} — ${insurer}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, current_value=?, invested_amount=?, notes=?, family_member_id=? WHERE id=?`,
      [asset_name, parseFloat(annual_premium), parseFloat(annual_premium), notes || null, family_member_id || null, id]
    )
    await conn.execute(
      `UPDATE insurance_policies SET
         insurer=?, policy_number=?, plan_name=?,
         sum_assured=?, annual_premium=?, premium_frequency=?,
         start_date=?, renewal_date=?, policy_term_years=?, premium_term_years=?,
         bonus_accumulated=?, surrender_value=?,
         family_floater=?, members_covered=?, no_claim_bonus=?,
         vehicle_number=?, idv=?, ncb_percent=?, ins_type_vehicle=?, fund_value=?
       WHERE asset_id=?`,
      [insurer, policy_number || null, plan_name || null,
       sum_assured ? parseFloat(sum_assured) : null,
       parseFloat(annual_premium), premium_frequency || 'yearly',
       start_date, renewal_date || null,
       policy_term_years ? parseInt(policy_term_years) : null,
       premium_term_years ? parseInt(premium_term_years) : null,
       parseFloat(bonus_accumulated || 0),
       surrender_value ? parseFloat(surrender_value) : null,
       family_floater ? 1 : 0, members_covered || null,
       parseFloat(no_claim_bonus || 0),
       vehicle_number || null,
       idv ? parseFloat(idv) : null,
       parseFloat(ncb_percent || 0),
       ins_type_vehicle || 'comprehensive',
       fund_value ? parseFloat(fund_value) : null,
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

async function policyDelete(request, reply) {
  const db = request.server.db
  const result = await insert(db, 'UPDATE assets SET is_active=0 WHERE id=? AND user_id=?', [request.params.id, request.user.id])
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Policy not found' })
  return reply.code(204).send()
}

// ── Nominees ──────────────────────────────────────────────────────────────────

async function nomineeList(request, reply) {
  const db = request.server.db
  const policy = await queryOne(db,
    'SELECT ip.id FROM insurance_policies ip JOIN assets a ON a.id=ip.asset_id WHERE a.id=? AND a.user_id=? AND a.is_active=1',
    [request.params.id, request.user.id]
  )
  if (!policy) return reply.code(404).send({ message: 'Policy not found' })

  const rows = await query(db,
    'SELECT id, name, relationship, share_percent, dob FROM insurance_nominees WHERE policy_id=?',
    [policy.id]
  )
  return rows.map((r) => ({ ...r, dob: fmtDate(r.dob), share_percent: parseFloat(r.share_percent) }))
}

async function nomineeCreate(request, reply) {
  const db = request.server.db
  const policy = await queryOne(db,
    'SELECT ip.id FROM insurance_policies ip JOIN assets a ON a.id=ip.asset_id WHERE a.id=? AND a.user_id=? AND a.is_active=1',
    [request.params.id, request.user.id]
  )
  if (!policy) return reply.code(404).send({ message: 'Policy not found' })

  const { name, relationship, share_percent, dob } = request.body
  const [res] = await db.execute(
    'INSERT INTO insurance_nominees (policy_id, name, relationship, share_percent, dob) VALUES (?, ?, ?, ?, ?)',
    [policy.id, name, relationship || null, parseFloat(share_percent || 100), dob || null]
  )
  return reply.code(201).send({ id: res.insertId })
}

async function nomineeDelete(request, reply) {
  const db = request.server.db
  const policy = await queryOne(db,
    'SELECT ip.id FROM insurance_policies ip JOIN assets a ON a.id=ip.asset_id WHERE a.id=? AND a.user_id=? AND a.is_active=1',
    [request.params.id, request.user.id]
  )
  if (!policy) return reply.code(404).send({ message: 'Policy not found' })

  const result = await insert(db,
    'DELETE FROM insurance_nominees WHERE id=? AND policy_id=?',
    [request.params.nomineeId, policy.id]
  )
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Nominee not found' })
  return reply.code(204).send()
}

// ── Premium payments ──────────────────────────────────────────────────────────

async function premiumList(request, reply) {
  const db = request.server.db
  const policy = await queryOne(db,
    'SELECT ip.id FROM insurance_policies ip JOIN assets a ON a.id=ip.asset_id WHERE a.id=? AND a.user_id=? AND a.is_active=1',
    [request.params.id, request.user.id]
  )
  if (!policy) return reply.code(404).send({ message: 'Policy not found' })

  const rows = await query(db,
    'SELECT id, payment_date, amount, is_paid, receipt_number, notes FROM insurance_premium_payments WHERE policy_id=? ORDER BY payment_date DESC',
    [policy.id]
  )
  return rows.map((r) => ({ ...r, payment_date: fmtDate(r.payment_date), amount: parseFloat(r.amount), is_paid: Boolean(r.is_paid) }))
}

async function premiumCreate(request, reply) {
  const db = request.server.db
  const policy = await queryOne(db,
    'SELECT ip.id FROM insurance_policies ip JOIN assets a ON a.id=ip.asset_id WHERE a.id=? AND a.user_id=? AND a.is_active=1',
    [request.params.id, request.user.id]
  )
  if (!policy) return reply.code(404).send({ message: 'Policy not found' })

  const { payment_date, amount, is_paid, receipt_number, notes } = request.body
  const [res] = await db.execute(
    'INSERT INTO insurance_premium_payments (policy_id, payment_date, amount, is_paid, receipt_number, notes) VALUES (?, ?, ?, ?, ?, ?)',
    [policy.id, payment_date, parseFloat(amount), is_paid !== false ? 1 : 0, receipt_number || null, notes || null]
  )
  return reply.code(201).send({ id: res.insertId })
}

module.exports = {
  policyList, policyCreate, policyGet, policyUpdate, policyDelete,
  nomineeList, nomineeCreate, nomineeDelete,
  premiumList, premiumCreate,
}
