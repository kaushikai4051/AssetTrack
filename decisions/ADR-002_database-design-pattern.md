# ADR-002 · Database Design Pattern (Polymorphic Base Table)

- **Status**: Accepted
- **Date**: 2026-06-18
- **Decided by**: Claude (architecture design)

---

## Decision

Use a **polymorphic base table + type-specific child tables** pattern for assets.

- One `assets` table holds fields common to every asset: `user_id`, `asset_type` (enum), `asset_name`, `currency`, `current_value`, `invested_amount`, `is_active`.
- Each asset type (FD, mutual fund, stock, etc.) has its own child table linked by `asset_id` (1-to-1 foreign key) containing only type-specific fields.
- Transactional assets (mutual funds, stocks, PPF, loans) have an additional **transactions table** (1-to-many) for historical records.

---

## Context

There are 30+ distinct asset types, each with a different set of fields. The system needs to:
1. Query "all assets for user X" efficiently (for dashboard and net worth)
2. Store type-specific details without schema pollution
3. Support XIRR and capital gains calculations that require transaction history

---

## Options Considered

### Option A — Polymorphic base table (chosen)
```
assets (base) → fixed_deposits (child, 1:1)
             → mutual_funds (child, 1:1)
             → mutual_fund_transactions (1:many)
```
- `SELECT * FROM assets WHERE user_id = ?` gives all assets in one query
- Type detail requires one JOIN per type (acceptable — detail pages load one type at a time)

### Option B — Single table per asset type (30+ separate tables, no base)
- Dashboard query requires 30 UNION ALL statements
- Adding a cross-cutting field (e.g., `notes`) requires 30 ALTER TABLE migrations
- Ruled out.

### Option C — EAV (Entity-Attribute-Value)
- Single `asset_attributes` table with `(asset_id, key, value)` rows
- Extremely flexible but makes validation, indexing, and SQL queries brittle
- Financial data has fixed, well-known schemas — flexibility is not needed
- Ruled out.

### Option D — JSON blob per asset type
- Store type-specific data in a `details JSON` column on `assets`
- Easy to start, impossible to query/index specific fields (e.g., find all FDs maturing in 30 days)
- Ruled out.

---

## Consequences

- **Positive**: Dashboard query (`SELECT … FROM assets WHERE user_id = ?`) is always a single indexed scan.
- **Positive**: Adding a new cross-cutting field (e.g., `tags`) requires one migration on `assets` only.
- **Positive**: Type-specific schemas are enforced at the DB level with proper columns and constraints.
- **Trade-off**: Detail-page queries require one JOIN (e.g., `assets JOIN fixed_deposits`), which is acceptable — detail views always know the asset type.
- **Trade-off**: Adding a new asset type requires a new child table migration, but this is rare and deliberate.
