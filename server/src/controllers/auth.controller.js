const bcrypt = require('bcrypt')
const crypto = require('crypto')
const { queryOne, insert } = require('../models/db')
const config = require('../config')

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days

const COOKIE_OPTS = {
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict',
  path: '/',
  maxAge: REFRESH_TTL_SECONDS,
}

// ---------- token storage helpers (Redis first, DB fallback) ----------

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function storeRefreshToken(server, token, userId) {
  const hash = hashToken(token)
  if (server.redisAvailable) {
    await server.redis.set(
      `session:refresh:${hash}`,
      JSON.stringify({ userId }),
      'EX', REFRESH_TTL_SECONDS
    )
  } else {
    const expiresAt = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000)
      .toISOString().slice(0, 19).replace('T', ' ')
    await insert(server.db,
      'INSERT INTO refresh_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
      [hash, userId, expiresAt]
    )
  }
}

async function lookupRefreshToken(server, token) {
  const hash = hashToken(token)
  if (server.redisAvailable) {
    const raw = await server.redis.get(`session:refresh:${hash}`)
    return raw ? JSON.parse(raw) : null
  }
  return queryOne(server.db,
    'SELECT user_id AS userId FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
    [hash]
  )
}

async function deleteRefreshToken(server, token) {
  const hash = hashToken(token)
  if (server.redisAvailable) {
    await server.redis.del(`session:refresh:${hash}`)
  } else {
    await server.db.execute(
      'DELETE FROM refresh_tokens WHERE token_hash = ?',
      [hash]
    )
  }
}

// ---------- route handlers ----------

async function register(request, reply) {
  const { full_name, email, password } = request.body || {}

  if (!full_name || !email || !password) {
    return reply.status(400).send({ message: 'full_name, email and password are required' })
  }
  if (password.length < 8) {
    return reply.status(400).send({ message: 'Password must be at least 8 characters' })
  }

  const existing = await queryOne(request.server.db,
    'SELECT id FROM users WHERE email = ?', [email]
  )
  if (existing) return reply.status(409).send({ message: 'Email already registered' })

  const hash = await bcrypt.hash(password, 12)
  const result = await insert(request.server.db,
    'INSERT INTO users (email, password_hash, is_verified) VALUES (?, ?, 1)',
    [email, hash]
  )
  const userId = result.insertId

  await insert(request.server.db,
    'INSERT INTO user_profiles (user_id, full_name) VALUES (?, ?)',
    [userId, full_name]
  )

  const user = { id: userId, email, full_name }
  const accessToken = request.server.jwt.sign(
    { id: userId, email },
    { expiresIn: config.jwt.accessExpiry }
  )
  const refreshToken = crypto.randomBytes(40).toString('hex')
  await storeRefreshToken(request.server, refreshToken, userId)

  reply.setCookie('refreshToken', refreshToken, COOKIE_OPTS)
  return reply.status(201).send({ user, accessToken })
}

async function login(request, reply) {
  const { email, password } = request.body || {}

  if (!email || !password) {
    return reply.status(400).send({ message: 'email and password are required' })
  }

  const row = await queryOne(request.server.db,
    `SELECT u.id, u.email, u.password_hash, p.full_name
     FROM users u
     JOIN user_profiles p ON p.user_id = u.id
     WHERE u.email = ? AND u.is_active = 1`,
    [email]
  )

  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return reply.status(401).send({ message: 'Invalid email or password' })
  }

  const user = { id: row.id, email: row.email, full_name: row.full_name }
  const accessToken = request.server.jwt.sign(
    { id: row.id, email: row.email },
    { expiresIn: config.jwt.accessExpiry }
  )
  const refreshToken = crypto.randomBytes(40).toString('hex')
  await storeRefreshToken(request.server, refreshToken, row.id)

  reply.setCookie('refreshToken', refreshToken, COOKIE_OPTS)
  return { user, accessToken }
}

async function logout(request, reply) {
  const token = request.cookies?.refreshToken
  if (token) await deleteRefreshToken(request.server, token).catch(() => {})
  reply.clearCookie('refreshToken', { path: '/' })
  return { message: 'Logged out' }
}

async function refresh(request, reply) {
  const token = request.cookies?.refreshToken
  if (!token) return reply.status(401).send({ message: 'No refresh token' })

  const session = await lookupRefreshToken(request.server, token)
  if (!session) return reply.status(401).send({ message: 'Session expired — please log in again' })

  const row = await queryOne(request.server.db,
    'SELECT id, email FROM users WHERE id = ? AND is_active = 1',
    [session.userId]
  )
  if (!row) return reply.status(401).send({ message: 'User not found' })

  // Rotate: delete old, issue new
  await deleteRefreshToken(request.server, token)
  const newRefreshToken = crypto.randomBytes(40).toString('hex')
  await storeRefreshToken(request.server, newRefreshToken, row.id)

  const accessToken = request.server.jwt.sign(
    { id: row.id, email: row.email },
    { expiresIn: config.jwt.accessExpiry }
  )
  reply.setCookie('refreshToken', newRefreshToken, COOKIE_OPTS)
  return { accessToken }
}

async function me(request, reply) {
  const row = await queryOne(request.server.db,
    `SELECT u.id, u.email, u.created_at,
            p.full_name, p.dob, p.risk_profile, p.pan, p.base_currency
     FROM users u
     JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [request.user.id]
  )
  if (!row) return reply.status(404).send({ message: 'User not found' })
  // Mask PAN: show first 5 + last 1, hide middle 4
  if (row.pan) row.pan_masked = row.pan.slice(0, 5) + '****' + row.pan.slice(-1)
  return row
}

async function updateProfile(request, reply) {
  const userId = request.user.id
  const { full_name, dob, risk_profile, pan, base_currency } = request.body || {}

  if (!full_name || full_name.trim().length < 2) {
    return reply.status(400).send({ message: 'Full name is required' })
  }

  await request.server.db.execute(
    `UPDATE user_profiles
     SET full_name = ?, dob = ?, risk_profile = ?, pan = ?, base_currency = ?
     WHERE user_id = ?`,
    [
      full_name.trim(),
      dob || null,
      risk_profile || null,
      pan ? pan.toUpperCase().trim() : null,
      base_currency || 'INR',
      userId,
    ]
  )

  const updated = await queryOne(request.server.db,
    `SELECT u.id, u.email, p.full_name, p.dob, p.risk_profile, p.base_currency
     FROM users u JOIN user_profiles p ON p.user_id = u.id WHERE u.id = ?`,
    [userId]
  )
  return { message: 'Profile updated', user: updated }
}

async function changePassword(request, reply) {
  const userId = request.user.id
  const { current_password, new_password } = request.body || {}

  if (!current_password || !new_password) {
    return reply.status(400).send({ message: 'current_password and new_password are required' })
  }
  if (new_password.length < 8) {
    return reply.status(400).send({ message: 'New password must be at least 8 characters' })
  }

  const row = await queryOne(request.server.db,
    'SELECT password_hash FROM users WHERE id = ?', [userId]
  )
  if (!row) return reply.status(404).send({ message: 'User not found' })

  const match = await bcrypt.compare(current_password, row.password_hash)
  if (!match) return reply.status(400).send({ message: 'Current password is incorrect' })

  const newHash = await bcrypt.hash(new_password, 12)
  await request.server.db.execute(
    'UPDATE users SET password_hash = ? WHERE id = ?', [newHash, userId]
  )
  return { message: 'Password changed successfully' }
}

module.exports = { register, login, logout, refresh, me, updateProfile, changePassword }
