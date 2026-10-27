import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { categories, products, promos, reviews, faqs, paymentMethods, settings } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

/**
 * Where the demo JSON store lives.
 *
 * A Vercel Function's project filesystem is read-only — only /tmp is writable.
 * Writing to ROOT/data there throws EROFS, which surfaces as a 500 (and, when
 * it happens during bootstrap, as a broken/404-looking deployment). /tmp keeps
 * the demo functional, but it is per-instance and wiped on cold starts, so it
 * is NOT durable. For real orders, point VC_DATA_DIR at a mounted volume or,
 * much better, replace this module with Postgres / Vercel KV / Turso.
 */
const DATA_DIR = process.env.VC_DATA_DIR
  || (process.env.VERCEL ? '/tmp/vctopup-data' : path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const SECRET = process.env.VC_SECRET || 'vctopup-demo-secret-change-me-in-production';

// ------------------------------------------------------------------ crypto
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(password), salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
  } catch {
    return false;
  }
}

export function signToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 30 })).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const uid = (prefix = 'id') => `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
export const orderCode = (d = new Date()) =>
  `VC-${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

// -------------------------------------------------------------- demo orders
function makeDemoOrders() {
  const customers = [
    ['ដារ៉ា សុភាព', '012345678', 'dara@example.com'],
    ['វិចិត្រ ចាន់ថា', '010987654', 'vichetr@example.com'],
    ['សុភាវី រិទ្ធី', '011222333', 'sopheavy@example.com'],
    ['ម៉ាឡែន ពិសិដ្ឋ', '077888999', 'malen@example.com'],
    ['Rathanak Pich', '016555444', 'rathanak@example.com'],
    ['Sreyneath Kong', '069111222', 'sreyneath@example.com'],
  ];
  const picks = [
    ['mobile-legends', 3], ['free-fire', 2], ['metfone', 4], ['pubg-mobile', 2],
    ['smart', 1], ['steam-wallet', 2], ['tiktok-coins', 1], ['genshin-impact', 2],
    ['netflix', 1], ['valorant', 1], ['cellcard', 2], ['spotify', 1],
  ];
  const statuses = ['completed', 'completed', 'completed', 'completed', 'completed', 'processing', 'completed', 'pending', 'completed', 'cancelled', 'completed', 'completed'];
  const methods = ['aba', 'wing', 'truemoney', 'acleda', 'wallet'];
  const out = [];

  for (let i = 0; i < 34; i++) {
    const d = new Date(Date.now() - i * 21 * 60 * 60 * 1000 - (i % 5) * 3600 * 1000);
    const [slug, pkgIndex] = picks[i % picks.length];
    const p = products.find((x) => x.slug === slug);
    const pk = p.packages[Math.min(pkgIndex, p.packages.length - 1)];
    const customer = customers[i % customers.length];
    const qty = i % 7 === 0 ? 2 : 1;
    const subtotal = pk.price * qty;
    const discount = i % 5 === 0 ? +(subtotal * 0.1).toFixed(2) : 0;
    const total = +(subtotal - discount).toFixed(2);
    const status = i < 6 ? statuses[i % statuses.length] : (i % 11 === 0 ? 'cancelled' : i % 7 === 0 ? 'processing' : i % 13 === 0 ? 'pending' : 'completed');
    out.push({
      code: orderCode(d) + String(i).padStart(2, '0'),
      userId: i % 3 === 0 ? 'usr_demo1' : null,
      items: [{
        productId: p.id,
        productSlug: p.slug,
        productName: p.name,
        productIcon: p.icon,
        productColors: p.colors,
        packageId: pk.id,
        packageLabel: pk.label,
        price: pk.price,
        qty,
        accountId: status === 'completed' ? '••••' + String(1000 + i).slice(-4) : '',
        lineTotal: +(pk.price * qty).toFixed(2),
      }],
      subtotal: +subtotal.toFixed(2),
      discount,
      total,
      promoCode: discount ? 'VC10' : '',
      customer: { name: customer[0], phone: customer[1], email: customer[2], telegram: '' },
      payment: { method: methods[i % methods.length], status: status === 'completed' ? 'paid' : 'pending', transactionId: status === 'completed' ? 'TXN' + (100000 + i * 137) : '' },
      status,
      note: '',
      pointsEarned: Math.floor(total),
      createdAt: d.toISOString(),
      timeline: [
        { status: 'pending', at: d.toISOString(), note: 'Order created' },
        ...(status !== 'pending' ? [{ status: 'processing', at: new Date(d.getTime() + 60000).toISOString(), note: 'Payment verified' }] : []),
        ...(status === 'completed' ? [{ status: 'completed', at: new Date(d.getTime() + 180000).toISOString(), note: 'Credits delivered' }] : []),
        ...(status === 'cancelled' ? [{ status: 'cancelled', at: new Date(d.getTime() + 120000).toISOString(), note: 'Cancelled by admin' }] : []),
      ],
    });
  }
  return out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function seed() {
  const users = [
    { id: 'usr_demo1', name: 'ដារ៉ា សុភាព', email: 'dara@example.com', phone: '012345678', password: hashPassword('User@123'), role: 'user', balance: 25.5, points: 340, createdAt: new Date(Date.now() - 90 * 86400000).toISOString() },
    { id: 'usr_demo2', name: 'Admin VC', email: 'admin@vctopup.com', phone: '012000000', password: hashPassword('Admin@123'), role: 'admin', balance: 0, points: 0, createdAt: new Date(Date.now() - 200 * 86400000).toISOString() },
    { id: 'usr_demo3', name: 'វិចិត្រ ចាន់ថា', email: 'vichetr@example.com', phone: '010987654', password: hashPassword('User@123'), role: 'user', balance: 8.0, points: 120, createdAt: new Date(Date.now() - 60 * 86400000).toISOString() },
  ];
  return {
    version: 1,
    settings, categories, products, promos, reviews, faqs, paymentMethods,
    users,
    orders: makeDemoOrders(),
    messages: [
      { id: uid('msg'), name: 'Sokha', email: 'sokha@example.com', subject: 'សំណួរអំពីការបញ្ចូល', body: 'សូមជួយពិនិត្យការបញ្ជាទិញរបស់ខ្ញុំ។', read: false, createdAt: new Date(Date.now() - 3 * 86400000).toISOString() },
    ],
    counters: { visitors: 128450 },
  };
}

// ------------------------------------------------------------------ storage
let cache = null;

export function getDB() {
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return cache;
    }
  } catch (err) {
    console.error('[db] failed to read, re-seeding:', err.message);
  }
  cache = seed();
  persist();
  return cache;
}

/** Never let a read-only /tmp take the whole Function down. */
function persist() {
  try { saveDB(); }
  catch (err) { console.error('[db] could not persist store (running in memory):', err.message); }
}

export function saveDB() {
  if (!cache) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Unique temp name: serverless instances can cold-start and write concurrently.
  const tmp = `${DB_FILE}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export function mutate(fn) {
  const db = getDB();
  const result = fn(db);
  persist();
  return result;
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, phone: u.phone,
    role: u.role, balance: u.balance || 0, points: u.points || 0,
    createdAt: u.createdAt,
  };
}
