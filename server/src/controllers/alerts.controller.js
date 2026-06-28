const { query } = require('../models/db')

function daysBetween(from, to) {
  return Math.ceil((new Date(to) - new Date(from)) / 86400000)
}

function priority(daysLeft) {
  if (daysLeft <= 7) return 'urgent'
  if (daysLeft <= 30) return 'warning'
  return 'info'
}

function fmtDate(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
}

// Next occurrence of emi_due_day on or after today
function nextEmiDate(emiDueDay) {
  const today = new Date()
  let d = new Date(today.getFullYear(), today.getMonth(), emiDueDay)
  if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, emiDueDay)
  return d.toISOString().slice(0, 10)
}

// Days until next March 31 (FY deadline)
function daysUntilFYEnd() {
  const today = new Date()
  const year = today.getMonth() >= 3 ? today.getFullYear() + 1 : today.getFullYear()
  return daysBetween(today, new Date(year, 2, 31))
}

async function all(request, reply) {
  const userId = request.user.id
  const db = request.server.db
  const days = Math.min(365, Math.max(7, parseInt(request.query.days) || 90))
  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() + days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const alerts = []

  const [fds, rds, govtSchemes, bonds, sgb, insurance, loans, goals, ppf, ssy] =
    await Promise.all([

      // 1. FD maturities
      query(db,
        `SELECT a.asset_name, fd.maturity_date, fd.maturity_amount
         FROM fixed_deposits fd JOIN assets a ON a.id = fd.asset_id
         WHERE a.user_id = ? AND a.is_active = 1 AND fd.maturity_date BETWEEN ? AND ?
         ORDER BY fd.maturity_date`,
        [userId, todayStr, cutoffStr]
      ).catch(() => []),

      // 2. RD maturities
      query(db,
        `SELECT a.asset_name, rd.maturity_date
         FROM recurring_deposits rd JOIN assets a ON a.id = rd.asset_id
         WHERE a.user_id = ? AND a.is_active = 1 AND rd.maturity_date BETWEEN ? AND ?
         ORDER BY rd.maturity_date`,
        [userId, todayStr, cutoffStr]
      ).catch(() => []),

      // 3. Govt scheme maturities (NSC, KVP, SCSS, SSY, PO TD/RD)
      query(db,
        `SELECT a.asset_name, gsh.scheme_type, gsh.maturity_date
         FROM govt_scheme_holdings gsh JOIN assets a ON a.id = gsh.asset_id
         WHERE a.user_id = ? AND a.is_active = 1
           AND gsh.maturity_date IS NOT NULL AND gsh.maturity_date BETWEEN ? AND ?
         ORDER BY gsh.maturity_date`,
        [userId, todayStr, cutoffStr]
      ).catch(() => []),

      // 4. Bond maturities
      query(db,
        `SELECT a.asset_name, bh.bond_type, bh.maturity_date
         FROM bond_holdings bh JOIN assets a ON a.id = bh.asset_id
         WHERE a.user_id = ? AND a.is_active = 1 AND bh.maturity_date BETWEEN ? AND ?
         ORDER BY bh.maturity_date`,
        [userId, todayStr, cutoffStr]
      ).catch(() => []),

      // 5. SGB — maturity + 5-year early exit window
      query(db,
        `SELECT a.asset_name, gh.sgb_maturity_date, gh.sgb_issue_date
         FROM gold_holdings gh JOIN assets a ON a.id = gh.asset_id
         WHERE a.user_id = ? AND a.is_active = 1 AND gh.gold_type = 'sgb'
           AND (
             gh.sgb_maturity_date BETWEEN ? AND ?
             OR DATE_ADD(gh.sgb_issue_date, INTERVAL 5 YEAR) BETWEEN ? AND ?
           )`,
        [userId, todayStr, cutoffStr, todayStr, cutoffStr]
      ).catch(() => []),

      // 6. Insurance premium due dates
      query(db,
        `SELECT a.asset_name, ip.insurance_type, ip.next_due_date, ip.annual_premium
         FROM insurance_policies ip JOIN assets a ON a.id = ip.asset_id
         WHERE a.user_id = ? AND a.is_active = 1 AND ip.next_due_date BETWEEN ? AND ?
         ORDER BY ip.next_due_date`,
        [userId, todayStr, cutoffStr]
      ).catch(() => []),

      // 7. Loan EMIs
      query(db,
        `SELECT a.asset_name, l.emi_due_day, l.emi_amount, l.loan_type
         FROM loans l JOIN assets a ON a.id = l.asset_id
         WHERE a.user_id = ? AND a.is_active = 1 AND l.is_closed = 0
           AND l.emi_due_day IS NOT NULL`,
        [userId]
      ).catch(() => []),

      // 8. Goal deadlines
      query(db,
        `SELECT id, name, goal_type, target_amount, current_value, target_date
         FROM goals WHERE user_id = ? AND is_achieved = 0 AND target_date BETWEEN ? AND ?
         ORDER BY target_date`,
        [userId, todayStr, cutoffStr]
      ).catch(() => []),

      // 9. PPF accounts (for contribution reminder)
      query(db,
        `SELECT a.asset_name FROM ppf_accounts pa JOIN assets a ON a.id = pa.asset_id
         WHERE a.user_id = ? AND a.is_active = 1`,
        [userId]
      ).catch(() => []),

      // 10. SSY accounts (for contribution reminder)
      query(db,
        `SELECT a.asset_name FROM govt_scheme_holdings gsh JOIN assets a ON a.id = gsh.asset_id
         WHERE a.user_id = ? AND a.is_active = 1 AND gsh.scheme_type = 'ssy'`,
        [userId]
      ).catch(() => []),
    ])

  // ── Build alerts ───────────────────────────────────────────────────────────

  fds.forEach((r) => {
    const d = daysBetween(today, r.maturity_date)
    alerts.push({
      id: `fd-${r.asset_name}-${fmtDate(r.maturity_date)}`,
      category: 'maturity',
      title: `FD Maturity — ${r.asset_name}`,
      detail: r.maturity_amount
        ? `Maturity amount ₹${Number(r.maturity_amount).toLocaleString('en-IN')}`
        : null,
      date: fmtDate(r.maturity_date),
      daysLeft: d,
      priority: priority(d),
    })
  })

  rds.forEach((r) => {
    const d = daysBetween(today, r.maturity_date)
    alerts.push({
      id: `rd-${r.asset_name}-${fmtDate(r.maturity_date)}`,
      category: 'maturity',
      title: `RD Maturity — ${r.asset_name}`,
      detail: null,
      date: fmtDate(r.maturity_date),
      daysLeft: d,
      priority: priority(d),
    })
  })

  govtSchemes.forEach((r) => {
    const d = daysBetween(today, r.maturity_date)
    const label = r.scheme_type.toUpperCase()
    alerts.push({
      id: `gs-${r.asset_name}-${fmtDate(r.maturity_date)}`,
      category: 'maturity',
      title: `${label} Maturity — ${r.asset_name}`,
      detail: null,
      date: fmtDate(r.maturity_date),
      daysLeft: d,
      priority: priority(d),
    })
  })

  bonds.forEach((r) => {
    const d = daysBetween(today, r.maturity_date)
    alerts.push({
      id: `bond-${r.asset_name}-${fmtDate(r.maturity_date)}`,
      category: 'maturity',
      title: `Bond Maturity — ${r.asset_name}`,
      detail: r.bond_type ? `Type: ${r.bond_type.replace('_', ' ')}` : null,
      date: fmtDate(r.maturity_date),
      daysLeft: d,
      priority: priority(d),
    })
  })

  sgb.forEach((r) => {
    if (r.sgb_maturity_date) {
      const matStr = fmtDate(r.sgb_maturity_date)
      const d = daysBetween(today, matStr)
      if (matStr >= todayStr && matStr <= cutoffStr) {
        alerts.push({
          id: `sgb-mat-${r.asset_name}`,
          category: 'maturity',
          title: `SGB Maturity — ${r.asset_name}`,
          detail: 'Tax-free redemption at maturity',
          date: matStr,
          daysLeft: d,
          priority: priority(d),
        })
      }
    }
    if (r.sgb_issue_date) {
      const exitDate = new Date(r.sgb_issue_date)
      exitDate.setFullYear(exitDate.getFullYear() + 5)
      const exitStr = exitDate.toISOString().slice(0, 10)
      const d = daysBetween(today, exitStr)
      if (exitStr >= todayStr && exitStr <= cutoffStr) {
        alerts.push({
          id: `sgb-exit-${r.asset_name}`,
          category: 'maturity',
          title: `SGB Early Exit Window — ${r.asset_name}`,
          detail: '5-year early redemption window opens',
          date: exitStr,
          daysLeft: d,
          priority: priority(d),
        })
      }
    }
  })

  insurance.forEach((r) => {
    const d = daysBetween(today, r.next_due_date)
    alerts.push({
      id: `ins-${r.asset_name}-${fmtDate(r.next_due_date)}`,
      category: 'insurance',
      title: `Premium Due — ${r.asset_name}`,
      detail: r.annual_premium
        ? `Premium ₹${Number(r.annual_premium).toLocaleString('en-IN')}`
        : null,
      date: fmtDate(r.next_due_date),
      daysLeft: d,
      priority: priority(d),
    })
  })

  loans.forEach((r) => {
    const date = nextEmiDate(r.emi_due_day)
    const d = daysBetween(today, date)
    if (d <= days) {
      alerts.push({
        id: `emi-${r.asset_name}-${date}`,
        category: 'emi',
        title: `EMI Due — ${r.asset_name}`,
        detail: r.emi_amount
          ? `EMI ₹${Number(r.emi_amount).toLocaleString('en-IN')}`
          : null,
        date,
        daysLeft: d,
        priority: priority(d),
      })
    }
  })

  goals.forEach((r) => {
    const d = daysBetween(today, r.target_date)
    const shortfall = parseFloat(r.target_amount) - parseFloat(r.current_value)
    alerts.push({
      id: `goal-${r.id}`,
      category: 'goal',
      title: `Goal Deadline — ${r.name}`,
      detail: shortfall > 0
        ? `Shortfall ₹${Math.round(shortfall).toLocaleString('en-IN')}`
        : 'On track!',
      date: fmtDate(r.target_date),
      daysLeft: d,
      priority: shortfall > 0 ? priority(d) : 'info',
    })
  })

  // PPF / SSY contribution reminder: alert when FY end is within lookahead
  const fyDays = daysUntilFYEnd()
  if (fyDays <= days) {
    const fyDate = (() => {
      const t = new Date()
      const yr = t.getMonth() >= 3 ? t.getFullYear() + 1 : t.getFullYear()
      return `${yr}-03-31`
    })()

    ppf.forEach((r) => {
      alerts.push({
        id: `ppf-contrib-${r.asset_name}`,
        category: 'contribution',
        title: `PPF Contribution Deadline — ${r.asset_name}`,
        detail: 'Minimum ₹500 required; max ₹1,50,000 per year (80C eligible)',
        date: fyDate,
        daysLeft: fyDays,
        priority: priority(fyDays),
      })
    })

    ssy.forEach((r) => {
      alerts.push({
        id: `ssy-contrib-${r.asset_name}`,
        category: 'contribution',
        title: `SSY Contribution Deadline — ${r.asset_name}`,
        detail: 'Minimum ₹250 required; max ₹1,50,000 per year (80C eligible)',
        date: fyDate,
        daysLeft: fyDays,
        priority: priority(fyDays),
      })
    })
  }

  // Sort: urgent first, then by date
  const ORDER = { urgent: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => ORDER[a.priority] - ORDER[b.priority] || a.daysLeft - b.daysLeft)

  return { alerts, total: alerts.length, days }
}

module.exports = { all }
