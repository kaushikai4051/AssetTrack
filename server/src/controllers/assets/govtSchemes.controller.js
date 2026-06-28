const { query, insert } = require('../../models/db')
const { familyFilter } = require('../../utils/familyFilter')
const {
  calcNSCMaturity, calcKVPMaturity, calcPOTDMaturity, calcPORDMaturity,
  defaultMaturityDate,
} = require('../../finance/govtSchemes')

// Map scheme_type → asset_type ENUM value in the assets table
function toAssetType(schemeType) {
  if (['po_td', 'po_mis', 'po_rd'].includes(schemeType)) return 'post_office'
  return schemeType // ppf, nps, epf, nsc, ssy, scss, kvp → same value
}

// How each tx_type shifts invested_amount and current_value
function txDelta(tx_type, amount) {
  const amt = Number(amount)
  if (tx_type === 'deposit' || tx_type === 'employer_contribution') return { invested: amt, value: amt }
  if (tx_type === 'interest')    return { invested: 0, value:  amt }
  if (tx_type === 'withdrawal')  return { invested: 0, value: -amt }
  return { invested: 0, value: 0 }
}

// Estimate maturity_amount at creation time for predictable schemes
function estimateMaturity(body) {
  const principal = Number(body.invested_amount || 0)
  const rate      = Number(body.interest_rate || 0)
  const type      = body.scheme_type

  if (!principal || !rate) return null
  try {
    if (type === 'nsc')    return calcNSCMaturity(principal, rate, 5)
    if (type === 'kvp')    return calcKVPMaturity(principal)
    if (type === 'scss')   return principal // quarterly payout; principal returned at maturity
    if (type === 'po_td') {
      const years = body.tenure_years || 5
      return calcPOTDMaturity(principal, rate, years)
    }
    if (type === 'po_rd') {
      const months = body.tenure_months || 60
      return calcPORDMaturity(principal / (body.tenure_months || 60), rate, months)
    }
  } catch { /* ignore */ }
  return null
}

// ── List ────────────────────────────────────────────────────────────────────

async function list(request) {
  const ff = familyFilter(request)
  const rows = await query(request.server.db,
    `SELECT gsh.*, a.current_value, a.invested_amount, a.notes
     FROM govt_scheme_holdings gsh
     JOIN assets a ON a.id = gsh.asset_id
     WHERE a.user_id = ? AND a.is_active = 1${ff.sql}
     ORDER BY gsh.scheme_type, a.created_at DESC`,
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

// ── Create ───────────────────────────────────────────────────────────────────

async function create(request, reply) {
  const b = request.body
  const invested    = Number(b.invested_amount || 0)
  const currentVal  = Number(b.current_value || b.invested_amount || 0)
  const maturityAmt = b.maturity_amount != null ? Number(b.maturity_amount) : estimateMaturity(b)
  const maturityDate = b.maturity_date || defaultMaturityDate(b.scheme_type, b.start_date)

  const schemeName = b.name || (b.account_number
    ? `${b.scheme_type.toUpperCase()} ${b.account_number}`
    : b.scheme_type.toUpperCase())

  const conn = await request.server.db.getConnection()
  try {
    await conn.beginTransaction()

    const [assetRes] = await conn.execute(
      `INSERT INTO assets (user_id, asset_type, asset_name, invested_amount, current_value, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [request.user.id, toAssetType(b.scheme_type), schemeName, invested, currentVal, b.notes || null]
    )
    const assetId = assetRes.insertId

    await conn.execute(
      `INSERT INTO govt_scheme_holdings
         (asset_id, scheme_type, account_number, institution, start_date, maturity_date,
          maturity_amount, interest_rate, nominee,
          pran, nps_account_type, fund_manager,
          uan, employee_share, employer_share, eps_balance,
          beneficiary_name, beneficiary_dob,
          maturity_period_months)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        assetId, b.scheme_type,
        b.account_number || null, b.institution || null,
        b.start_date || null, maturityDate || null,
        maturityAmt || null, b.interest_rate || null, b.nominee || null,
        b.pran || null, b.nps_account_type || null, b.fund_manager || null,
        b.uan || null,
        b.employee_share != null ? Number(b.employee_share) : null,
        b.employer_share != null ? Number(b.employer_share) : null,
        b.eps_balance != null ? Number(b.eps_balance) : null,
        b.beneficiary_name || null, b.beneficiary_dob || null,
        b.maturity_period_months || null,
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

// ── Get ──────────────────────────────────────────────────────────────────────

async function get(request, reply) {
  const [row] = await query(request.server.db,
    `SELECT gsh.*, a.current_value, a.invested_amount, a.notes
     FROM govt_scheme_holdings gsh
     JOIN assets a ON a.id = gsh.asset_id
     WHERE gsh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Not found' })
  return row
}

// ── Update ───────────────────────────────────────────────────────────────────

async function update(request, reply) {
  const b = request.body
  const [row] = await query(request.server.db,
    `SELECT gsh.id FROM govt_scheme_holdings gsh
     JOIN assets a ON a.id = gsh.asset_id
     WHERE gsh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Not found' })

  const invested   = Number(b.invested_amount || 0)
  const currentVal = Number(b.current_value || b.invested_amount || 0)

  const conn = await request.server.db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `UPDATE assets SET asset_name=?, invested_amount=?, current_value=?, notes=? WHERE id=?`,
      [b.name || b.scheme_type.toUpperCase(), invested, currentVal, b.notes || null, request.params.id]
    )
    await conn.execute(
      `UPDATE govt_scheme_holdings SET
         account_number=?, institution=?, start_date=?, maturity_date=?,
         maturity_amount=?, interest_rate=?, nominee=?,
         pran=?, nps_account_type=?, fund_manager=?,
         uan=?, employee_share=?, employer_share=?, eps_balance=?,
         beneficiary_name=?, beneficiary_dob=?, maturity_period_months=?
       WHERE asset_id=?`,
      [
        b.account_number || null, b.institution || null,
        b.start_date || null, b.maturity_date || null,
        b.maturity_amount || null, b.interest_rate || null, b.nominee || null,
        b.pran || null, b.nps_account_type || null, b.fund_manager || null,
        b.uan || null,
        b.employee_share != null ? Number(b.employee_share) : null,
        b.employer_share != null ? Number(b.employer_share) : null,
        b.eps_balance != null ? Number(b.eps_balance) : null,
        b.beneficiary_name || null, b.beneficiary_dob || null,
        b.maturity_period_months || null,
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

// ── Delete ───────────────────────────────────────────────────────────────────

async function remove(request, reply) {
  const [row] = await query(request.server.db,
    `SELECT gsh.asset_id FROM govt_scheme_holdings gsh
     JOIN assets a ON a.id = gsh.asset_id
     WHERE gsh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ message: 'Not found' })
  await insert(request.server.db,
    `UPDATE assets SET is_active = 0 WHERE id = ?`, [request.params.id]
  )
  return { success: true }
}

// ── Transactions ─────────────────────────────────────────────────────────────

async function listTransactions(request, reply) {
  const [holding] = await query(request.server.db,
    `SELECT gsh.id FROM govt_scheme_holdings gsh
     JOIN assets a ON a.id = gsh.asset_id
     WHERE gsh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!holding) return reply.code(404).send({ message: 'Not found' })
  return query(request.server.db,
    `SELECT * FROM govt_scheme_transactions WHERE holding_id = ? ORDER BY tx_date DESC`,
    [holding.id]
  )
}

async function addTransaction(request, reply) {
  const { tx_date, tx_type, amount, description } = request.body
  const [holding] = await query(request.server.db,
    `SELECT gsh.id, gsh.asset_id FROM govt_scheme_holdings gsh
     JOIN assets a ON a.id = gsh.asset_id
     WHERE gsh.asset_id = ? AND a.user_id = ? AND a.is_active = 1`,
    [request.params.id, request.user.id]
  )
  if (!holding) return reply.code(404).send({ message: 'Not found' })

  const delta = txDelta(tx_type, amount)
  const conn  = await request.server.db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(
      `INSERT INTO govt_scheme_transactions (holding_id, tx_date, tx_type, amount, description)
       VALUES (?, ?, ?, ?, ?)`,
      [holding.id, tx_date, tx_type, Number(amount), description || null]
    )
    await conn.execute(
      `UPDATE assets SET invested_amount = invested_amount + ?, current_value = current_value + ? WHERE id = ?`,
      [delta.invested, delta.value, holding.asset_id]
    )
    await conn.commit()
    return reply.code(201).send({ success: true })
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

async function deleteTransaction(request, reply) {
  const [tx] = await query(request.server.db,
    `SELECT t.id, t.tx_type, t.amount, gsh.asset_id FROM govt_scheme_transactions t
     JOIN govt_scheme_holdings gsh ON gsh.id = t.holding_id
     JOIN assets a ON a.id = gsh.asset_id
     WHERE t.id = ? AND a.user_id = ?`,
    [request.params.txId, request.user.id]
  )
  if (!tx) return reply.code(404).send({ message: 'Not found' })

  const delta = txDelta(tx.tx_type, tx.amount)
  const conn  = await request.server.db.getConnection()
  try {
    await conn.beginTransaction()
    await conn.execute(`DELETE FROM govt_scheme_transactions WHERE id = ?`, [tx.id])
    // Reverse the delta that was applied when this transaction was added
    await conn.execute(
      `UPDATE assets SET invested_amount = invested_amount - ?, current_value = current_value - ? WHERE id = ?`,
      [delta.invested, delta.value, tx.asset_id]
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

module.exports = { list, create, get, update, remove, listTransactions, addTransaction, deleteTransaction }
