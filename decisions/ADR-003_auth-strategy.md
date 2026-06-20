# ADR-003 · Authentication Strategy

- **Status**: Accepted
- **Date**: 2026-06-18
- **Decided by**: Claude (architecture design)

---

## Decision

Use **short-lived JWT access tokens + long-lived refresh tokens stored in httpOnly cookies**, with refresh token metadata persisted in Redis.

- **Access token**: JWT, 15-minute expiry, sent in `Authorization: Bearer` header by the client.
- **Refresh token**: opaque random token, 7-day expiry, stored in an `httpOnly; Secure; SameSite=Strict` cookie.
- **Redis**: holds the refresh token (hashed) keyed to `session:refresh:{tokenHash}` with 7-day TTL. Allows instant revocation without a DB query on every request.
- **Rotation**: each refresh call issues a new refresh token and invalidates the old one in Redis.

---

## Context

This is a personal finance application handling sensitive data. Authentication must be:
1. Secure against XSS (tokens should not be accessible via `document.cookie` or `localStorage`)
2. Resistant to CSRF (SameSite=Strict cookie covers this for same-origin requests)
3. Support logout-everywhere (token revocation)
4. Stateless on hot paths (access token is self-contained for the 15-minute window)

---

## Options Considered

### Option A — JWT in localStorage
- Access token stored in `localStorage`, sent as `Authorization` header
- Vulnerable to XSS — any injected script can read and exfiltrate the token
- Ruled out for a financial application.

### Option B — Session cookie (server-side sessions in Redis)
- Session ID in httpOnly cookie, session data in Redis
- Requires Redis lookup on every request — adds latency
- Works fine, but loses the stateless benefit of JWT for the common case

### Option C — JWT access + refresh in httpOnly cookie (chosen)
- Access token is short-lived → damage window if leaked is 15 minutes
- Refresh token in httpOnly cookie → not accessible to JavaScript
- Redis stores refresh token hash → revocation is O(1)
- Fastify JWT plugin handles verification with no DB call on every request

---

## Refresh Flow

```
1. Client calls POST /auth/refresh (cookie sent automatically)
2. Server reads refresh token from cookie
3. Server looks up SHA-256(token) in Redis
4. If found and not expired → issue new access token + rotate refresh token
5. If not found → force re-login (token stolen or expired)
```

---

## Consequences

- **Positive**: Access token verification is stateless (no DB/Redis call per request).
- **Positive**: Refresh token is not accessible to JavaScript, blocking XSS theft.
- **Positive**: Instant revocation: delete the Redis key to log out any session.
- **Risk**: Refresh token in cookie is sent on every request to the domain — CSRF mitigated by `SameSite=Strict` and requiring `Authorization` header on mutations.
- **Risk**: If Redis goes down, all sessions appear invalid until Redis recovers. Mitigated by `refresh_tokens` DB table as a fallback for recovery.
- **Out of scope for v1**: device tracking, concurrent session limits, 2FA (TOTP) — can be added later without changing this architecture.
