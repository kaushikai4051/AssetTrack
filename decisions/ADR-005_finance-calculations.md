# ADR-005 · Finance Calculations on Server Side

- **Status**: Accepted
- **Date**: 2026-06-18
- **Decided by**: Claude (architecture design)

---

## Decision

All financial calculations (XIRR, CAGR, capital gains, EMI amortization, tax deduction aggregation) are performed **on the server** in the `server/src/services/finance/` layer. The frontend receives only the computed result values.

---

## Context

The app needs to compute:
- **XIRR** — requires iterative Newton-Raphson over potentially hundreds of dated cash flows
- **Capital gains** — India-specific rules: LTCG/STCG thresholds, indexation (CII), grandfathering (Jan 31 2018), and post-April-2023 MF rule changes
- **EMI amortization** — month-by-month reducing balance schedule
- **Tax deduction totals** — 80C basket aggregated across multiple assets and family members

These calculations reference data from the database (transaction history, purchase lots, interest rates). Doing them on the frontend would require shipping all raw transaction data to the client on every load.

---

## Options Considered

### Option A — Client-side calculations
- Ship all transactions to frontend; calculate in browser using a JS finance library
- **Problems**:
  - Sensitive raw data (all purchase prices, amounts) always sent over the wire even when not displayed
  - Tax rule logic duplicated or shipped to the client
  - Heavy computation on low-end mobile devices
  - Hard to cache: re-calculated on every render

### Option B — Server-side calculations (chosen)
- Controller calls `services/finance/xirr.js` with transaction data queried from DB
- Returns only the result: `{ xirr: 0.1423, absoluteReturn: 0.52, currentValue: 152000 }`
- Results cached in Redis (keyed by `asset_id` + `last_updated`) and invalidated when a new transaction is added

### Option C — Dedicated calculation microservice
- Separate Node.js service just for math
- Unnecessary complexity for this scale — the Fastify server handles it fine
- Ruled out.

---

## Finance Module Structure

```
server/src/services/finance/
├── xirr.js            # XIRR via Newton-Raphson (handles edge cases: all-positive, no-solution)
├── cagr.js            # CAGR = (endValue / startValue)^(1/years) - 1
├── emi.js             # EMI formula + full amortization schedule generator
├── capitalGains.js    # LTCG/STCG split per lot, indexation with CII table, grandfathering
└── returns.js         # Absolute return %, annualized return wrapper
```

---

## Tax Rule Encoding (India-specific, as of FY 2024-25)

The `capitalGains.js` module encodes these rules as explicit constants:
- Equity LTCG threshold: 1 year holding, ₹1L annual exemption, 10% above
- Equity STCG: 15% flat
- Debt MF purchased after April 1, 2023: slab rate regardless of holding
- Gold / Real estate LTCG: 3 years / 2 years respectively, 20% with indexation
- CII (Cost Inflation Index) table: hardcoded for all years from 2001-02, updated annually

---

## Consequences

- **Positive**: Sensitive transaction history never leaves the server unnecessarily.
- **Positive**: Calculation results cacheable in Redis, reducing DB load on repeated dashboard loads.
- **Positive**: Tax rule changes require updating one server-side module, not a client bundle re-deploy.
- **Risk**: India tax rules change frequently (budget announcements). The CII table and rate constants in `capitalGains.js` must be reviewed each April. Mitigate by documenting which constants map to which budget year.
