/**
 * server/credentials.js — pure validation helpers shared by config, the live
 * setup CLI and the fulfillment adapter.
 *
 * These functions never log, return, or echo a secret. They answer questions
 * like "is this a real-looking key?" so a copied .env.example can never make
 * the store believe it is ready to move real money.
 */

const DEMO_PATTERN = /^(your[-_\s]|replace[-_\s]|change[-_\s]|changeme|demo|example|placeholder|sample|test[-_\s]|dummy|fake|todo|<|\$\{|xxx|sk[-_]?test|pk[-_]?test)/i;
const DEMO_WORD_PATTERN = /(^|[-_\s])(placeholder|replace|example|dummy|fake|sample|demo)([-_\s]|$)/i;

export function isRealValue(value, minLength = 1) {
  if (value === undefined || value === null) return false;
  const v = String(value).trim();
  return v.length >= minLength
    && !DEMO_PATTERN.test(v)
    && !DEMO_WORD_PATTERN.test(v)
    && !/^(.)\1{7,}$/.test(v); // e.g. xxxxxxxxxxxx
}

export function isStrongSecret(value, minLength = 32) {
  const v = String(value ?? '').trim();
  if (v.length < minLength || !isRealValue(v, minLength)) return false;
  // Require at least a few distinct characters; a repeated string is not a secret.
  return new Set(v).size >= Math.min(10, v.length);
}

export function isPostgresUrl(value) {
  const v = String(value ?? '').trim();
  if (!/^postgres(ql)?:\/\//i.test(v)) return false;
  if (!isRealValue(v, 20) || /(user:password|username:password|localhost|127\.0\.0\.1|example\.com)/i.test(v)) return false;
  try {
    const u = new URL(v);
    return Boolean(u.hostname && u.pathname.length > 1);
  } catch {
    return false;
  }
}

export function isHttpsUrl(value) {
  const v = String(value ?? '').trim().replace(/\/$/, '');
  if (!isRealValue(v, 10)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:'
      && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|.*\.local)$/i.test(u.hostname)
      && !/(your-domain|yourdomain|example\.com|example\.org|placeholder|your-store|yourstore)/i.test(u.hostname);
  } catch {
    return false;
  }
}

export function isBakongAccountId(value) {
  const v = String(value ?? '').trim();
  return isRealValue(v, 6)
    && /^[a-z0-9._%+-]+@[a-z0-9.-]+$/i.test(v)
    && !/(example|placeholder|your[_-])/i.test(v);
}

/** Shop2Topup issues a `<keyId>.<secret>` Bearer credential. */
export function isShop2TopupKey(value) {
  const v = String(value ?? '').trim();
  const parts = v.split('.');
  return parts.length === 2
    && isRealValue(parts[0], 6)
    && isRealValue(parts[1], 12)
    && !/\s/.test(v);
}

export function isShop2TopupItemId(value) {
  const n = Number(String(value ?? '').trim());
  return Number.isSafeInteger(n) && n > 0;
}

/** Parse PARTNER_SKU_MAP / SHOP2TOPUP_ITEM_MAP without ever throwing. */
export function parseSkuMap(raw) {
  if (!raw || !String(raw).trim()) return { value: {}, error: null };
  try {
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { value: {}, error: 'Must be a JSON object' };
    }
    return { value: parsed, error: null };
  } catch (err) {
    return { value: {}, error: err.message };
  }
}

const demoSku = (value, item) => {
  const v = String(value ?? '').trim();
  const generated = `${item?.productSlug || ''}:${item?.packageId || ''}`;
  return !v || v === generated || /^(mobile-legends|free-fire|pubg-mobile|genshin-impact|valorant|roblox|tiktok-coins|steam-wallet|netflix|metfone|smart|cellcard):/i.test(v) && v === generated;
};

/** Env mapping wins over the seeded placeholder SKU. */
export function resolvePartnerSku(item, skuMap = {}) {
  const key = `${item.productSlug}:${item.packageId}`;
  const mapped = skuMap[key] ?? skuMap[item.productSlug];
  if (mapped !== undefined && mapped !== null && mapped !== '') return mapped;
  if (!demoSku(item.partnerSku, item)) return item.partnerSku;
  return key;
}

/** Extract a provider catalogue item ID from a string, number or object. */
export function providerItemId(value) {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value === 'string') return isShop2TopupItemId(value) ? Number(value.trim()) : null;
  if (value && typeof value === 'object') {
    return providerItemId(value.itemId ?? value.item_id ?? value.subCategoryId ?? value.sub_category_id);
  }
  return null;
}

/**
 * A real, fulfillable SKU. For Shop2Topup it MUST be a numeric catalogue ID;
 * for the generic adapter it must be a non-placeholder string. A generated
 * `slug:packageId` value is never real.
 */
export function hasFulfillableSku(item, skuMap = {}, provider = 'shop2topup') {
  const resolved = resolvePartnerSku(item, skuMap);
  if (provider === 'shop2topup') return providerItemId(resolved) !== null;
  const s = typeof resolved === 'object' ? (resolved.sku || resolved.code || '') : String(resolved ?? '').trim();
  return isRealValue(s, 2) && !demoSku(s, item);
}
