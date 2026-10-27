/**
 * server/config.js — single source of truth for live-vs-sandbox integration.
 *
 * HARD RULE: nothing in this file (or any other server file) ever exposes a
 * secret to the browser. `integrationStatus()` returns booleans only.
 */
const env = process.env;

export const PAYMENT_MODE = (env.PAYMENT_MODE || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox';
export const isLive = PAYMENT_MODE === 'live';

export const hasDurableStore = () => Boolean(env.DATABASE_URL);
export const hasRealSecret = () => Boolean(env.VC_SECRET)
  && env.VC_SECRET.length >= 24
  && !/^(vctopup-demo|replace-with|change-me)/i.test(env.VC_SECRET);

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

export function partnerConfig() {
  let skuMap = {};
  try { skuMap = env.PARTNER_SKU_MAP ? JSON.parse(env.PARTNER_SKU_MAP) : {}; }
  catch (err) { console.error('[partner] PARTNER_SKU_MAP is not valid JSON:', err.message); }
  return {
    url: env.PARTNER_API_URL || '',
    key: env.PARTNER_API_KEY || '',
    secret: env.PARTNER_API_SECRET || '',
    callbackSecret: env.PARTNER_CALLBACK_SECRET || env.PARTNER_API_SECRET || '',
    timeoutMs: Math.max(2000, Number(env.PARTNER_TIMEOUT_MS || 15000)),
    skuMap,
    publicBaseUrl: env.PUBLIC_BASE_URL || '',
  };
}

/**
 * Pre-flight report. `ready` is a HARD GATE: live mode refuses to create a
 * payable order until every check passes. This is what stops a store from
 * taking real money with an unverifiable payment path or a non-durable store.
 */
export function integrationStatus() {
  const b = bakongConfig();
  const p = partnerConfig();
  const checks = {
    durableStore: hasDurableStore(),
    signingSecret: hasRealSecret(),
    bakongToken: Boolean(b.token),
    bakongAccount: Boolean(b.accountId),
    bakongMerchant: Boolean(env.BAKONG_MERCHANT_NAME) && Boolean(env.BAKONG_MERCHANT_CITY),
    partnerEndpoint: Boolean(p.url),
    partnerCredentials: Boolean(p.key) && Boolean(p.secret),
    callbackSecret: Boolean(p.callbackSecret),
  };
  const required = isLive
    ? ['durableStore', 'signingSecret', 'bakongToken', 'bakongAccount', 'bakongMerchant', 'partnerEndpoint', 'partnerCredentials']
    : [];
  const blockers = required.filter((k) => !checks[k]);
  return {
    mode: PAYMENT_MODE,
    live: isLive,
    qrCurrency: b.currency,
    qrTtlMinutes: Math.round(b.ttlMs / 60000),
    merchantName: b.merchantName,
    merchantCity: b.merchantCity,
    bakongBase: b.base,
    partnerConfigured: Boolean(p.url),
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
export function assertLiveReady() {
  if (!isLive) return;
  const s = integrationStatus();
  if (!s.ready) throw new LiveNotReadyError(s.blockers);
}
