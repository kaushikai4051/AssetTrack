# ADR-008 — MySQL → PostgreSQL Migration Plan

**Status:** Planned (not started)  
**Date drafted:** 2026-06-26  
**Scope:** Full migration of the AssetTrack database from MySQL 8.x to PostgreSQL 16.x

---

## Why migrate

| Capability | MySQL | PostgreSQL |
|---|---|---|
| JSONB columns (future portfolio snapshots) | Limited JSON | Native JSONB with indexing |
| Window functions (XIRR, rolling returns) | Basic | Full SQL:2011 support |
| Full-text search (fund name search) | MyISAM-era | `tsvector` / GIN indexes |
| Partial indexes | No | Yes |
| Advisory locks (cron job safety) | No | Yes |
| `CHECK` constraints enforced | 8.0+ only | Always |
| Array columns (future bulk NAV storage) | No | Native |
| Community & cloud support | Good | Excellent (AWS RDS, Supabase, Neon) |

---

## Phase 0 — Pre-migration audit (do before anything else)

1. Run `mysqldump --no-data assetmgmt > schema_dump.sql` — capture current schema as baseline.
2. List every raw SQL string in `server/src/` that uses MySQL-specific syntax (see catalogue below).
3. Confirm PostgreSQL target version: **PostgreSQL 16** (LTS).
4. Decide hosting: local dev stays Docker; prod candidates are **Supabase** (managed) or **AWS RDS for PostgreSQL**.
5. Snapshot production data before any work begins.

---

## Phase 1 — Schema conversion (14 migration files)

### 1.1 Global find-and-replace rules across all `.sql` files

| MySQL | PostgreSQL | Notes |
|---|---|---|
| `USE assetmgmt;` | *(remove)* | Connect with `--dbname` flag instead |
| `ENGINE=InnoDB` | *(remove)* | PG has no storage engine concept |
| `AUTO_INCREMENT` | `GENERATED ALWAYS AS IDENTITY` | Or use `SERIAL` (older style) |
| `INT UNSIGNED` | `INTEGER` + `CHECK (col >= 0)` | PG has no unsigned integers |
| `TINYINT(1)` | `BOOLEAN` | Use `TRUE`/`FALSE` literals |
| `DATETIME` | `TIMESTAMP` | No `DATETIME` type in PG |
| `ENUM('a','b')` | `TEXT CHECK (col IN ('a','b'))` | Or create a named PG ENUM type |
| `DECIMAL(p,s)` | `NUMERIC(p,s)` | Identical behaviour, just rename |
| `VARCHAR(n)` | `VARCHAR(n)` | Compatible — no change needed |
| `ON UPDATE CURRENT_TIMESTAMP` | *(replace with trigger)* | See trigger template below |
| `INDEX idx_name (col)` | `CREATE INDEX idx_name ON table(col)` | Move outside `CREATE TABLE` block |
| `UNSIGNED` in FOREIGN KEY | `INTEGER` | Match the referenced column type |
| backtick identifiers `` `col` `` | `"col"` or unquoted | Only quote reserved words |

### 1.2 `ON UPDATE CURRENT_TIMESTAMP` trigger template

```sql
-- Reusable trigger function (create once)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to each table that had ON UPDATE CURRENT_TIMESTAMP
CREATE TRIGGER trg_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
-- Repeat for: users, mutual_funds, loans, etc.
```

### 1.3 Table-by-table notes

| Migration file | MySQL-specific issues |
|---|---|
| `001_create_users.sql` | `TINYINT(1)` on `is_active`, `is_email_verified`; `DATETIME` on timestamps |
| `002_create_assets_base.sql` | `INT UNSIGNED` PKs/FKs throughout; `ENUM` on `asset_type`, `currency` |
| `003_create_refresh_tokens.sql` | `DATETIME` on `expires_at` |
| `005_create_bank_accounts.sql` | `ENUM` on `compounding`, `account_type`; `TINYINT(1)` on `is_auto_renew` |
| `006_create_mutual_funds.sql` | `ENUM` on `plan_type`, `type`, `source` |
| `007_create_stocks.sql` | `ENUM` on `exchange`, `transaction_type` |
| `008_create_gold.sql` | `ENUM` on `gold_type`, `purity` |
| `009_create_govt_schemes.sql` | `ENUM` on `scheme_type`, `tx_type` |
| `010_create_bonds.sql` | `ENUM` on `bond_type` |
| `011_create_insurance.sql` | `ENUM` on `insurance_type`, `premium_frequency` |
| `012_create_real_estate.sql` | `ENUM` on `property_type` |
| `013_create_loans.sql` | `ENUM` on `loan_type`, `rate_type` |
| `014_create_goals.sql` | `ENUM` on `goal_type`, `status` |

### 1.4 ENUM strategy decision

**Recommendation: use `TEXT` + `CHECK` constraints** (not PG native ENUMs).

Reason: PG native ENUMs cannot have values removed without `ALTER TYPE ... DROP VALUE` (which requires PG 14+), and adding values requires `ALTER TYPE`. `TEXT + CHECK` is easier to evolve.

```sql
-- Example: instead of ENUM('purchase','redemption',...)
type TEXT NOT NULL CHECK (type IN ('purchase','redemption','dividend_reinvest','switch_in','switch_out'))
```

---

## Phase 2 — Application layer changes

### 2.1 Replace `mysql2` with `pg`

```bash
npm uninstall mysql2 --workspace=server
npm install pg --workspace=server
```

### 2.2 Rewrite `server/src/plugins/db.js`

```js
// BEFORE (mysql2)
const mysql = require('mysql2/promise')
const pool = mysql.createPool({
  host, port, database, user, password,
  timezone: '+05:30',
  dateStrings: ['DATE'],
})

// AFTER (pg)
const { Pool } = require('pg')
const pool = new Pool({ host, port, database, user, password })

// Run once at startup to fix timezone + DATE handling
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Kolkata'")
})

// Prevent pg from parsing DATE columns as JS Date objects (preserves YYYY-MM-DD strings)
const { types } = require('pg')
types.setTypeParser(types.builtins.DATE, (val) => val) // return raw string
```

### 2.3 Rewrite `server/src/models/db.js`

```js
// pg uses pool.query() directly (no pool.execute())
// Returns { rows, rowCount, command } — not [rows, fields]

async function query(pool, sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows
}

async function queryOne(pool, sql, params = []) {
  const { rows } = await pool.query(sql, params)
  return rows[0] || null
}

async function insert(pool, sql, params = []) {
  const { rows, rowCount } = await pool.query(sql, params)
  return { rows, rowCount }
}
```

### 2.4 Parameter placeholders — `?` → `$N`

Every SQL string in controllers must be updated. MySQL uses positional `?`; PostgreSQL uses `$1`, `$2`, `$3` ...

```js
// BEFORE
'INSERT INTO assets (user_id, asset_type) VALUES (?, ?)'

// AFTER
'INSERT INTO assets (user_id, asset_type) VALUES ($1, $2)'
```

**Scope:** affects every controller file in `server/src/controllers/` — approximately 400+ query strings across 10+ controllers.

**Strategy:** write a helper that converts `?` to `$N` sequentially, or do a file-by-file rewrite. The rewrite approach is safer (easier to catch mistakes).

### 2.5 `insertId` → `RETURNING id`

Every `INSERT` that reads `result.insertId` must append `RETURNING id` to the SQL and read `result.rows[0].id` instead.

```js
// BEFORE
const [result] = await conn.execute('INSERT INTO assets (...) VALUES (?)', [...])
const assetId = result.insertId

// AFTER
const result = await client.query('INSERT INTO assets (...) VALUES ($1) RETURNING id', [...])
const assetId = result.rows[0].id
```

**Scope:** affects every controller that creates records — `fdCreate`, `rdCreate`, `mfCreate`, `stockCreate`, `goalCreate`, all import controllers, etc.

### 2.6 `affectedRows` → `rowCount`

```js
// BEFORE
if (result.affectedRows === 0) return reply.code(404).send(...)

// AFTER
if (result.rowCount === 0) return reply.code(404).send(...)
```

### 2.7 Transaction handling

```js
// BEFORE (mysql2)
const conn = await db.getConnection()
await conn.beginTransaction()
// ... queries using conn.execute(...)
await conn.commit()
conn.release()

// AFTER (pg)
const client = await db.connect()
await client.query('BEGIN')
// ... queries using client.query(...)
await client.query('COMMIT')
client.release()
```

The `try/catch/finally` structure stays the same — only method names change.

### 2.8 `.env` changes

```env
# Remove
DB_HOST=localhost
DB_PORT=3306
DB_NAME=assetmgmt
DB_USER=root
DB_PASSWORD=

# Add
PGHOST=localhost
PGPORT=5432
PGDATABASE=assetmgmt
PGUSER=postgres
PGPASSWORD=
DATABASE_URL=postgresql://postgres:@localhost:5432/assetmgmt
```

---

## Phase 3 — Data migration

### 3.1 Tooling options

| Tool | Pros | Cons |
|---|---|---|
| `pgloader` | Handles type coercion automatically, fast | Needs separate install |
| `mysqldump` + manual transform | Full control | Error-prone for ENUMs/booleans |
| Python script (pandas) | Flexible | Slow for large tables |
| **`pgloader` (recommended)** | One command, handles most conversions | — |

### 3.2 `pgloader` command

```
LOAD DATABASE
  FROM mysql://root:@localhost/assetmgmt
  INTO postgresql://postgres:@localhost/assetmgmt

WITH include drop, create tables, create indexes, reset sequences,
     workers = 4, concurrency = 2

CAST
  type tinyint  when (= 1 precision) to boolean   drop typemod,
  type datetime                      to timestamp,
  type int unsigned                  to integer,
  column assets.current_value        to numeric,
  column assets.invested_amount      to numeric;
```

### 3.3 Post-migration data checks

```sql
-- Verify row counts match MySQL source
SELECT 'assets'        AS tbl, COUNT(*) FROM assets
UNION ALL SELECT 'fixed_deposits',      COUNT(*) FROM fixed_deposits
UNION ALL SELECT 'mutual_funds',        COUNT(*) FROM mutual_funds
UNION ALL SELECT 'mutual_fund_transactions', COUNT(*) FROM mutual_fund_transactions
-- ... all tables

-- Verify sequences are past max id (prevents PK conflicts on new inserts)
SELECT setval('assets_id_seq', (SELECT MAX(id) FROM assets));
-- Repeat for every table with GENERATED AS IDENTITY / SERIAL
```

---

## Phase 4 — Testing

- [ ] Run full backend test suite (`npm test --workspace=server`) — all existing tests must pass
- [ ] Test every CRUD endpoint via Postman/curl against PostgreSQL
- [ ] Import CSV flows (FD, PPF, MF) — verify `RETURNING id` works correctly
- [ ] Dashboard summary — verify `SUM`, `GROUP BY`, date arithmetic still correct
- [ ] XIRR calculation — spot-check against known values
- [ ] DATE column handling — verify dates returned as `YYYY-MM-DD` strings (no timezone shift)
- [ ] Loan amortization schedule — verify floating point results match
- [ ] Load test with production-size dataset

---

## Phase 5 — Cutover plan (production)

1. Put app in maintenance mode (or drain traffic).
2. Final `mysqldump` of production data.
3. Run `pgloader` against production PostgreSQL.
4. Run sequence reset queries.
5. Update environment variables to point to PostgreSQL.
6. Deploy new application build (with `pg` driver).
7. Smoke test all critical paths.
8. Remove maintenance mode.
9. Keep MySQL instance running (read-only) for 2 weeks as rollback option.

**Rollback:** revert env vars to MySQL connection string + redeploy previous build. No data loss if MySQL was kept read-only during the window.

---

## Effort estimate

| Phase | Effort |
|---|---|
| Phase 0 — Audit | 0.5 day |
| Phase 1 — Schema conversion (14 files) | 1 day |
| Phase 2 — Application layer (controllers, plugin, models) | 3–4 days |
| Phase 3 — Data migration + verification | 0.5 day |
| Phase 4 — Testing | 1–2 days |
| Phase 5 — Cutover | 0.5 day |
| **Total** | **~7–9 days** |

The bulk of the work is Phase 2 — specifically the mechanical `?` → `$N` rewrite and `insertId` → `RETURNING id` changes across all controllers.

---

## Future work enabled after migration

- JSONB columns for storing raw price history without a separate time-series table
- PostgreSQL full-text search on fund names and stock symbols
- Partial indexes (e.g., index only active assets: `WHERE is_active = true`)
- `pg_cron` extension for scheduled jobs instead of `node-cron`
- Supabase Realtime for live dashboard updates (optional)
