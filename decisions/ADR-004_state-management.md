# ADR-004 · Frontend State Management

- **Status**: Accepted
- **Date**: 2026-06-18
- **Decided by**: Claude (architecture design)

---

## Decision

Split frontend state into two distinct layers:

- **Zustand** — client-only UI state (auth session, sidebar open/close, active modal, theme, active family member filter, active financial year)
- **TanStack Query (React Query v5)** — all server state (API data, caching, background refetch, mutations)

---

## Context

The app has two clearly different types of state:
1. **Server state**: asset lists, dashboard data, goals, tax summary — fetched from the API, needs caching, background sync, and optimistic updates.
2. **UI state**: whether the sidebar is open, which modal is active, the selected family member — lives only in the browser, never persisted to the server.

Mixing these into a single store (Redux/Zustand for everything) causes unnecessary complexity: manual cache invalidation, loading state management, and refetch logic all have to be hand-coded.

---

## Options Considered

### Option A — Redux Toolkit + RTK Query
- Full-featured, well-tested, good devtools
- Significant boilerplate for slice/action/thunk setup
- RTK Query is excellent but opinionated; adds bundle size
- Overkill for a single-developer project with no existing Redux expertise indicated

### Option B — Zustand for everything
- Simple, but managing server state (fetching, caching, error/loading states, background refresh) in Zustand requires reinventing what TanStack Query already does well
- Ruled out.

### Option C — TanStack Query only
- Covers server state perfectly
- Global UI state (sidebar, auth user) is awkward to put in a Query — not a "query"
- Would require React Context for UI state, which adds boilerplate

### Option D — Zustand + TanStack Query (chosen)
- Each tool does what it's best at
- Zustand stores are tiny, no boilerplate:
  ```js
  // authStore.js
  const useAuthStore = create((set) => ({
    user: null,
    login: (user) => set({ user }),
    logout: () => set({ user: null })
  }))
  ```
- TanStack Query handles all API data:
  ```js
  const { data } = useQuery({ queryKey: ['assets', 'mutual-funds'], queryFn: fetchMutualFunds })
  ```
- Both have excellent React devtools

---

## Zustand Store Responsibilities

| Store | Contents |
|---|---|
| `authStore` | `user`, `isLoggedIn`, `login()`, `logout()` |
| `uiStore` | `sidebarOpen`, `activeModal`, `theme` |
| `filterStore` | `activeMemberId`, `activeFY` (financial year) |

## TanStack Query Key Conventions

```js
['dashboard', 'summary']
['assets', assetType]             // list
['assets', assetType, id]         // detail
['assets', assetType, id, 'transactions']
['goals']
['goals', id]
['tax', 'summary', fy]
['tax', 'capital-gains', fy]
['notifications']
```

---

## Consequences

- **Positive**: Server data is automatically cached, deduplicated, and stale-while-revalidate.
- **Positive**: Mutations via `useMutation` automatically invalidate related queries.
- **Positive**: UI state is trivially simple — 5-line Zustand stores.
- **Trade-off**: Two mental models to learn (Zustand for UI, TanStack Query for server). Both are well-documented with small APIs.
