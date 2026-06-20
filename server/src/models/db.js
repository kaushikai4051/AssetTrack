async function query(pool, sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

async function queryOne(pool, sql, params = []) {
  const rows = await query(pool, sql, params)
  return rows[0] || null
}

async function insert(pool, sql, params = []) {
  const [result] = await pool.execute(sql, params)
  return result
}

module.exports = { query, queryOne, insert }
