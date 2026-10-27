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

> 💡 This is a **demo store**. Wallet top-ups and KHQR payments are simulated — no real money
> is ever charged. Replace the payment step with a real PSP before going live.

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

No database server, no Docker, no external services required.

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

This repository is intended as a complete, runnable demo. For real payments you should:

1. Replace the simulated KHQR payload with a **certified KHQR/PSP integration** and verify
   webhooks server-side before fulfilling orders.
2. Move `data/db.json` to a real database (PostgreSQL / SQLite) and add rate limiting.
3. Set a strong `VC_SECRET`, enforce HTTPS, add CSRF protection and input rate limits.
4. Verify Player IDs with the game provider's API before delivery.

---

Made with ❤️ in Cambodia 🇰🇭
