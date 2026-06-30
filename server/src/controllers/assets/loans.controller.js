const { query, queryOne, insert } = require('../../models/db')
const { calcEMI, generateAmortization, calcPrepaymentSavings } = require('../../finance/emi')
const { familyFilter } = require('../../utils/familyFilter')

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : d
}

function parseLoan(r) {
  return {
    ...r,
    disbursement_date: fmtDate(r.disbursement_date),
    payment_due_date: fmtDate(r.payment_due_date),
    principal_amount: parseFloat(r.principal_amount),
    outstanding_amount: parseFloat(r.outstanding_amount),
    interest_rate: parseFloat(r.interest_rate),
    emi_amount: r.emi_amount ? parseFloat(r.emi_amount) : null,
    credit_limit: r.credit_limit ? parseFloat(r.credit_limit) : null,
    minimum_due: r.minimum_due ? parseFloat(r.minimum_due) : null,
    moratorium_months: r.moratorium_months ? parseInt(r.moratorium_months) : 0,
    tenure_months: parseInt(r.tenure_months),
    emi_due_day: parseInt(r.emi_due_day),
  }
}

const LOAN_ASSET_TYPE = {
  home: 'home_loan',
  car: 'car_loan',
  personal: 'personal_loan',
  education: 'education_loan',
  lap: 'lap_loan',
  gold: 'gold_loan',
  credit_card: 'credit_card_debt',
}

// ── List ──────────────────────────────────────────────────────────────────────

async function loanList(request, reply) {
  const db = request.server.db
  const { type } = request.query

  let sql = `SELECT a.id, a.asset_name, a.notes, a.family_member_id, a.current_value,
                    l.loan_type, l.lender, l.loan_account_number, l.principal_amount,
                    l.outstanding_amount, l.interest_rate, l.rate_type, l.tenure_months,
                    l.emi_amount, l.disbursement_date, l.emi_due_day,
                    l.property_address, l.moratorium_months,
                    l.credit_limit, l.minimum_due, l.payment_due_date
             FROM assets a JOIN loans l ON l.asset_id = a.id
             WHERE a.user_id = ? AND a.is_active = 1`
  const params = [request.user.id]

  if (type) {
    sql += ' AND l.loan_type = ?'
    params.push(type)
  }
  const ff = familyFilter(request)
  sql += ff.sql; params.push(...ff.params)
  sql += ' ORDER BY l.disbursement_date DESC'

  const rows = await query(db, sql, params)
  return rows.map(parseLoan)
}

// ── Create ────────────────────────────────────────────────────────────────────

async function loanCreate(request, reply) {
  const db = request.server.db
  const {
    loan_type, lender, loan_account_number, principal_amount, outstanding_amount,
    interest_rate, rate_type, tenure_months, disbursement_date, emi_due_day,
    property_address, moratorium_months, credit_limit, minimum_due, payment_due_date,
    notes, family_member_id,
  } = request.body

  const emi_amount = loan_type !== 'credit_card'
    ? calcEMI(outstanding_amount ?? principal_amount, interest_rate, tenure_months)
    : null

  const asset_type = LOAN_ASSET_TYPE[loan_type] || 'personal_loan'
  const asset_name = `${loan_type.charAt(0).toUpperCase() + loan_type.slice(1).replace('_', ' ')} — ${lender}`
  const outstanding = parseFloat(outstanding_amount ?? principal_amount)

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [assetResult] = await conn.execute(
      `INSERT INTO assets (user_id, family_member_id, asset_type, asset_name, currency,
                           current_value, invested_amount, notes)
       VALUES (?, ?, ?, ?, 'INR', ?, ?, ?)`,
      [request.user.id, family_member_id || null, asset_type, asset_name,
       -outstanding, parseFloat(principal_amount), notes || null]
    )
    const assetId = assetResult.insertId

    await conn.execute(
      `INSERT INTO loans (asset_id, loan_type, lender, loan_account_number, principal_amount,
                          outstanding_amount, interest_rate, rate_type, tenure_months, emi_amount,
                          disbursement_date, emi_due_day, property_address, moratorium_months,
                          credit_limit, minimum_due, payment_due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assetId, loan_type, lender, loan_account_number || null, parseFloat(principal_amount),
       outstanding, parseFloat(interest_rate), rate_type || 'fixed',
       parseInt(tenure_months), emi_amount,
       disbursement_date, emi_due_day || 1,
       property_address || null, moratorium_months || 0,
       credit_limit ? parseFloat(credit_limit) : null,
       minimum_due ? parseFloat(minimum_due) : null,
       payment_due_date || null]
    )
    await conn.commit()
    return reply.code(201).send({ id: assetId, emi_amount })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ── Get ───────────────────────────────────────────────────────────────────────

async function loanGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT a.id, a.asset_name, a.notes, a.family_member_id, a.current_value,
            l.loan_type, l.lender, l.loan_account_number, l.principal_amount,
            l.outstanding_amount, l.interest_rate, l.rate_type, l.tenure_months,
            l.emi_amount, l.disbursement_date, l.emi_due_day,
            l.property_address, l.moratorium_months,
            l.credit_limit, l.minimum_due, l.payment_due_date
     FROM assets a JOIN loans l ON l.asset_id = a.id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Loan not found' })
  return parseLoan(row)
}

// ── Update ────────────────────────────────────────────────────────────────────

async function loanUpdate(request, reply) {
  const db = request.server.db
  const { id } = request.params
  const {
    loan_type, lender, loan_account_number, principal_amount, outstanding_amount,
    interest_rate, rate_type, tenure_months, disbursement_date, emi_due_day,
    property_address, moratorium_months, credit_limit, minimum_due, payment_due_date,
    notes, family_member_id,
  } = request.body

  const existing = await queryOne(db, 'SELECT id FROM assets WHERE id=? AND user_id=? AND is_active=1', [id, request.user.id])
  if (!existing) return reply.code(404).send({ message: 'Loan not found' })

  const emi_amount = loan_type !== 'credit_card'
    ? calcEMI(outstanding_amount ?? principal_amount, interest_rate, tenure_months)
    : null

  const asset_name = `${loan_type.charAt(0).toUpperCase() + loan_type.slice(1).replace('_', ' ')} — ${lender}`
  const outstanding = parseFloat(outstanding_amount ?? principal_amount)

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, current_value=?, invested_amount=?, notes=?, family_member_id=? WHERE id=?`,
      [asset_name, -outstanding, parseFloat(principal_amount), notes || null, family_member_id || null, id]
    )
    await conn.execute(
      `UPDATE loans SET lender=?, loan_account_number=?, principal_amount=?, outstanding_amount=?,
       interest_rate=?, rate_type=?, tenure_months=?, emi_amount=?, disbursement_date=?, emi_due_day=?,
       property_address=?, moratorium_months=?, credit_limit=?, minimum_due=?, payment_due_date=?
       WHERE asset_id=?`,
      [lender, loan_account_number || null, parseFloat(principal_amount),
       outstanding, parseFloat(interest_rate), rate_type || 'fixed',
       parseInt(tenure_months), emi_amount, disbursement_date, emi_due_day || 1,
       property_address || null, moratorium_months || 0,
       credit_limit ? parseFloat(credit_limit) : null,
       minimum_due ? parseFloat(minimum_due) : null,
       payment_due_date || null, id]
    )
    await conn.commit()
    return { id: parseInt(id), emi_amount }
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function loanDelete(request, reply) {
  const db = request.server.db
  const result = await insert(db,
    'UPDATE assets SET is_active=0 WHERE id=? AND user_id=?',
    [request.params.id, request.user.id]
  )
  if (result.affectedRows === 0) return reply.code(404).send({ message: 'Loan not found' })
  return reply.code(204).send()
}

// ── Amortization schedule ─────────────────────────────────────────────────────

async function loanAmortization(request, reply) {
  const db = request.server.db
  const row = await queryOne(db,
    `SELECT l.outstanding_amount, l.interest_rate, l.tenure_months, l.emi_amount, l.disbursement_date
     FROM loans l JOIN assets a ON a.id = l.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Loan not found' })

  const schedule = generateAmortization(
    row.outstanding_amount,
    row.interest_rate,
    row.tenure_months,
    row.disbursement_date,
    row.emi_amount,
  )
  const totalInterest = schedule.reduce((s, r) => s + r.interest, 0)
  return {
    schedule,
    summary: {
      total_months: schedule.length,
      total_interest: Math.round(totalInterest * 100) / 100,
      total_payment: Math.round((parseFloat(row.outstanding_amount) + totalInterest) * 100) / 100,
    },
  }
}

// ── Prepayment simulator ──────────────────────────────────────────────────────

async function prepaymentSimulator(request, reply) {
  const db = request.server.db
  const prepaymentAmount = parseFloat(request.query.amount)
  if (!prepaymentAmount || prepaymentAmount <= 0) {
    return reply.code(400).send({ message: 'amount query param must be a positive number' })
  }

  const row = await queryOne(db,
    `SELECT l.outstanding_amount, l.interest_rate, l.tenure_months, l.emi_amount
     FROM loans l JOIN assets a ON a.id = l.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Loan not found' })

  return calcPrepaymentSavings(
    row.outstanding_amount,
    row.interest_rate,
    row.tenure_months,
    row.emi_amount,
    prepaymentAmount,
  )
}

// ── Transactions ──────────────────────────────────────────────────────────────

async function txnList(request, reply) {
  const db = request.server.db
  const ownership = await queryOne(db,
    'SELECT a.id FROM assets a JOIN loans l ON l.asset_id = a.id WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1',
    [request.params.id, request.user.id]
  )
  if (!ownership) return reply.code(404).send({ message: 'Loan not found' })

  const rows = await query(db,
    `SELECT id, txn_date, txn_type, amount, principal_part, interest_part, new_rate, notes
     FROM loan_transactions WHERE loan_id = ? ORDER BY txn_date DESC`,
    [request.params.id]
  )
  return rows.map((r) => ({
    ...r,
    txn_date: fmtDate(r.txn_date),
    amount: parseFloat(r.amount),
    principal_part: r.principal_part ? parseFloat(r.principal_part) : null,
    interest_part: r.interest_part ? parseFloat(r.interest_part) : null,
  }))
}

async function txnCreate(request, reply) {
  const db = request.server.db
  const { txn_date, txn_type, amount, principal_part, interest_part, new_rate, notes } = request.body

  const loanRow = await queryOne(db,
    `SELECT l.id, l.outstanding_amount, l.interest_rate FROM loans l
     JOIN assets a ON a.id = l.asset_id
     WHERE a.id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!loanRow) return reply.code(404).send({ message: 'Loan not found' })

  const conn = await db.getConnection()
  try {
    await conn.beginTransaction()
    const [res] = await conn.execute(
      `INSERT INTO loan_transactions (loan_id, txn_date, txn_type, amount, principal_part, interest_part, new_rate, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [loanRow.id, txn_date, txn_type, parseFloat(amount),
       principal_part ? parseFloat(principal_part) : null,
       interest_part ? parseFloat(interest_part) : null,
       new_rate ? parseFloat(new_rate) : null,
       notes || null]
    )

    // Update outstanding balance for EMI / prepayment / partial_closure
    if (['emi', 'prepayment', 'partial_closure'].includes(txn_type)) {
      const reduction = principal_part ? parseFloat(principal_part) : parseFloat(amount)
      const newOutstanding = Math.max(0, parseFloat(loanRow.outstanding_amount) - reduction)
      await conn.execute(
        `UPDATE loans SET outstanding_amount=? WHERE id=?`,
        [newOutstanding, loanRow.id]
      )
      await conn.execute(
        `UPDATE assets SET current_value=? WHERE id=?`,
        [-newOutstanding, request.params.id]
      )
    }

    if (txn_type === 'rate_change' && new_rate) {
      await conn.execute(
        `UPDATE loans SET interest_rate=? WHERE id=?`,
        [parseFloat(new_rate), loanRow.id]
      )
    }

    await conn.commit()
    return reply.code(201).send({ id: res.insertId })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

module.exports = {
  loanList, loanCreate, loanGet, loanUpdate, loanDelete,
  loanAmortization, prepaymentSimulator,
  txnList, txnCreate,
}
