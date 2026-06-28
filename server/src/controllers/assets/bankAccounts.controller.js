const { query, queryOne, insert } = require('../../models/db')
const { calcFDMaturity, calcRDMaturity } = require('../../finance/fd')

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : d
}

function addMonths(dateStr, months) {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

// ── Fixed Deposits ────────────────────────────────────────────────────────────

async function fdList(request, reply) {
  const db = request.server.db
  const rows = await query(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id, a.current_value,
            fd.bank_name, fd.account_number, fd.principal, fd.interest_rate,
            fd.compounding, fd.start_date, fd.maturity_date, fd.maturity_amount,
            fd.is_auto_renew, fd.nominee_name
     FROM assets a JOIN fixed_deposits fd ON fd.asset_id = a.id
     WHERE a.user_id = ? AND a.is_active = 1
     ORDER BY fd.maturity_date`,
    [request.user.id]
  )
  return rows.map((r) => ({
    ...r,
    start_date: fmtDate(r.start_date),
    maturity_date: fmtDate(r.maturity_date),
    principal: parseFloat(r.principal),
    maturity_amount: parseFloat(r.maturity_amount),
    interest_rate: parseFloat(r.interest_rate),
    is_auto_renew: Boolean(r.is_auto_renew),
  }))
}

async function fdCreate(request, reply) {
  const db = request.server.db
  const { bank_name, account_number, principal, interest_rate, compounding,
          start_date, maturity_date, is_auto_renew, nominee_name, notes, family_member_id,
          maturity_amount: clientMaturityAmount } = request.body

  const maturity_amount = clientMaturityAmount != null
    ? parseFloat(clientMaturityAmount)
    : calcFDMaturity(principal, interest_rate, compounding, start_date, maturity_date)
  const asset_name = `FD — ${bank_name}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [assetResult] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency,
                           current_value, invested_amount, notes)
       VALUES (?, ?, 'fixed_deposit', ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, asset_name, maturity_amount, parseFloat(principal), notes || null]
    )
    const assetId = assetResult.insertId
    await conn.execute(
      `INSERT INTO fixed_deposits (asset_id, bank_name, account_number, principal, interest_rate,
                                   compounding, start_date, maturity_date, maturity_amount,
                                   is_auto_renew, nominee_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, bank_name, account_number || null, parseFloat(principal), parseFloat(interest_rate),
       compounding, start_date, maturity_date, maturity_amount,
       is_auto_renew ? 1 : 0, nominee_name || null]
    )
    await conn.commit()
    return reply.code(201).send({ id: assetId, maturity_amount })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function fdGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id,
            fd.bank_name, fd.account_number, fd.principal, fd.interest_rate,
            fd.compounding, fd.start_date, fd.maturity_date, fd.maturity_amount,
            fd.is_auto_renew, fd.nominee_name
     FROM assets a JOIN fixed_deposits fd ON fd.asset_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Fixed deposit not found' })
  return {
    ...row,
    start_date: fmtDate(row.start_date),
    maturity_date: fmtDate(row.maturity_date),
    principal: parseFloat(row.principal),
    maturity_amount: parseFloat(row.maturity_amount),
    interest_rate: parseFloat(row.interest_rate),
    is_auto_renew: Boolean(row.is_auto_renew),
  }
}

async function fdUpdate(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const { bank_name, account_number, principal, interest_rate, compounding,
          start_date, maturity_date, is_auto_renew, nominee_name, notes, family_member_id,
          maturity_amount: clientMaturityAmount } = request.body

  const existing = await queryOne(db, 'SELECT id FROM assets WHERE id = ? AND user_id = ? AND is_active = 1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Fixed deposit not found' })

  const maturity_amount = clientMaturityAmount != null
    ? parseFloat(clientMaturityAmount)
    : calcFDMaturity(principal, interest_rate, compounding, start_date, maturity_date)
  const asset_name = `FD — ${bank_name}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, current_value=?, invested_amount=?, notes=?, family_member_id=? WHERE id=?`,
      [asset_name, maturity_amount, parseFloat(principal), notes || null, family_member_id || null, id]
    )
    await conn.execute(
      `UPDATE fixed_deposits SET bank_name=?, account_number=?, principal=?, interest_rate=?,
       compounding=?, start_date=?, maturity_date=?, maturity_amount=?, is_auto_renew=?, nominee_name=?
       WHERE asset_id=?`,
      [bank_name, account_number || null, parseFloat(principal), parseFloat(interest_rate),
       compounding, start_date, maturity_date, maturity_amount,
       is_auto_renew ? 1 : 0, nominee_name || null, id]
    )
    await conn.commit()
    return { id: parseInt(id), maturity_amount }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function fdDelete(request, reply) {
  const db = request.server.db
  const result = await insert(db,
    'UPDATE assets SET is_active=0 WHERE id=? AND user_id=?',
    [request.params.id, request.user.id]
  )
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Fixed deposit not found' })
  return reply.code(204).send()
}

// ── Recurring Deposits ────────────────────────────────────────────────────────

async function rdList(request, reply) {
  const db = request.server.db
  const rows = await query(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id,
            rd.bank_name, rd.account_number, rd.monthly_amount, rd.interest_rate,
            rd.tenure_months, rd.start_date, rd.maturity_date, rd.maturity_amount
     FROM assets a JOIN recurring_deposits rd ON rd.asset_id = a.id
     WHERE a.user_id = ? AND a.is_active = 1
     ORDER BY rd.maturity_date`,
    [request.user.id]
  )
  return rows.map((r) => ({
    ...r,
    start_date: fmtDate(r.start_date),
    maturity_date: fmtDate(r.maturity_date),
    monthly_amount: parseFloat(r.monthly_amount),
    maturity_amount: parseFloat(r.maturity_amount),
    interest_rate: parseFloat(r.interest_rate),
  }))
}

async function rdCreate(request, reply) {
  const db = request.server.db
  const { bank_name, account_number, monthly_amount, interest_rate, tenure_months,
          start_date, notes, family_member_id } = request.body

  const maturity_date = addMonths(start_date, parseInt(tenure_months))
  const maturity_amount = calcRDMaturity(monthly_amount, interest_rate, tenure_months)
  const invested_amount = parseFloat(monthly_amount) * parseInt(tenure_months)
  const asset_name = `RD — ${bank_name}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [assetResult] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency,
                           current_value, invested_amount, notes)
       VALUES (?, ?, 'recurring_deposit', ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, asset_name, maturity_amount, invested_amount, notes || null]
    )
    const assetId = assetResult.insertId
    await conn.execute(
      `INSERT INTO recurring_deposits (asset_id, bank_name, account_number, monthly_amount,
                                       interest_rate, tenure_months, start_date, maturity_date, maturity_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, bank_name, account_number || null, parseFloat(monthly_amount),
       parseFloat(interest_rate), parseInt(tenure_months), start_date, maturity_date, maturity_amount]
    )
    await conn.commit()
    return reply.code(201).send({ id: assetId, maturity_amount, maturity_date })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function rdGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id,
            rd.bank_name, rd.account_number, rd.monthly_amount, rd.interest_rate,
            rd.tenure_months, rd.start_date, rd.maturity_date, rd.maturity_amount
     FROM assets a JOIN recurring_deposits rd ON rd.asset_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Recurring deposit not found' })
  return {
    ...row,
    start_date: fmtDate(row.start_date),
    maturity_date: fmtDate(row.maturity_date),
    monthly_amount: parseFloat(row.monthly_amount),
    maturity_amount: parseFloat(row.maturity_amount),
    interest_rate: parseFloat(row.interest_rate),
  }
}

async function rdUpdate(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const { bank_name, account_number, monthly_amount, interest_rate, tenure_months,
          start_date, notes, family_member_id } = request.body

  const existing = await queryOne(db, 'SELECT id FROM assets WHERE id=? AND user_id=? AND is_active=1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Recurring deposit not found' })

  const maturity_date = addMonths(start_date, parseInt(tenure_months))
  const maturity_amount = calcRDMaturity(monthly_amount, interest_rate, tenure_months)
  const invested_amount = parseFloat(monthly_amount) * parseInt(tenure_months)
  const asset_name = `RD — ${bank_name}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, current_value=?, invested_amount=?, notes=?, family_member_id=? WHERE id=?`,
      [asset_name, maturity_amount, invested_amount, notes || null, family_member_id || null, id]
    )
    await conn.execute(
      `UPDATE recurring_deposits SET bank_name=?, account_number=?, monthly_amount=?, interest_rate=?,
       tenure_months=?, start_date=?, maturity_date=?, maturity_amount=? WHERE asset_id=?`,
      [bank_name, account_number || null, parseFloat(monthly_amount), parseFloat(interest_rate),
       parseInt(tenure_months), start_date, maturity_date, maturity_amount, id]
    )
    await conn.commit()
    return { id: parseInt(id), maturity_amount, maturity_date }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function rdDelete(request, reply) {
  const db = request.server.db
  const result = await insert(db,
    'UPDATE assets SET is_active=0 WHERE id=? AND user_id=?',
    [request.params.id, request.user.id]
  )
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Recurring deposit not found' })
  return reply.code(204).send()
}

// ── Savings Accounts ──────────────────────────────────────────────────────────

async function savingsList(request, reply) {
  const db = request.server.db
  const rows = await query(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id, a.current_value,
            sa.bank_name, sa.account_number, sa.account_type, sa.ifsc_code,
            sa.branch_name, sa.interest_rate
     FROM assets a JOIN savings_accounts sa ON sa.asset_id = a.id
     WHERE a.user_id = ? AND a.is_active = 1
     ORDER BY a.created_at DESC`,
    [request.user.id]
  )
  return rows.map((r) => ({
    ...r,
    current_value: parseFloat(r.current_value),
    interest_rate: parseFloat(r.interest_rate),
  }))
}

async function savingsCreate(request, reply) {
  const db = request.server.db
  const { bank_name, account_number, account_type, ifsc_code, branch_name,
          interest_rate, balance, notes, family_member_id } = request.body

  const asset_name = `${account_type.charAt(0).toUpperCase() + account_type.slice(1)} A/C — ${bank_name}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [assetResult] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency,
                           current_value, invested_amount, notes)
       VALUES (?, ?, 'savings_account', ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, asset_name,
       parseFloat(balance || 0), parseFloat(balance || 0), notes || null]
    )
    const assetId = assetResult.insertId
    await conn.execute(
      `INSERT INTO savings_accounts (asset_id, bank_name, account_number, account_type,
                                     ifsc_code, branch_name, interest_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [assetId, bank_name, account_number || null, account_type || 'savings',
       ifsc_code || null, branch_name || null, parseFloat(interest_rate || 0)]
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

async function savingsGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id, a.current_value,
            sa.bank_name, sa.account_number, sa.account_type, sa.ifsc_code,
            sa.branch_name, sa.interest_rate
     FROM assets a JOIN savings_accounts sa ON sa.asset_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Account not found' })
  return { ...row, current_value: parseFloat(row.current_value), interest_rate: parseFloat(row.interest_rate) }
}

async function savingsUpdate(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const { bank_name, account_number, account_type, ifsc_code, branch_name,
          interest_rate, balance, notes, family_member_id } = request.body

  const existing = await queryOne(db, 'SELECT id FROM assets WHERE id=? AND user_id=? AND is_active=1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Account not found' })

  const asset_name = `${account_type.charAt(0).toUpperCase() + account_type.slice(1)} A/C — ${bank_name}`

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, current_value=?, invested_amount=?, notes=?, family_member_id=? WHERE id=?`,
      [asset_name, parseFloat(balance || 0), parseFloat(balance || 0), notes || null, family_member_id || null, id]
    )
    await conn.execute(
      `UPDATE savings_accounts SET bank_name=?, account_number=?, account_type=?,
       ifsc_code=?, branch_name=?, interest_rate=? WHERE asset_id=?`,
      [bank_name, account_number || null, account_type || 'savings',
       ifsc_code || null, branch_name || null, parseFloat(interest_rate || 0), id]
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

async function savingsDelete(request, reply) {
  const db = request.server.db
  const result = await insert(db,
    'UPDATE assets SET is_active=0 WHERE id=? AND user_id=?',
    [request.params.id, request.user.id]
  )
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Account not found' })
  return reply.code(204).send()
}

module.exports = {
  fdList, fdCreate, fdGet, fdUpdate, fdDelete,
  rdList, rdCreate, rdGet, rdUpdate, rdDelete,
  savingsList, savingsCreate, savingsGet, savingsUpdate, savingsDelete,
}
