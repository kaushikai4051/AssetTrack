# ADR-001 · Tech Stack Selection

- **Status**: Accepted
- **Date**: 2026-06-18
- **Decided by**: User

---

## Decision

| Layer | Chosen |
|---|---|
| Frontend framework | React 18 + Vite (SPA) |
| UI components | shadcn/ui + Tailwind CSS |
| Backend framework | Node.js + Fastify |
| API style | REST |
| Primary database | MySQL 8 |
| Cache / sessions | Redis 7 |
| Language | JavaScript (no TypeScript) |
| Deployment | Local dev first; cloud TBD |

---

## Context

The application is a personal finance tracker for Indian investors covering 10+ asset classes. It needs a fast, interactive UI (dashboard with charts), a structured relational database (financial data is highly relational), and a performant API layer.

---

## Options Considered

### Frontend
| Option | Reason not chosen |
|---|---|
| Next.js | SSR complexity unnecessary for an authenticated SPA |
| Vue / Nuxt | Smaller ecosystem; team familiarity favors React |
| Angular | Overkill for single-developer project |

### Backend
| Option | Reason not chosen |
|---|---|
| Python + FastAPI | User prefers JS full-stack; no data science workloads |
| Java + Spring Boot | Too heavyweight for this scale |
| Go | Smaller ecosystem; JS full-stack is simpler to maintain |

### Database
| Option | Reason not chosen |
|---|---|
| PostgreSQL | Functionally equivalent; user has MySQL familiarity |
| MongoDB | Financial data is highly relational; NoSQL adds complexity |
| SQLite | Not suitable for multi-user or production |

### Language
| Option | Reason not chosen |
|---|---|
| TypeScript | User prefers plain JS; less boilerplate to start |

---

## Consequences

- **Positive**: Single language (JS) across client and server reduces context switching.
- **Positive**: Vite provides extremely fast HMR during development.
- **Positive**: shadcn/ui gives full component control without fighting a design system.
- **Positive**: Fastify is schema-validated and faster than Express by default.
- **Risk**: No TypeScript means runtime type errors in financial calculations — mitigate with Fastify JSON Schema validation on all API inputs and careful unit tests on the `finance/` service layer.
- **Risk**: MySQL lacks native JSON time-series performance; mitigated by `market_prices` table with proper indexing.
