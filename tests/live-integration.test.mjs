import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// Isolate config and the JSON store. db.js captures VC_DATA_DIR / DATABASE_URL
// at import time, so these are set BEFORE any server module is imported.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vctopup-live-test-'));
process.env.DOTENV_CONFIG_PATH = path.join(tmp, 'no-such.env');
process.env.VC_DATA_DIR = path.join(tmp, 'data');
process.env.PAYMENT_MODE = 'live';
process.env.VC_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
process.env.CRON_SECRET = 'z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4j3i2h1';
process.env.BAKONG_API_TOKEN = 'NBC_DEV_TOKEN_0123456789abcdefghijkl';
process.env.BAKONG_ACCOUNT_ID = 'vctopup@aba';
process.env.BAKONG_MERCHANT_NAME = 'VC TOPUP CO LTD';
process.env.BAKONG_MERCHANT_CITY = 'Siem Reap';
process.env.BAKONG_CURRENCY = 'USD';
process.env.PUBLIC_BASE_URL = 'https://pay.vctopup.shop';
process.env.PARTNER_PROVIDER = 'shop2topup';
process.env.SHOP2TOPUP_BASE_URL = 'https://mock.shop2topup.test/api/endpoints/v1';
process.env.SHOP2TOPUP_API_KEY = 'key_abc123456.secret_xyz987654321';
process.env.SHOP2TOPUP_WEBHOOK_SECRET = 'webhook_hmac_secret_0123456789';
process.env.SHOP2TOPUP_CATEGORY_ID = '12';
process.env.SHOP2TOPUP_VALIDATE_PLAYER = 'true';
process.env.GOOGLE_CLIENT_ID = '123456789012-testclient.apps.googleusercontent.com';
process.env.TELEGRAM_BOT_USERNAME = 'vctopup_test_bot';
process.env.TELEGRAM_BOT_TOKEN = `123456:${'A'.repeat(40)}`;
process.env.SHOP2TOPUP_ITEM_MAP = JSON.stringify({ 'mobile-legends:86-diamonds': '1001' });
process.env.DATABASE_URL = ''; // db.js uses the local JSON store in tests

const VALID_DATABASE_URL = 'postgresql://vcuser:Str0ngPass@db.vctopup.shop:5432/vctopup?sslmode=require';
const API_KEY = process.env.SHOP2TOPUP_API_KEY;
const WEBHOOK_SECRET = process.env.SHOP2TOPUP_WEBHOOK_SECRET;

const providerOrders = new Map();
let createCalls = 0;
const requests = [];

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const p = u.pathname;
  const method = init.method || 'GET';
  requests.push({ path: p, method, body: init.body ? JSON.parse(init.body) : null });
  if (u.hostname === 'oauth2.googleapis.com' && p === '/tokeninfo') {
    return jsonResponse({
      iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID,
      exp: String(Math.floor(Date.now() / 1000) + 3600), sub: 'google-user-98765',
      email: 'verified.user@gmail.com', email_verified: 'true', name: 'Verified User', picture: 'https://lh3.googleusercontent.com/picture',
    });
  }

  if (!String(init.headers?.Authorization || '').includes(API_KEY)) {
    return jsonResponse({ error: { code: 'PROVIDER_AUTH' }, success: false }, 401);
  }
  if (p.endsWith('/account')) {
    return jsonResponse({ account: { id: 'acc_1', name: 'VC TOPUP', email: 'ops@vctopup.shop', currency: 'USD', balance: 25.5 } });
  }
  if (p.includes('/catalog/category/12/requirements')) {
    return jsonResponse({ requirements: [
      { field_name: 'player_id', required: true },
      { field_name: 'server', required: false },
    ] });
  }
  if (p.includes('/catalog/subcategories')) {
    return jsonResponse({ subcategories: [{ item_id: 1001, name: 'MLBB 86 Diamonds', unit_price: '0.950000', currency: 'USD' }] });
  }
  if (p.includes('/catalog/subcategory/1001/price')) {
    return jsonResponse({ price: { unit_price: '0.950000', currency: 'USD' } });
  }
  if (p.endsWith('/player/validate')) {
    return jsonResponse({ valid: true, player: { player_name: 'ProGamer99' } });
  }
  if (p.endsWith('/orders/create')) {
    createCalls += 1;
    const body = JSON.parse(init.body);
    providerOrders.set(body.order_id, 'pending');
    return jsonResponse({ order: { order_id: body.order_id, status: 'pending' } });
  }
  const orderMatch = p.match(/\/orders\/([^/]+)$/);
  if (orderMatch && method === 'GET') {
    const id = decodeURIComponent(orderMatch[1]);
    if (!providerOrders.has(id)) {
      return jsonResponse({ success: false, error: { code: 'ORDER_NOT_FOUND' } }, 404);
    }
    return jsonResponse({ order: { order_id: id, status: providerOrders.get(id), transaction_id: `TX-${id.slice(0, 8)}` } });
  }
  return jsonResponse({});
};

const credentials = await import('../server/credentials.js');
const config = await import('../server/config.js');
const s2t = await import('../server/shop2topup.js');
const partner = await import('../server/partner.js');
const authProviders = await import('../server/authProviders.js');
const payments = await import('../server/payments.js');
const db = await import('../server/db.js');

await db.ensureStore();
const mappedTestPackage = db.getDB().products.find((p) => p.slug === 'mobile-legends').packages[0];
mappedTestPackage.partnerSku = '1001';
mappedTestPackage.providerCost = 0.95;
mappedTestPackage.providerPriceCheckedAt = new Date().toISOString();

const item = {
  productSlug: 'mobile-legends', packageId: '86-diamonds', productName: 'Mobile Legends',
  packageLabel: '86 Diamonds', price: 1.5, qty: 1, accountId: '12345678 (1234)', partnerSku: '1001',
  providerCost: 0.95, providerPriceCheckedAt: new Date().toISOString(),
};
const order = {
  code: 'VC-TEST-0001', items: [item], total: 1.5,
  payment: { currency: 'USD', status: 'paid' },
  customer: { name: 'Test', phone: '012345678', email: 'test@vctopup.shop' },
  fulfillment: {}, timeline: [],
};

test('placeholder credentials are rejected by the live gate', () => {
  assert.equal(credentials.isStrongSecret('REPLACE_WITH_RANDOM_32_BYTE_HEX', 32), false);
  assert.equal(credentials.isShop2TopupKey('REPLACE_WITH_KEY_ID.DOT_SECRET'), false);
  assert.equal(credentials.isBakongAccountId('REPLACE_WITH_YOUR_BAKONG_ID_AT_BANK'), false);
  assert.equal(credentials.isPostgresUrl('postgresql://user:password@localhost/db'), false);
  assert.equal(credentials.isHttpsUrl('https://your-domain.com'), false);
  assert.equal(credentials.hasFulfillableSku({ productSlug: 'x', packageId: 'y', partnerSku: 'x:y' }, {}, 'shop2topup'), false);
  assert.equal(credentials.hasFulfillableSku({ productSlug: 'x', packageId: 'y', partnerSku: '1001' }, {}, 'shop2topup'), true);
});

test('integrationStatus is ready with real-looking env values and never leaks secrets', () => {
  process.env.DATABASE_URL = VALID_DATABASE_URL;
  const s = config.integrationStatus();
  assert.equal(s.provider, 'shop2topup');
  assert.equal(s.ready, true, `blockers: ${s.blockers.join(', ')}`);
  assert.equal(s.checks.partnerSkus, true);
  assert.equal(s.webhookSignatureHeader, 'X-Shop2Topup-Signature');
  assert.ok(s.webhookUrl.endsWith('/api/payments/partner-callback'));
  const serialized = JSON.stringify(s);
  for (const secret of [API_KEY, WEBHOOK_SECRET, process.env.BAKONG_API_TOKEN, process.env.VC_SECRET]) {
    assert.equal(serialized.includes(secret), false);
  }
  assert.doesNotThrow(() => config.assertLiveReady([item]));
  assert.throws(() => config.assertLiveReady([{ ...item, productSlug: 'missing-game', packageId: 'unknown', partnerSku: '' }]), (err) => {
    assert.equal(err.name, 'LiveNotReadyError');
    assert.ok(err.blockers.some((b) => b.includes('missing-game:unknown')));
    return true;
  });
  mappedTestPackage.partnerSku = null;
  mappedTestPackage.providerCost = null;
  mappedTestPackage.providerPriceCheckedAt = null;
});

test('existing development stores are purged of fake sales, contact claims and demo credits', () => {
  const migrationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vctopup-purge-test-'));
  const oldState = {
    version: 2,
    products: [{ slug: 'mobile-legends', sold: 999, rating: 4.9, featured: true, packages: [{ id: '86-diamonds', partnerSku: '1001', oldPrice: 20, bonus: 'extra', popular: true, providerCost: 2, providerPriceCheckedAt: new Date().toISOString() }] }],
    users: [
      { id: 'usr_demo_admin', email: 'admin@vctopup.com', role: 'admin', balance: 500, points: 800 },
      { id: 'usr_demo_customer', email: 'dara@example.com', balance: 50, points: 100 },
      { id: 'usr_real_legacy', email: 'legacy.user@gmail.com', role: 'user', balance: 50, points: 100 },
    ],
    orders: [{ code: 'VC-DEMO-1', payment: { verification: 'sandbox', transactionId: 'TXN12345' }, customer: { email: 'dara@example.com' } }],
    messages: [{ email: 'dara@example.com' }], reviews: [{ id: 'review-demo' }], promos: [{ code: 'VC10' }],
    settings: { phone: '+85512345678', telegram: '@vctopup', email: 'info@example.com', stats: { customers: 40000 } },
  };
  fs.writeFileSync(path.join(migrationDir, 'db.json'), JSON.stringify(oldState));
  const dbUrl = pathToFileURL(path.resolve('server/db.js')).href;
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `const {getDB}=await import(${JSON.stringify(dbUrl)}); console.log(JSON.stringify(getDB()));`], {
    cwd: path.resolve('.'), env: { ...process.env, VC_DATA_DIR: migrationDir, PAYMENT_MODE: 'sandbox', DATABASE_URL: '' }, encoding: 'utf8',
  });
  const migrated = JSON.parse(result.trim().split(/\r?\n/).at(-1));
  assert.equal(migrated.version, 3);
  assert.equal(migrated.users.length, 1);
  assert.equal(migrated.users[0].balance, undefined);
  assert.equal(migrated.users[0].points, undefined);
  assert.equal(migrated.orders.length, 0);
  assert.equal(migrated.messages.length, 0);
  assert.equal(migrated.reviews.length, 0);
  assert.equal(migrated.promos.length, 0);
  assert.equal(migrated.settings.phone, '');
  assert.equal(migrated.settings.telegram, '');
  assert.deepEqual(migrated.settings.stats, { orders: 0, customers: 0, games: 0, uptime: null });
  assert.equal(migrated.products[0].sold, 0);
  assert.equal(migrated.products[0].rating, null);
  assert.equal(migrated.products[0].featured, false);
  assert.deepEqual(migrated.products[0].packages[0].oldPrice, null);
  assert.equal(migrated.products[0].packages[0].providerPriceCheckedAt, undefined);
});

test('fresh store contains no seeded accounts, sample orders, reviews or fake promos', () => {
  const fresh = db.getDB();
  assert.equal(fresh.users.length, 0);
  assert.equal(fresh.orders.length, 0);
  assert.equal(fresh.reviews.length, 0);
  assert.equal(fresh.promos.length, 0);
  assert.deepEqual(fresh.paymentMethods.map((m) => m.id), ['bakong']);
  assert.equal(fresh.settings.exchangeRate, null);
  assert.ok(fresh.products.every((p) => p.sold === 0 && p.rating === null && p.packages.every((pk) => !pk.partnerSku && !pk.oldPrice)));
});

test('Google ID-token and Telegram Login Widget signatures are verified server-side', async () => {
  const providerStatus = authProviders.authProviderConfig();
  assert.equal(providerStatus.googleReady, true);
  assert.equal(providerStatus.telegramReady, true);
  assert.equal(providerStatus.telegramBotUsername, 'vctopup_test_bot');
  process.env.GOOGLE_CLIENT_ID = 'REPLACE_WITH_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';
  process.env.TELEGRAM_BOT_USERNAME = 'REPLACE_WITH_TELEGRAM_BOT_USERNAME';
  process.env.TELEGRAM_BOT_TOKEN = 'REPLACE_WITH_TELEGRAM_BOT_TOKEN';
  assert.deepEqual(authProviders.authProviderConfig(), { googleClientId: '', telegramBotUsername: '', googleReady: false, telegramReady: false });
  process.env.GOOGLE_CLIENT_ID = '123456789012-testclient.apps.googleusercontent.com';
  process.env.TELEGRAM_BOT_USERNAME = 'vctopup_test_bot';
  process.env.TELEGRAM_BOT_TOKEN = `123456:${'A'.repeat(40)}`;
  const google = await authProviders.verifyGoogleCredential('id-token'.padEnd(150, 'x'));
  assert.equal(google.providerId, 'google-user-98765');
  assert.equal(google.email, 'verified.user@gmail.com');
  assert.equal(google.emailVerified, true);

  const fields = { id: 987654, first_name: 'Telegram', username: 'player_kh', auth_date: String(Math.floor(Date.now() / 1000)) };
  const check = Object.keys(fields).sort().map((key) => `${key}=${fields[key]}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(check).digest('hex');
  const telegram = authProviders.verifyTelegramLogin({ ...fields, hash });
  assert.equal(telegram.providerId, '987654');
  assert.equal(telegram.username, 'player_kh');
  assert.equal(telegram.email, null);
  assert.throws(() => authProviders.verifyTelegramLogin({ ...fields, hash: '0'.repeat(64) }), /verification failed/i);
});

test('forced admin retry still refuses delivery unless Bakong payment is verified', async () => {
  const unpaid = {
    code: 'VC-UNPAID-0001', items: [item], total: 1.5,
    payment: { method: 'bakong', verification: 'bakong', status: 'pending' },
    status: 'pending', fulfillment: {}, timeline: [],
  };
  db.mutate((state) => state.orders.unshift(unpaid));
  const requestsBefore = requests.length;
  const result = await payments.deliverOrder(unpaid.code, { force: true });
  assert.equal(result.status, 409);
  assert.match(result.error, /payment has not been verified/i);
  assert.equal(requests.length, requestsBefore);
});

test('generic partner callback remains supported', () => {
  const previous = process.env.PARTNER_PROVIDER;
  const previousSecret = process.env.PARTNER_CALLBACK_SECRET;
  process.env.PARTNER_PROVIDER = 'generic';
  process.env.PARTNER_CALLBACK_SECRET = 'generic_callback_secret_0123456789';
  const raw = JSON.stringify({ orderId: 'VC-GENERIC-1', status: 'SUCCESS' });
  const ts = String(Date.now());
  const sig = `sha256=${crypto.createHmac('sha256', process.env.PARTNER_CALLBACK_SECRET).update(`${ts}.${raw}`).digest('hex')}`;
  assert.equal(partner.verifyCallback(raw, sig, ts).ok, true);
  assert.equal(partner.verifyCallback(raw, `sha256=${'0'.repeat(64)}`, ts).ok, false);
  process.env.PARTNER_PROVIDER = previous;
  if (previousSecret === undefined) delete process.env.PARTNER_CALLBACK_SECRET;
  else process.env.PARTNER_CALLBACK_SECRET = previousSecret;
});

test('deterministic UUIDs are stable and valid', () => {
  const a = partner.deterministicUuid(`${order.code}:0`);
  const b = partner.deterministicUuid(`${order.code}:0`);
  const c = partner.deterministicUuid(`${order.code}:1`);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('Shop2Topup account probe returns safe account data', async () => {
  const r = await s2t.testConnection();
  assert.equal(r.reachable, true);
  assert.equal(r.funded, true);
  assert.equal(r.account.name, 'VC TOPUP');
  assert.equal(JSON.stringify(r).includes(API_KEY), false);
});

test('real player requirements and provider price are planned before payment', async () => {
  partner.clearRequirementsCache();
  const plan = await partner.planShop2TopupOrders(order);
  assert.equal(plan.error, undefined);
  assert.equal(plan.orders.length, 1);
  assert.equal(plan.orders[0].itemId, 1001);
  assert.equal(plan.orders[0].expectedUnitPrice, '0.950000');
  assert.equal(plan.orders[0].requirements.player_id, '12345678');
  assert.equal(plan.orders[0].requirements.server, '1234');
  assert.ok(plan.playerNames.includes('ProGamer99'));
  assert.ok(requests.some((r) => r.path.endsWith('/player/validate')));
  assert.ok(requests.some((r) => r.path.includes('/catalog/subcategory/1001/price')));
});

test('fulfillment is idempotent: one provider order, pending then completed', async () => {
  partner.clearRequirementsCache();
  const plan = await partner.planShop2TopupOrders(order);
  const prepared = { ...order, fulfillment: { providerOrders: plan.orders } };

  const pending = await partner.fulfill(prepared);
  assert.equal(pending.state, 'pending');
  assert.equal(createCalls, 1);
  assert.equal(pending.providerOrders.length, 1);

  const stillPending = await partner.fulfill(prepared);
  assert.equal(stillPending.state, 'pending');
  assert.equal(createCalls, 1, 'a retry must not create another provider order');

  providerOrders.set(plan.orders[0].id, 'completed');
  const done = await partner.fulfill(prepared);
  assert.equal(done.state, 'completed');
  assert.equal(createCalls, 1);
  assert.equal(done.providerResults[0].state, 'completed');
});

test('signed Shop2Topup webhook delivers a verified paid order exactly once', async () => {
  partner.clearRequirementsCache();
  const plan = await partner.planShop2TopupOrders(order);
  const providerOrderId = plan.orders[0].id;
  const code = 'VC-TEST-CALLBACK';

  await db.transact((d) => {
    d.orders.unshift({
      code, status: 'paid', payment: { status: 'paid' }, items: [item],
      customer: order.customer, fulfillment: { providerOrders: plan.orders },
      timeline: [],
    });
    d.partnerOrderMap ||= {};
    d.partnerOrderMap[providerOrderId] = code;
    d.webhookEvents = [];
  });

  const raw = JSON.stringify({
    event: 'order.completed',
    timestamp: new Date().toISOString(),
    data: { order_id: providerOrderId, status: 'completed', transaction_id: 'TX-REAL-1' },
  });
  const signature = `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')}`;
  const headers = { 'x-shop2topup-signature': signature };

  const first = await payments.handlePartnerCallback(raw, '', '', headers);
  assert.equal(first.order.code, code);
  assert.equal(first.order.status, 'completed');
  assert.equal(first.order.fulfillment.callbackEvent, 'order.completed');
  assert.equal(first.order.fulfillment.providerOrderId, providerOrderId);

  const replay = await payments.handlePartnerCallback(raw, '', '', headers);
  assert.equal(replay.duplicate, true);
  const stored = db.getDB().orders.find((o) => o.code === code);
  assert.equal(stored.pointsAwarded, undefined);

  const forged = await payments.handlePartnerCallback(raw, `sha256=${'0'.repeat(64)}`, '', { 'x-shop2topup-signature': `sha256=${'0'.repeat(64)}` });
  assert.equal(forged.status, 401);
});

test('callback for an unpaid order is ignored', async () => {
  const code = 'VC-TEST-UNPAID';
  const providerOrderId = partner.deterministicUuid(`${code}:0`);
  await db.transact((d) => {
    d.orders.unshift({
      code, status: 'pending', payment: { status: 'pending' }, items: [item],
      customer: order.customer, fulfillment: {}, timeline: [],
    });
    d.partnerOrderMap ||= {};
    d.partnerOrderMap[providerOrderId] = code;
  });
  const raw = JSON.stringify({
    event: 'order.completed', timestamp: new Date().toISOString(),
    data: { order_id: providerOrderId, status: 'completed' },
  });
  const signature = `sha256=${crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex')}`;
  const r = await payments.handlePartnerCallback(raw, '', '', { 'x-shop2topup-signature': signature });
  assert.equal(r.ignored, true);
  assert.equal(r.order.status, 'pending');
});

test('sandbox default remains safe in a fresh process', () => {
  // Child process check: PAYMENT_MODE=sandbox must never select live delivery.
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', `
    process.env.PAYMENT_MODE='sandbox';
    process.env.DOTENV_CONFIG_PATH='${path.join(tmp, 'no-such.env')}';
    process.env.VC_DATA_DIR='${path.join(tmp, 'sandbox-data')}';
    const { integrationStatus } = await import('${pathToFileURL(path.resolve('server/config.js')).href}');
    const s = integrationStatus();
    console.log(JSON.stringify({ mode: s.mode, ready: s.ready, provider: s.provider }));
  `], { encoding: 'utf8', env: { ...process.env, PAYMENT_MODE: 'sandbox', DATABASE_URL: '' } });
  const parsed = JSON.parse(out.trim().split('\n').pop());
  assert.equal(parsed.mode, 'sandbox');
  assert.equal(parsed.ready, true);
  assert.equal(parsed.provider, 'shop2topup');
});
