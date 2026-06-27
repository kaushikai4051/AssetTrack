const { query } = require('../models/db')
const { generateAmortization } = require('../finance/emi')
const { parseFY } = require('./capitalGainsTax')

function inFY(dateStr, start, end) {
  const d = new Date(dateStr)
  return d >= start && d <= end
}

// ── 80C (₹1.5L cap) ──────────────────────────────────────────────────────────

async function get80C(db, userId, start, end) {
  const items = []

  // PPF deposits
  const ppfTx = await query(db,
    `SELECT gst.amount, gst.tx_date
     FROM govt_scheme_transactions gst
     JOIN govt_scheme_holdings gsh ON gsh.id = gst.holding_id
     JOIN assets a ON a.id = gsh.asset_id
     WHERE a.user_id = ? AND gsh.scheme_type = 'ppf' AND gst.tx_type = 'deposit'`,
    [userId]
  )
  const ppfAmt = ppfTx.filter((t) => inFY(t.tx_date, start, end))
                      .reduce((s, t) => s + parseFloat(t.amount), 0)
  if (ppfAmt > 0) items.push({ label: 'PPF Deposits', section: '80C', amount: Math.round(ppfAmt * 100) / 100 })

  // ELSS Mutual Fund purchases
  const elssTx = await query(db,
    `SELECT mft.amount, mft.transaction_date
     FROM mutual_fund_transactions mft
     JOIN mutual_funds mf ON mf.id = mft.fund_id
     JOIN assets a ON a.id = mf.asset_id
     WHERE a.user_id = ? AND mf.category = 'ELSS' AND mft.type = 'purchase'`,
    [userId]
  )
  const elssAmt = elssTx.filter((t) => inFY(String(t.transaction_date), start, end))
                        .reduce((s, t) => s + parseFloat(t.amount), 0)
  if (elssAmt > 0) items.push({ label: 'ELSS Mutual Funds', section: '80C', amount: Math.round(elssAmt * 100) / 100 })

  // NSC investments (principal at purchase date = start date of holding)
  const nscRows = await query(db,
    `SELECT a.invested_amount, gsh.start_date
     FROM govt_scheme_holdings gsh
     JOIN assets a ON a.id = gsh.asset_id
     WHERE a.user_id = ? AND gsh.scheme_type = 'nsc' AND a.is_active = 1`,
    [userId]
  )
  const nscAmt = nscRows.filter((r) => r.start_date && inFY(r.start_date, start, end))
                        .reduce((s, r) => s + parseFloat(r.invested_amount || 0), 0)
  if (nscAmt > 0) items.push({ label: 'NSC Investments', section: '80C', amount: Math.round(nscAmt * 100) / 100 })

  // SSY deposits
  const ssyTx = await query(db,
    `SELECT gst.amount, gst.tx_date
     FROM govt_scheme_transactions gst
     JOIN govt_scheme_holdings gsh ON gsh.id = gst.holding_id
     JOIN assets a ON a.id = gsh.asset_id
     WHERE a.user_id = ? AND gsh.scheme_type = 'ssy' AND gst.tx_type = 'deposit'`,
    [userId]
  )
  const ssyAmt = ssyTx.filter((t) => inFY(t.tx_date, start, end))
                      .reduce((s, t) => s + parseFloat(t.amount), 0)
  if (ssyAmt > 0) items.push({ label: 'SSY Deposits', section: '80C', amount: Math.round(ssyAmt * 100) / 100 })

  // SCSS deposits
  const scssTx = await query(db,
    `SELECT gst.amount, gst.tx_date
     FROM govt_scheme_transactions gst
     JOIN govt_scheme_holdings gsh ON gsh.id = gst.holding_id
     JOIN assets a ON a.id = gsh.asset_id
     WHERE a.user_id = ? AND gsh.scheme_type = 'scss' AND gst.tx_type = 'deposit'`,
    [userId]
  )
  const scssAmt = scssTx.filter((t) => inFY(t.tx_date, start, end))
                        .reduce((s, t) => s + parseFloat(t.amount), 0)
  if (scssAmt > 0) items.push({ label: 'SCSS Deposits', section: '80C', amount: Math.round(scssAmt * 100) / 100 })

  // Life insurance premiums (term, endowment, money_back, ulip, lic)
  const lifeIns = await query(db,
    `SELECT ip.annual_premium, ip.premium_frequency, ip.start_date
     FROM insurance_policies ip JOIN assets a ON a.id = ip.asset_id
     WHERE a.user_id = ? AND a.is_active = 1
       AND ip.insurance_type IN ('term','endowment','money_back','ulip','lic')`,
    [userId]
  )
  const lifePremAmt = lifeIns.reduce((s, p) => {
    // Count premium if policy was active in FY (start_date before FY end)
    if (p.start_date && new Date(p.start_date) <= end) {
      return s + parseFloat(p.annual_premium || 0)
    }
    return s
  }, 0)
  if (lifePremAmt > 0) items.push({ label: 'Life Insurance Premiums', section: '80C', amount: Math.round(lifePremAmt * 100) / 100 })

  const total    = items.reduce((s, i) => s + i.amount, 0)
  const limit    = 150000
  const used     = Math.min(total, limit)
  const remaining = Math.max(0, limit - total)

  return { items, total: Math.round(total * 100) / 100, used: Math.round(used * 100) / 100, limit, remaining: Math.round(remaining * 100) / 100 }
}

// ── 80D (₹25K limit for self/family) ─────────────────────────────────────────

async function get80D(db, userId, start, end) {
  const items = []

  const healthIns = await query(db,
    `SELECT a.asset_name, ip.annual_premium, ip.start_date
     FROM insurance_policies ip JOIN assets a ON a.id = ip.asset_id
     WHERE a.user_id = ? AND a.is_active = 1
       AND ip.insurance_type IN ('health','critical_illness')`,
    [userId]
  )
  for (const p of healthIns) {
    if (p.start_date && new Date(p.start_date) <= end) {
      const amt = parseFloat(p.annual_premium || 0)
      if (amt > 0) items.push({ label: p.asset_name, section: '80D', amount: Math.round(amt * 100) / 100 })
    }
  }

  const total     = items.reduce((s, i) => s + i.amount, 0)
  const limit     = 25000
  const used      = Math.min(total, limit)
  const remaining = Math.max(0, limit - total)

  return { items, total: Math.round(total * 100) / 100, used: Math.round(used * 100) / 100, limit, remaining: Math.round(remaining * 100) / 100 }
}

// ── 24b — Home loan interest ──────────────────────────────────────────────────

async function get24b(db, userId, start, end) {
  const items = []

  const homeLoans = await query(db,
    `SELECT l.id, a.asset_name, l.outstanding_amount, l.interest_rate,
            l.tenure_months, l.disbursement_date, l.emi_amount
     FROM loans l JOIN assets a ON a.id = l.asset_id
     WHERE a.user_id = ? AND a.is_active = 1 AND l.loan_type = 'home'`,
    [userId]
  )

  for (const loan of homeLoans) {
    if (!loan.disbursement_date || !loan.outstanding_amount) continue

    const schedule = generateAmortization(
      parseFloat(loan.outstanding_amount),
      parseFloat(loan.interest_rate),
      parseInt(loan.tenure_months),
      loan.disbursement_date,
      loan.emi_amount ? parseFloat(loan.emi_amount) : undefined
    )

    const fyInterest = schedule
      .filter((row) => inFY(row.date, start, end))
      .reduce((s, row) => s + row.interest, 0)

    if (fyInterest > 0) {
      items.push({
        label:   loan.asset_name || 'Home Loan',
        section: '24b',
        amount:  Math.round(fyInterest * 100) / 100,
      })
    }
  }

  const total     = items.reduce((s, i) => s + i.amount, 0)
  const limit     = 200000 // ₹2L for self-occupied
  const used      = Math.min(total, limit)
  const remaining = Math.max(0, limit - total)

  return { items, total: Math.round(total * 100) / 100, used: Math.round(used * 100) / 100, limit, remaining: Math.round(remaining * 100) / 100 }
}

// ── 80CCD(1B) — NPS additional (₹50K over 80C) ───────────────────────────────

async function get80CCD1B(db, userId, start, end) {
  const items = []

  const npsTx = await query(db,
    `SELECT gst.amount, gst.tx_date
     FROM govt_scheme_transactions gst
     JOIN govt_scheme_holdings gsh ON gsh.id = gst.holding_id
     JOIN assets a ON a.id = gsh.asset_id
     WHERE a.user_id = ? AND gsh.scheme_type = 'nps'
       AND gst.tx_type = 'deposit'`,
    [userId]
  )
  const npsAmt = npsTx.filter((t) => inFY(t.tx_date, start, end))
                      .reduce((s, t) => s + parseFloat(t.amount), 0)
  if (npsAmt > 0) items.push({ label: 'NPS Contributions', section: '80CCD(1B)', amount: Math.round(npsAmt * 100) / 100 })

  const total     = items.reduce((s, i) => s + i.amount, 0)
  const limit     = 50000
  const used      = Math.min(total, limit)
  const remaining = Math.max(0, limit - total)

  return { items, total: Math.round(total * 100) / 100, used: Math.round(used * 100) / 100, limit, remaining: Math.round(remaining * 100) / 100 }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getDeductions(db, userId, fy) {
  const { start, end } = parseFY(fy)
  const [d80C, d80D, d24b, d80CCD] = await Promise.all([
    get80C(db, userId, start, end),
    get80D(db, userId, start, end),
    get24b(db, userId, start, end),
    get80CCD1B(db, userId, start, end),
  ])
  return { fy, '80C': d80C, '80D': d80D, '24b': d24b, '80CCD1B': d80CCD }
}

module.exports = { getDeductions }
