/**
 * server/shop2topup.js — concrete REAL-DIAMOND fulfillment provider.
 *
 * Shop2Topup v1 Reseller API (direct top-up by Player ID, not voucher codes):
 *   GET  /account
 *   GET  /catalog/big-categories | /catalog/categories | /catalog/subcategories
 *   GET  /catalog/subcategory/:itemId/price
 *   GET  /catalog/category/:categoryId/requirements
 *   POST /player/validate
 *   POST /orders/create        (order_id is our stable UUID idempotency key)
 *   GET  /orders/:orderId
 *
 * Credentials are read from server-side environment variables only. This file
 * never writes them to an order, log, API response or browser bundle.
 */
import crypto from 'node:crypto';
import './env.js';
import { shop2topupConfig } from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function endpoint(path) {
  const cfg = shop2topupConfig();
  const base = cfg.base.endsWith('/') ? cfg.base : `${cfg.base}/`;
  return new URL(String(path).replace(/^\/+/, ''), base).toString();
}

function errorMessage(json, status) {
  const detail = json?.error?.message || json?.message || json?.error?.code;
  return detail ? String(detail).slice(0, 240) : `Provider HTTP ${status}`;
}

async function callApi(path, { method = 'GET', body, timeout, _retry = false } = {}) {
  const cfg = shop2topupConfig();
  if (!cfg.apiKey) throw Object.assign(new Error('Shop2Topup API key is not configured'), { code: 'PROVIDER_NO_KEY' });

  let response;
  try {
    response = await fetch(endpoint(path), {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(timeout || cfg.timeoutMs),
    });
  } catch (err) {
    throw Object.assign(new Error(`Shop2Topup unreachable: ${err.message}`), { code: 'PROVIDER_NETWORK', cause: err });
  }

  const text = await response.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { json = null; }

  if (response.status === 429 && !_retry) {
    const retryAfter = Math.min(3, Number(response.headers?.get?.('Retry-After') || 1) || 1);
    await sleep(retryAfter * 1000);
    return callApi(path, { method, body, timeout, _retry: true });
  }
  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('Shop2Topup rejected the API key (wrong, revoked, or IP not allowlisted).'), {
      code: 'PROVIDER_AUTH', status: response.status,
    });
  }
  if (!json) {
    throw Object.assign(new Error(`Shop2Topup returned a non-JSON response (HTTP ${response.status}).`), {
      code: 'PROVIDER_BAD_RESPONSE', status: response.status,
    });
  }
  if (!response.ok || json.success === false) {
    const err = new Error(errorMessage(json, response.status));
    err.code = json.error?.code || (response.status === 429 ? 'PROVIDER_RATE_LIMIT' : `PROVIDER_HTTP_${response.status}`);
    err.status = response.status;
    throw err;
  }
  return { json, status: response.status };
}

function listFrom(json, ...keys) {
  for (const key of keys) {
    const value = json?.[key];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
  }
  const data = json?.data;
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return [];
}

function normalizeCategory(raw) {
  return {
    id: String(raw?.id ?? raw?.category_id ?? raw?.big_category_id ?? raw?.item_id ?? ''),
    name: String(raw?.name ?? raw?.category_name ?? raw?.title ?? 'Unnamed category'),
    bigCategoryId: raw?.big_category_id ?? raw?.bigCategoryId ?? null,
  };
}

function normalizeItem(raw) {
  const price = raw?.price ?? raw?.unit_price ?? raw?.price_breakdown?.final_partner_price ?? null;
  return {
    id: String(raw?.item_id ?? raw?.sub_category_id ?? raw?.id ?? raw?.offerId ?? ''),
    name: String(raw?.name ?? raw?.subcategory_name ?? raw?.product_name ?? raw?.offerName ?? 'Unnamed product'),
    categoryId: raw?.category_id ?? raw?.categoryId ?? null,
    unitPrice: price && typeof price === 'object' ? Number(price.unit_price ?? price.amount) : Number(price),
    currency: String(raw?.currency ?? price?.currency ?? 'USD').toUpperCase(),
    available: raw?.available !== false,
    directTopUp: raw?.is_return_data_for_customer === false || raw?.direct_top_up === true,
  };
}

export async function getBigCategories() {
  const { json } = await callApi('/catalog/big-categories');
  return listFrom(json, 'big_categories', 'bigCategories', 'categories').map(normalizeCategory);
}

export async function getCategories(bigCategoryId) {
  const q = bigCategoryId ? `?bigCategoryId=${encodeURIComponent(bigCategoryId)}` : '';
  const { json } = await callApi(`/catalog/categories${q}`);
  return listFrom(json, 'categories', 'items').map(normalizeCategory);
}

export async function getSubcategories(categoryId) {
  if (!categoryId) return [];
  const { json } = await callApi(`/catalog/subcategories?categoryId=${encodeURIComponent(categoryId)}`);
  return listFrom(json, 'subcategories', 'items', 'products').map(normalizeItem);
}

export async function getCategoryRequirements(categoryId) {
  if (!categoryId) return [];
  const { json } = await callApi(`/catalog/category/${encodeURIComponent(categoryId)}/requirements`);
  return listFrom(json, 'requirements', 'fields', 'items');
}

export async function getItemPrice(itemId) {
  const { json } = await callApi(`/catalog/subcategory/${encodeURIComponent(itemId)}/price`);
  const price = json?.price || json?.data?.price || json;
  return {
    unitPrice: Number(price?.unit_price ?? price?.price ?? price?.amount),
    currency: String(price?.currency ?? json?.currency ?? 'USD').toUpperCase(),
    checkedAt: new Date().toISOString(),
  };
}

/** Split `12345678 (1234)` into Player ID + Zone/Server ID. */
export function parseAccountId(raw) {
  const value = String(raw ?? '').trim();
  let m = value.match(/^([A-Za-z0-9._-]{3,30})\s*\(\s*([^)]+?)\s*\)/);
  if (m) return { playerId: m[1], server: m[2].trim() };
  m = value.match(/^([A-Za-z0-9._-]{3,30})\s*(?:\/|-|,)\s*([A-Za-z0-9 _-]{1,30})$/);
  if (m) return { playerId: m[1], server: m[2].trim() };
  return { playerId: value, server: '' };
}

function optionValue(option) {
  if (option === null || option === undefined) return '';
  if (typeof option !== 'object') return String(option);
  return String(option.value ?? option.id ?? option.code ?? option.name ?? '');
}

/** Convert provider requirement definitions into an order `requirements` object. */
export function buildRequirements(definitions, context = {}) {
  const fallback = { player_id: context.playerId, ...(context.server ? { server: context.server } : {}) };
  if (!Array.isArray(definitions) || definitions.length === 0) return { requirements: fallback, missing: [] };

  const requirements = {};
  const missing = [];
  for (const def of definitions) {
    const name = String(def?.field_name ?? def?.name ?? def?.key ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const required = def.required === true || def.is_required === true || def.required === 1 || def.required === '1';
    let value = '';

    if (/email/.test(key)) value = context.email || '';
    else if (/phone|mobile|msisdn/.test(key)) value = context.phone || '';
    else if (/server|zone|region/.test(key)) value = context.server || context.defaultServer || '';
    else if (/quantity|qty/.test(key)) value = context.quantity || 1;
    else if (/player|user|uid|account|target|recipient/.test(key)) value = context.playerId || '';
    else value = def.default_value ?? def.defaultValue ?? '';

    if (!value) {
      const options = def.allowed_values || def.options || def.values || [];
      if (Array.isArray(options) && options.length) value = optionValue(options[0]);
    }
    if (value !== '' && value !== undefined && value !== null) requirements[name] = String(value);
    else if (required) missing.push(name);
  }
  return { requirements: Object.keys(requirements).length ? requirements : fallback, missing };
}

export async function validatePlayer(itemId, accountId) {
  const parsed = parseAccountId(accountId);
  const body = {
    sub_category_id: Number(itemId),
    player_id: parsed.playerId,
    ...(parsed.server ? { server: parsed.server } : {}),
  };
  try {
    const { json } = await callApi('/player/validate', { method: 'POST', body });
    const player = json?.player || json?.data || json;
    const valid = json?.valid ?? json?.success ?? json?.is_valid ??
      Boolean(player?.player_name || player?.nickname || player?.username || player?.name);
    return {
      valid: Boolean(valid),
      playerId: parsed.playerId,
      server: parsed.server,
      playerName: player?.player_name || player?.nickname || player?.username || player?.name || null,
      reason: valid ? null : String(json?.message || json?.error?.message || 'Player not found'),
    };
  } catch (err) {
    if (['PLAYER_NOT_FOUND', 'REGION_MISMATCH', 'MISSING_REQUIRED_FIELD'].includes(err.code)) {
      return { valid: false, playerId: parsed.playerId, server: parsed.server, playerName: null, reason: err.message };
    }
    throw err;
  }
}

export function normalizeOrderStatus(raw, fallbackId = '') {
  const order = raw?.order || raw?.data || raw || {};
  const status = String(order.status || order.order_status || raw?.status || '').toUpperCase();
  const completed = ['COMPLETED', 'COMPLETE', 'SUCCESS', 'DELIVERED', 'PAID'].includes(status);
  const failed = ['FAILED', 'CANCELED', 'CANCELLED', 'REFUNDED', 'REJECTED'].includes(status);
  const pending = ['PENDING', 'PROCESSING', 'QUEUED', 'SUBMITTED', 'IN_PROGRESS', 'RETRYING'].includes(status);
  return {
    id: String(order.order_id || order.id || order.transaction_id || fallbackId),
    status: status || 'PENDING',
    state: completed ? 'completed' : failed ? 'failed' : pending ? 'pending' : 'pending',
    ref: order.transaction_id || order.trx_id || order.id || fallbackId || null,
    message: String(order.message || raw?.message || status || 'Provider order accepted'),
    chargedAmount: order.charged_amount ?? null,
    currency: order.currency || null,
  };
}

export async function createOrder(payload) {
  const { json } = await callApi('/orders/create', { method: 'POST', body: payload });
  return normalizeOrderStatus(json, payload.order_id);
}

export async function getOrder(orderId) {
  try {
    const { json } = await callApi(`/orders/${encodeURIComponent(orderId)}`);
    return normalizeOrderStatus(json, orderId);
  } catch (err) {
    if (err.status === 404 || ['ORDER_NOT_FOUND', 'NOT_FOUND'].includes(err.code)) return null;
    throw err;
  }
}

/** Safe, secret-free account check for the admin panel / setup CLI. */
export async function testConnection() {
  const cfg = shop2topupConfig();
  if (!cfg.apiKey) return { provider: 'shop2topup', configured: false, reachable: false, reason: 'No API key configured' };
  try {
    const { json } = await callApi('/account', { timeout: 10_000 });
    const account = json?.account || json?.data || json;
    const balance = Number(account?.balance ?? account?.wallet_balance ?? json?.balance ?? 0);
    return {
      provider: 'shop2topup',
      configured: true,
      reachable: true,
      funded: Number.isFinite(balance) ? balance > 0 : null,
      account: {
        id: account?.id || account?.key_id || account?.account_id || null,
        name: account?.name || account?.business_name || account?.email || null,
        email: account?.email || null,
        currency: account?.currency || json?.currency || null,
        balance: Number.isFinite(balance) ? balance : null,
      },
      testedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      provider: 'shop2topup', configured: true, reachable: false,
      code: err.code || null, reason: err.message, testedAt: new Date().toISOString(),
    };
  }
}

/** Catalogue browser used by Admin → Real integrations. */
export async function getCatalog(categoryId = '') {
  if (categoryId) {
    const [items, requirements] = await Promise.all([
      getSubcategories(categoryId).catch(() => []),
      getCategoryRequirements(categoryId).catch(() => []),
    ]);
    return { categoryId, bigCategories: [], categories: [], items, requirements };
  }
  const bigCategories = await getBigCategories().catch(() => []);
  const groups = await Promise.allSettled(bigCategories.slice(0, 8).map((b) => getCategories(b.id)));
  const categories = groups.flatMap((g) => g.status === 'fulfilled' ? g.value : []);
  return { categoryId: '', bigCategories, categories, items: [], requirements: [] };
}

/** Constant-time verification of X-Shop2Topup-Signature over the raw bytes. */
export function verifyWebhook(rawBody, signature = '', maxSkewMs = 5 * 60_000) {
  const cfg = shop2topupConfig();
  if (!cfg.webhookSecret) return { ok: false, reason: 'No webhook secret configured' };
  const got = String(signature || '').replace(/^sha256=/i, '').trim();
  if (!/^[a-f0-9]{64}$/i.test(got)) return { ok: false, reason: 'Bad signature format' };
  const expected = crypto.createHmac('sha256', cfg.webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(got, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'Bad signature' };

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return { ok: false, reason: 'Invalid JSON' }; }
  const ts = Date.parse(payload.timestamp || '');
  if (Number.isFinite(ts) && Math.abs(Date.now() - ts) > maxSkewMs) return { ok: false, reason: 'Stale webhook timestamp' };
  return { ok: true, payload, event: String(payload.event || '') };
}
