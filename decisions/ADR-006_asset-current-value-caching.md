# ADR-006 · Asset Current Value Caching Strategy

- **Status**: Accepted
- **Date**: 2026-06-18
- **Decided by**: Claude (architecture design)

---

## Decision

Store a **denormalized `current_value` column on the `assets` base table**, refreshed by a background cron job (daily). Raw transactions remain the source of truth; `current_value` is a calculated cache.

---

## Context

The dashboard needs to display net worth and asset allocation across all assets on every page load. Recalculating `current_value` from transactions at query time for every asset would be:
- Multiple table scans per asset type
- NAV / stock price fetch on every request (slow, rate-limited by external APIs)
- Unacceptable latency for a dashboard expected to load in < 2 seconds

---

## Options Considered

### Option A — Calculate on every request
- Always accurate to the second
- Requires fetching live prices for every holding on dashboard load
- External price APIs (MF NAV, stock price) have rate limits and add 100–500ms per call
- Not viable for a responsive dashboard.

### Option B — Cached `current_value` in `assets` table (chosen)
- Background job runs daily (6:30 AM) after price sync (6:00 AM)
- Updates `assets.current_value` and `assets.invested_amount` for all active assets
- Dashboard query: `SELECT SUM(current_value), asset_type FROM assets WHERE user_id = ?` — single indexed scan
- Staleness: at most 24 hours (acceptable for a personal tracker; prices shown with "as of [date]" label)
- Manually triggered refresh: user can hit "Refresh prices" button → fires price sync + value recalc for their portfolio only, result cached in Redis for 10 minutes

### Option C — Redis-only cache of computed totals
- Store `cache:dashboard:{userId}` with full summary in Redis, 5-minute TTL
- Fast reads, but cache population still requires a full recalc
- Used **in addition** to Option B: Redis caches the dashboard API response; `assets.current_value` is the source that populates the Redis cache

---

## Update Triggers

| Event | Action |
|---|---|
| New transaction added | Recalculate `current_value` for that specific `asset_id` only; invalidate `cache:dashboard:{userId}` |
| Asset edited (interest rate, units changed) | Same as above |
| Daily cron (6:30 AM) | Recalculate all active assets for all users using latest prices |
| User clicks "Refresh" | Recalculate user's portfolio only; cache result 10 min |

---

## Consequences

- **Positive**: Dashboard query is a single SQL aggregation — sub-100ms.
- **Positive**: No external API calls during a dashboard page load.
- **Positive**: Individual asset edits immediately update that asset's `current_value` without waiting for the daily job.
- **Trade-off**: Values are at most 24 hours stale. Acceptable for a personal finance tracker (not a trading platform). All pages display a "prices as of [timestamp]" note.
- **Trade-off**: `current_value` can drift from true value if the daily job fails. Monitoring/alerting on job failures is required before going to production.
