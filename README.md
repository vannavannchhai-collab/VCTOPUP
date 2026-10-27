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

### Environment variables (optional)

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Express / production server port |
| `VC_SECRET` | demo string | Secret used to sign auth tokens — **change this in production** |
| `NODE_ENV` | — | set to `production` for production mode |

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
    ├── index.js               # all REST routes + static hosting
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
