# ADR-007 · Market Price Data Sources

- **Status**: Accepted
- **Date**: 2026-06-18
- **Decided by**: Claude (architecture design)

---

## Decision

Use **free public APIs** for all market price data in v1. No paid data subscriptions until user growth justifies cost.

| Data Type | Source | Endpoint | Cache TTL |
|---|---|---|---|
| Mutual Fund NAV | MFAPI.in | `GET https://api.mfapi.in/mf/{schemeCode}` | 24 hours |
| Stock prices (Indian) | NSE India (unofficial) or Yahoo Finance | REST | 5 minutes |
| Gold price (INR/gram) | GoldAPI.io (free tier) or MCX public feed | REST | 1 hour |
| Crypto prices | CoinGecko API (free tier) | `GET /simple/price?ids=...&vs_currencies=inr` | 15 minutes |
| IFSC / Bank lookup | Razorpay IFSC API (`ifsc.razorpay.com`) | REST | Permanent (no change) |

---

## Context

Price data is needed for:
- Daily portfolio valuation (current value of MF units, stocks, gold, crypto)
- NAV auto-fill when user adds a mutual fund transaction
- Live price display on asset detail pages

---

## Constraints

- Free tiers have rate limits (CoinGecko: 10–30 req/min; MFAPI: reasonable limits)
- NSE stock price APIs are unofficial and can change without notice
- All external calls must be cached in Redis to avoid hitting rate limits

---

## Data Flow

```
Background job (6:00 AM daily):
  → Fetch all distinct ISINs/tickers/coins for active assets
  → Batch-fetch prices from external APIs
  → Store in market_prices table (date-stamped)
  → Store in Redis with TTL

User-triggered (asset detail page):
  → Check Redis cache first
  → If miss or stale → fetch from external API → update Redis
```

---

## Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| NSE unofficial API breaks | Fall back to Yahoo Finance; show last-known price with staleness warning |
| CoinGecko rate limit hit | Batch all coin IDs in one request; increase cache TTL to 1 hour |
| MFAPI.in downtime | Use AMFI website CSV as fallback (`https://www.amfiindia.com/spages/NAVAll.txt`) |
| Gold API free tier exhausted | Switch to MCX scrape or manual entry fallback |

---

## Future (out of scope v1)

- NSE/BSE official API (requires registration and may have cost)
- Angel Broking / Zerodha Kite Connect WebSocket for real-time stock prices
- Bloomberg / Refinitiv for institutional-grade data

---

## Consequences

- **Positive**: Zero cost to run in development and for early users.
- **Positive**: MFAPI.in and AMFI are highly reliable for Indian MF data.
- **Trade-off**: Stock prices from unofficial NSE API may be delayed 15 minutes (NSE policy for free data). Acceptable for a tracker; not acceptable for a trading tool (which this is not).
- **Trade-off**: If any free API changes its contract, price data silently becomes stale. The daily job must log failures and write a `job_status` record so operators can detect and act.
