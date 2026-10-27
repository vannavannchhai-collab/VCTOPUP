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
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import {
  ROOT, getDB, saveDB, mutate, hashPassword, verifyPassword,
  signToken, verifyToken, uid, orderCode, publicUser,
} from './db.js';

const app = express();
export const PORT = process.env.PORT || 4000;
const IS_VERCEL = Boolean(process.env.VERCEL);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
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
      productIcon: p.icon, productColors: p.colors,
      packageId: pk.id, packageLabel: pk.label, price: pk.price,
      qty, accountId: clean(raw.accountId).slice(0, 80),
      lineTotal: round(pk.price * qty),
    };
  });
}

// ================================================================ PUBLIC API
api.get('/health', (_req, res) => res.json({ ok: true, service: 'VC TOPUP API', time: new Date().toISOString() }));

api.get('/bootstrap', (_req, res) => {
  const db = getDB();
  res.json({
    ok: true,
    settings: db.settings,
    categories: db.categories,
    paymentMethods: db.paymentMethods,
    reviews: db.reviews,
    faqs: db.faqs,
    featured: db.products.filter((p) => p.featured).map((p) => ({ ...p, minPrice: Math.min(...p.packages.map((x) => x.price)) })),
    popular: [...db.products].sort((a, b) => b.sold - a.sold).slice(0, 8).map((p) => ({ ...p, minPrice: Math.min(...p.packages.map((x) => x.price)) })),
    productCount: db.products.length,
  });
});

api.get('/categories', (_req, res) => res.json({ ok: true, data: getDB().categories }));

api.get('/products', (req, res) => {
  const db = getDB();
  const { category, q, sort = 'popular', limit } = req.query;
  let list = [...db.products];
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
  const db = getDB();
  const p = db.products.find((x) => x.slug === req.params.slug || x.id === req.params.slug);
  if (!p) return fail(res, 404, 'Product not found');
  const related = db.products.filter((x) => x.category === p.category && x.id !== p.id).slice(0, 4)
    .map((x) => ({ ...x, minPrice: Math.min(...x.packages.map((y) => y.price)) }));
  res.json({ ok: true, data: { ...p, minPrice: Math.min(...p.packages.map((x) => x.price)) }, related });
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

api.post('/orders', asyncH((req, res) => {
  const db = getDB();
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
  const method = clean(payment.method) || 'aba';
  if (!db.paymentMethods.some((m) => m.id === method)) return fail(res, 400, 'Invalid payment method');

  const subtotal = round(items.reduce((s, i) => s + i.lineTotal, 0));
  let discount = 0, appliedPromo = '';
  if (clean(promoCode)) {
    const result = computePromo(db, promoCode, subtotal);
    if (result.error) return fail(res, 400, result.error);
    discount = result.discount;
    appliedPromo = result.promo.code;
  }
  const total = round(Math.max(0, subtotal - discount));
  const now = new Date().toISOString();
  const isWallet = method === 'wallet';
  let payer = req.user || null;
  if (!payer) {
    const h = req.headers.authorization;
    const payload = h?.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
    payer = payload ? db.users.find((u) => u.id === payload.uid) : null;
  }
  if (isWallet) {
    if (!payer) return fail(res, 401, 'Please sign in to use your VC Wallet');
    if ((payer.balance || 0) < total) return fail(res, 400, 'Insufficient VC Wallet balance');
  }

  const code = orderCode();
  const order = {
    code,
    userId: payer?.id || null,
    items, subtotal, discount, total,
    promoCode: appliedPromo,
    customer: { name, phone, email, telegram: clean(customer.telegram) },
    payment: {
      method,
      status: isWallet ? 'paid' : 'pending',
      transactionId: clean(payment.transactionId) || (isWallet ? `WALLET-${code}` : ''),
    },
    status: isWallet ? 'processing' : 'pending',
    note: clean(note).slice(0, 500),
    pointsEarned: Math.floor(total),
    createdAt: now,
    timeline: [
      { status: 'pending', at: now, note: 'Order created' },
      ...(isWallet ? [{ status: 'processing', at: now, note: 'Paid with VC Wallet' }] : []),
    ],
  };

  mutate((d) => {
    d.orders.unshift(order);
    if (appliedPromo) {
      const p = d.promos.find((x) => x.code === appliedPromo);
      if (p) p.uses += 1;
    }
    if (isWallet && payer) {
      const u = d.users.find((x) => x.id === payer.id);
      if (u) u.balance = round((u.balance || 0) - total);
    }
    if (payer) {
      const u = d.users.find((x) => x.id === payer.id);
      if (u) u.points = (u.points || 0) + (isWallet ? order.pointsEarned : 0);
    }
  });
  res.status(201).json({ ok: true, data: order });
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
api.post('/auth/register', (req, res) => {
  const db = getDB();
  const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), phone = clean(req.body.phone);
  const password = String(req.body.password || '');
  if (name.length < 2) return fail(res, 400, 'Please enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, 'Please enter a valid email');
  if (password.length < 6) return fail(res, 400, 'Password must be at least 6 characters');
  if (db.users.some((u) => u.email === email)) return fail(res, 409, 'An account with this email already exists');
  const user = {
    id: uid('usr'), name, email, phone, password: hashPassword(password),
    role: 'user', balance: 2, points: 50, createdAt: new Date().toISOString(),
  };
  mutate((d) => d.users.push(user));
  res.status(201).json({ ok: true, token: signToken({ uid: user.id }), data: publicUser(user), message: 'Welcome to VC TOPUP! You received $2 welcome credit.' });
});

api.post('/auth/login', (req, res) => {
  const db = getDB();
  const email = clean(req.body.email).toLowerCase();
  const user = db.users.find((u) => u.email === email);
  if (!user || !verifyPassword(req.body.password, user.password)) return fail(res, 401, 'Incorrect email or password');
  res.json({ ok: true, token: signToken({ uid: user.id }), data: publicUser(user) });
});

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

api.post('/auth/wallet/topup', auth, (req, res) => {
  const amount = Number(req.body.amount);
  if (![5, 10, 20, 50, 100].includes(amount)) return fail(res, 400, 'Invalid amount');
  const user = mutate((db) => {
    const u = db.users.find((x) => x.id === req.user.id);
    u.balance = round((u.balance || 0) + amount);
    return publicUser(u);
  });
  res.json({ ok: true, data: user, message: `$${amount} added to your wallet (demo)` });
});

api.post('/auth/wallet/redeem', auth, (req, res) => {
  const points = 100;
  if ((req.user.points || 0) < points) return fail(res, 400, 'You need at least 100 VC Points');
  const user = mutate((db) => {
    const u = db.users.find((x) => x.id === req.user.id);
    u.points -= points;
    u.balance = round((u.balance || 0) + 1);
    return publicUser(u);
  });
  res.json({ ok: true, data: user, message: '100 VC Points redeemed for $1.00' });
});

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

api.put('/admin/orders/:code', (req, res) => {
  const db = getDB();
  const order = db.orders.find((o) => o.code === req.params.code);
  if (!order) return fail(res, 404, 'Order not found');
  const status = clean(req.body.status);
  if (!['pending', 'processing', 'completed', 'cancelled'].includes(status)) return fail(res, 400, 'Invalid status');
  const updated = mutate((d) => {
    const o = d.orders.find((x) => x.code === req.params.code);
    o.status = status;
    if (status === 'completed') o.payment.status = 'paid';
    o.timeline.push({ status, at: new Date().toISOString(), note: clean(req.body.note) || `Status changed to ${status}` });
    if (status === 'completed' && o.userId) {
      const u = d.users.find((x) => x.id === o.userId);
      if (u) u.points = (u.points || 0) + o.pointsEarned;
    }
    return o;
  });
  res.json({ ok: true, data: updated, message: 'Order updated' });
});

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
    delivery: b.delivery || { kh: '១–៥ នាទី', en: '1–5 min' },
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
  res.status(500).json({ ok: false, message: 'Something went wrong. Please try again.' });
});

// Seed on first import so the very first Function invocation has data.
getDB();

export { app };
export default app;
