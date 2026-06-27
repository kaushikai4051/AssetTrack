const { query } = require('../models/db')
const { classifyLots } = require('../finance/capitalGains')

// Indian FY: Apr 1 – Mar 31.  fy = "2024-25"
function parseFY(fy) {
  const [startYear] = fy.split('-').map(Number)
  return {
    start: new Date(`${startYear}-04-01`),
    end:   new Date(`${startYear + 1}-03-31T23:59:59`),
  }
}

function inFY(dateStr, start, end) {
  const d = new Date(dateStr)
  return d >= start && d <= end
}

// ── Stocks (FIFO via existing classifyLots) ───────────────────────────────────

async function stockGains(db, userId, start, end) {
  const holdings = await query(db,
    `SELECT sh.id, sh.ticker, sh.company_name, sh.last_price
     FROM stock_holdings sh JOIN assets a ON a.id = sh.asset_id
     WHERE a.user_id = ? AND a.is_active = 1`,
    [userId]
  )
  if (!holdings.length) return []

  const ids = holdings.map((h) => h.id)
  const txRows = await query(db,
    `SELECT holding_id, type, transaction_date, shares, price
     FROM stock_transactions WHERE holding_id IN (${ids.map(() => '?').join(',')})
     ORDER BY holding_id, transaction_date`,
    ids
  )
  const txByHolding = {}
  for (const t of txRows) {
    ;(txByHolding[t.holding_id] = txByHolding[t.holding_id] || []).push(t)
  }

  const result = []
  for (const h of holdings) {
    const txs      = txByHolding[h.id] || []
    const lastPrice = parseFloat(h.last_price) || 0
    const { realised } = classifyLots(txs, lastPrice)

    const fyRealised = realised.filter((r) => inFY(r.sellDate, start, end))
    if (!fyRealised.length) continue

    let ltcg = 0, stcg = 0
    for (const r of fyRealised) {
      if (r.isLTCG) ltcg += r.gain
      else stcg += r.gain
    }

    result.push({
      asset_type: 'stock',
      name:       h.company_name,
      ticker:     h.ticker,
      ltcg:       Math.round(ltcg * 100) / 100,
      stcg:       Math.round(stcg * 100) / 100,
      lots:       fyRealised.length,
    })
  }
  return result
}

// ── Mutual Funds (FIFO on units) ──────────────────────────────────────────────

const MF_INFLOW = new Set(['purchase', 'dividend_reinvest', 'switch_in'])

function mfLotClassify(txs, fyStart, fyEnd) {
  const sorted = [...txs].sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date))
  const lots   = []
  const results = { equity_ltcg: 0, equity_stcg: 0, debt_income: 0, lotCount: 0 }

  for (const t of sorted) {
    const units = parseFloat(t.units)
    const nav   = parseFloat(t.nav) || 0

    if (MF_INFLOW.has(t.type)) {
      lots.push({ date: new Date(t.transaction_date), costNav: nav, remaining: units })
    } else if (t.type === 'redemption' || t.type === 'switch_out') {
      if (!inFY(t.transaction_date, fyStart, fyEnd)) {
        // consume lots without recording gain (redemption outside FY)
        let toRedeem = units
        for (const lot of lots) {
          if (lot.remaining <= 0 || toRedeem <= 0) continue
          const used = Math.min(lot.remaining, toRedeem)
          lot.remaining -= used
          toRedeem      -= used
        }
        continue
      }
      let toRedeem = units
      for (const lot of lots) {
        if (lot.remaining <= 0 || toRedeem <= 0) continue
        const used     = Math.min(lot.remaining, toRedeem)
        const holdDays = (new Date(t.transaction_date) - lot.date) / 86_400_000
        const gain     = (nav - lot.costNav) * used
        lot.remaining -= used
        toRedeem      -= used
        results.lotCount++

        if (t.fund_category === 'Debt' || t.fund_category === 'Liquid' || t.fund_category === 'Money Market') {
          results.debt_income += gain
        } else {
          if (holdDays > 365) results.equity_ltcg += gain
          else                results.equity_stcg += gain
        }
      }
    }
  }
  return results
}

async function mfGains(db, userId, start, end) {
  const funds = await query(db,
    `SELECT mf.id, mf.scheme_name, mf.category, mf.last_nav
     FROM mutual_funds mf JOIN assets a ON a.id = mf.asset_id
     WHERE a.user_id = ? AND a.is_active = 1`,
    [userId]
  )
  if (!funds.length) return []

  const ids = funds.map((f) => f.id)
  const txRows = await query(db,
    `SELECT fund_id, type, transaction_date, units, nav, amount
     FROM mutual_fund_transactions WHERE fund_id IN (${ids.map(() => '?').join(',')})
     ORDER BY fund_id, transaction_date`,
    ids
  )

  const txByFund = {}
  for (const t of txRows) {
    ;(txByFund[t.fund_id] = txByFund[t.fund_id] || []).push({ ...t, fund_category: '' })
  }

  const result = []
  for (const f of funds) {
    const txs = (txByFund[f.id] || []).map((t) => ({ ...t, fund_category: f.category }))
    const hasRedemptionInFY = txs.some(
      (t) => (t.type === 'redemption' || t.type === 'switch_out') && inFY(t.transaction_date, start, end)
    )
    if (!hasRedemptionInFY) continue

    const g = mfLotClassify(txs, start, end)
    if (g.equity_ltcg === 0 && g.equity_stcg === 0 && g.debt_income === 0) continue

    result.push({
      asset_type:   'mutual_fund',
      name:         f.scheme_name,
      category:     f.category,
      ltcg:         Math.round(g.equity_ltcg * 100) / 100,
      stcg:         Math.round(g.equity_stcg * 100) / 100,
      debt_income:  Math.round(g.debt_income * 100) / 100,
      lots:         g.lotCount,
    })
  }
  return result
}

// ── Tax liability computation ─────────────────────────────────────────────────

// Rates: post Union Budget 2024 (Jul 23 2024)
const EQUITY_LTCG_RATE    = 0.125   // 12.5%
const EQUITY_STCG_RATE    = 0.20    // 20%
const EQUITY_LTCG_EXEMPT  = 125000  // ₹1.25L per year (equity + equity MF combined)

function computeTax(stockItems, mfItems) {
  let totalEquityLTCG = 0
  let totalEquitySTCG = 0
  let totalDebtIncome = 0

  for (const s of stockItems)  { totalEquityLTCG += s.ltcg; totalEquitySTCG += s.stcg }
  for (const m of mfItems)     { totalEquityLTCG += m.ltcg; totalEquitySTCG += m.stcg; totalDebtIncome += m.debt_income }

  const taxableLTCG = Math.max(0, totalEquityLTCG - EQUITY_LTCG_EXEMPT)
  const ltcgTax     = Math.round(taxableLTCG * EQUITY_LTCG_RATE * 100) / 100
  const stcgTax     = Math.round(totalEquitySTCG * EQUITY_STCG_RATE * 100) / 100

  return {
    equity_ltcg:         Math.round(totalEquityLTCG * 100) / 100,
    equity_stcg:         Math.round(totalEquitySTCG * 100) / 100,
    equity_ltcg_exempt:  EQUITY_LTCG_EXEMPT,
    taxable_ltcg:        Math.round(taxableLTCG * 100) / 100,
    debt_income:         Math.round(totalDebtIncome * 100) / 100,
    ltcg_tax:            ltcgTax,
    stcg_tax:            stcgTax,
    total_cg_tax:        Math.round((ltcgTax + stcgTax) * 100) / 100,
  }
}

// ── Harvest suggestions (unrealized) ─────────────────────────────────────────

async function harvestSuggestions(db, userId) {
  // Stocks with unrealized losses
  const holdings = await query(db,
    `SELECT sh.id, sh.ticker, sh.company_name, sh.last_price, sh.shares_held, sh.avg_cost_price
     FROM stock_holdings sh JOIN assets a ON a.id = sh.asset_id
     WHERE a.user_id = ? AND a.is_active = 1 AND sh.last_price > 0`,
    [userId]
  )

  const ids = holdings.length ? holdings.map((h) => h.id) : []
  const txMap = {}
  if (ids.length) {
    const txRows = await query(db,
      `SELECT holding_id, type, transaction_date, shares, price
       FROM stock_transactions WHERE holding_id IN (${ids.map(() => '?').join(',')})
       ORDER BY holding_id, transaction_date`,
      ids
    )
    for (const t of txRows) {
      ;(txMap[t.holding_id] = txMap[t.holding_id] || []).push(t)
    }
  }

  const losers  = []
  const gainers = []

  for (const h of holdings) {
    const lastPrice = parseFloat(h.last_price) || 0
    const { ltcgGain, stcgGain } = classifyLots(txMap[h.id] || [], lastPrice)
    const unrealizedGain = ltcgGain + stcgGain

    const item = {
      asset_type:      'stock',
      name:            h.company_name,
      ticker:          h.ticker,
      unrealized_gain: Math.round(unrealizedGain * 100) / 100,
      ltcg:            Math.round(ltcgGain * 100) / 100,
      stcg:            Math.round(stcgGain * 100) / 100,
    }
    if (unrealizedGain < 0) losers.push(item)
    else if (unrealizedGain > 0) gainers.push(item)
  }

  losers.sort((a, b)  => a.unrealized_gain - b.unrealized_gain)
  gainers.sort((a, b) => b.unrealized_gain - a.unrealized_gain)

  const totalLoss = losers.reduce((s, l) => s + l.unrealized_gain, 0)
  const totalGain = gainers.reduce((s, g) => s + g.unrealized_gain, 0)

  return {
    losers,
    gainers,
    total_harvestable_loss: Math.round(Math.abs(totalLoss) * 100) / 100,
    total_unrealized_gain:  Math.round(totalGain * 100) / 100,
    potential_tax_saving:   Math.round(Math.abs(totalLoss) * EQUITY_STCG_RATE * 100) / 100,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getRealizedGains(db, userId, fy) {
  const { start, end } = parseFY(fy)
  const [stocks, mfs]  = await Promise.all([
    stockGains(db, userId, start, end),
    mfGains(db, userId, start, end),
  ])
  const tax = computeTax(stocks, mfs)
  return { fy, stocks, mutual_funds: mfs, tax }
}

module.exports = { getRealizedGains, harvestSuggestions, parseFY }
