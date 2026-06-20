const MFAPI_BASE = process.env.MFAPI_URL || 'https://api.mfapi.in/mf'
const CACHE_TTL = 86_400 // 24 h in seconds

async function fetchWithTimeout(url, ms = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`MFAPI ${res.status}: ${url}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// Returns { nav, date, meta } — pulls latest entry from history array
async function getNav(schemeCode, redis) {
  const cacheKey = `cache:mf-nav:${schemeCode}`

  if (redis) {
    const hit = await redis.get(cacheKey).catch(() => null)
    if (hit) return JSON.parse(hit)
  }

  const json = await fetchWithTimeout(`${MFAPI_BASE}/${schemeCode}`)
  if (json.status !== 'SUCCESS' || !json.data?.length) {
    throw new Error(`No NAV data for scheme ${schemeCode}`)
  }

  const result = {
    nav: parseFloat(json.data[0].nav),
    date: json.data[0].date,
    meta: json.meta,
  }

  if (redis) {
    await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL).catch(() => null)
  }

  return result
}

// Returns array of { schemeCode, schemeName }
async function searchFunds(query) {
  const json = await fetchWithTimeout(`${MFAPI_BASE}/search?q=${encodeURIComponent(query)}`)
  return Array.isArray(json) ? json : []
}

module.exports = { getNav, searchFunds }
