# ⚡ VC TOPUP

> ហាងបញ្ចូលលុយហ្គេម និងទូរស័ព្ទពេញលេញ — លឿន ងាយ សុវត្ថិភាព។
> A complete, full-stack game & mobile top-up store built for Cambodia.

A production-shaped **bilingual (Khmer / English)** e-commerce website for game credits,
gift cards, streaming subscriptions and mobile phone top-ups. It ships with a real REST API,
persistent demo data, customer accounts, order tracking, KHQR payment UI and a full admin panel.

---

## ✨ Features

### Storefront
- **30 products** across 5 categories — Games, Mobile Top Up, Gift Cards, Streaming, Apps & Social
  (MLBB, Free Fire, PUBG, Genshin, Valorant, Roblox, Metfone, Smart, Cellcard, Steam, Netflix, TikTok…).
- Rich product pages with tiered packages, old-price discounts, "best value" flags,
  Player ID / phone / email fields, quantity, live USD **+ KHR** pricing (1 USD = 4,100 ៛).
- Shop with full-text search, category filters, 5 sort modes and result counts.
- Persistent cart (drawer + full page), promo codes, order summary.
- Checkout with contact form, **5 payment methods**, a real generated **KHQR QR code**,
  transaction reference field, order notes and terms confirmation.
- Order confirmation page, **order tracking** by order code + phone, animated status timeline.
- Customer accounts: register / login, order history, **VC Wallet**, VC Points rewards,
  profile & password management.
- Home page with hero, category grid, best sellers, how-it-works, promo banner, payment logos,
  testimonials, FAQ accordion and CTA.
- About & Contact pages with a working contact form (messages land in the admin inbox).
- Fully **responsive** (desktop / tablet / mobile) with a mobile slide-out menu.
- **Khmer ⇄ English** language switch everywhere; all fonts are **self-hosted** (works offline).

### Admin panel (`/admin`)
- Dashboard: revenue, orders, average order value, pending count, 14-day bar chart,
  revenue-by-category bars, top products and recent orders.
- Orders: search, status filtering and **live status updates** with timeline.
- Products: create / edit / delete, featured toggle, colours, icons and packages.
- Promo codes: create / edit / toggle / delete with usage limits.
- Customers, contact messages and editable site settings (announcement, contacts, FX rate).

### Backend
- Express REST API with server-side price recalculation (cart prices cannot be tampered with).
- Token auth (HMAC-signed), scrypt password hashing, role-based admin access.
- Promo validation, wallet balance checks, order codes, status timelines.
- Zero-config JSON datastore seeded with realistic demo data on first boot.

---

## 🚀 Quick start

Requirements: **Node.js 18+** (tested on Node 22).

```bash
npm install
npm run dev
```

Open **http://localhost:5173** — Vite runs the React app and proxies `/api` to the
Express server on port 4000. Both are started by one command (`concurrently`).

### Production build

```bash
npm run build     # creates dist/
npm start         # Express serves dist/ + the API on port 4000
```

Use `PORT=8080 npm start` to change the port. In production the whole app is served from
**one origin**, so no proxy is needed.

### Deploying to Vercel

Vercel is **not** a VPS. It never runs `npm start` and there is no long-lived Express
process. A deployment is a **static build** plus **on-demand Functions**, and the CDN
routes requests from metadata produced at build time — not by looking for a file on a
running server's disk. Three files in this repo express that split:

| File | Role |
| --- | --- |
| `vercel.json` | Pins the Vite preset, the `dist/` output directory and the two rewrites |
| `api/index.js` | Vercel Function — default-exports the Express `(req, res)` handler |
| `server/app.js` | The Express app itself, with **no `listen()`**, shared by both hosts |
| `server/index.js` | Local/VPS entry point that calls `listen()` |

The two rewrites (order matters — first match wins):

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "/api" },
  { "source": "/:path*",     "destination": "/index.html" }
]
```

1. `/api/*` → the Function, so `/api/bootstrap`, `/api/orders`, `/api/admin/*` resolve.
2. Everything else → `index.html`, so React Router owns `/shop`, `/product/:slug`,
   `/admin`, `/track` … even on refresh or direct navigation.
3. Real files (`/assets/*`, `/img/*`, `/favicon.svg`) are matched by Vercel's
   **File System Routes, which run before rewrites**, so the catch-all never eats them.

**Deploy checklist**

1. Import the repo at [vercel.com/new](https://vercel.com/new) (or run `vercel --prod`).
2. In **Project Settings → Build and Deployment** verify:
   - Root Directory = `./` (the repo root, not `src/`)
   - Framework Preset = **Vite** (not "Other" — see below)
   - Build Command = `npm run build`, Output Directory = `dist`
   (these three are already pinned in `vercel.json`).
3. Add `VC_SECRET` in **Environment Variables**.
4. Deploy and smoke-test: `/`, `/shop` (refresh it directly), a product URL, and
   `/api/health` which must return `{"ok":true,...}` JSON.

> ⚠️ **Demo data on Vercel is ephemeral.** `data/db.json` is a local JSON file and a
> Function's project filesystem is read-only, so on Vercel the store writes to
> `/tmp/vctopup-data/db.json`. Cold starts re-seed it and instances do not share it,
> so orders may disappear. Before taking real orders, replace `server/db.js` with a
> hosted database (Vercel Postgres / Neon / Turso / Supabase).

**If you still see `404: NOT_FOUND`**

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Every URL 404s but the build says Ready | Framework Preset = "Other" → no routing manifest was generated | Set the preset to Vite and redeploy |
| Output Directory is wrong (e.g. `build`, `public`) | Vercel serves an empty folder | Set it to `dist` |
| `.vercel.app` works, custom domain 404s | DNS / domain assignment | Fix the domain, not the code |
| `/` works, `/shop` 404s on refresh | Missing SPA catch-all | Keep rewrite #2 |
| UI loads but API calls 404 / return HTML | Missing Function or missing API rewrite | Keep `api/index.js` + rewrite #1 |
| The deployment URL itself 404s | Deployment deleted, wrong URL, or deployment protection | Check the Deployments list and access role |

### Environment variables (optional)

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Express / production server port (ignored on Vercel) |
| `VC_SECRET` | demo string | Secret used to sign auth tokens — **change this in production** |
| `VC_DATA_DIR` | `./data` locally, `/tmp/vctopup-data` on Vercel | Where the demo JSON store writes |
| `VERCEL` | set by Vercel | Detected automatically — switches off `listen()`/static serving and enables the `/tmp` store |
| `NODE_ENV` | — | set to `production` for local production mode; Vercel sets it for you |

---

## 💰 Go live: real payment → real diamonds

The default build is a **sandbox**: QR codes are correctly formatted KHQR strings
but no money moves and no diamonds are sent. Switching to `PAYMENT_MODE=live`
activates this pipeline:

```
Customer places order
   │
   ├─► server/khqr.js builds a UNIQUE dynamic EMVCo KHQR (amount + bill no. + timestamp + CRC16)
   │      └─ md5(qr) is stored on the order — this is the lookup key
   │
   ├─► /pay/:code shows the QR (generated by the server, never by the browser)
   │
   ├─► customer scans with ABA / ACLEDA / Wing / any KHQR app and pays REAL money
   │
   ├─► server/bakong.js  POST /v1/check_transaction_by_md5  (Bearer developer token)
   │      └─ validates amount, currency, payee account, and that the tx hash was never used before
   │
   ├─► server/payments.js atomically marks the order PAID (Postgres row lock)
   │
   └─► server/partner.js POST {PARTNER_API_URL} with HMAC signature + Idempotency-Key
          └─ the official game partner credits REAL diamonds to the Player ID
          └─ order → completed, VC Points awarded, timeline updated
```

**The single most important invariant:** `fulfill()` can only be reached when
`order.payment.status === 'paid'`, and `paid` can only be set by the server after
Bakong (or an admin) confirms the money. No browser field — including
`transactionId` — can mark an order paid. A failed partner call moves the order
to `delivery_failed` so money is never silently swallowed.

### 1. Prerequisites (things only you can obtain)

| What | Where to get it |
| --- | --- |
| KYC-verified **Bakong account** + Account ID (`name@bank`) | [bakong.nbc.gov.kh](https://bakong.nbc.gov.kh) mobile app |
| **Bakong Open API developer token** | [api-bakong.nbc.gov.kh/register](https://api-bakong.nbc.gov.kh/register/) — NBC emails it; expires ~90 days |
| **Official game partner / publisher API** credentials | Your contract with Moonton / Garena / Tencent / your top-up supplier |
| Partner **SKU catalogue** mapping to your packages | Partner's product list |
| **Hosted Postgres** (Neon / Supabase / Vercel Postgres) | Required — Vercel's `/tmp` is not durable |
| Business registration, merchant onboarding, refund policy, support channel | Your legal/compliance setup |

> The Bakong production API is **restricted to Cambodian IP addresses**. Vercel
> Functions run in `iad1` by default. Either pin the Function to a permitted
> region, use the SIT sandbox for testing, or use an approved relay/proxy.
> This is an integration decision you must confirm with NBC before going live.

### 2. Configure

```bash
cp .env.example .env      # fill in every live value
```

Set the same variables in **Vercel → Settings → Environment Variables**. Minimum
for live mode (the app *fails closed* if any are missing):

| Variable | Example |
| --- | --- |
| `PAYMENT_MODE` | `live` |
| `DATABASE_URL` | `postgresql://…?sslmode=require` |
| `VC_SECRET` | `openssl rand -hex 32` |
| `BAKONG_API_TOKEN` | NBC developer token |
| `BAKONG_ACCOUNT_ID` | `your_store@aba` |
| `BAKONG_MERCHANT_NAME` / `BAKONG_MERCHANT_CITY` | `VC TOPUP` / `Siem Reap` |
| `BAKONG_CURRENCY` | `USD` (or `KHR`) |
| `PARTNER_API_URL` | `https://api.partner.com/v1/topup` |
| `PARTNER_API_KEY` / `PARTNER_API_SECRET` | partner credentials |
| `PARTNER_SKU_MAP` | `{"mobile-legends:86-diamonds":"MOONTON_MLBB_86"}` |
| `PUBLIC_BASE_URL` | `https://your-domain.com` |
| `CRON_SECRET` | another random string |

`GET /api/config` reports exactly which checks pass — **no secret values are
ever exposed**. The admin dashboard → **Integration status** shows the same
report plus recent security events.

### 3. Partner API contract

`server/partner.js` sends:

```http
POST {PARTNER_API_URL}
Content-Type: application/json
X-Api-Key: {PARTNER_API_KEY}
X-Timestamp: {unix ms}
X-Signature: sha256={HMAC_SHA256(PARTNER_API_SECRET, `${timestamp}.${rawBody}`)}
Idempotency-Key: {order.code}

{
  "orderId": "VC-261027-XXXX",
  "reference": "VC-261027-XXXX",
  "currency": "USD",
  "total": 9.49,
  "items": [{ "sku": "MOONTON_MLBB_86", "accountId": "12345678 (1234)", "quantity": 1, "price": 9.49 }],
  "customer": { "name": "...", "phone": "...", "email": "..." },
  "callbackUrl": "https://your-domain.com/api/payments/partner-callback"
}
```

Expected response (adapt `interpret()` in `server/partner.js` if your partner
uses different field names):

```json
{ "status": "SUCCESS", "transactionId": "PARTNER-123", "message": "delivered" }
```

`SUCCESS / COMPLETED / DELIVERED` → order completed. `PENDING / PROCESSING` →
the partner can finish later via the **signed callback**. `FAILED` →
`delivery_failed`, visible in admin with a **Retry delivery** button. All
retries carry the same `Idempotency-Key`, so a retry can never double-credit.

The callback is verified with a constant-time HMAC comparison and a 5-minute
timestamp window. Requests with a bad signature are rejected.

### 4. Test safely (sandbox first)

```bash
PAYMENT_MODE=sandbox npm run dev
```

1. Add a product to the cart → checkout → **place order**.
2. `/pay/:code` shows a valid-format KHQR against `vctopup@sandbox`, with a
   **SANDBOX** banner and a **Simulate bank payment** button.
3. Click it. The server settles the order, calls the sandbox partner adapter,
   and moves it to `completed`. No money and no diamonds are involved.
4. Inspect `/api/config`, `/api/payments/:code/status` and admin → Integration
   status to confirm every transition.

Then deploy to Vercel with `PAYMENT_MODE=live` but a **test Bakong account +
partner sandbox + small real amount** before opening to customers. Confirm
these by hand:

- `/api/health` → `"paymentMode":"live"`, `"durableStore":true`
- `/api/config` → `ready: true`, `blockers: []`
- A real QR scan settles within one polling cycle (≤5 s)
- An amount/currency/hash mismatch is rejected and logged as a security event
- A partner outage produces `delivery_failed`, never a phantom `completed`

### 5. Reconciliation & failure handling

A Function can die between "paid" and "delivered". Three safety nets:

1. `/api/payments/:code/status` re-triggers delivery for any paid-but-undelivered
   order (the customer's page polls every 5 s).
2. `GET /api/payments/reconcile` (header `Authorization: Bearer $CRON_SECRET`)
   sweeps up to 20 stuck orders. On Vercel Pro add a cron in `vercel.json`:
   ```json
   "crons": [{ "path": "/api/payments/reconcile", "schedule": "*/5 * * * *" }]
   ```
   (Hobby plans only allow daily crons — use an external scheduler otherwise.)
3. Admin → Orders → **Retry delivery** for `delivery_failed`, or
   **Confirm payment** for manual Wing/TrueMoney transfers.

Every state change is appended to `order.timeline`, and suspicious events
(amount mismatch, replayed transaction hash, failed verification) are recorded
in `securityEvents` and shown in admin.

### 6. Payment methods in live mode

| Method kind | Verification | Delivery |
| --- | --- | --- |
| `aba`, `acleda` (KHQR) | automatic via Bakong `check_transaction_by_md5` | automatic |
| `wing`, `truemoney` (manual transfer) | **admin must confirm** — never auto-settled | automatic after confirmation |
| `wallet` (VC Wallet balance) | internal ledger debit | automatic |

### 7. Before you accept real customers

- [ ] Reconcile Bakong settlement reports against your orders daily.
- [ ] Implement refunds/chargebacks (this demo has no refund endpoint).
- [ ] Rotate `BAKONG_API_TOKEN` before its ~90-day expiry (`/v1/renew_token`).
- [ ] Add rate limiting and bot protection on `POST /api/orders`.
- [ ] Confirm Partner SLAs, idempotency guarantees and duplicate-credit policy.
- [ ] Verify Player IDs with the game provider before charging where possible.
- [ ] Have a human support channel for `delivery_failed` orders.
- [ ] Review NBC terms, consumer-protection and tax obligations in Cambodia.

---

## 🔑 Demo accounts & codes

| Role | Email | Password |
| --- | --- | --- |
| Administrator | `admin@vctopup.com` | `Admin@123` |
| Customer | `dara@example.com` | `User@123` |
| Customer | `vichetr@example.com` | `User@123` |

The login page has one-click **"Use this account"** buttons.

| Promo code | Effect |
| --- | --- |
| `VC10` | 10% off (min. $5) |
| `WELCOME5` | $1 off (min. $8) |
| `KHMER2026` | 15% off (min. $20) |

> 💡 By default (`PAYMENT_MODE=sandbox`) the store is a **demo**: KHQR strings are
> correctly formatted but no real money or diamonds are involved. See
> [Go live](#-go-live-real-payment--real-diamonds) for real Bakong + partner
> delivery. Live mode refuses to run until it is fully configured.

---

## 🧱 Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, React Router 6, Vite 6, plain CSS design system, lucide-react icons |
| Fonts | Self-hosted Inter Variable, Noto Sans Khmer, Bayon, Battambang (Fontsource) |
| QR | `qrcode` (generated client-side for KHQR) |
| Backend | Node.js, Express 4, CORS |
| Auth | scrypt + HMAC-signed tokens |
| Storage | Atomic JSON file (`data/db.json`, auto-seeded, git-ignored) |

In **sandbox/demo** mode: no database server, no Docker, no external services
required (a local JSON file is auto-seeded). **Live** mode requires hosted
Postgres, a Bakong developer token and a game-partner API.

---

## 📁 Project structure

```
├── index.html                 # HTML shell, meta tags, favicon
├── vite.config.js             # dev server (0.0.0.0) + /api proxy
├── vercel.json                # Vite preset, dist output, API + SPA rewrites
├── api/
│   └── index.js               # Vercel Function: exports the Express handler
├── public/
│   ├── favicon.svg
│   └── img/                   # generated 3D artwork (transparent WebP)
├── src/
│   ├── main.jsx               # entry point + self-hosted font imports
│   ├── App.jsx                # routes, scroll manager, reveal animations
│   ├── lib/
│   │   ├── api.js             # typed fetch wrapper + token handling
│   │   ├── format.js          # USD/KHR, dates, status helpers
│   │   ├── i18n.js            # ~300 Khmer/English UI strings
│   │   └── store.jsx          # global state (cart, auth, i18n, toasts)
│   ├── components/            # Layout, Header, Footer, CartDrawer, ProductCard, UI primitives
│   ├── pages/                 # Home, Shop, Product, Cart, Checkout, Order, Track,
│   │                          # Login, Account, Admin, Contact, About, 404
│   └── styles/                # base.css, layout.css, pages.css
└── server/
    ├── app.js                 # Express app definition (all REST routes, no listen)
    ├── index.js               # local/VPS entry point — calls app.listen()
    ├── db.js                  # JSON store, auth helpers, demo data generator
    └── seed.js                # catalog, categories, promos, reviews, FAQs, settings
```

---

## 🔌 API overview

All endpoints are under `/api` and return `{ ok: true, data }` (or `{ ok: false, message }`).

**Public**

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/bootstrap` | Settings, categories, payments, reviews, FAQs, featured & popular |
| GET | `/categories` | All categories |
| GET | `/products?category=&q=&sort=&limit=` | Filtered catalog |
| GET | `/products/:slug` | Product + related items |
| GET | `/payment-methods`, `/reviews`, `/faqs`, `/settings` | Supporting data |
| POST | `/promo/validate` | Validate a code against a subtotal |
| POST | `/orders` | Create an order |
| GET | `/orders/:code?phone=` | Look up one order |
| GET | `/orders?phone=` | List orders by phone / email |
| POST | `/contact` | Submit a contact message |

**Auth** — `/auth/register`, `/auth/login`, `/auth/me`, `/auth/profile`,
`/auth/change-password`, `/auth/orders`, `/auth/wallet/topup`, `/auth/wallet/redeem`.

**Admin** (requires `Authorization: Bearer <token>` with an admin role) —
`/admin/overview`, `/admin/orders`, `/admin/products`, `/admin/promos`, `/admin/users`,
`/admin/messages`, `/admin/settings` (GET / POST / PUT / DELETE where applicable).

Example:

```bash
curl -X POST localhost:4000/api/promo/validate \
  -H 'Content-Type: application/json' \
  -d '{"code":"VC10","subtotal":20}'
# {"ok":true,"data":{"code":"VC10","type":"percent","value":10,"discount":2}}
```

---

## 🔄 Resetting demo data

The database is created automatically on first boot. To restore the original catalog,
orders, users and promos:

```bash
rm -f data/db.json
npm run dev       # re-seeds on startup
```

---

## 🛠 Customising

- **Catalog** — edit `server/seed.js`. Each product has `packages: [{ label, price, oldPrice, popular }]`,
  `colors`, `icon` (any lucide name), `requiresId` and bilingual `desc` / `instructions`.
- **Prices & FX rate** — `exchangeRate` in `server/seed.js` or live in Admin → Settings.
- **Copy / translations** — `src/lib/i18n.js` (keys are shared between Khmer and English).
- **Theme** — CSS custom properties at the top of `src/styles/base.css`.
- **Branding** — `public/favicon.svg`, the `.brand` markup in `src/components/Layout.jsx`,
  and `settings` in `server/seed.js`.

---

## 🔒 Before going live

The real Bakong + partner pipeline is implemented — see
[Go live](#-go-live-real-payment--real-diamonds). What remains is operational:

1. Register with NBC, obtain a developer token, and confirm the production API
   is reachable from your Vercel region (Cambodia IP restriction).
2. Sign a game-partner agreement, map every package SKU, and test the signed
   request/callback contract with their sandbox.
3. Provision hosted Postgres (`DATABASE_URL`) and keep off-site backups.
4. Set strong `VC_SECRET` and `CRON_SECRET`, add rate limiting / bot protection
   on `POST /api/orders`, and monitor `securityEvents` in admin.
5. Implement refunds/chargebacks and daily settlement reconciliation.
6. Have a human on call for `delivery_failed` orders.

---

Made with ❤️ in Cambodia 🇰🇭
