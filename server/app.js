/**
 * VC TOPUP — Express application definition.
 *
 * This file deliberately DOES NOT call app.listen(). It is shared by two hosts:
 *   • server/index.js  → long-running Node server (local dev / VPS / container)
 *   • api/index.js     → Vercel Function (serverless, request-driven)
 *
 * Vercel has no process that stays alive between requests. Calling listen() at
 * module scope in a function bundle either does nothing useful or leaves an
 * orphan port with no router attached — which is one common source of 404s.
 */
import './env.js';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import {
  ROOT, getDB, saveDB, mutate, hashPassword, verifyPassword,
  signToken, verifyToken, uid, orderCode, publicUser,
  readFresh, transact, ensureStore,
} from './db.js';
import { integrationStatus, assertLiveReady, LiveNotReadyError, isLive, partnerConfig, shop2topupConfig } from './config.js';
import { isShop2TopupItemId } from './credentials.js';
import { validateOrderRecipients } from './partner.js';
import { authProviderConfig, verifyGoogleCredential, verifyTelegramLogin } from './authProviders.js';
import { testConnection as testProviderConnection, getCatalog as getProviderCatalog, getItemPrice } from './shop2topup.js';
import {
  attachPayment, publicPayment, verifyPayment, deliverOrder,
  refreshPaymentQR, handlePartnerCallback,
} from './payments.js';

const app = express();
export const PORT = process.env.PORT || 4000;
const IS_VERCEL = Boolean(process.env.VERCEL);

app.use(cors({ origin: true, credentials: true }));
// Keep the raw bytes so partner callbacks can be HMAC-verified exactly as sent.
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); },
}));
app.use((req, _res, next) => {
  if (process.env.NODE_ENV !== 'production' && req.path.startsWith('/api')) {
    console.log(`  ↳ ${req.method} ${req.originalUrl}`);
  }
  next();
});

const api = express.Router();
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const fail = (res, code, message, extra = {}) => res.status(code).json({ ok: false, message, ...extra });

// ---------------------------------------------------------------- middleware
function auth(req, _res, next) {
  const header = req.headers.authorization || '';
  const payload = verifyToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!payload) return fail(_res, 401, 'Not authenticated');
  const user = getDB().users.find((u) => u.id === payload.uid);
  if (!user) return fail(_res, 401, 'Account not found');
  req.user = user;
  next();
}
const adminOnly = (req, res, next) =>
  req.user.role !== 'admin' ? fail(res, 403, 'Admin access required') : next();

// ------------------------------------------------------------------ helpers
const clean = (v) => String(v ?? '').trim();
const round = (n) => Math.round(n * 100) / 100;

function computePromo(db, code, subtotal) {
  const promo = db.promos.find((p) => p.code.toUpperCase() === clean(code).toUpperCase());
  if (!promo || !promo.active) return { error: 'Invalid or inactive promo code' };
  if (promo.maxUses && promo.uses >= promo.maxUses) return { error: 'This promo code has reached its limit' };
  if (subtotal < promo.minOrder) return { error: `Minimum order of $${promo.minOrder.toFixed(2)} required` };
  const discount = promo.type === 'percent' ? round(subtotal * promo.value / 100) : round(Math.min(promo.value, subtotal));
  return { promo, discount };
}

function normalizeOrderItems(db, rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new Error('Your cart is empty');
  return rawItems.map((raw) => {
    const p = db.products.find((x) => x.slug === raw.productSlug || x.id === raw.productId);
    if (!p) throw new Error(`Product not found: ${raw.productSlug}`);
    const pk = p.packages.find((x) => x.id === raw.packageId) || p.packages.find((x) => x.label === raw.packageLabel);
    if (!pk) throw new Error(`Package not found for ${p.name}`);
    const qty = Math.min(99, Math.max(1, parseInt(raw.qty, 10) || 1));
    return {
      productId: p.id, productSlug: p.slug, productName: p.name,
      productIcon: p.icon, productColors: p.colors, productBrand: p.brand || null,
      packageId: pk.id, packageLabel: pk.label, price: pk.price,
      partnerSku: pk.partnerSku || '',
      providerCost: Number(pk.providerCost) || null,
      providerPriceCheckedAt: pk.providerPriceCheckedAt || null,
      qty, accountId: clean(raw.accountId).slice(0, 80),
      lineTotal: round(pk.price * qty),
    };
  });
}

// ================================================================ PUBLIC API
function customerCatalog() {
  if (!isLive || !integrationStatus().ready || partnerConfig().provider !== 'shop2topup') return [];
  const db = getDB();
  const maxAgeMs = Number(process.env.SHOP2TOPUP_PRICE_MAX_AGE_HOURS || 24) * 60 * 60_000;
  return db.products.map((product) => {
    const packages = (product.packages || []).filter((pk) => {
      const checkedAt = Date.parse(pk.providerPriceCheckedAt || '');
      return isShop2TopupItemId(pk.partnerSku)
        && Number.isFinite(Number(pk.providerCost)) && Number(pk.providerCost) > 0
        && Number.isFinite(checkedAt) && Date.now() - checkedAt <= maxAgeMs;
    });
    return { ...product, packages, minPrice: packages.length ? Math.min(...packages.map((p) => p.price)) : null,
      sold: 0, rating: null, tag: null, featured: false, popular: false };
  }).filter((p) => p.packages.length > 0);
}

api.get('/health', (_req, res) => res.json({
  ok: true, service: 'VC TOPUP API', time: new Date().toISOString(),
  paymentMode: integrationStatus().mode,
  durableStore: integrationStatus().checks.durableStore,
}));

/** Public, secret-free integration report. The UI uses it to keep checkout
 * locked until every required real integration is ready. */
api.get('/config', (_req, res) => res.json({ ok: true, data: integrationStatus() }));

api.get('/bootstrap', (_req, res) => {
  const db = getDB();
  const products = customerCatalog();
  const realOrders = (db.orders || []).filter((o) => o.payment?.status === 'paid' && o.status === 'completed');
  const settingsSnapshot = { ...db.settings, stats: {
    orders: realOrders.length,
    customers: new Set(realOrders.map((o) => o.userId || o.customer?.email || o.customer?.phone).filter(Boolean)).size,
    games: new Set(products.map((p) => p.category)).size,
    uptime: null,
  } };
  res.json({
    ok: true,
    payment: integrationStatus(),
    settings: settingsSnapshot,
    categories: db.categories.filter((c) => products.some((p) => p.category === c.id)),
    paymentMethods: db.paymentMethods,
    reviews: [],
    faqs: db.faqs,
    featured: products,
    popular: products,
    productCount: products.length,
  });
});

api.get('/categories', (_req, res) => {
  const products = customerCatalog();
  res.json({ ok: true, data: getDB().categories.filter((c) => products.some((p) => p.category === c.id)) });
});

api.get('/products', (req, res) => {
  const { category, q, sort = 'popular', limit } = req.query;
  let list = customerCatalog();
  if (category && category !== 'all') list = list.filter((p) => p.category === category);
  if (q) {
    const needle = clean(q).toLowerCase();
    list = list.filter((p) =>
      p.name.toLowerCase().includes(needle) ||
      p.slug.includes(needle) ||
      p.desc.en.toLowerCase().includes(needle) ||
      p.desc.kh.includes(needle) ||
      p.currency.toLowerCase().includes(needle)
    );
  }
  if (sort === 'price-asc') list.sort((a, b) => Math.min(...a.packages.map((x) => x.price)) - Math.min(...b.packages.map((x) => x.price)));
  else if (sort === 'price-desc') list.sort((a, b) => Math.min(...b.packages.map((x) => x.price)) - Math.min(...a.packages.map((x) => x.price)));
  else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
  else list.sort((a, b) => b.sold - a.sold);
  const data = list.map((p) => ({ ...p, minPrice: Math.min(...p.packages.map((x) => x.price)) }));
  res.json({ ok: true, data: limit ? data.slice(0, Number(limit)) : data, total: data.length });
});

api.get('/products/:slug', (req, res) => {
  const list = customerCatalog();
  const p = list.find((x) => x.slug === req.params.slug || x.id === req.params.slug);
  if (!p) return fail(res, 404, 'This product is not yet available from the verified top-up provider.');
  const related = list.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4);
  res.json({ ok: true, data: p, related });
});

api.get('/payment-methods', (_req, res) => res.json({ ok: true, data: getDB().paymentMethods }));
api.get('/reviews', (_req, res) => res.json({ ok: true, data: getDB().reviews }));
api.get('/faqs', (_req, res) => res.json({ ok: true, data: getDB().faqs }));
api.get('/settings', (_req, res) => res.json({ ok: true, data: getDB().settings }));

api.post('/promo/validate', (req, res) => {
  const db = getDB();
  const subtotal = Number(req.body.subtotal) || 0;
  const result = computePromo(db, req.body.code, subtotal);
  if (result.error) return fail(res, 400, result.error);
  res.json({ ok: true, data: { code: result.promo.code, type: result.promo.type, value: result.promo.value, discount: result.discount } });
});

api.post('/orders', asyncH(async (req, res) => {
  await ensureStore();
  if (!isLive) return fail(res, 503, 'Real payments are not enabled. No simulated or test orders are accepted.');
  const db = await readFresh();
  const { customer = {}, payment = {}, promoCode = '', note = '' } = req.body;
  let items;
  try { items = normalizeOrderItems(db, req.body.items); }
  catch (err) { return fail(res, 400, err.message); }

  const name = clean(customer.name), phone = clean(customer.phone), email = clean(customer.email);
  if (name.length < 2) return fail(res, 400, 'Please enter your name');
  if (!/^[0-9+\-\s]{7,20}$/.test(phone)) return fail(res, 400, 'Please enter a valid phone number');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Please enter a valid email');
  for (const item of items) {
    if (item.accountId.length < 3) return fail(res, 400, 'Please enter your account ID / phone number');
  }
  const method = clean(payment.method) || 'bakong';
  const methodConfig = db.paymentMethods.find((m) => m.id === method);
  if (!methodConfig || method !== 'bakong' || methodConfig.kind !== 'khqr') return fail(res, 400, 'Only verified Bakong KHQR checkout is enabled.');

  // HARD GATE: never accept a real-money order until verification, storage and
  // fulfillment are all configured. Fails closed rather than silently demo-ing.
  try { assertLiveReady(items); }
  catch (err) {
    return fail(res, err.status || 503, err.message, { blockers: err.blockers || [] });
  }

  const subtotal = round(items.reduce((s, i) => s + i.lineTotal, 0));
  let discount = 0, appliedPromo = '';
  if (clean(promoCode)) {
    const result = computePromo(db, promoCode, subtotal);
    if (result.error) return fail(res, 400, result.error);
    discount = result.discount;
    appliedPromo = result.promo.code;
  }
  const total = round(Math.max(0, subtotal - discount));

  // In live mode, verify the game account against the REAL provider before we
  // show a payable KHQR. Wrong IDs must not turn into paid, undeliverable orders.
  if (isLive) {
    let recipientCheck;
    try {
      recipientCheck = await validateOrderRecipients(items, {
        customer: { name, phone, email },
        currency: integrationStatus().qrCurrency,
      });
    } catch (err) {
      console.error('[order] recipient validation error', err);
      return fail(res, 422, 'Could not verify the game account with the delivery provider. Please try again.');
    }
    if (!recipientCheck.ok) return fail(res, 422, recipientCheck.message);
  }
  const now = new Date().toISOString();
  let payer = req.user || null;
  if (!payer) {
    const h = req.headers.authorization;
    const payload = h?.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
    payer = payload ? db.users.find((u) => u.id === payload.uid) : null;
  }
  const code = orderCode();
  const order = {
    code,
    userId: payer?.id || null,
    items, subtotal, discount, total,
    promoCode: appliedPromo,
    customer: { name, phone, email, telegram: clean(customer.telegram) },
    payment: { method, transactionId: clean(payment.transactionId) },
    status: 'pending',
    note: clean(note).slice(0, 500),
    fulfillment: { status: 'not_started', attempts: 0 },
    createdAt: now,
    timeline: [{ status: 'pending', at: now, note: 'Order created' }],
  };

  // A unique dynamic KHQR is generated SERVER-SIDE and bound to this order.
  // The browser never invents a payment string and never sets payment status.
  order.payment = attachPayment(order, methodConfig, db.settings);
  await transact((d) => { d.orders.unshift(order); });
  res.status(201).json({ ok: true, data: order, payment: publicPayment(order) });
}));

/* ============================================================ PAYMENT FLOW
 * The browser can only READ payment state. Verification is always triggered
 * here on the server, against Bakong, with the credentials in env vars.
 * ==================================================================== */
function findOrder(db, code) {
  return db.orders.find((o) => String(o.code).toLowerCase() === String(code).toLowerCase());
}

/**
 * Reconciliation sweep. If a Function crashed after payment but before
 * delivery, no browser is left polling — this endpoint finishes the job.
 * Call it from a scheduler with CRON_SECRET. Safe to call repeatedly.
 * NOTE: declared BEFORE /payments/:code so "reconcile" isn't read as a code.
 */
api.get('/payments/reconcile', asyncH(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-cron-secret'] || '';
  if (!secret || provided !== secret) return fail(res, 401, 'Reconciliation requires CRON_SECRET');
  await ensureStore();
  const db = await readFresh();
  const candidates = db.orders.filter((o) =>
    (o.status === 'paid') ||
    (o.status === 'processing' && o.fulfillment?.lastAttemptAt && Date.now() - new Date(o.fulfillment.lastAttemptAt).getTime() > 120_000) ||
    (o.status === 'pending' && o.payment?.verification === 'bakong' && o.payment?.expiresAt && Date.now() < new Date(o.payment.expiresAt).getTime())
  ).slice(0, 20);

  const results = [];
  for (const o of candidates) {
    try {
      const v = await verifyPayment(o.code);
      if (v.shouldDeliver) await deliverOrder(o.code);
      results.push({ code: o.code, ok: true, status: v.order?.status || o.status });
    } catch (err) {
      results.push({ code: o.code, ok: false, error: err.message });
    }
  }
  res.json({ ok: true, data: { scanned: candidates.length, results } });
}));

/** Public payment instruction for the /pay/:code page. */
api.get('/payments/:code', asyncH(async (req, res) => {
  await ensureStore();
  const db = await readFresh();
  const order = findOrder(db, req.params.code);
  if (!order) return fail(res, 404, 'Order not found');
  if (req.query.phone && clean(req.query.phone).replace(/\D/g, '').slice(-6) !== order.customer.phone.replace(/\D/g, '').slice(-6)) {
    return fail(res, 404, 'No order found for that phone number');
  }
  res.json({
    ok: true,
    data: {
      code: order.code,
      status: order.status,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items,
      customer: { name: order.customer.name, phone: order.customer.phone.replace(/\d(?=\d{4})/g, '•') },
      payment: publicPayment(order),
      fulfillment: order.fulfillment || null,
      timeline: order.timeline,
      config: { mode: integrationStatus().mode, qrTtlMinutes: integrationStatus().qrTtlMinutes },
    },
  });
}));

/**
 * Polling endpoint: verify with Bakong, settle, then deliver.
 * Safe to call repeatedly — every transition is idempotent.
 */
api.get('/payments/:code/status', asyncH(async (req, res) => {
  await ensureStore();
  const verified = await verifyPayment(req.params.code);
  if (verified.error) return fail(res, verified.status || 400, verified.error);
  let order = verified.order;
  let delivery = null;
  if (verified.shouldDeliver) {
    delivery = await deliverOrder(order.code);
    order = delivery.order || order;
  }
  res.json({
    ok: true,
    data: {
      code: order.code,
      status: order.status,
      paymentStatus: order.payment.status,
      verification: order.payment.verification,
      paidAt: order.payment.paidAt,
      expiresAt: order.payment.expiresAt || null,
      discrepancy: order.payment.discrepancy || null,
      fulfillment: order.fulfillment || null,
      deliveredAt: order.deliveredAt || null,
      timeline: order.timeline,
      verificationError: verified.verificationError || null,
      throttled: Boolean(verified.throttled),
    },
  });
}));

/** Issue a fresh KHQR after the previous one expired. */
api.post('/payments/:code/refresh', asyncH(async (req, res) => {
  await ensureStore();
  const r = await refreshPaymentQR(req.params.code);
  if (r.error) return fail(res, r.status || 400, r.error);
  res.json({ ok: true, data: publicPayment(r.order) });
}));

/** Signed partner callback for asynchronous delivery confirmations. */
api.post('/payments/partner-callback', asyncH(async (req, res) => {
  await ensureStore();
  await readFresh();
  const r = await handlePartnerCallback(
    req.rawBody || JSON.stringify(req.body || {}),
    req.headers['x-signature'] || req.headers['x-shop2topup-signature'] || '',
    req.headers['x-timestamp'] || '',
    req.headers
  );
  if (r.error) return fail(res, r.status || 400, r.error);
  res.json({ ok: true, received: true, duplicate: Boolean(r.duplicate), test: Boolean(r.test) });
}));

api.get('/orders/:code', (req, res) => {
  const db = getDB();
  const order = db.orders.find((o) => o.code.toLowerCase() === req.params.code.toLowerCase());
  if (!order) return fail(res, 404, 'Order not found');
  if (req.query.phone && clean(req.query.phone).replace(/\D/g, '').slice(-6) !== order.customer.phone.replace(/\D/g, '').slice(-6)) {
    return fail(res, 404, 'No order found for that phone number');
  }
  res.json({ ok: true, data: order });
});

api.get('/orders', (req, res) => {
  const db = getDB();
  const phone = clean(req.query.phone).replace(/\D/g, '');
  const email = clean(req.query.email).toLowerCase();
  if (!phone && !email) return fail(res, 400, 'Phone or email is required');
  const data = db.orders.filter((o) =>
    (phone && o.customer.phone.replace(/\D/g, '').includes(phone.slice(-6))) ||
    (email && o.customer.email.toLowerCase() === email)
  );
  res.json({ ok: true, data });
});

api.post('/contact', (req, res) => {
  const { name, email, subject, body } = req.body;
  if (clean(name).length < 2 || !clean(email).includes('@') || clean(body).length < 5) {
    return fail(res, 400, 'Please complete all required fields');
  }
  const message = {
    id: uid('msg'), name: clean(name), email: clean(email),
    subject: clean(subject) || 'General enquiry', body: clean(body).slice(0, 2000),
    read: false, createdAt: new Date().toISOString(),
  };
  mutate((db) => db.messages.unshift(message));
  res.status(201).json({ ok: true, message: 'Message received. We will get back to you soon!', data: message });
});

// ==================================================================== AUTH
api.get('/auth/providers', (_req, res) => res.json({ ok: true, data: authProviderConfig() }));

api.post('/auth/register', asyncH(async (req, res) => {
  await ensureStore();
  const db = await readFresh();
  const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), phone = clean(req.body.phone);
  const password = String(req.body.password || '');
  if (name.length < 2) return fail(res, 400, 'Please enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Please enter a valid email');
  if (password.length < 10) return fail(res, 400, 'Password must be at least 10 characters');
  if (db.users.some((u) => u.email?.toLowerCase() === email)) return fail(res, 409, 'An account with this email already exists');
  const user = {
    id: uid('usr'), name, email, phone, password: hashPassword(password), authProvider: 'password',
    role: 'user', createdAt: new Date().toISOString(),
  };
  await transact((d) => d.users.push(user));
  res.status(201).json({ ok: true, token: signToken({ uid: user.id }), data: publicUser(user), message: 'Account created.' });
}));

api.post('/auth/login', asyncH(async (req, res) => {
  await ensureStore();
  const db = await readFresh();
  const email = clean(req.body.email).toLowerCase();
  const user = db.users.find((u) => u.email?.toLowerCase() === email && u.password);
  if (!user || !verifyPassword(req.body.password, user.password)) return fail(res, 401, 'Incorrect email or password');
  res.json({ ok: true, token: signToken({ uid: user.id }), data: publicUser(user) });
}));

async function createSocialSession(identity) {
  const user = await transact((d) => {
    d.users ||= [];
    let current = d.users.find((u) => u.authProvider === identity.provider && u.providerId === identity.providerId);
    if (!current && identity.email) {
      current = d.users.find((u) => u.email?.toLowerCase() === identity.email.toLowerCase());
      if (current && current.authProvider && current.authProvider !== 'password' && current.providerId !== identity.providerId) {
        throw Object.assign(new Error('This email is already connected to another sign-in provider.'), { status: 409 });
      }
      if (current) {
        current.authProvider = identity.provider;
        current.providerId = identity.providerId;
        current.emailVerified = true;
      }
    }
    if (!current) {
      current = {
        id: uid('usr'), name: identity.name, email: identity.email || null,
        phone: '', telegram: identity.username ? `@${identity.username}` : '',
        authProvider: identity.provider, providerId: identity.providerId,
        emailVerified: Boolean(identity.emailVerified), picture: identity.picture || '',
        role: 'user', createdAt: new Date().toISOString(),
      };
      d.users.push(current);
    } else {
      current.name ||= identity.name;
      current.picture ||= identity.picture || '';
      if (identity.username) current.telegram = `@${identity.username}`;
    }
    return current;
  });
  return { ok: true, token: signToken({ uid: user.id }), data: publicUser(user), message: 'Signed in successfully.' };
}

api.post('/auth/google', asyncH(async (req, res) => {
  await ensureStore();
  try {
    const identity = await verifyGoogleCredential(req.body?.credential);
    res.json(await createSocialSession(identity));
  } catch (err) { return fail(res, err.status || 401, err.message || 'Google sign-in failed'); }
}));

api.post('/auth/telegram', asyncH(async (req, res) => {
  await ensureStore();
  try {
    const identity = verifyTelegramLogin(req.body);
    res.json(await createSocialSession(identity));
  } catch (err) { return fail(res, err.status || 401, err.message || 'Telegram sign-in failed'); }
}));

api.get('/auth/me', auth, (req, res) => res.json({ ok: true, data: publicUser(req.user) }));

api.put('/auth/profile', auth, (req, res) => {
  const name = clean(req.body.name), phone = clean(req.body.phone), telegram = clean(req.body.telegram);
  if (name.length < 2) return fail(res, 400, 'Please enter your name');
  const updated = mutate((db) => {
    const u = db.users.find((x) => x.id === req.user.id);
    u.name = name; u.phone = phone; u.telegram = telegram;
    return publicUser(u);
  });
  res.json({ ok: true, data: updated, message: 'Profile updated' });
});

api.post('/auth/change-password', auth, (req, res) => {
  const current = String(req.body.current || ''), next = String(req.body.next || '');
  if (!verifyPassword(current, req.user.password)) return fail(res, 400, 'Current password is incorrect');
  if (next.length < 6) return fail(res, 400, 'New password must be at least 6 characters');
  mutate((db) => { db.users.find((x) => x.id === req.user.id).password = hashPassword(next); });
  res.json({ ok: true, message: 'Password changed successfully' });
});

api.get('/auth/orders', auth, (req, res) => {
  const db = getDB();
  const data = db.orders.filter((o) => o.userId === req.user.id || o.customer.email === req.user.email);
  res.json({ ok: true, data });
});

api.post('/auth/wallet/topup', auth, (_req, res) => fail(res, 410, 'The internal wallet is disabled. Pay through the verified Bakong KHQR for each order.'));
api.post('/auth/wallet/redeem', auth, (_req, res) => fail(res, 410, 'Promotional wallet credits are not issued.'));

// =================================================================== ADMIN
api.use('/admin', auth, adminOnly);

api.get('/admin/overview', (_req, res) => {
  const db = getDB();
  const orders = db.orders;
  const completed = orders.filter((o) => o.status === 'completed');
  const revenue = round(completed.reduce((s, o) => s + o.total, 0));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const thisMonth = orders.filter((o) => new Date(o.createdAt) >= new Date(today.getFullYear(), today.getMonth(), 1));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today.getTime() - (13 - i) * 86400000);
    const key = d.toISOString().slice(0, 10);
    const dayOrders = completed.filter((o) => o.createdAt.slice(0, 10) === key);
    return { date: key, label: `${d.getDate()}/${d.getMonth() + 1}`, orders: dayOrders.length, revenue: round(dayOrders.reduce((s, o) => s + o.total, 0)) };
  });
  const byCategory = db.categories.map((c) => {
    const ids = new Set(db.products.filter((p) => p.category === c.id).map((p) => p.id));
    const catOrders = completed.filter((o) => o.items.some((i) => ids.has(i.productId)));
    return { id: c.id, name: c.name, count: catOrders.length, revenue: round(catOrders.reduce((s, o) => s + o.total, 0)) };
  });
  const topProducts = [...db.products].sort((a, b) => b.sold - a.sold).slice(0, 6).map((p) => ({
    id: p.id, name: p.name, icon: p.icon, colors: p.colors, sold: p.sold,
    revenue: round(completed.filter((o) => o.items.some((i) => i.productId === p.id)).reduce((s, o) => s + o.total, 0)),
  }));
  res.json({
    ok: true,
    data: {
      stats: {
        revenue, orders: orders.length, customers: db.users.filter((u) => u.role === 'user').length,
        products: db.products.length, pending: orders.filter((o) => o.status === 'pending').length,
        processing: orders.filter((o) => o.status === 'processing').length,
        completed: completed.length, cancelled: orders.filter((o) => o.status === 'cancelled').length,
        thisMonth: thisMonth.length, avgOrder: orders.length ? round(revenue / Math.max(1, completed.length)) : 0,
        monthRevenue: round(completed.filter((o) => new Date(o.createdAt) >= new Date(today.getFullYear(), today.getMonth(), 1)).reduce((s, o) => s + o.total, 0)),
      },
      chart: days, byCategory, topProducts,
      recent: orders.slice(0, 8),
      lowStock: [],
    },
  });
});

api.get('/admin/orders', (req, res) => {
  const db = getDB();
  let list = [...db.orders];
  if (req.query.status && req.query.status !== 'all') list = list.filter((o) => o.status === req.query.status);
  if (req.query.q) {
    const n = clean(req.query.q).toLowerCase();
    list = list.filter((o) => o.code.toLowerCase().includes(n) || o.customer.name.toLowerCase().includes(n) || o.customer.phone.includes(n) || o.items.some((i) => i.productName.toLowerCase().includes(n)));
  }
  res.json({ ok: true, data: list, total: list.length });
});

/** Retry a failed partner delivery (idempotent thanks to Idempotency-Key). */
api.post('/admin/orders/:code/retry', asyncH(async (req, res) => {
  await ensureStore();
  const current = (await readFresh()).orders.find((o) => o.code === req.params.code);
  if (!current) return fail(res, 404, 'Order not found');
  if (current.payment?.status !== 'paid' || current.status !== 'delivery_failed') {
    return fail(res, 409, 'Only a paid order with a failed provider delivery can be retried.');
  }
  const r = await deliverOrder(req.params.code, { force: true });
  if (r.error) return fail(res, r.status || 400, r.error);
  res.json({ ok: true, data: r.order, result: r.result || null, message: 'Delivery retried' });
}));

/** Integration health — safe booleans only, never secret values. */
api.get('/admin/integrations', asyncH(async (_req, res) => {
  await ensureStore();
  const s = integrationStatus();
  const db = getDB();
  res.json({ ok: true, data: {
    ...s,
    ordersAwaitingPayment: db.orders.filter((o) => o.status === 'pending').length,
    ordersFailedDelivery: db.orders.filter((o) => o.status === 'delivery_failed').length,
    recentSecurityEvents: (db.securityEvents || []).slice(0, 12),
  } });
}));

/** Verify the real provider account without ever returning a credential. */
api.get('/admin/integrations/connection', asyncH(async (_req, res) => {
  await ensureStore();
  const provider = partnerConfig().provider;
  if (provider !== 'shop2topup') {
    return res.json({ ok: true, data: {
      provider, configured: integrationStatus().checks.partnerCredentials,
      reachable: false, reason: 'Remote account check is available for Shop2Topup only',
    } });
  }
  res.json({ ok: true, data: await testProviderConnection() });
}));

/** Browse real catalogue IDs so an admin can map each package safely. */
api.get('/admin/integrations/catalog', asyncH(async (req, res) => {
  await ensureStore();
  const provider = partnerConfig().provider;
  if (provider !== 'shop2topup') return fail(res, 400, 'Catalogue browser is available for Shop2Topup only');
  if (!integrationStatus().checks.partnerCredentials) {
    return fail(res, 422, 'Set a real SHOP2TOPUP_API_KEY in the server environment before loading the provider catalogue.');
  }
  const categoryId = clean(req.query.categoryId) || shop2CategoryId();
  try {
    res.json({ ok: true, data: await getProviderCatalog(categoryId) });
  } catch (err) {
    return fail(res, 422, `Could not load provider catalogue: ${err.message}`);
  }
}));

/** Atomically map our packages to real provider item IDs. No secrets here. */
api.put('/admin/integrations/sku-map', asyncH(async (req, res) => {
  await ensureStore();
  const map = req.body?.map;
  if (!map || typeof map !== 'object' || Array.isArray(map)) return fail(res, 400, 'A JSON object of package keys → item IDs is required');
  const provider = partnerConfig().provider;
  if (provider !== 'shop2topup') return fail(res, 400, 'Provider price sync currently supports Shop2Topup only');
  const db = await readFresh();
  const validKeys = new Set(db.products.flatMap((p) => (p.packages || []).map((pk) => `${p.slug}:${pk.id}`)));
  const entries = Object.entries(map).map(([key, raw]) => [key, clean(raw)]);
  for (const [key, value] of entries) {
    if (!validKeys.has(key)) return fail(res, 400, `Unknown package mapping: ${key}`);
    if (value && !isShop2TopupItemId(value)) return fail(res, 400, `${key}: Shop2Topup item IDs must be positive numbers`);
    if (key.length > 120 || value.length > 120) return fail(res, 400, 'Mapping keys or values are too long');
  }

  const toRefresh = entries.filter(([key, value]) => {
    if (!value) return false;
    const [slug, pkgId] = key.split(':');
    const pkg = db.products.find((p) => p.slug === slug)?.packages.find((x) => x.id === pkgId);
    const checked = Date.parse(pkg?.providerPriceCheckedAt || '');
    const maxAge = Number(process.env.SHOP2TOPUP_PRICE_MAX_AGE_HOURS || 24) * 60 * 60_000;
    return pkg?.partnerSku !== value || !Number.isFinite(checked) || Date.now() - checked > maxAge;
  });
  if (toRefresh.length && !integrationStatus().checks.partnerCredentials) {
    return fail(res, 422, 'Set a real SHOP2TOPUP_API_KEY before mapping items; package prices are synced from the real catalogue.');
  }
  if (toRefresh.length > 20) return fail(res, 413, 'Map at most 20 new or changed items per save so every price can be verified safely.');

  const { retailMultiplier } = shop2topupConfig();
  const prices = new Map();
  for (const [key, itemId] of toRefresh) {
    let quote;
    try { quote = await getItemPrice(itemId); }
    catch (err) { return fail(res, 422, `Could not verify provider price for ${key}: ${err.message}`); }
    if (!Number.isFinite(quote.unitPrice) || quote.unitPrice <= 0 || quote.currency !== 'USD') {
      return fail(res, 422, `${key}: provider returned an invalid price or unsupported currency (${quote.currency})`);
    }
    prices.set(key, { ...quote, itemId, retailPrice: round(quote.unitPrice * retailMultiplier) });
  }

  const updated = await transact((d) => {
    let count = 0;
    for (const p of d.products) {
      for (const pk of p.packages || []) {
        const key = `${p.slug}:${pk.id}`;
        if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
        const itemId = clean(map[key]);
        if (!itemId) {
          pk.partnerSku = null; pk.providerCost = null; pk.providerPriceCheckedAt = null;
          pk.providerPriceCurrency = null; pk.priceSource = null;
          continue;
        }
        const quote = prices.get(key);
        if (quote) {
          pk.partnerSku = itemId;
          pk.providerCost = quote.unitPrice;
          pk.providerPriceCurrency = quote.currency;
          pk.providerPriceCheckedAt = quote.checkedAt;
          pk.priceSource = 'shop2topup-live-catalog';
          pk.price = quote.retailPrice;
          pk.oldPrice = null;
        }
        count += 1;
      }
    }
    return count;
  });
  res.json({ ok: true, data: { updated, syncedPrices: prices.size, retailMultiplier, integration: integrationStatus() }, message: `${updated} mappings saved; ${prices.size} real provider prices synchronized` });
}));

function shop2CategoryId() {
  return String(process.env.SHOP2TOPUP_CATEGORY_ID || process.env.S2T_CATEGORY_ID || '').trim();
}

api.get('/admin/products', (_req, res) => res.json({ ok: true, data: getDB().products }));

api.post('/admin/products', (req, res) => {
  const b = req.body;
  const slug = clean(b.slug || b.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const db = getDB();
  if (db.products.some((p) => p.slug === slug)) return fail(res, 409, 'A product with this slug already exists');
  const p = {
    id: slug, slug, name: clean(b.name) || 'Untitled product',
    category: clean(b.category) || 'games', icon: clean(b.icon) || 'Gamepad2',
    colors: Array.isArray(b.colors) && b.colors.length === 2 ? b.colors : ['#8b5cf6', '#4f46e5'],
    tag: clean(b.tag) || null, featured: !!b.featured, popular: !!b.popular,
    rating: 4.8, sold: Number(b.sold) || 0, requiresId: clean(b.requiresId) || 'player',
    idLabel: b.idLabel || { kh: 'លេខសម្គាល់អ្នកលេង', en: 'Player ID' },
    idPlaceholder: clean(b.idPlaceholder) || '123456789',
    currency: clean(b.currency) || 'units',
    desc: b.desc || { kh: '', en: '' },
    instructions: b.instructions || { kh: [], en: [] },
    delivery: b.delivery || { kh: 'ពេលវេលាដឹកជញ្ជូនអាស្រ័យលើអ្នកផ្គត់ផ្គង់', en: 'Delivery timing depends on the provider' },
    packages: Array.isArray(b.packages) && b.packages.length ? b.packages : [
      { id: 'starter', label: 'Starter', price: 1, oldPrice: null, bonus: null, popular: false },
    ],
  };
  mutate((d) => d.products.push(p));
  res.status(201).json({ ok: true, data: p, message: 'Product created' });
});

api.put('/admin/products/:id', (req, res) => {
  const db = getDB();
  if (!db.products.some((p) => p.id === req.params.id)) return fail(res, 404, 'Product not found');
  const updated = mutate((d) => {
    const idx = d.products.findIndex((p) => p.id === req.params.id);
    d.products[idx] = { ...d.products[idx], ...req.body, id: d.products[idx].id, slug: d.products[idx].slug };
    return d.products[idx];
  });
  res.json({ ok: true, data: updated, message: 'Product updated' });
});

api.delete('/admin/products/:id', (req, res) => {
  const db = getDB();
  if (!db.products.some((p) => p.id === req.params.id)) return fail(res, 404, 'Product not found');
  mutate((d) => { d.products = d.products.filter((p) => p.id !== req.params.id); });
  res.json({ ok: true, message: 'Product deleted' });
});

api.get('/admin/promos', (_req, res) => res.json({ ok: true, data: getDB().promos }));

api.post('/admin/promos', (req, res) => {
  const code = clean(req.body.code).toUpperCase();
  const db = getDB();
  if (!code) return fail(res, 400, 'Code is required');
  if (db.promos.some((p) => p.code === code)) return fail(res, 409, 'This code already exists');
  const p = {
    code, type: req.body.type === 'fixed' ? 'fixed' : 'percent',
    value: Number(req.body.value) || 10, minOrder: Number(req.body.minOrder) || 0,
    maxUses: Number(req.body.maxUses) || 100, uses: 0, active: req.body.active !== false,
    note: req.body.note || { kh: '', en: '' },
  };
  mutate((d) => d.promos.push(p));
  res.status(201).json({ ok: true, data: p, message: 'Promo created' });
});

api.put('/admin/promos/:code', (req, res) => {
  const db = getDB();
  if (!db.promos.some((p) => p.code === req.params.code)) return fail(res, 404, 'Promo not found');
  const updated = mutate((d) => {
    const p = d.promos.find((x) => x.code === req.params.code);
    Object.assign(p, req.body, { code: p.code });
    return p;
  });
  res.json({ ok: true, data: updated, message: 'Promo updated' });
});

api.delete('/admin/promos/:code', (req, res) => {
  mutate((d) => { d.promos = d.promos.filter((p) => p.code !== req.params.code); });
  res.json({ ok: true, message: 'Promo deleted' });
});

api.get('/admin/users', (_req, res) => {
  const db = getDB();
  const data = db.users.map((u) => ({
    ...publicUser(u),
    orderCount: db.orders.filter((o) => o.userId === u.id || o.customer.email === u.email).length,
    spent: round(db.orders.filter((o) => (o.userId === u.id || o.customer.email === u.email) && o.status === 'completed').reduce((s, o) => s + o.total, 0)),
  }));
  res.json({ ok: true, data });
});

api.get('/admin/messages', (_req, res) => res.json({ ok: true, data: getDB().messages }));

api.put('/admin/messages/:id', (req, res) => {
  const updated = mutate((db) => {
    const m = db.messages.find((x) => x.id === req.params.id);
    if (!m) return null;
    if (req.body.read !== undefined) m.read = !!req.body.read;
    return m;
  });
  if (!updated) return fail(res, 404, 'Message not found');
  res.json({ ok: true, data: updated });
});

api.put('/admin/settings', (req, res) => {
  const allowed = ['announcement', 'phone', 'telegram', 'email', 'exchangeRate', 'tagline', 'address'];
  const updated = mutate((db) => {
    for (const key of allowed) if (req.body[key] !== undefined) db.settings[key] = req.body[key];
    return db.settings;
  });
  res.json({ ok: true, data: updated, message: 'Settings saved' });
});

// -------------------------------------------------------------------- mount
app.use('/api', api);

// On Vercel, a rewrite to a Function normally preserves the original request
// path (/api/products/x). Mount the router at the root as well so the API still
// resolves if a runtime delivers the path with the /api prefix stripped.
if (IS_VERCEL) app.use(api);

app.use('/api', (_req, res) => fail(res, 404, 'API endpoint not found'));

// Static hosting is a local/VPS concern. On Vercel the CDN serves `dist/`
// directly (see outputDirectory in vercel.json), so a filesystem check here
// would look for files that are not in the Function bundle.
const DIST = path.join(ROOT, 'dist');
if (!IS_VERCEL && fs.existsSync(DIST)) {
  app.use(express.static(DIST, { maxAge: '1h' }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  const status = Number(err.status) || (err instanceof LiveNotReadyError ? 503 : 500);
  // Config/verification errors are safe to show; unexpected internals are not.
  const message = status < 500 ? err.message : 'Something went wrong. Please try again.';
  res.status(status).json({ ok: false, message, ...(err.blockers ? { blockers: err.blockers } : {}) });
});

// Seed on first import so the very first Function invocation has data.
getDB();

export { app };
export default app;
