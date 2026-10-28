import './env.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { categories, products, promos, reviews, faqs, paymentMethods, settings } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

/**
 * Local JSON store is for development only; live orders require Postgres.
 *
 * A Vercel Function's project filesystem is read-only — only /tmp is writable.
 * Writing to ROOT/data there throws EROFS, which surfaces as a 500 (and, when
 * it happens during bootstrap, as a broken/404-looking deployment). /tmp keeps
 * useful for local development, but it is per-instance and wiped on cold starts,
 * so it is NOT durable. Live payment requires durable Postgres.
 */
const DATA_DIR = process.env.VC_DATA_DIR
  || (process.env.VERCEL ? '/tmp/vctopup-data' : path.join(ROOT, 'data'));
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Never ship a known fallback signing secret. Live deployments must set a stable, strong VC_SECRET.
export const SECRET = process.env.VC_SECRET || crypto.randomBytes(32).toString('hex');

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

// --------------------------------------------------------------- fresh state
function seed() {
  return {
    version: 2,
    settings, categories, products, promos, reviews, faqs, paymentMethods,
    users: [],
    orders: [],
    messages: [],
    securityEvents: [],
    partnerOrderMap: {},
    webhookEvents: [],
    counters: { visitors: 0 },
  };
}

// ------------------------------------------------------------------ storage
let cache = null;

/** One-time purge of the old sample storefront data in existing installations. */
function purgeLegacyDemo(state) {
  if (!state || Number(state.version || 1) >= 3) return false;
  state.users = (state.users || []).filter((u) => !String(u.id || '').startsWith('usr_demo') && !/@example\.com$/i.test(u.email || '') && u.email !== 'admin@vctopup.com');
  state.orders = (state.orders || []).filter((o) => o.payment?.verification !== 'sandbox' && !/@example\.com$/i.test(o.customer?.email || '') && !/^TXN\d+$/.test(o.payment?.transactionId || ''));
  state.messages = (state.messages || []).filter((m) => !/@example\.com$/i.test(m.email || ''));
  state.reviews = [];
  state.promos = [];
  state.paymentMethods = paymentMethods;
  state.securityEvents ||= [];
  state.partnerOrderMap ||= {};
  state.webhookEvents ||= [];
  state.counters = { ...(state.counters || {}), visitors: 0 };
  state.settings = { ...settings, ...(state.settings || {}), phone: '', telegram: '', email: '',
    address: { kh: '', en: '' }, announcement: { kh: '', en: '' },
    stats: { orders: 0, customers: 0, games: 0, uptime: null } };
  for (const user of state.users) { delete user.balance; delete user.points; }
  for (const p of state.products || []) {
    p.brand ||= products.find((seeded) => seeded.slug === p.slug)?.brand || null;
    p.desc = products.find((seeded) => seeded.slug === p.slug)?.desc || p.desc;
    p.sold = 0; p.rating = null; p.tag = null; p.featured = false; p.popular = false;
    for (const pkg of p.packages || []) {
      pkg.partnerSku = pkg.partnerSku && /^\d+$/.test(String(pkg.partnerSku)) ? pkg.partnerSku : null;
      pkg.oldPrice = null; pkg.bonus = null; pkg.popular = false;
      delete pkg.providerPriceCheckedAt; delete pkg.providerCost;
    }
  }
  state.version = 3;
  return true;
}

export function getDB() {
  if (cache) return cache;
  try {
    if (fs.existsSync(DB_FILE)) {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (purgeLegacyDemo(cache)) persist();
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

/* ------------------------------------------------------------------------
 * DURABLE STORE (required for LIVE payments)
 *
 * The JSON file is local development storage and is per-instance on
 * Vercel. When DATABASE_URL is set (Neon / Supabase / Vercel Postgres) we keep
 * the whole state in one JSONB row and serialize every write with
 * SELECT ... FOR UPDATE. That row lock is what makes
 *   "mark order paid" -> "deliver diamonds"
 * atomic across concurrently-running Functions: two instances cannot both
 * settle the same order, and no order can be lost by a stale in-memory cache.
 * ---------------------------------------------------------------------- */
const DATABASE_URL = process.env.DATABASE_URL || '';
export const isDurableStore = () => Boolean(DATABASE_URL);

let pool = null;
let storeReady = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 2,
      connectionTimeoutMillis: 8000,
      // Neon/Supabase require TLS. Their URLs normally include sslmode=require.
      ssl: /(?:sslmode=require|ssl=true)/i.test(DATABASE_URL) ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (err) => console.error('[pg] idle client error:', err.message));
  }
  return pool;
}

const STATE_ID = 'main';

/** Call once before serving requests (idempotent). Loads the state from PG. */
export function ensureStore() {
  if (storeReady) return storeReady;
  storeReady = (async () => {
    if (!DATABASE_URL) { getDB(); return; }
    const p = getPool();
    await p.query(`CREATE TABLE IF NOT EXISTS vc_state (
      id text PRIMARY KEY,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    const { rows } = await p.query('SELECT data FROM vc_state WHERE id = $1', [STATE_ID]);
    if (rows[0]?.data) {
      cache = rows[0].data;
      if (purgeLegacyDemo(cache)) {
        await p.query('UPDATE vc_state SET data = $2, updated_at = now() WHERE id = $1', [STATE_ID, cache]);
        console.log('[store] removed legacy demo accounts/orders and sample claims');
      }
      console.log('[store] loaded state from Postgres');
    } else {
      const fresh = seed();
      await p.query(
        'INSERT INTO vc_state (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [STATE_ID, fresh]
      );
      const again = await p.query('SELECT data FROM vc_state WHERE id = $1', [STATE_ID]);
      cache = again.rows[0]?.data || fresh;
      console.log('[store] seeded Postgres state');
    }
  })();
  return storeReady;
}

/** Re-read PG so a verification request never decides from a stale cache. */
export async function readFresh() {
  await ensureStore();
  if (!DATABASE_URL) return getDB();
  const { rows } = await getPool().query('SELECT data FROM vc_state WHERE id = $1', [STATE_ID]);
  if (rows[0]?.data) cache = rows[0].data;
  return cache;
}

/**
 * Atomic mutation. `fn` must be SYNCHRONOUS and must not perform network I/O —
 * the row is locked for the whole call. Do external API calls before/after.
 */
export async function transact(fn) {
  await ensureStore();
  if (!DATABASE_URL) return mutate(fn);

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT data FROM vc_state WHERE id = $1 FOR UPDATE', [STATE_ID]);
    const state = JSON.parse(JSON.stringify(rows[0]?.data || cache || seed()));
    const result = fn(state);
    await client.query(
      `INSERT INTO vc_state (id, data, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [STATE_ID, state]
    );
    await client.query('COMMIT');
    cache = state;
    // Best-effort local mirror for debugging; a failure here is non-fatal.
    try { saveDB(); } catch { /* /tmp may be unavailable */ }
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  } finally {
    client.release();
  }
}

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email || null, phone: u.phone || '',
    telegram: u.telegram || '', authProvider: u.authProvider || 'password',
    picture: u.picture || '', role: u.role,
    createdAt: u.createdAt,
  };
}
