const { query, queryOne, insert } = require('../models/db')

// Asset types that are liabilities — excluded from coverage check
const LIABILITY_TYPES = [
  'home_loan', 'car_loan', 'personal_loan', 'education_loan',
  'lap_loan', 'gold_loan', 'credit_card_debt',
]

// Human-readable asset type labels
const TYPE_LABEL = {
  fixed_deposit: 'Fixed Deposit', recurring_deposit: 'Recurring Deposit',
  savings_account: 'Savings Account', mutual_fund: 'Mutual Fund',
  stock: 'Stock', gold: 'Gold', corporate_bond: 'Corporate Bond',
  gsec_bond: 'G-Sec / T-Bill', tax_free_bond: 'Tax-Free Bond',
  ppf: 'PPF', nps: 'NPS', epf: 'EPF', ssy: 'SSY', nsc: 'NSC',
  scss: 'SCSS', kvp: 'KVP', post_office: 'Post Office',
  life_insurance: 'Life Insurance', health_insurance: 'Health Insurance',
  vehicle_insurance: 'Vehicle Insurance', property: 'Property', reit: 'REIT',
  crypto: 'Crypto', chit_fund: 'Chit Fund', p2p_lending: 'P2P Lending',
  angel_investment: 'Angel Investment', unlisted_shares: 'Unlisted Shares',
}

// GET /nominees/summary
async function summary(request, reply) {
  const userId = request.user.id
  const placeholders = LIABILITY_TYPES.map(() => '?').join(',')

  // All trackable assets (non-liability, active)
  const assets = await query(request.server.db,
    `SELECT a.id, a.asset_name, a.asset_type, a.current_value
     FROM assets a
     WHERE a.user_id = ? AND a.is_active = 1
       AND a.asset_type NOT IN (${placeholders})
     ORDER BY a.current_value DESC`,
    [userId, ...LIABILITY_TYPES]
  )

  // Which asset IDs have at least one nominee
  const coveredRows = await query(request.server.db,
    `SELECT DISTINCT asset_id FROM nominees WHERE user_id = ?`,
    [userId]
  )
  const coveredSet = new Set(coveredRows.map((r) => r.asset_id))

  const total = assets.length
  const covered = assets.filter((a) => coveredSet.has(a.id)).length
  const uncovered = assets
    .filter((a) => !coveredSet.has(a.id))
    .map((a) => ({
      id: a.id,
      asset_name: a.asset_name,
      asset_type: a.asset_type,
      type_label: TYPE_LABEL[a.asset_type] || a.asset_type,
      current_value: Number(a.current_value),
    }))

  return {
    totalAssets: total,
    coveredAssets: covered,
    uncoveredAssets: total - covered,
    coveragePercent: total > 0 ? Math.round((covered / total) * 100) : 0,
    uncovered,
  }
}

// GET /nominees — all assets with their nominees grouped
async function list(request, reply) {
  const userId = request.user.id
  const placeholders = LIABILITY_TYPES.map(() => '?').join(',')

  const assets = await query(request.server.db,
    `SELECT a.id AS asset_id, a.asset_name, a.asset_type, a.current_value
     FROM assets a
     WHERE a.user_id = ? AND a.is_active = 1
       AND a.asset_type NOT IN (${placeholders})
     ORDER BY a.current_value DESC`,
    [userId, ...LIABILITY_TYPES]
  )

  const nominees = await query(request.server.db,
    `SELECT id, asset_id, name, relationship, percentage, phone
     FROM nominees WHERE user_id = ?`,
    [userId]
  )

  // Group nominees by asset_id
  const nomineeMap = {}
  for (const n of nominees) {
    if (!nomineeMap[n.asset_id]) nomineeMap[n.asset_id] = []
    nomineeMap[n.asset_id].push({
      id: n.id,
      name: n.name,
      relationship: n.relationship,
      percentage: Number(n.percentage),
      phone: n.phone || null,
    })
  }

  return assets.map((a) => ({
    asset_id: a.asset_id,
    asset_name: a.asset_name,
    asset_type: a.asset_type,
    type_label: TYPE_LABEL[a.asset_type] || a.asset_type,
    current_value: Number(a.current_value),
    nominees: nomineeMap[a.asset_id] || [],
  }))
}

// POST /nominees
async function create(request, reply) {
  const userId = request.user.id
  const { asset_id, name, relationship, percentage, phone } = request.body || {}

  if (!asset_id || !name || !relationship) {
    return reply.status(400).send({ message: 'asset_id, name and relationship are required' })
  }
  if (percentage != null && (percentage <= 0 || percentage > 100)) {
    return reply.status(400).send({ message: 'percentage must be between 1 and 100' })
  }

  // Verify asset belongs to this user
  const asset = await queryOne(request.server.db,
    'SELECT id FROM assets WHERE id = ? AND user_id = ?',
    [asset_id, userId]
  )
  if (!asset) return reply.status(404).send({ message: 'Asset not found' })

  // Check existing total percentage won't exceed 100
  const existing = await queryOne(request.server.db,
    'SELECT COALESCE(SUM(percentage), 0) AS total FROM nominees WHERE asset_id = ? AND user_id = ?',
    [asset_id, userId]
  )
  const pct = Number(percentage ?? 100)
  if (Number(existing.total) + pct > 100) {
    return reply.status(400).send({ message: `Total nominee percentage would exceed 100% (currently ${existing.total}%)` })
  }

  const result = await insert(request.server.db,
    'INSERT INTO nominees (user_id, asset_id, name, relationship, percentage, phone) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, asset_id, name.trim(), relationship, pct, phone?.trim() || null]
  )
  return reply.status(201).send({ id: result.insertId, message: 'Nominee added' })
}

// PUT /nominees/:id
async function update(request, reply) {
  const userId = request.user.id
  const { id } = request.params
  const { name, relationship, percentage, phone } = request.body || {}

  if (!name || !relationship) {
    return reply.status(400).send({ message: 'name and relationship are required' })
  }

  const existing = await queryOne(request.server.db,
    'SELECT id, asset_id, percentage FROM nominees WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  if (!existing) return reply.status(404).send({ message: 'Nominee not found' })

  const pct = Number(percentage ?? existing.percentage)
  if (pct <= 0 || pct > 100) {
    return reply.status(400).send({ message: 'percentage must be between 1 and 100' })
  }

  // Check total for other nominees on same asset + new pct
  const otherTotal = await queryOne(request.server.db,
    'SELECT COALESCE(SUM(percentage), 0) AS total FROM nominees WHERE asset_id = ? AND user_id = ? AND id != ?',
    [existing.asset_id, userId, id]
  )
  if (Number(otherTotal.total) + pct > 100) {
    return reply.status(400).send({ message: `Total nominee percentage would exceed 100%` })
  }

  await request.server.db.execute(
    'UPDATE nominees SET name = ?, relationship = ?, percentage = ?, phone = ? WHERE id = ? AND user_id = ?',
    [name.trim(), relationship, pct, phone?.trim() || null, id, userId]
  )
  return { message: 'Nominee updated' }
}

// DELETE /nominees/:id
async function remove(request, reply) {
  const userId = request.user.id
  const { id } = request.params

  const existing = await queryOne(request.server.db,
    'SELECT id FROM nominees WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  if (!existing) return reply.status(404).send({ message: 'Nominee not found' })

  await request.server.db.execute(
    'DELETE FROM nominees WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  return { message: 'Nominee removed' }
}

module.exports = { summary, list, create, update, remove }
