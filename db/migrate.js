// Usage: node db/migrate.js
// Runs all pending SQL migrations in order against the configured DB.
// Reads DB credentials from server/.env

require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') })
const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

async function run() {
  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    })

    console.log('Connected to MySQL.')

    // Run each .sql file in order
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
      console.log(`Running ${file}...`)
      await conn.query(sql)
      console.log(`  ✓ ${file}`)
    }

    console.log('\nAll migrations applied successfully.')
  } catch (err) {
    console.error('\nMigration failed:', err.message)
    process.exit(1)
  } finally {
    if (conn) await conn.end()
  }
}

run()
