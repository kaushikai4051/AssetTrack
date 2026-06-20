const CACHE_TTL = 5 * 60 // 5 minutes

const EXCHANGE_SUFFIX = { NSE: '.NS', BSE: '.BO', NASDAQ: '', NYSE: '', OTHER: '' }

function yahooSymbol(ticker, exchange) {
  return ticker.toUpperCase() + (EXCHANGE_SUFFIX[exchange] ?? '')
}

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function getStockPrice(ticker, exchange = 'NSE', redis = null) {
  const symbol   = yahooSymbol(ticker, exchange)
  const cacheKey = `cache:stock-price:${symbol}`

  if (redis) {
    const hit = await redis.get(cacheKey).catch(() => null)
    if (hit) return JSON.parse(hit)
  }

  const json = await fetchWithTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`
  )

  const meta = json?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) throw new Error(`No price data for ${symbol}`)

  const result = {
    ticker,
    symbol,
    price:    meta.regularMarketPrice,
    currency: meta.currency || 'INR',
    name:     meta.shortName || meta.longName || ticker,
    exchange: meta.fullExchangeName || exchange,
  }

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL).catch(() => null)
  }

  return result
}

module.exports = { getStockPrice }
