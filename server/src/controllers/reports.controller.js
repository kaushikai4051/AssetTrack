const { query, queryOne } = require('../models/db')

function fyBounds(fy) {
  // fy = '2024-25' → start = 2024-04-01, end = 2025-03-31
  const year = parseInt(fy.split('-')[0])
  return { start: `${year}-04-01`, end: `${year + 1}-03-31` }
}

function currentFY() {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return `${year}-${String(year + 1).slice(-2)}`
}

function buildFYOptions() {
  const now = new Date()
  const base = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 5 }, (_, i) => {
    const y = base - i
    return `${y}-${String(y + 1).slice(-2)}`
  })
}

const LIABILITY_TYPES = [
  'home_loan', 'car_loan', 'personal_loan', 'education_loan',
  'lap_loan', 'gold_loan', 'credit_card_debt',
]

const CATEGORY_MAP = {
  fixed_deposit: 'Bank Accounts', recurring_deposit: 'Bank Accounts', savings_account: 'Bank Accounts',
  mutual_fund: 'Mutual Funds', stock: 'Stocks', gold: 'Gold',
  corporate_bond: 'Bonds', gsec_bond: 'Bonds', tax_free_bond: 'Bonds',
  ppf: 'Govt Schemes', nps: 'Govt Schemes', epf: 'Govt Schemes',
  ssy: 'Govt Schemes', nsc: 'Govt Schemes', scss: 'Govt Schemes',
  kvp: 'Govt Schemes', post_office: 'Govt Schemes',
  life_insurance: 'Insurance', health_insurance: 'Insurance', vehicle_insurance: 'Insurance',
  property: 'Real Estate', reit: 'Real Estate',
  crypto: 'Alternatives', chit_fund: 'Alternatives', p2p_lending: 'Alternatives',
  angel_investment: 'Alternatives', unlisted_shares: 'Alternatives',
}

// ── 1. Net worth snapshot ─────────────────────────────────────────────────────

async function netWorthSnapshot(request, reply) {
  const userId = request.user.id
  const db = request.server.db
  const liabPh = LIABILITY_TYPES.map(() => '?').join(',')

  const rows = await query(db,
    `SELECT asset_name, asset_type, current_value, invested_amount
     FROM assets WHERE user_id = ? AND is_active = 1
     ORDER BY asset_type, asset_name`,
    [userId]
  ).catch(() => [])

  const catMap = {}
  let totalAssets = 0
  let totalLiabilities = 0

  rows.forEach((r) => {
    const isLiab = LIABILITY_TYPES.includes(r.asset_type)
    const val = parseFloat(r.current_value || 0)
    const inv = parseFloat(r.invested_amount || 0)
    const cat = isLiab ? 'Liabilities' : (CATEGORY_MAP[r.asset_type] || 'Other')

    if (!catMap[cat]) catMap[cat] = { items: [], total: 0, isLiab }
    catMap[cat].items.push({ name: r.asset_name, type: r.asset_type, current: val, invested: inv })
    catMap[cat].total += val
    if (isLiab) totalLiabilities += val
    else totalAssets += val
  })

  const categories = Object.entries(catMap).map(([name, v]) => ({
    name,
    isLiability: v.isLiab,
    total: Math.round(v.total),
    items: v.items.map((i) => ({ ...i, current: Math.round(i.current), invested: Math.round(i.invested) })),
  }))

  return {
    categories,
    totalAssets: Math.round(totalAssets),
    totalLiabilities: Math.round(totalLiabilities),
    netWorth: Math.round(totalAssets - totalLiabilities),
    asOf: new Date().toISOString().slice(0, 10),
    fyOptions: buildFYOptions(),
  }
}

// ── 2. Interest & income report ───────────────────────────────────────────────

async function interestIncome(request, reply) {
  const userId = request.user.id
  const db = request.server.db
  const fy = request.query.fy || currentFY()
  const { start, end } = fyBounds(fy)

  const [fdRows, bondCoupons, ppfInterest, savingsRows] = await Promise.all([

    // FD: accrue interest = current_value - invested_amount for active FDs
    // (approximate; shown as "total accrued since start")
    query(db,
      `SELECT a.asset_name, fd.bank_name, fd.interest_rate, fd.start_date,
              a.invested_amount AS principal, a.current_value,
              (a.current_value - a.invested_amount) AS interest_earned
       FROM fixed_deposits fd JOIN assets a ON a.id = fd.asset_id
       WHERE a.user_id = ? AND a.is_active = 1
       ORDER BY fd.bank_name, a.asset_name`,
      [userId]
    ).catch(() => []),

    // Bond coupon payments received in FY
    query(db,
      `SELECT a.asset_name, bh.issuer, bh.coupon_rate,
              SUM(bcp.amount) AS coupon_received
       FROM bond_coupon_payments bcp
       JOIN assets a ON a.id = bcp.asset_id
       JOIN bond_holdings bh ON bh.asset_id = bcp.asset_id
       WHERE a.user_id = ? AND bcp.payment_date BETWEEN ? AND ?
       GROUP BY a.id, a.asset_name, bh.issuer, bh.coupon_rate
       ORDER BY coupon_received DESC`,
      [userId, start, end]
    ).catch(() => []),

    // PPF interest credited in FY
    query(db,
      `SELECT a.asset_name, SUM(pt.interest_earned) AS interest_earned
       FROM ppf_transactions pt JOIN assets a ON a.id = pt.asset_id
       WHERE a.user_id = ? AND pt.financial_year = ? AND pt.interest_earned > 0
       GROUP BY a.id, a.asset_name`,
      [userId, fy]
    ).catch(() => []),

    // Savings accounts: interest = current_value - invested_amount (if any)
    query(db,
      `SELECT a.asset_name, sa.bank_name, sa.interest_rate,
              (a.current_value - a.invested_amount) AS interest_earned
       FROM savings_accounts sa JOIN assets a ON a.id = sa.asset_id
       WHERE a.user_id = ? AND a.is_active = 1
         AND a.current_value > a.invested_amount`,
      [userId]
    ).catch(() => []),
  ])

  const fdIncome = fdRows.map((r) => ({
    source: r.asset_name,
    detail: `${r.bank_name} @ ${r.interest_rate}%`,
    type: 'FD Interest',
    amount: Math.round(parseFloat(r.interest_earned || 0)),
  })).filter((r) => r.amount > 0)

  const bondIncome = bondCoupons.map((r) => ({
    source: r.asset_name,
    detail: `${r.issuer} @ ${r.coupon_rate}%`,
    type: 'Bond Coupon',
    amount: Math.round(parseFloat(r.coupon_received || 0)),
  }))

  const ppfIncome = ppfInterest.map((r) => ({
    source: r.asset_name,
    detail: 'PPF interest (tax-free)',
    type: 'PPF Interest',
    amount: Math.round(parseFloat(r.interest_earned || 0)),
  }))

  const savingsIncome = savingsRows.map((r) => ({
    source: r.asset_name,
    detail: `${r.bank_name} @ ${r.interest_rate}%`,
    type: 'Savings Interest',
    amount: Math.round(parseFloat(r.interest_earned || 0)),
  })).filter((r) => r.amount > 0)

  const allIncome = [...fdIncome, ...bondIncome, ...ppfIncome, ...savingsIncome]
    .sort((a, b) => b.amount - a.amount)

  const totalIncome = allIncome.reduce((s, r) => s + r.amount, 0)

  return { fy, income: allIncome, totalIncome, fyOptions: buildFYOptions() }
}

// ── 3. Insurance summary ──────────────────────────────────────────────────────

async function insuranceSummary(request, reply) {
  const userId = request.user.id
  const db = request.server.db

  const rows = await query(db,
    `SELECT a.asset_name, ip.insurer, ip.policy_number, ip.insurance_type,
            ip.sum_assured, ip.sum_insured, ip.annual_premium, ip.premium_mode,
            ip.policy_term_years, ip.start_date, ip.maturity_date, ip.next_due_date
     FROM insurance_policies ip JOIN assets a ON a.id = ip.asset_id
     WHERE a.user_id = ? AND a.is_active = 1
     ORDER BY ip.insurance_type, a.asset_name`,
    [userId]
  ).catch(() => [])

  const TYPE_LABEL = {
    term: 'Term Life', endowment: 'Endowment', money_back: 'Money Back',
    ulip: 'ULIP', lic_other: 'LIC Other',
    health_individual: 'Health (Individual)', health_floater: 'Health (Floater)',
    health_super_topup: 'Health (Super Top-up)',
    vehicle_third_party: 'Vehicle (3rd Party)', vehicle_comprehensive: 'Vehicle (Comprehensive)',
    critical_illness: 'Critical Illness', accident: 'Accident',
  }

  const grouped = {}
  let totalPremium = 0
  let totalLifeCover = 0
  let totalHealthCover = 0

  rows.forEach((r) => {
    const label = TYPE_LABEL[r.insurance_type] || r.insurance_type
    const group = r.insurance_type.startsWith('health') ? 'Health'
      : r.insurance_type.startsWith('vehicle') ? 'Vehicle'
      : 'Life'

    if (!grouped[group]) grouped[group] = []
    const premium = parseFloat(r.annual_premium || 0)
    const cover = parseFloat(r.sum_assured || r.sum_insured || 0)

    grouped[group].push({
      name: r.asset_name,
      insurer: r.insurer,
      policyNumber: r.policy_number,
      type: label,
      cover: Math.round(cover),
      premium: Math.round(premium),
      mode: r.premium_mode,
      termYears: r.policy_term_years,
      startDate: r.start_date ? String(r.start_date).slice(0, 10) : null,
      maturityDate: r.maturity_date ? String(r.maturity_date).slice(0, 10) : null,
      nextDueDate: r.next_due_date ? String(r.next_due_date).slice(0, 10) : null,
    })

    totalPremium += premium
    if (group === 'Life') totalLifeCover += cover
    if (group === 'Health') totalHealthCover += cover
  })

  return {
    groups: grouped,
    totalPremium: Math.round(totalPremium),
    totalLifeCover: Math.round(totalLifeCover),
    totalHealthCover: Math.round(totalHealthCover),
    policyCount: rows.length,
  }
}

// ── 4. Loan statement ─────────────────────────────────────────────────────────

async function loanStatement(request, reply) {
  const userId = request.user.id
  const db = request.server.db

  const loans = await query(db,
    `SELECT a.id AS asset_id, a.asset_name,
            l.loan_type, l.lender, l.loan_amount, l.interest_rate,
            l.emi_amount, l.tenure_months, l.disbursement_date,
            l.outstanding_principal, l.is_closed
     FROM loans l JOIN assets a ON a.id = l.asset_id
     WHERE a.user_id = ? AND a.is_active = 1
     ORDER BY l.disbursement_date DESC`,
    [userId]
  ).catch(() => [])

  const results = await Promise.all(loans.map(async (loan) => {
    const txRows = await query(db,
      `SELECT principal_paid, interest_paid, total_paid, transaction_date, is_prepayment
       FROM loan_transactions WHERE asset_id = ? ORDER BY transaction_date ASC`,
      [loan.asset_id]
    ).catch(() => [])

    const totalPrincipalPaid = txRows.reduce((s, t) => s + parseFloat(t.principal_paid || 0), 0)
    const totalInterestPaid = txRows.reduce((s, t) => s + parseFloat(t.interest_paid || 0), 0)
    const totalPaid = txRows.reduce((s, t) => s + parseFloat(t.total_paid || 0), 0)
    const prepayments = txRows.filter((t) => t.is_prepayment).reduce((s, t) => s + parseFloat(t.total_paid || 0), 0)
    const emiCount = txRows.filter((t) => !t.is_prepayment).length

    return {
      name: loan.asset_name,
      lender: loan.lender,
      type: loan.loan_type,
      loanAmount: parseFloat(loan.loan_amount || 0),
      interestRate: parseFloat(loan.interest_rate || 0),
      emiAmount: parseFloat(loan.emi_amount || 0),
      tenureMonths: loan.tenure_months,
      disbursementDate: loan.disbursement_date ? String(loan.disbursement_date).slice(0, 10) : null,
      outstanding: parseFloat(loan.outstanding_principal || 0),
      isClosed: !!loan.is_closed,
      totalPrincipalPaid: Math.round(totalPrincipalPaid),
      totalInterestPaid: Math.round(totalInterestPaid),
      totalPaid: Math.round(totalPaid),
      prepayments: Math.round(prepayments),
      emiCount,
      recentTransactions: txRows.slice(-5).reverse().map((t) => ({
        date: String(t.transaction_date).slice(0, 10),
        principalPaid: Math.round(parseFloat(t.principal_paid || 0)),
        interestPaid: Math.round(parseFloat(t.interest_paid || 0)),
        totalPaid: Math.round(parseFloat(t.total_paid || 0)),
        isPrepayment: !!t.is_prepayment,
      })),
    }
  }))

  const totalOutstanding = results.reduce((s, l) => s + l.outstanding, 0)
  const totalInterestPaid = results.reduce((s, l) => s + l.totalInterestPaid, 0)

  return {
    loans: results,
    totalOutstanding: Math.round(totalOutstanding),
    totalInterestPaid: Math.round(totalInterestPaid),
  }
}

module.exports = { netWorthSnapshot, interestIncome, insuranceSummary, loanStatement }
