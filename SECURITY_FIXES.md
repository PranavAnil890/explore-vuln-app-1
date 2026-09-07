# Security Fixes Applied

This document records the fix applied for every vulnerability originally
catalogued in `README.md`, so you can compare before/after and re-verify each
one. Vulnerability numbers match the original catalog.

| # | Vulnerability | Fix | Where |
|---|---|---|---|
| 1 | NoSQL injection (auth bypass) | Reject non-string `username`/`password` before any DB query; `express-mongo-sanitize` middleware strips `$`/`.` keys globally as defense-in-depth | `routes/auth.js`, `server.js` |
| 2 | Weak MD5 password hashing | Replaced with `bcrypt`, 12 salt rounds | `routes/auth.js` |
| 3 | Mass assignment / privilege escalation | `role` never read from client input on register or user update; schema-level `enum: ['user','admin']` as backstop; explicit field whitelists on every update endpoint | `routes/auth.js`, `routes/users.js`, `models/User.js` |
| 4 | Stored XSS | `DOMPurify` sanitization on the server before storage (`ALLOWED_TAGS: []`) **and** again on the client before render (defense-in-depth) | `routes/places.js`, `frontend/src/pages/Explore.js`, `PlaceDetail.js` |
| 5 | IDOR / broken access control | Ownership checks (`place.ownerId === req.user.id` or admin) on view/update/delete of places; same pattern on user profile read/update; private places return 404 to non-owners | `routes/places.js`, `routes/users.js` |
| 6 | Excessive data exposure | Password hash never returned in any response; `GET /api/users` restricted to admins; profile responses use `.select('-password')` | `routes/auth.js`, `routes/users.js` |
| 7 | Insecure JWT handling | No hardcoded fallback secret (server refuses to start without one ≥32 chars); tokens now expire (`expiresIn: '1h'`) | `server.js`, `routes/auth.js` |
| 8 | CORS misconfiguration | Explicit origin allowlist via `ALLOWED_ORIGINS` env var instead of reflecting any origin | `server.js` |
| 9 | Insecure file upload | MIME-type allowlist, 5MB size cap, random server-generated filenames (no client-controlled names/paths) | `routes/places.js` |
| 10 | No rate limiting | `express-rate-limit` on `/api/auth/*` (20 req/15min) and a general `/api` limiter (300 req/15min) | `server.js` |
| 11 | Missing security headers | `helmet()` added | `server.js` |
| 12 | Verbose error handling | Errors logged server-side only (`console.error`); clients get generic messages | `server.js`, all route files |
| 13 | Multer DoS (CVE, empty field name crash) | Upgraded `multer` 1.4.5-lts.2 → 2.0.1; upload middleware now wrapped so any multer error returns a 400 instead of crashing the process | `routes/places.js`, `package.json` |

## Still worth doing (not fully closed by this pass)

- **JWT storage**: tokens are still kept in `localStorage` on the frontend.
  The XSS that made this dangerous is now fixed, but the fully correct
  long-term answer is moving to an `httpOnly` cookie-based session, which
  requires converting the backend from bearer-token auth to cookie auth
  (CSRF protection would then be needed too). Left as a follow-up since it's
  an architecture change, not a one-line fix.
- **`npm audit` / dependency scanning**: run `npm audit` (and ideally `snyk
  test` or Dependabot) on both `backend` and `frontend` periodically -
  vulnerability #13 was found this way and there may be others as
  dependencies age.
- **Automated tests**: `backend/tests/security.test.js` covers the core
  fixes (injection, IDOR, privilege escalation, XSS sanitization, admin-only
  listing). Extend this file as you find more edge cases.

## How to verify

```bash
cd backend
npm install
cp .env.example .env   # then set a real JWT_SECRET (see the comment in the file)
npm run seed            # optional: creates alice/bob/admin test users + sample places
npm run dev

# in another terminal, with a separate test DB configured:
npm test
```

All tests in `security.test.js` should pass, confirming the exploits from the
original README no longer work.
