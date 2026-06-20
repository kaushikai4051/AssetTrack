const fp = require('fastify-plugin')
const mysql = require('mysql2/promise')
const config = require('../config')

async function dbPlugin(fastify) {
  const pool = mysql.createPool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+05:30',
  })

  try {
    const conn = await pool.getConnection()
    conn.release()
    fastify.log.info('MySQL connected')
  } catch (err) {
    fastify.log.warn({ msg: 'MySQL unavailable — starting without DB', err: err.message })
  }

  fastify.decorate('db', pool)
  fastify.addHook('onClose', async () => pool.end())
}

module.exports = fp(dbPlugin, { name: 'db' })
