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
- **Real integrations:** verify the provider account, browse its real catalogue, map every package to a real diamond item ID, inspect the live readiness gate and copy the signed webhook URL.

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

Useful scripts: `npm test` (payment/provider safety tests), `npm run build`,
`npm run setup:live` (interactive real-credential setup), `npm run check:live --
--probe` (readiness + real account probe), `npm run partner:catalog` (real item IDs).

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
3. Add `VC_SECRET` in **Environment Variables**. For live mode, also add every
   variable generated by `npm run setup:live`, including `CRON_SECRET` (used by
   the reconcile cron in `vercel.json`).
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

### Environment variables (sandbox / demo)

```bash
cp .env.example .env
```

The server loads `.env` through `dotenv` (see `server/env.js`). Both `.env` and
`.env.local` are git-ignored. For **real payments**, run `npm run setup:live`
instead of copying the example — it generates strong secrets and rejects placeholder
credentials. See [Go live](#-go-live-real-payment--real-diamonds).

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Express / production server port (ignored on Vercel) |
| `VC_SECRET` | demo string | Secret used to sign auth tokens — **change this in production** |
| `VC_DATA_DIR` | `./data` locally, `/tmp/vctopup-data` on Vercel | Where the demo JSON store writes |
| `PAYMENT_MODE` | `sandbox` | `sandbox` = fake money/diamonds; `live` = real money/diamonds (fail-closed) |
| `VERCEL` | set by Vercel | Detected automatically — switches off `listen()`/static serving and enables the `/tmp` store |
| `NODE_ENV` | — | set to `production` for local production mode; Vercel sets it for you |

---

## 💰 Go live: real payment → real diamonds

> 🇰🇭 **សំខាន់៖** ខ្ញុំមិនអាចបង្កើត ឬបញ្ចូល API key/គណនីរបស់អ្នកផ្សេងបានទេ។
> គណនី Bakong (KYC) និងគណនីអ្នកផ្គត់ផ្គង់ពេជ្រ ត្រូវតែចុះឈ្មោះដោយម្ចាស់អាជីវកម្ម។
> កូដនេះបានរៀបចំកន្លែងសុវត្ថិភាពសម្រាប់បញ្ចូល **real account, real API key និង real diamond item IDs** ហើយបដិសេធរាល់តម្លៃក្លែងក្លាយ។
>
> **Important:** no real credential can be generated by an AI or committed to a
> public repository. Only your verified Bakong merchant account and your funded
> game-top-up reseller account can issue them. Never paste keys into chat, the
> browser, React code, or the admin form. Keep them in server environment variables.

This repository now ships with a concrete real-diamond provider:
**Shop2Topup v1 Reseller API** (`PARTNER_PROVIDER=shop2topup`). It supports
direct crediting by Player ID, catalogue/price lookup, player validation,
UUID idempotency, asynchronous status, and an HMAC-signed webhook. The older
generic signed partner adapter remains available with `PARTNER_PROVIDER=generic`.

The default build is still a **sandbox**: QR strings are correctly formatted
KHQR, but no money moves and no diamonds are sent. `PAYMENT_MODE=live` activates:

```
Checkout (real Player ID / Zone ID)
   │
   ├─► server/partner.js validates the player + provider price BEFORE payment
   │
   ├─► server/khqr.js builds a UNIQUE dynamic KHQR (amount + bill + expiry + CRC16)
   │      └─ md5(qr) is stored on the order
   │
   ├─► Customer scans with ABA / ACLEDA / Wing / any KHQR app and pays REAL money
   │
   ├─► server/bakong.js POST /v1/check_transaction_by_md5 (Bearer NBC token)
   │      └─ amount, currency, payee and transaction-hash replay are validated
   │
   ├─► server/payments.js atomically marks the order PAID (Postgres row lock)
   │
   └─► server/shop2topup.js POST /orders/create with a STABLE UUID
          ├─ GET /orders/:uuid or signed webhook confirms COMPLETED
          └─ real diamonds arrive → order completed + VC Points awarded
```

**The single most important invariant:** `fulfill()` is reachable only when
`order.payment.status === 'paid'`, and `paid` is set only by Bakong verification,
an explicit admin confirmation, or an internal wallet debit. A browser field —
including `transactionId` — can never mark an order paid.

### 1. What you must obtain (only you / your business can)

| What | Where |
| --- | --- |
| KYC-verified **Bakong merchant account** + Account ID (`name@bank`) | [bakong.nbc.gov.kh](https://bakong.nbc.gov.kh) |
| **Bakong Open API developer token** | [api-bakong.nbc.gov.kh/register](https://api-bakong.nbc.gov.kh/register/) — NBC emails it; renew before expiry |
| **Real Shop2Topup reseller account**, funded wallet, API Access key `<keyId>.<secret>` | [portal.shop2topup.com](https://portal.shop2topup.com/en/resellers) |
| Shop2Topup **webhook signing secret** + registered HTTPS webhook URL | Shop2Topup reseller panel |
| Real **numeric item IDs** for each diamond package | `npm run partner:catalog` or Admin → Real integrations |
| Hosted **Postgres** (`DATABASE_URL`) | Neon / Supabase / Vercel Postgres / Railway |
| Business registration, refund policy, support channel, Cambodia-IP strategy | Your legal/compliance setup |

> Bakong production is restricted to Cambodian IP addresses in many deployments.
> Vercel Functions may run outside Cambodia. Confirm an approved region or relay
> with NBC **before** enabling live mode. A 401/403 from Bakong is treated as a
> credential/IP failure, never as “paid”.

### 2. Insert real credentials safely

Run this locally (never in a public terminal share):

```bash
npm run setup:live
```

It asks for your real values, generates `VC_SECRET` and `CRON_SECRET` with
`crypto.randomBytes(32)`, validates that they are not placeholders, and writes a
git-ignored `.env` with permissions `0600`. Then:

1. Copy **every variable** from `.env` into **Vercel → Settings → Environment Variables**.
2. Set the webhook URL printed by the script (usually
   `https://YOUR-DOMAIN/api/payments/partner-callback`) in the Shop2Topup panel.
3. Use the **same** `SHOP2TOPUP_WEBHOOK_SECRET` in both places.
4. Deploy, then run:

```bash
npm run check:live -- --probe
npm run partner:catalog                 # list big/category IDs
npm run partner:catalog -- --category=12  # list real item IDs + prices
```

`check:live -- --probe` calls `GET /account` with your key and reports account
name, balance and funding status — never the key. `/api/config` and Admin →
Real integrations show the same secret-free readiness report.

### 3. Map real diamond packages

A demo package has `partnerSku: null`. A real package must point to a numeric
Shop2Topup catalogue item ID. You can map them in either place:

| Method | How |
| --- | --- |
| **Admin → Real integrations** (recommended) | Load the provider catalogue, type/choose each item ID, click **Save mapping**. Saved atomically on each product. |
| `SHOP2TOPUP_ITEM_MAP` / `PARTNER_SKU_MAP` | JSON map: `{"mobile-legends:86-diamonds":"12345","free-fire:100-diamonds":"67890"}` |

`assertLiveReady(items)` checks the actual cart before creating an order, so an
unmapped package cannot take real money. `GET /api/config` shows
`skuCoverage.mapped/total`. The admin table shows **Mapped / Unmapped** per package.

For games like MLBB, enter `123456789 (1234)` (Player ID + Zone ID). The adapter
splits it into `player_id` and `server`, and can also use the provider's
`GET /catalog/category/:id/requirements` field names when
`SHOP2TOPUP_CATEGORY_ID` is set. No game password, OTP, or recovery code is
ever requested.

### 4. Shop2Topup request contract

The adapter in `server/shop2topup.js` implements this flow (see the provider's
[Reseller API docs](https://shop2topup.com/en/reseller-api)):

```http
Authorization: Bearer <keyId>.<secret>

GET  /catalog/subcategories?categoryId=12
GET  /catalog/subcategory/12345/price
GET  /catalog/category/12/requirements
POST /player/validate       { sub_category_id, player_id, server }
POST /orders/create         {
  order_id: "<deterministic UUID>",
  sub_category_id: 12345,
  quantity: 1,
  requirements: { player_id: "123456789", server: "1234" },
  expected_unit_price: "0.950000"
}
GET  /orders/<deterministic UUID>
```

Safety details:

- `order_id` is a UUID derived from `order.code` + line index, persisted **before**
  the provider call. A retry / duplicate poll reads the same provider order instead
  of buying twice.
- `expected_unit_price` is fetched live from the provider. If the provider cost
  exceeds `item.price × SHOP2TOPUP_MAX_COST_RATIO` (default `1`), fulfillment is
  refused rather than silently losing money.
- Player validation happens at checkout and again before fulfillment. A bad UID
  is rejected with HTTP 422 before a KHQR is shown.
- `PENDING / PROCESSING` keeps the order in `processing`; the status endpoint and
  reconciliation poll again after the 2-minute lease. `COMPLETED` awards points.
- `FAILED / REFUNDED` moves the order to `delivery_failed` for admin review.

Webhook verification uses the **raw request body**:

```text
X-Shop2Topup-Signature: sha256=<hex HMAC-SHA256(webhookSecret, rawBody)>
```

Bad signatures, stale timestamps, replayed event bodies, and callbacks for unpaid
orders are rejected. The webhook order ID is mapped back to the VC TOPUP order via
`partnerOrderMap`, populated before any provider order is created.

### 5. Generic official-partner fallback

If you already have a direct contract with a publisher or another supplier, set:

```bash
PARTNER_PROVIDER=generic
PARTNER_API_URL=https://api.your-official-partner.com/v1/topup
PARTNER_API_KEY=...
PARTNER_API_SECRET=...
PARTNER_CALLBACK_SECRET=...
PARTNER_SKU_MAP={"mobile-legends:86-diamonds":"OFFICIAL_MLBB_86"}
```

`server/partner.js` sends `X-Api-Key`, `X-Timestamp`,
`X-Signature: sha256=HMAC(secret, timestamp + "." + rawBody)` and
`Idempotency-Key: <order code>`. Expected response:
`{ "status": "SUCCESS", "transactionId": "PARTNER-123" }`. Generic callbacks use
`X-Signature` and `X-Timestamp` instead of the Shop2Topup header.

### 6. Fail-closed live gate

`GET /api/config` / `GET /api/admin/integrations` expose booleans only — never a
secret. In live mode all of these must pass:

`durableStore`, `signingSecret`, `bakongToken`, `bakongAccount`,
`bakongMerchant`, `bakongApiBase`, `partnerProvider`, `partnerEndpoint`,
`partnerCredentials`, `partnerWebhook`, `partnerSkus`, `cronSecret`.

Placeholders copied from `.env.example` (`REPLACE_WITH_…`, `your-…`, `demo`,
short or repeated strings) are deliberately rejected. Missing values produce
HTTP 503 with a `blockers` array; `/api/orders` never creates a payable order.
A specific unmapped product produces
`partnerSkus:<productSlug>:<packageId>` before the QR is generated.

### 7. Test safely (sandbox first)

```bash
PAYMENT_MODE=sandbox npm run dev
```

1. Add a product → checkout → place order.
2. `/pay/:code` shows a valid-format KHQR against `vctopup@sandbox` with a
   **SANDBOX** banner and **Simulate bank payment** button.
3. Click it: server settles, the sandbox partner adapter completes, and no real
   money or diamonds are involved.
4. Inspect `/api/config`, `/api/payments/:code/status`, Admin → Integration status.

Then deploy with live credentials, map SKUs, and make **one small real order to
your own game account**. Confirm:

- `/api/health` → `"paymentMode":"live"`, `"durableStore":true`
- `/api/config` → `ready: true`, `blockers: []`
- `npm run check:live -- --probe` → account reachable and funded
- A real QR scan settles within one polling cycle
- The provider order reaches `COMPLETED` and diamonds arrive
- A wrong Player ID is rejected **before** payment
- An amount/currency/hash mismatch is logged as a security event
- A partner outage produces `delivery_failed`, never a phantom `completed`

### 8. Reconciliation & failure handling

A Function can die between “paid” and “delivered”. Three safety nets:

1. `/api/payments/:code/status` re-triggers delivery for paid-but-undelivered
   orders (the customer page polls every 5 s).
2. `GET /api/payments/reconcile` (header `Authorization: Bearer $CRON_SECRET`)
   sweeps up to 20 stuck orders. Vercel automatically adds this header when a
   `CRON_SECRET` environment variable exists. A Hobby-compatible daily cron is
   already included in `vercel.json`:
   ```json
   "crons": [{ "path": "/api/payments/reconcile", "schedule": "0 0 * * *" }]
   ```
   On Pro (or with an external scheduler) you can shorten the interval; don't
   rely on a daily cron as the only recovery path for live orders.
3. Admin → Orders → **Retry delivery** for `delivery_failed`, or
   **Confirm payment** for manual Wing/TrueMoney transfers.

Every state change is appended to `order.timeline`; suspicious events are stored
in `securityEvents` and shown in Admin. Refunds/chargebacks still require a
business process with the payment and game partners.

### 9. Payment methods in live mode

| Method kind | Verification | Delivery |
| --- | --- | --- |
| `khqr` (ABA / ACLEDA) | Bakong `check_transaction_by_md5` | Shop2Topup direct top-up |
| `wallet` (Wing / TrueMoney manual) | Admin confirmation only | Shop2Topup direct top-up |
| `balance` (VC Wallet) | Atomic internal ledger debit | Shop2Topup direct top-up |

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
| QR | `qrcode` (renders a server-generated KHQR string) |
| Backend | Node.js 20+, Express 4, CORS, `dotenv` |
| Auth | scrypt + HMAC-signed tokens |
| Storage | Atomic JSON file (`data/db.json`, git-ignored) or hosted Postgres via `DATABASE_URL` |
| Payments | Bakong KHQR + NBC Open API verification |
| Real diamonds | Shop2Topup v1 reseller adapter (or generic signed partner adapter) |

In **sandbox/demo** mode: no database server, no Docker, no external services
required (a local JSON file is auto-seeded). **Live** mode requires hosted
Postgres, a Bakong developer token, a funded real top-up account and real
provider item IDs. Run `npm test` for the provider/payment safety tests.

---

## 📁 Project structure

```
├── index.html                 # HTML shell, meta tags, favicon
├── vite.config.js             # dev server (0.0.0.0) + /api proxy
├── vercel.json                # Vite preset, dist output, API + SPA rewrites, daily reconcile cron
├── .env.example               # every live variable; all values are placeholders
├── api/
│   └── index.js               # Vercel Function: exports the Express handler
├── scripts/
│   ├── setup-live.mjs         # interactive real-credential setup → git-ignored .env
│   ├── check-live.mjs         # live readiness report + provider account probe
│   └── partner-catalog.mjs    # browse real provider category / item IDs
├── tests/
│   └── live-integration.test.mjs # provider, idempotency, webhook and gate tests
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
    ├── env.js                 # loads .env before any other server module
    ├── config.js              # live/sandbox gate + secret-free integration status
    ├── credentials.js         # placeholder/credential/SKU validation helpers
    ├── db.js                  # JSON store / Postgres, auth helpers, demo data
    ├── seed.js                # catalog, categories, promos, reviews, FAQs, settings
    ├── khqr.js                # EMVCo KHQR TLV generator + CRC16 + md5
    ├── bakong.js              # NBC check_transaction_by_md5 client
    ├── payments.js            # paid → processing → completed state machine
    ├── partner.js             # provider selection, plan, idempotent fulfillment
    └── shop2topup.js          # concrete real-diamond API + signed webhook
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
| GET | `/config` | Secret-free live readiness report, provider and webhook metadata |
| POST | `/promo/validate` | Validate a code against a subtotal |
| POST | `/orders` | Create an order (live mode validates Player ID first) |
| GET | `/orders/:code?phone=` | Look up one order |
| GET | `/orders?phone=` | List orders by phone / email |
| GET | `/payments/:code`, `/payments/:code/status` | KHQR instruction and server-side settlement |
| POST | `/payments/:code/simulate`, `/payments/:code/refresh` | Sandbox-only simulation / QR refresh |
| POST | `/payments/partner-callback` | Signed asynchronous delivery callback |
| GET | `/payments/reconcile` | `CRON_SECRET`-protected crash-recovery sweep |
| POST | `/contact` | Submit a contact message |

**Auth** — `/auth/register`, `/auth/login`, `/auth/me`, `/auth/profile`,
`/auth/change-password`, `/auth/orders`, `/auth/wallet/topup`, `/auth/wallet/redeem`.

**Admin** (requires `Authorization: Bearer <token>` with an admin role) —
`/admin/overview`, `/admin/orders`, `/admin/products`, `/admin/promos`, `/admin/users`,
`/admin/messages`, `/admin/settings` (GET / POST / PUT / DELETE where applicable),
plus `/admin/integrations`, `/admin/integrations/connection`,
`/admin/integrations/catalog`, `/admin/integrations/sku-map`,
`/admin/orders/:code/retry` and `/admin/orders/:code/confirm-payment`.

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

- **Catalog** — edit `server/seed.js`. Each product has `packages: [{ label, price, oldPrice, popular, partnerSku }]`,
  `colors`, `icon` (any lucide name), `requiresId` and bilingual `desc` / `instructions`.
  `partnerSku` starts as `null`; map it to a real provider item ID in Admin → Real integrations.
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
2. Verify/fund your **Shop2Topup reseller account** (or sign a direct publisher
   agreement), map every package to a real numeric item ID, and test the signed
   request/callback contract with a small real order.
3. Provision hosted Postgres (`DATABASE_URL`) and keep off-site backups.
4. Set strong `VC_SECRET` and `CRON_SECRET`, add rate limiting / bot protection
   on `POST /api/orders`, and monitor `securityEvents` in admin.
5. Implement refunds/chargebacks and daily settlement reconciliation.
6. Have a human on call for `delivery_failed` orders.

---

Made with ❤️ in Cambodia 🇰🇭
