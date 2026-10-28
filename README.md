# VC TOPUP

Bilingual Khmer/English digital top-up storefront built with React/Vite and an Express API. The repository contains integration code for Google Sign-In, Telegram Login, Bakong KHQR payment verification, and Shop2Topup partner fulfillment. **It is not a live store until the real merchant/provider accounts, credentials, product mappings, database, and deployment configuration have been supplied and verified.** There are no test customers, sample orders, pretend payment-success controls, or pre-mapped saleable SKUs in a fresh install.

## Run locally

Requirements: Node.js 20+ and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

The local app uses the repository's local development settings. With no valid live setup, the customer catalog stays unavailable and order creation fails closed; no simulated sale is created. Build and test commands:

```sh
npm test
npm run build
```

Tests mock external services. Passing tests do **not** prove a real Bakong or Shop2Topup account is operational.

## Production setup (Vercel)

Use a real, verified business account for every provider. Never paste secrets into source control, issues, or chat.

1. Provision hosted PostgreSQL and configure `DATABASE_URL` with TLS. Vercel's filesystem is ephemeral; the local JSON store is not suitable for production.
2. Create a Google **Web application** OAuth client. Add the deployed HTTPS hostname as an authorized JavaScript origin. Configure `GOOGLE_CLIENT_ID` with that client ID.
3. Create a Telegram bot with `@BotFather`, set its website domain to the deployed hostname, then configure `TELEGRAM_BOT_USERNAME` and the server-only `TELEGRAM_BOT_TOKEN`. Telegram Login does not provide an email address; do not treat a Telegram username as an email identity.
4. Obtain a Bakong/NBC merchant account and developer token. Set the real account ID, merchant name/city, API token, and production API base. Confirm production API connectivity and any NBC network/IP restrictions before taking payment.
5. Register and fund a Shop2Topup reseller account. Set its API key and webhook signing secret. Register the callback URL shown by the application's integration status with the provider.
6. Create the first administrator **after** the production database is configured:

   ```sh
   npm run admin:create
   ```

   Enter a unique owner email and strong password. Do not set bootstrap credentials in a public build or use a shared default password.
7. In the admin integration panel, load the provider's current catalog and map each product/package to the provider's actual numeric item ID. Sync prices. Only mapped packages with a recent provider price check are eligible to appear in the customer catalog.
8. Set every required value from `.env.example` in Vercel Project Settings → Environment Variables, deploy, and run:

   ```sh
   npm run check:live -- --probe
   ```

   Keep customer sales closed until the live readiness gate reports no blockers. Complete a low-value, real end-to-end order and verify the incoming Bakong payment, signed provider callback, and delivered game balance before opening sales.

`npm run setup:live` is an interactive helper that writes a local, ignored `.env` with restrictive file permissions. It cannot create provider accounts, verify credentials, configure Vercel, map game SKUs, or make the service live by itself. It deliberately does not request credentials in chat.

## Authentication and brand assets

- Google credentials are verified server-side against Google's token-info endpoint, with audience, issuer, expiration, subject, and verified-email checks.
- Telegram Login Widget data is checked server-side using the bot-token HMAC and a short authentication-age window.
- Google client ID and Telegram bot username are public configuration; the Telegram bot token is server-only. Rotate any credential that is exposed.
- Product marks use official Simple Icons where an exact brand icon exists. Brands without a supported exact mark render as plain text; the app does not substitute another brand's logo or draw lookalikes. Add additional official assets only after obtaining/confirming the rights and exact source.

## Fail-closed commerce guarantees

- Customer product lists are filtered to packages with real provider SKU mappings and freshly synced prices.
- Production checkout requires live configuration. If any live prerequisite is missing, order creation is rejected; it never falls back to a simulated payment or delivery.
- Fulfillment follows verified payment and is sent through the configured provider. Provider timeouts or failed deliveries remain visible as pending/failed for reconciliation; they are not marked delivered optimistically.
- Wallet top-ups/redemptions, rewards points, sample reviews, fake social proof, and canned promo claims are not part of customer checkout.
- New installations contain no seeded user, administrator, customer order, or saleable mapped package. The bootstrap admin is created explicitly against durable storage.

## Important environment variables

See [`.env.example`](.env.example) for the annotated full list. Core production values include:

- `PAYMENT_MODE=live`, `DATABASE_URL`, `PUBLIC_BASE_URL`, `VC_SECRET`, `CRON_SECRET`
- `GOOGLE_CLIENT_ID`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_BOT_TOKEN`
- `BAKONG_API_TOKEN`, `BAKONG_ACCOUNT_ID`, merchant name/city
- `PARTNER_PROVIDER=shop2topup`, `SHOP2TOPUP_API_KEY`, `SHOP2TOPUP_WEBHOOK_SECRET`

Never commit `.env` or real provider mappings/secrets. Check admin integration status after each deployment; readiness is an environment/configuration result, not a claim made by this README.
