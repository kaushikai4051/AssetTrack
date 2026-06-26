const { parseCSVBuffer, parseDate, parseNum } = require('../../utils/csvParser')

const VALID_TX_TYPES = new Set(['deposit', 'withdrawal', 'interest'])

async function importPPF(request, reply) {
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

  // Group rows by account_number — each unique account becomes one holding
  const accountMap = new Map() // account_number → { meta, txRows[] }
  const rowErrors = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rowNum = i + 2

    const account_number = raw.account_number?.trim()
    const tx_date = parseDate(raw.tx_date)
    const tx_type = raw.tx_type?.trim()?.toLowerCase()
    const amount  = parseNum(raw.amount)

    if (!account_number)                      { rowErrors.push({ row: rowNum, reason: 'account_number is required' }); continue }
    if (!tx_date)                             { rowErrors.push({ row: rowNum, reason: 'tx_date is invalid (use YYYY-MM-DD)' }); continue }
    if (!VALID_TX_TYPES.has(tx_type))         { rowErrors.push({ row: rowNum, reason: `tx_type must be one of: ${[...VALID_TX_TYPES].join(', ')}` }); continue }
    if (amount == null || amount <= 0)        { rowErrors.push({ row: rowNum, reason: 'amount must be a positive number' }); continue }

    if (!accountMap.has(account_number)) {
      accountMap.set(account_number, {
        meta: {
          account_number,
          institution: raw.institution?.trim() || null,
          start_date: parseDate(raw.start_date) || null,
          interest_rate: parseNum(raw.interest_rate) || null,
          nominee: raw.nominee?.trim() || null,
        },
        txRows: [],
      })
    }

    accountMap.get(account_number).txRows.push({
      tx_date, tx_type, amount,
      description: raw.description?.trim() || null,
      rowNum,
    })
  }

  const imported = []
  const failed = [...rowErrors]
  const db = request.server.db

  for (const [, account] of accountMap) {
    const { meta, txRows } = account

    // Derive invested_amount and current_value from transactions
    let invested = 0
    let currentVal = 0
    for (const t of txRows) {
      if (t.tx_type === 'deposit')    { invested += t.amount; currentVal += t.amount }
      if (t.tx_type === 'interest')   { currentVal += t.amount }
      if (t.tx_type === 'withdrawal') { currentVal -= t.amount }
    }

    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const [assetRes] = await conn.execute(
        `INSERT INTO assets (user_id, asset_type, asset_name, currency, current_value, invested_amount)
         VALUES (?, 'ppf', ?, 'INR', ?, ?)`,
        [request.user.id,
         meta.account_number ? `PPF ${meta.account_number}` : 'PPF',
         currentVal, invested]
      )
      const assetId = assetRes.insertId

      const [holdingRes] = await conn.execute(
        `INSERT INTO govt_scheme_holdings
           (asset_id, scheme_type, account_number, institution, start_date, interest_rate, nominee)
         VALUES (?, 'ppf', ?, ?, ?, ?, ?)`,
        [assetId, meta.account_number, meta.institution, meta.start_date,
         meta.interest_rate, meta.nominee]
      )
      const holdingId = holdingRes.insertId

      for (const t of txRows) {
        await conn.execute(
          `INSERT INTO govt_scheme_transactions (holding_id, tx_date, tx_type, amount, description)
           VALUES (?, ?, ?, ?, ?)`,
          [holdingId, t.tx_date, t.tx_type, t.amount, t.description]
        )
      }

      await conn.commit()
      imported.push(assetId)
    } catch (err) {
      await conn.rollback()
      failed.push({ row: `account ${meta.account_number}`, reason: `DB error: ${err.message}` })
    } finally {
      conn.release()
    }
  }

  return {
    imported: imported.length,
    total: accountMap.size,
    failed,
  }
}

module.exports = { importPPF }
