# Explore (MERN App - Vulnerabilities Fixed)

**This version has all 13 originally-catalogued vulnerabilities fixed.**
See [`SECURITY_FIXES.md`](./SECURITY_FIXES.md) for exactly what changed and
why, mapped to each item below. The vulnerability descriptions in this file
are kept as-is for reference/before-after comparison - they describe the
**original, unpatched** behavior.

**⚠️ Historical context (original vulnerable version) - FOR SECURITY TRAINING / TESTING ONLY.**
This app is deliberately broken. Never deploy it to a public server, never reuse
this code in a real product, and only run it against a local/isolated MongoDB
instance. It's meant to be used the way OWASP's NodeGoat or DVWA are used: as a
sandbox to practice finding and fixing real vulnerability classes in a MERN
(MongoDB, Express, React, Node) stack.

## Stack
- Backend: Node.js + Express + Mongoose (MongoDB)
- Frontend: React (Create React App) + react-router + axios
- Auth: JWT (deliberately misconfigured)

## Setup

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env and set a real JWT_SECRET (>= 32 chars) - the server refuses to
# start without one. Generate one with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm install
npm run seed         # optional: creates alice/bob/admin test users + sample places
npm run dev          # starts on http://localhost:5000, needs local MongoDB running

# Frontend (separate terminal)
cd frontend
cp .env.example .env
npm install
npm start            # starts on http://localhost:3000
```

You need a local MongoDB instance running at `mongodb://localhost:27017` (or
update `MONGO_URI` in `.env`).

Health check: `GET http://localhost:5000/api/health` confirms the server and
DB connection are both up.

## Vulnerability catalog

Each item below: **what it is → where it lives → how to trigger/verify it →
how you'd actually fix it.** Use this as an answer key after your own review,
or as a checklist while you practice a manual security assessment.

### 1. NoSQL Injection (Authentication Bypass)
- **Where:** `backend/routes/auth.js`, `POST /api/auth/login`
- **Issue:** `username`/`password` from the request body are placed directly
  into a Mongoose `findOne()` query with no type checking. MongoDB treats a
  JSON object as query operators, so a client can send:
  ```json
  { "username": { "$ne": null }, "password": { "$ne": null } }
  ```
  This matches the first user in the collection and returns a valid JWT with
  no credentials at all.
- **Test it:** `curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"username":{"$ne":null},"password":{"$ne":null}}'`
- **Fix:** Validate that `username`/`password` are strings before querying
  (e.g. with a schema validator like `joi`/`zod`, or `mongo-sanitize` /
  `express-mongo-sanitize` middleware to strip `$`/`.` keys from user input).

### 2. Weak password hashing
- **Where:** `backend/routes/auth.js` (`weakHash` = unsalted MD5)
- **Issue:** MD5 is fast and unsalted, so leaked hashes can be cracked with a
  rainbow table in seconds.
- **Fix:** Use `bcrypt` or `argon2` with a proper per-user salt and cost factor.

### 3. Mass assignment / privilege escalation
- **Where:** `backend/routes/auth.js` (`POST /register`), `backend/routes/users.js` (`PUT /:id`)
- **Issue:** The server saves whatever fields the client sends, including
  `role`. A client can register (or update) with `"role": "admin"` and be
  treated as an administrator everywhere `role` is checked.
- **Test it:** `curl -X POST http://localhost:5000/api/auth/register -H "Content-Type: application/json" -d '{"username":"eviluser","password":"pass","role":"admin"}'`
- **Fix:** Whitelist exactly which fields a given endpoint may set; never
  spread/pass the raw request body into a Mongoose model for privileged fields.

### 4. Stored XSS
- **Where:** `backend/models/Place.js` (`description`, no sanitization) +
  `frontend/src/pages/Explore.js` and `PlaceDetail.js`
  (`dangerouslySetInnerHTML={{ __html: p.description }}`)
- **Issue:** Any user can submit a place with `description` containing
  `<img src=x onerror=alert(document.cookie)>`. It's stored as-is and
  executes in every visitor's browser on the Explore feed - including
  reading their `localStorage` JWT (see #7).
- **Fix:** Never use `dangerouslySetInnerHTML` on untrusted data. Sanitize
  server-side (e.g. with `DOMPurify` in a Node context, or a markdown-only
  input) and/or escape on render; add a Content-Security-Policy header.

### 5. Broken access control / IDOR (Insecure Direct Object Reference)
- **Where:** `backend/routes/places.js` (`GET/PUT/DELETE /:id`),
  `backend/routes/users.js` (`GET/PUT /:id`)
- **Issue:** Ownership is never checked. Any authenticated user can view,
  edit, or delete any other user's place, and view/edit any other user's
  full profile (including password hash) just by supplying their Mongo `_id`.
  The `isPrivate` flag on places is purely cosmetic - never enforced.
- **Test it:** Log in as user A, create a place, note its `_id`. Log in as
  user B and `PUT`/`DELETE` user A's place `_id` - it succeeds.
- **Fix:** On every read/write, check `resource.ownerId === req.user.id`
  (or an explicit role check for admin overrides) before performing the action.

### 6. Excessive data exposure
- **Where:** `backend/routes/auth.js` (login/register responses),
  `backend/routes/users.js` (`GET /` and `GET /:id`)
- **Issue:** Full Mongoose user documents - including the password hash and
  role - are sent to the client on register, login, and profile lookup.
  `GET /api/users` lists every user in the system with no admin check.
- **Fix:** Use a response DTO / `.select('-password')` and never return
  security-relevant fields; restrict listing endpoints to admins.

### 7. Insecure JWT handling
- **Where:** `backend/routes/auth.js`, `backend/routes/places.js`,
  `frontend/src/api.js`
- **Issues:**
  - Weak, hardcoded fallback secret (`secret123`) checked into `.env.example`.
  - Tokens are signed with **no expiry** (`jwt.sign(payload, secret)` with no
    `expiresIn`), so a stolen token is valid forever.
  - Token stored in `localStorage` on the frontend, which is directly
    readable by the stored-XSS payload in #4 - meaning XSS = full account
    takeover, not just page defacement.
- **Fix:** Use a long random secret from a secrets manager/env var only (no
  fallback), set `expiresIn` (and use refresh tokens for longer sessions),
  and store the token in an `httpOnly`, `Secure`, `SameSite` cookie instead
  of `localStorage`.

### 8. CORS misconfiguration
- **Where:** `backend/server.js` (`cors({ origin: true, credentials: true })`)
- **Issue:** Reflects any requesting origin and allows credentials, meaning
  any website on the internet can make authenticated-looking cross-origin
  requests on behalf of a visitor.
- **Fix:** Set `origin` to an explicit allowlist of trusted frontend origins.

### 9. Insecure file upload
- **Where:** `backend/routes/places.js` (`multer` config, `POST /upload`)
- **Issue:** No file type/mimetype/size validation, the original
  (attacker-controlled) filename is preserved, and `/uploads` is served
  statically with no authentication - allowing upload of arbitrary files
  (e.g. an `.html` file for a stored-content-based attack, or filenames
  designed to collide with/overwrite other files).
- **Fix:** Validate MIME type and extension against an allowlist, generate a
  random server-side filename, cap file size, and store outside the web root
  (or behind an authenticated download endpoint) with an antivirus/content
  scan if possible.

### 10. Missing rate limiting / brute-force protection
- **Where:** entire app, especially `POST /api/auth/login`
- **Issue:** No rate limiting anywhere, so login (and the NoSQL injection in
  #1) can be brute-forced or scripted without any throttling.
- **Fix:** Add `express-rate-limit` (or an API gateway/WAF rule) on
  authentication endpoints, and consider account lockout/backoff.

### 11. Missing security headers
- **Where:** `backend/server.js` (no `helmet()`)
- **Issue:** No `Content-Security-Policy`, `X-Frame-Options`,
  `X-Content-Type-Options`, `Strict-Transport-Security`, etc. This makes the
  stored XSS in #4 more damaging (no CSP to block inline scripts) and leaves
  the app open to clickjacking.
- **Fix:** Add the `helmet` middleware and configure a real CSP.

### 12. Verbose error handling / information disclosure
- **Where:** `backend/server.js` global error handler, several route
  `catch` blocks (`res.json({ error: err.message, stack: err.stack })`)
- **Issue:** Stack traces and raw driver/DB error messages are returned to
  the client, which can leak file paths, library versions, and query
  structure useful for further attacks.
- **Fix:** Log details server-side only; return a generic error message
  (and a request id for correlation) to the client.

## Suggested exercise flow
1. Run the app locally as-is and manually walk through each vulnerability
   above using curl/Postman/browser devtools to confirm it's exploitable.
2. Pick one vulnerability class at a time, fix it, and re-verify the exploit
   no longer works (regression-test your fix).
3. Once fixed, try adding automated checks: `npm audit`, `eslint-plugin-security`,
   a SAST tool, or `express-mongo-sanitize` + `helmet` + `express-rate-limit`
   as a baseline hardening pass.
