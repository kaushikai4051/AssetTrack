const TROY_OZ_TO_GRAMS = 31.1035
const CACHE_TTL        = 3600 // 1 hour

async function fetchChart(symbol, ms = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
      { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!res.ok) throw new Error(`Yahoo Finance ${res.status} for ${symbol}`)
    const json = await res.json()
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
    if (!price) throw new Error(`No price in response for ${symbol}`)
    return price
  } finally {
    clearTimeout(timer)
  }
}

async function getGoldPrice(redis) {
  const cacheKey = 'cache:gold-price:INR'

  if (redis) {
    const hit = await redis.get(cacheKey).catch(() => null)
    if (hit) return JSON.parse(hit)
  }

  const [goldUsdPerOz, usdInr] = await Promise.all([
    fetchChart('GC=F'),    // Gold futures USD/troy oz
    fetchChart('USDINR=X'), // USD → INR spot
  ])

  const pricePerGram = Math.round((goldUsdPerOz / TROY_OZ_TO_GRAMS) * usdInr * 100) / 100

  const result = {
    price_per_gram: pricePerGram,
    gold_usd_per_oz: goldUsdPerOz,
    usd_inr: usdInr,
    currency: 'INR',
    unit: 'per gram (24k)',
  }

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL).catch(() => null)
  }

  return result
}

module.exports = { getGoldPrice }
