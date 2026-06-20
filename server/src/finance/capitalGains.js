// FIFO lot classification for Indian equity capital gains.
// Returns unrealised LTCG / STCG split for the remaining open position.
// For realised gains (sold lots), see the returned `realised` array.

function classifyLots(transactions, lastPrice = 0, asOfDate = new Date()) {
  const txns = [...transactions].sort(
    (a, b) => new Date(a.transaction_date) - new Date(b.transaction_date)
  )

  // Open lots: { date, costPerShare, remaining }
  const lots = []
  const realised = [] // { buyDate, sellDate, shares, costPerShare, sellPrice, holdDays, isLTCG, gain }

  for (const t of txns) {
    const shares = parseFloat(t.shares)
    const price  = parseFloat(t.price) || 0

    switch (t.type) {
      case 'buy':
        lots.push({ date: new Date(t.transaction_date), costPerShare: price, remaining: shares })
        break

      case 'bonus':
        lots.push({ date: new Date(t.transaction_date), costPerShare: 0, remaining: shares })
        break

      case 'split': {
        // shares = split ratio (e.g. 2 for 2-for-1)
        const ratio = shares
        for (const lot of lots) {
          if (lot.remaining > 0) {
            lot.costPerShare = lot.costPerShare / ratio
            lot.remaining    = lot.remaining * ratio
          }
        }
        break
      }

      case 'sell': {
        let toSell = shares
        for (const lot of lots) {
          if (lot.remaining <= 0 || toSell <= 0) continue
          const used     = Math.min(lot.remaining, toSell)
          const holdDays = (new Date(t.transaction_date) - lot.date) / 86_400_000
          realised.push({
            buyDate:      lot.date.toISOString().slice(0, 10),
            sellDate:     t.transaction_date,
            shares:       used,
            costPerShare: lot.costPerShare,
            sellPrice:    price,
            holdDays,
            isLTCG:       holdDays > 365,
            gain:         (price - lot.costPerShare) * used,
          })
          lot.remaining -= used
          toSell        -= used
        }
        break
      }
    }
  }

  // Classify remaining open lots
  let ltcgShares = 0, stcgShares = 0
  let ltcgCost   = 0, stcgCost   = 0
  let ltcgGain   = 0, stcgGain   = 0

  for (const lot of lots) {
    if (lot.remaining <= 0) continue
    const holdDays = (asOfDate - lot.date) / 86_400_000
    const gain     = (lastPrice - lot.costPerShare) * lot.remaining
    if (holdDays > 365) {
      ltcgShares += lot.remaining
      ltcgCost   += lot.remaining * lot.costPerShare
      ltcgGain   += gain
    } else {
      stcgShares += lot.remaining
      stcgCost   += lot.remaining * lot.costPerShare
      stcgGain   += gain
    }
  }

  return {
    ltcgShares:  Math.round(ltcgShares * 10000) / 10000,
    stcgShares:  Math.round(stcgShares * 10000) / 10000,
    ltcgGain:    Math.round(ltcgGain * 100) / 100,
    stcgGain:    Math.round(stcgGain * 100) / 100,
    realised,
  }
}

module.exports = { classifyLots }
