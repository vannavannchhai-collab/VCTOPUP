/**
 * server/config.js — single source of truth for live-vs-sandbox integration.
 *
 * HARD RULE: nothing in this file (or any other server file) ever exposes a
 * secret to the browser. `integrationStatus()` returns booleans, counts and
 * non-sensitive provider metadata only.
 */
import './env.js';
import { getDB } from './db.js';
import {
  isRealValue, isStrongSecret, isPostgresUrl, isHttpsUrl, isBakongAccountId,
  isShop2TopupKey, parseSkuMap, hasFulfillableSku,
} from './credentials.js';

const env = process.env;

export const PAYMENT_MODE = (env.PAYMENT_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
export const isLive = PAYMENT_MODE === 'live';

export const hasDurableStore = () => isPostgresUrl(env.DATABASE_URL);
export const hasRealSecret = () => isStrongSecret(env.VC_SECRET, 32);

function skuMapConfig() {
  const { value, error } = parseSkuMap(env.SHOP2TOPUP_ITEM_MAP || env.PARTNER_SKU_MAP || env.S2T_ITEM_MAP);
  return { value, error };
}

function publicOrigin() {
  return isHttpsUrl(env.PUBLIC_BASE_URL) ? env.PUBLIC_BASE_URL.trim().replace(/\/$/, '') : '';
}

export function bakongConfig() {
  return {
    base: env.BAKONG_API_BASE || (isLive ? 'https://api-bakong.nbc.gov.kh/v1' : 'https://sit-api-bakong.nbc.gov.kh/v1'),
    token: env.BAKONG_API_TOKEN || '',
    accountId: env.BAKONG_ACCOUNT_ID || '',
    merchantName: env.BAKONG_MERCHANT_NAME || 'VC TOPUP',
    merchantCity: env.BAKONG_MERCHANT_CITY || 'Siem Reap',
    merchantId: env.BAKONG_MERCHANT_ID || '',
    acquiringBank: env.BAKONG_ACQUIRING_BANK || '',
    currency: (env.BAKONG_CURRENCY || 'USD').toUpperCase(),
    // NBC guidance: a dynamic KHQR should not live longer than ~10 minutes.
    ttlMs: Math.max(60_000, Number(env.BAKONG_QR_TTL_MINUTES || 10) * 60_000),
    pollThrottleMs: Math.max(1000, Number(env.BAKONG_POLL_THROTTLE_MS || 4000)),
  };
}

/** Provider selection. Existing PARTNER_API_URL deployments stay on `generic`. */
export function partnerConfig() {
  const requested = String(env.PARTNER_PROVIDER || '').trim().toLowerCase();
  const detected = requested || (env.SHOP2TOPUP_API_KEY || env.S2T_KEY
    ? 'shop2topup'
    : env.PARTNER_API_URL ? 'generic' : 'shop2topup');
  const provider = ['shop2topup', 'generic'].includes(detected) ? detected : 'generic';
  const { value: skuMap, error: skuMapError } = skuMapConfig();
  const origin = publicOrigin();
  return {
    provider,
    url: env.PARTNER_API_URL || '',
    key: env.PARTNER_API_KEY || '',
    secret: env.PARTNER_API_SECRET || '',
    callbackSecret: env.PARTNER_CALLBACK_SECRET || env.PARTNER_API_SECRET || '',
    timeoutMs: Math.max(2000, Number(env.PARTNER_TIMEOUT_MS || 15000)),
    skuMap,
    skuMapError,
    publicBaseUrl: origin,
    webhookUrl: origin ? `${origin}/api/payments/partner-callback` : '',
  };
}

/**
 * Concrete real-diamond provider: Shop2Topup v1 Reseller API.
 * Credentials are a server-side `<keyId>.<secret>` Bearer key; the webhook
 * secret is separate. Never send either value to the browser.
 */
export function shop2topupConfig() {
  const p = partnerConfig();
  return {
    base: (env.SHOP2TOPUP_BASE_URL || env.S2T_BASE_URL || 'https://shop2topup.com/api/endpoints/v1').replace(/\/$/, ''),
    apiKey: env.SHOP2TOPUP_API_KEY || env.S2T_API_KEY || env.S2T_KEY || '',
    webhookSecret: env.SHOP2TOPUP_WEBHOOK_SECRET || env.S2T_WEBHOOK_SECRET || '',
    categoryId: env.SHOP2TOPUP_CATEGORY_ID || '',
    defaultServer: env.SHOP2TOPUP_DEFAULT_SERVER || '',
    timeoutMs: Math.max(3000, Number(env.SHOP2TOPUP_TIMEOUT_MS || 15000)),
    validatePlayer: String(env.SHOP2TOPUP_VALIDATE_PLAYER || 'true').toLowerCase() !== 'false',
    maxCostRatio: Math.max(0.1, Math.min(1, Number(env.SHOP2TOPUP_MAX_COST_RATIO || 1))),
    skuMap: p.skuMap,
    webhookUrl: p.webhookUrl,
  };
}

/** Count packages that point at a real provider catalogue ID. */
function catalogCoverage(provider, skuMap) {
  let products = [];
  try { products = getDB()?.products || []; } catch { products = []; }
  let total = 0, mapped = 0;
  const missing = [];
  for (const p of products) {
    for (const pk of p.packages || []) {
      total += 1;
      const item = { productSlug: p.slug, packageId: pk.id, partnerSku: pk.partnerSku };
      if (hasFulfillableSku(item, skuMap, provider)) mapped += 1;
      else if (missing.length < 12) missing.push({ product: p.name || p.slug, slug: p.slug, packageId: pk.id, label: pk.label });
    }
  }
  return { mapped, total, missing, ready: total > 0 && mapped > 0 };
}

/**
 * Pre-flight report. `ready` is a HARD GATE: live mode refuses to create a
 * payable order until every check passes. Placeholder values copied from
 * .env.example are deliberately rejected.
 */
export function integrationStatus() {
  const b = bakongConfig();
  const p = partnerConfig();
  const s = shop2topupConfig();
  const coverage = catalogCoverage(p.provider, p.skuMap);
  const isShop2 = p.provider === 'shop2topup';

  const checks = {
    durableStore: hasDurableStore(),
    signingSecret: hasRealSecret(),
    bakongToken: isRealValue(b.token, 20),
    bakongAccount: isBakongAccountId(b.accountId),
    bakongMerchant: isRealValue(env.BAKONG_MERCHANT_NAME, 2) && isRealValue(env.BAKONG_MERCHANT_CITY, 2),
    bakongApiBase: isHttpsUrl(b.base),
    partnerProvider: ['shop2topup', 'generic'].includes(p.provider),
    partnerEndpoint: isHttpsUrl(isShop2 ? s.base : p.url),
    partnerCredentials: isShop2
      ? isShop2TopupKey(s.apiKey)
      : isRealValue(p.key, 8) && isStrongSecret(p.secret, 16),
    partnerWebhook: isShop2
      ? isStrongSecret(s.webhookSecret, 16) && Boolean(p.webhookUrl)
      : isStrongSecret(p.callbackSecret, 16) && Boolean(p.webhookUrl),
    partnerSkus: coverage.ready && !p.skuMapError,
    cronSecret: isStrongSecret(env.CRON_SECRET, 24),
  };
  const required = isLive
    ? ['durableStore', 'signingSecret', 'bakongToken', 'bakongAccount', 'bakongMerchant', 'bakongApiBase',
      'partnerProvider', 'partnerEndpoint', 'partnerCredentials', 'partnerWebhook', 'partnerSkus', 'cronSecret']
    : [];
  const blockers = required.filter((k) => !checks[k]);

  return {
    mode: PAYMENT_MODE,
    live: isLive,
    provider: p.provider,
    providerLabel: isShop2 ? 'Shop2Topup direct top-up API' : 'Generic signed partner API',
    qrCurrency: b.currency,
    qrTtlMinutes: Math.round(b.ttlMs / 60000),
    merchantName: b.merchantName,
    merchantCity: b.merchantCity,
    bakongBase: b.base,
    partnerConfigured: Boolean(isShop2 ? s.apiKey : p.url),
    webhookUrl: p.webhookUrl,
    webhookSignatureHeader: isShop2 ? 'X-Shop2Topup-Signature' : 'X-Signature',
    providerCategoryId: isShop2 ? s.categoryId : '',
    skuCoverage: { mapped: coverage.mapped, total: coverage.total, missing: coverage.missing },
    skuMapError: p.skuMapError || null,
    checks,
    blockers,
    ready: blockers.length === 0,
  };
}

export class LiveNotReadyError extends Error {
  constructor(blockers) {
    super(`Live payments are not configured. Missing: ${blockers.join(', ')}. ` +
      'Set the required environment variables (see .env.example) or use PAYMENT_MODE=sandbox.');
    this.name = 'LiveNotReadyError';
    this.status = 503;
    this.blockers = blockers;
  }
}

/** Call before creating any order that can move real money. */
export function assertLiveReady(items = []) {
  if (!isLive) return;
  const s = integrationStatus();
  if (!s.ready) throw new LiveNotReadyError(s.blockers);
  const p = partnerConfig();
  const missing = items
    .filter((i) => !hasFulfillableSku(i, p.skuMap, p.provider))
    .map((i) => `${i.productSlug}:${i.packageId}`);
  if (missing.length) {
    throw new LiveNotReadyError([`partnerSkus:${[...new Set(missing)].join(',')}`]);
  }
}
