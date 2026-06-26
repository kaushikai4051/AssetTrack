const { parseCSVBuffer, parseDate, parseNum, parseBool } = require('../../utils/csvParser')
const { calcFDMaturity } = require('../../finance/fd')

const VALID_COMPOUNDING = new Set(['monthly', 'quarterly', 'half_yearly', 'yearly', 'simple'])

async function importFD(request, reply) {
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

  const imported = []
  const failed = []
  const db = request.server.db

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2 // +2: 1-based index + skip header

    const bank_name    = raw.bank_name?.trim()
    const principal    = parseNum(raw.principal)
    const interest_rate = parseNum(raw.interest_rate)
    const compounding  = raw.compounding?.trim()?.toLowerCase() || 'quarterly'
    const start_date   = parseDate(raw.start_date)
    const maturity_date = parseDate(raw.maturity_date)

    if (!bank_name)                           { failed.push({ row: rowNum, reason: 'bank_name is required' }); continue }
    if (principal == null || principal <= 0)  { failed.push({ row: rowNum, reason: 'principal must be a positive number' }); continue }
    if (interest_rate == null || interest_rate <= 0) { failed.push({ row: rowNum, reason: 'interest_rate must be a positive number' }); continue }
    if (!VALID_COMPOUNDING.has(compounding))  { failed.push({ row: rowNum, reason: `compounding must be one of: ${[...VALID_COMPOUNDING].join(', ')}` }); continue }
    if (!start_date)                          { failed.push({ row: rowNum, reason: 'start_date is invalid (use YYYY-MM-DD)' }); continue }
    if (!maturity_date)                       { failed.push({ row: rowNum, reason: 'maturity_date is invalid (use YYYY-MM-DD)' }); continue }
    if (new Date(maturity_date) <= new Date(start_date)) { failed.push({ row: rowNum, reason: 'maturity_date must be after start_date' }); continue }

    const maturity_amount = calcFDMaturity(principal, interest_rate, compounding, start_date, maturity_date)
    const asset_name = `FD — ${bank_name}`

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()
      const [assetRes] = await conn.execute(
        `INSERT INTO assets (user_id, asset_type, asset_name, currency, current_value, invested_amount, notes)
         VALUES (?, 'fixed_deposit', ?, 'INR', ?, ?, ?)`,
        [request.user.id, asset_name, maturity_amount, principal, raw.notes?.trim() || null]
      )
      const assetId = assetRes.insertId

      await conn.execute(
        `INSERT INTO fixed_deposits (asset_id, bank_name, account_number, principal, interest_rate,
                                     compounding, start_date, maturity_date, maturity_amount,
                                     is_auto_renew, nominee_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [assetId, bank_name, raw.account_number?.trim() || null, principal, interest_rate,
         compounding, start_date, maturity_date, maturity_amount,
         parseBool(raw.is_auto_renew) ? 1 : 0, raw.nominee_name?.trim() || null]
      )
      await conn.commit()
      imported.push(assetId)
    } catch (err) {
      await conn.rollback()
      failed.push({ row: rowNum, reason: `DB error: ${err.message}` })
    } finally {
      conn.release()
    }
  }

  return { imported: imported.length, total: rows.length, failed }
}

module.exports = { importFD }
