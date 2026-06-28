const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')
const { query, queryOne, insert } = require('../models/db')

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// POST /documents  (multipart)
async function upload(request, reply) {
  const userId = request.user.id
  const { asset_type, asset_id, expires_at } = request.query || {}

  const file = await request.file({ limits: { fileSize: MAX_BYTES + 1 } })
  if (!file) return reply.status(400).send({ message: 'No file uploaded' })

  if (!ALLOWED_TYPES.has(file.mimetype)) {
    file.file.resume()
    return reply.status(400).send({ message: 'Only PDF, JPG, and PNG files are allowed' })
  }

  const chunks = []
  for await (const chunk of file.file) chunks.push(chunk)
  const buffer = Buffer.concat(chunks)

  if (buffer.length > MAX_BYTES) {
    return reply.status(400).send({ message: 'File exceeds the 10 MB limit' })
  }

  const ext = path.extname(file.filename) || ''
  const storedName = `${randomUUID()}${ext}`
  fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer)

  const result = await insert(request.server.db,
    `INSERT INTO documents (user_id, asset_type, asset_id, file_name, stored_name, mime_type, size_bytes, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      asset_type || null,
      asset_id ? parseInt(asset_id) : null,
      file.filename,
      storedName,
      file.mimetype,
      buffer.length,
      expires_at || null,
    ]
  )

  return reply.status(201).send({
    id: result.insertId,
    file_name: file.filename,
    mime_type: file.mimetype,
    size_bytes: buffer.length,
    expires_at: expires_at || null,
  })
}

// GET /documents?asset_type=&asset_id=
async function list(request, reply) {
  const userId = request.user.id
  const { asset_type, asset_id } = request.query || {}

  let sql = `SELECT id, asset_type, asset_id, file_name, mime_type, size_bytes, expires_at, created_at
             FROM documents WHERE user_id = ?`
  const params = [userId]

  if (asset_type) { sql += ' AND asset_type = ?'; params.push(asset_type) }
  if (asset_id)   { sql += ' AND asset_id = ?';   params.push(parseInt(asset_id)) }

  sql += ' ORDER BY created_at DESC'

  const rows = await query(request.server.db, sql, params)
  return rows.map((r) => ({
    ...r,
    size_bytes: Number(r.size_bytes),
    expires_at: r.expires_at ? String(r.expires_at).slice(0, 10) : null,
  }))
}

// GET /documents/:id/download
async function download(request, reply) {
  const userId = request.user.id
  const { id } = request.params

  const doc = await queryOne(request.server.db,
    'SELECT file_name, stored_name, mime_type FROM documents WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  if (!doc) return reply.status(404).send({ message: 'Document not found' })

  const filePath = path.join(UPLOADS_DIR, doc.stored_name)
  if (!fs.existsSync(filePath)) return reply.status(404).send({ message: 'File not found on disk' })

  return reply
    .header('Content-Disposition', `attachment; filename="${doc.file_name}"`)
    .header('Content-Type', doc.mime_type)
    .send(fs.createReadStream(filePath))
}

// DELETE /documents/:id
async function remove(request, reply) {
  const userId = request.user.id
  const { id } = request.params

  const doc = await queryOne(request.server.db,
    'SELECT stored_name FROM documents WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  if (!doc) return reply.status(404).send({ message: 'Document not found' })

  const filePath = path.join(UPLOADS_DIR, doc.stored_name)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

  await request.server.db.execute(
    'DELETE FROM documents WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  return { message: 'Document deleted' }
}

module.exports = { upload, list, download, remove }
