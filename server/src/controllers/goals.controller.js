const { query, queryOne, insert } = require('../models/db')
const { projectGoal } = require('../finance/goalProjection')

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : d
}

async function getLinkedValue(db, goalId) {
  const rows = await query(
    db,
    `SELECT COALESCE(SUM(a.current_value), 0) AS total
     FROM goal_assets ga JOIN assets a ON a.id = ga.asset_id
     WHERE ga.goal_id = ? AND a.is_active = 1`,
    [goalId]
  )
  return parseFloat(rows[0]?.total ?? 0)
}

async function formatGoal(db, row) {
  const currentValue = await getLinkedValue(db, row.id)
  const projection = projectGoal(row, currentValue)
  return {
    id:             row.id,
    name:           row.name,
    goal_type:      row.goal_type,
    target_amount:  parseFloat(row.target_amount),
    target_date:    fmtDate(row.target_date),
    assumed_return: parseFloat(row.assumed_return),
    notes:          row.notes,
    created_at:     row.created_at,
    ...projection,
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

async function goalList(request, reply) {
  const db = request.server.db
  const rows = await query(
    db,
    `SELECT * FROM goals WHERE user_id = ? ORDER BY target_date`,
    [request.user.id]
  )
  const goals = await Promise.all(rows.map(r => formatGoal(db, r)))
  return goals
}

// ── Get ───────────────────────────────────────────────────────────────────────

async function goalGet(request, reply) {
  const db = request.server.db
  const row = await queryOne(
    db,
    `SELECT * FROM goals WHERE id = ? AND user_id = ?`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ error: 'Goal not found' })

  const linkedAssets = await query(
    db,
    `SELECT a.id, a.asset_name, a.asset_type, a.current_value
     FROM goal_assets ga JOIN assets a ON a.id = ga.asset_id
     WHERE ga.goal_id = ? AND a.is_active = 1`,
    [row.id]
  )

  const currentValue = linkedAssets.reduce((s, a) => s + parseFloat(a.current_value), 0)
  const projection = projectGoal(row, currentValue)

  return {
    id:             row.id,
    name:           row.name,
    goal_type:      row.goal_type,
    target_amount:  parseFloat(row.target_amount),
    target_date:    fmtDate(row.target_date),
    assumed_return: parseFloat(row.assumed_return),
    notes:          row.notes,
    created_at:     row.created_at,
    linked_assets:  linkedAssets.map(a => ({
      ...a,
      current_value: parseFloat(a.current_value),
    })),
    ...projection,
  }
}

// ── Create ────────────────────────────────────────────────────────────────────

async function goalCreate(request, reply) {
  const db = request.server.db
  const { name, goal_type, target_amount, target_date, assumed_return = 12, notes } = request.body

  const result = await insert(
    db,
    `INSERT INTO goals (user_id, name, goal_type, target_amount, target_date, assumed_return, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [request.user.id, name, goal_type, target_amount, target_date, assumed_return, notes ?? null]
  )

  const row = await queryOne(db, `SELECT * FROM goals WHERE id = ?`, [result.insertId])
  return reply.code(201).send(await formatGoal(db, row))
}

// ── Update ────────────────────────────────────────────────────────────────────

async function goalUpdate(request, reply) {
  const db = request.server.db
  const existing = await queryOne(
    db,
    `SELECT id FROM goals WHERE id = ? AND user_id = ?`,
    [request.params.id, request.user.id]
  )
  if (!existing) return reply.code(404).send({ error: 'Goal not found' })

  const { name, goal_type, target_amount, target_date, assumed_return, notes } = request.body
  await query(
    db,
    `UPDATE goals SET name=?, goal_type=?, target_amount=?, target_date=?, assumed_return=?, notes=?
     WHERE id=?`,
    [name, goal_type, target_amount, target_date, assumed_return ?? 12, notes ?? null, request.params.id]
  )

  const row = await queryOne(db, `SELECT * FROM goals WHERE id = ?`, [request.params.id])
  return formatGoal(db, row)
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function goalDelete(request, reply) {
  const db = request.server.db
  const existing = await queryOne(
    db,
    `SELECT id FROM goals WHERE id = ? AND user_id = ?`,
    [request.params.id, request.user.id]
  )
  if (!existing) return reply.code(404).send({ error: 'Goal not found' })
  await query(db, `DELETE FROM goals WHERE id = ?`, [request.params.id])
  return { success: true }
}

// ── Link / Unlink Assets ──────────────────────────────────────────────────────

async function goalLinkAsset(request, reply) {
  const db = request.server.db
  const goal = await queryOne(
    db,
    `SELECT id FROM goals WHERE id = ? AND user_id = ?`,
    [request.params.id, request.user.id]
  )
  if (!goal) return reply.code(404).send({ error: 'Goal not found' })

  const asset = await queryOne(
    db,
    `SELECT id FROM assets WHERE id = ? AND user_id = ? AND is_active = 1`,
    [request.body.asset_id, request.user.id]
  )
  if (!asset) return reply.code(404).send({ error: 'Asset not found' })

  await query(
    db,
    `INSERT IGNORE INTO goal_assets (goal_id, asset_id) VALUES (?, ?)`,
    [request.params.id, request.body.asset_id]
  )
  return reply.code(201).send({ success: true })
}

async function goalUnlinkAsset(request, reply) {
  const db = request.server.db
  const goal = await queryOne(
    db,
    `SELECT id FROM goals WHERE id = ? AND user_id = ?`,
    [request.params.id, request.user.id]
  )
  if (!goal) return reply.code(404).send({ error: 'Goal not found' })
  await query(
    db,
    `DELETE FROM goal_assets WHERE goal_id = ? AND asset_id = ?`,
    [request.params.id, request.params.assetId]
  )
  return { success: true }
}

// ── Projection ────────────────────────────────────────────────────────────────

async function goalProjection(request, reply) {
  const db = request.server.db
  const row = await queryOne(
    db,
    `SELECT * FROM goals WHERE id = ? AND user_id = ?`,
    [request.params.id, request.user.id]
  )
  if (!row) return reply.code(404).send({ error: 'Goal not found' })
  const currentValue = await getLinkedValue(db, row.id)
  return projectGoal(row, currentValue)
}

module.exports = {
  goalList,
  goalGet,
  goalCreate,
  goalUpdate,
  goalDelete,
  goalLinkAsset,
  goalUnlinkAsset,
  goalProjection,
}
