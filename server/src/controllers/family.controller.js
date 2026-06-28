const { query, queryOne, insert } = require('../models/db')

const VALID_RELATIONS = ['self', 'spouse', 'child', 'parent', 'sibling', 'other']

// GET /family
async function list(request, reply) {
  const rows = await query(request.server.db,
    `SELECT id, full_name, relation, dob, pan, created_at
     FROM family_members WHERE owner_user_id = ? ORDER BY id`,
    [request.user.id]
  )
  return rows.map((r) => ({
    ...r,
    dob: r.dob ? String(r.dob).slice(0, 10) : null,
  }))
}

// POST /family
async function create(request, reply) {
  const { full_name, relation, dob, pan } = request.body || {}

  if (!full_name?.trim()) return reply.status(400).send({ message: 'full_name is required' })
  if (!VALID_RELATIONS.includes(relation)) {
    return reply.status(400).send({ message: `relation must be one of: ${VALID_RELATIONS.join(', ')}` })
  }

  const result = await insert(request.server.db,
    'INSERT INTO family_members (owner_user_id, full_name, relation, dob, pan) VALUES (?, ?, ?, ?, ?)',
    [request.user.id, full_name.trim(), relation, dob || null, pan?.trim() || null]
  )
  return reply.status(201).send({ id: result.insertId, message: 'Family member added' })
}

// PUT /family/:id
async function update(request, reply) {
  const { id } = request.params
  const { full_name, relation, dob, pan } = request.body || {}

  if (!full_name?.trim()) return reply.status(400).send({ message: 'full_name is required' })
  if (!VALID_RELATIONS.includes(relation)) {
    return reply.status(400).send({ message: `relation must be one of: ${VALID_RELATIONS.join(', ')}` })
  }

  const existing = await queryOne(request.server.db,
    'SELECT id FROM family_members WHERE id = ? AND owner_user_id = ?',
    [id, request.user.id]
  )
  if (!existing) return reply.status(404).send({ message: 'Family member not found' })

  await request.server.db.execute(
    'UPDATE family_members SET full_name = ?, relation = ?, dob = ?, pan = ? WHERE id = ? AND owner_user_id = ?',
    [full_name.trim(), relation, dob || null, pan?.trim() || null, id, request.user.id]
  )
  return { message: 'Family member updated' }
}

// DELETE /family/:id
async function remove(request, reply) {
  const { id } = request.params

  const existing = await queryOne(request.server.db,
    'SELECT id FROM family_members WHERE id = ? AND owner_user_id = ?',
    [id, request.user.id]
  )
  if (!existing) return reply.status(404).send({ message: 'Family member not found' })

  await request.server.db.execute(
    'DELETE FROM family_members WHERE id = ? AND owner_user_id = ?',
    [id, request.user.id]
  )
  return { message: 'Family member removed' }
}

module.exports = { list, create, update, remove }
