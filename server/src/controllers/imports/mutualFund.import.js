const { parseCSVBuffer, parseDate, parseNum } = require('../../utils/csvParser')

const VALID_TX_TYPES = new Set(['purchase', 'redemption', 'dividend_reinvest', 'switch_in', 'switch_out'])
const VALID_SOURCES  = new Set(['sip', 'lumpsum', 'switch', 'dividend'])
const VALID_PLANS    = new Set(['growth', 'idcw'])
const INFLOW_TYPES   = new Set(['purchase', 'dividend_reinvest', 'switch_in'])

async function importMutualFund(request, reply) {
  const upload = await request.file()
  if (!upload) return reply.code(400).send({ message: 'No file uploaded' })

  const buffer = await upload.toBuffer()
  let rows
  try {
    rows = parseCSVBuffer(buffer)
  } catch (err) {
    return reply.code(400).send({ message: `CSV parse error: ${err.message}` })
  }

  if (!rows.length) return reply.code(400).send({ message: 'CSV file is empty or has no data rows' })

  // Group rows by scheme_code + folio_number (folio may be blank → use scheme_code only)
  const fundMap = new Map()
  const rowErrors = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2

    const scheme_name = raw.scheme_name?.trim()
    const scheme_code = raw.scheme_code?.trim()
    const tx_date  = parseDate(raw.tx_date)
    const tx_type  = raw.tx_type?.trim()?.toLowerCase()
    const source   = raw.source?.trim()?.toLowerCase() || 'lumpsum'
    const nav      = parseNum(raw.nav)
    const amount   = parseNum(raw.amount)
    let   units    = parseNum(raw.units)

    if (!scheme_name)                         { rowErrors.push({ row: rowNum, reason: 'scheme_name is required' }); continue }
    if (!scheme_code)                         { rowErrors.push({ row: rowNum, reason: 'scheme_code is required' }); continue }
    if (!tx_date)                             { rowErrors.push({ row: rowNum, reason: 'tx_date is invalid (use YYYY-MM-DD)' }); continue }
    if (!VALID_TX_TYPES.has(tx_type))         { rowErrors.push({ row: rowNum, reason: `tx_type must be one of: ${[...VALID_TX_TYPES].join(', ')}` }); continue }
    if (nav == null || nav <= 0)              { rowErrors.push({ row: rowNum, reason: 'nav must be a positive number' }); continue }
    if (amount == null || amount <= 0)        { rowErrors.push({ row: rowNum, reason: 'amount must be a positive number' }); continue }

    // Derive units from amount/nav if not provided
    if (units == null || units <= 0) units = parseFloat((amount / nav).toFixed(4))

    const folio = raw.folio_number?.trim() || ''
    const key = `${scheme_code}::${folio}`

    if (!fundMap.has(key)) {
      fundMap.set(key, {
        meta: {
          scheme_name,
          scheme_code,
          isin:         raw.isin?.trim() || null,
          fund_house:   raw.fund_house?.trim() || null,
          category:     raw.category?.trim() || null,
          plan_type:    VALID_PLANS.has(raw.plan_type?.trim()?.toLowerCase()) ? raw.plan_type.trim().toLowerCase() : 'growth',
          folio_number: folio || null,
        },
        txRows: [],
      })
    }

    fundMap.get(key).txRows.push({
      tx_date, tx_type, source, units, nav, amount,
      notes: raw.notes?.trim() || null,
      rowNum,
    })
  }

  const imported = []
  const failed = [...rowErrors]
  const db = request.server.db

  for (const [, fund] of fundMap) {
    const { meta, txRows } = fund

    // Sort by date to get correct avg_cost and running units
    txRows.sort((a, b) => new Date(a.tx_date) - new Date(b.tx_date))

    let unitsHeld      = 0
    let purchaseUnits  = 0
    let purchaseAmount = 0
    let netInvested    = 0

    for (const t of txRows) {
      if (INFLOW_TYPES.has(t.tx_type)) {
        unitsHeld     += t.units
        purchaseUnits += t.units
        purchaseAmount += t.amount
        netInvested   += t.amount
      } else {
        unitsHeld   -= t.units
        netInvested -= t.amount
      }
    }
    unitsHeld   = Math.max(0, parseFloat(unitsHeld.toFixed(4)))
    netInvested = Math.max(0, netInvested)
    const avgCostNav = purchaseUnits > 0 ? parseFloat((purchaseAmount / purchaseUnits).toFixed(4)) : 0

    // Use the most recent transaction's NAV as last_nav
    const lastTx  = txRows[txRows.length - 1]
    const lastNav = lastTx.nav
    const lastNavDate = lastTx.tx_date
    const currentValue = lastNav > 0 ? parseFloat((unitsHeld * lastNav).toFixed(2)) : netInvested

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const [assetRes] = await conn.execute(
        `INSERT INTO assets (user_id, asset_type, asset_name, currency, current_value, invested_amount)
         VALUES (?, 'mutual_fund', ?, 'INR', ?, ?)`,
        [request.user.id, meta.scheme_name, currentValue, netInvested]
      )
      const assetId = assetRes.insertId

      const [mfRes] = await conn.execute(
        `INSERT INTO mutual_funds (asset_id, scheme_name, scheme_code, isin, fund_house, category,
                                   plan_type, folio_number, units_held, avg_cost_nav, last_nav, last_nav_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [assetId, meta.scheme_name, meta.scheme_code, meta.isin, meta.fund_house,
         meta.category, meta.plan_type, meta.folio_number,
         unitsHeld, avgCostNav, lastNav, lastNavDate]
      )
      const fundId = mfRes.insertId

      for (const t of txRows) {
        await conn.execute(
          `INSERT INTO mutual_fund_transactions (fund_id, type, source, transaction_date, units, nav, amount, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [fundId, t.tx_type, t.source, t.tx_date, t.units, t.nav, t.amount, t.notes]
        )
      }

      await conn.commit()
      imported.push(assetId)
    } catch (err) {
      await conn.rollback()
      failed.push({ row: `fund ${meta.scheme_code}`, reason: `DB error: ${err.message}` })
    } finally {
      conn.release()
    }
  }

  return {
    imported: imported.length,
    total: fundMap.size,
    failed,
  }
}

module.exports = { importMutualFund }
