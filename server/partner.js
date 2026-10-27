/**
 * server/partner.js — official game-partner / top-up supplier adapter.
 *
 * This is the ONLY place that can convert a PAID order into real diamonds.
 * It is deliberately called only from the payment engine after Bakong has
 * confirmed settlement (never from a browser, never from the checkout form).
 *
 * Wire protocol (adapt the field names to your partner's spec — see README):
 *   POST {PARTNER_API_URL}
 *   X-Api-Key, X-Timestamp, X-Signature: sha256=<hmac>, Idempotency-Key
 *   body: { orderId, items:[{ sku, accountId, quantity }], total, currency, callbackUrl }
 */
import crypto from 'node:crypto';
import { partnerConfig, isLive } from './config.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve a package to the partner's SKU. Override real codes with PARTNER_SKU_MAP. */
export function resolveSku(item, skuMap = partnerConfig().skuMap) {
  const key = `${item.productSlug}:${item.packageId}`;
  return item.partnerSku || skuMap[key] || skuMap[item.productSlug] || key;
}

export function signRequest(secret, timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/** Constant-time verification of an inbound partner callback. */
export function verifyCallback(rawBody, signature = '', timestamp = '', maxSkewMs = 5 * 60_000) {
  const cfg = partnerConfig();
  if (!cfg.callbackSecret) return { ok: false, reason: 'No callback secret configured' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > maxSkewMs) return { ok: false, reason: 'Stale or invalid timestamp' };
  const expected = signRequest(cfg.callbackSecret, timestamp, rawBody);
  const got = String(signature).replace(/^sha256=/i, '').trim();
  const a = Buffer.from(got, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'Bad signature' };
  return { ok: true };
}

function interpret(json, httpStatus) {
  if (httpStatus < 200 || httpStatus >= 300) {
    return { state: 'failed', message: `Partner HTTP ${httpStatus}`, ref: null };
  }
  const status = String(json?.status || json?.result || json?.orderStatus || '').toUpperCase();
  const successFlag = json?.success === true || json?.code === 0 || json?.responseCode === 0;
  if (['SUCCESS', 'COMPLETED', 'COMPLETE', 'DELIVERED', 'PAID'].includes(status) || successFlag) {
    return { state: 'completed', message: json?.message || 'Credits delivered', ref: json?.transactionId || json?.txnId || json?.serial || json?.data?.transactionId || null };
  }
  if (['PENDING', 'PROCESSING', 'QUEUED', 'IN_PROGRESS'].includes(status)) {
    return { state: 'pending', message: json?.message || 'Partner is processing', ref: json?.transactionId || json?.orderId || null };
  }
  return { state: 'failed', message: json?.message || json?.error || 'Partner rejected the order', ref: null };
}

/** Sandbox stand-in: never calls the network, never delivers real credits. */
export async function sandboxFulfill(order) {
  await sleep(700);
  return {
    state: 'completed',
    ref: `SANDBOX-${order.code}`,
    message: 'SANDBOX: simulated partner delivery — no real diamonds were sent.',
    sandbox: true,
  };
}

/**
 * Deliver a paid order. Retries only transient failures (network / 5xx);
 * a definitive partner rejection goes straight to the manual-review queue.
 * The Idempotency-Key is the order code, so a retry can never double-credit.
 */
export async function fulfill(order) {
  const cfg = partnerConfig();
  if (!isLive || !cfg.url) return sandboxFulfill(order);
  if (!cfg.key || !cfg.secret) {
    return { state: 'failed', message: 'PARTNER_API_KEY / PARTNER_API_SECRET are not configured', ref: null };
  }

  const body = JSON.stringify({
    orderId: order.code,
    reference: order.code,
    currency: order.payment?.currency || 'USD',
    total: order.total,
    items: order.items.map((i) => ({
      sku: resolveSku(i, cfg.skuMap),
      productId: i.productSlug,
      packageId: i.packageId,
      accountId: i.accountId,
      quantity: i.qty,
      price: i.price,
    })),
    customer: { name: order.customer.name, phone: order.customer.phone, email: order.customer.email },
    ...(cfg.publicBaseUrl ? { callbackUrl: `${cfg.publicBaseUrl.replace(/\/$/, '')}/api/payments/partner-callback` } : {}),
  });

  const attempts = 3;
  let lastError = '';
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const timestamp = String(Date.now());
    let response;
    try {
      response = await fetch(cfg.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Api-Key': cfg.key,
          'X-Timestamp': timestamp,
          'X-Signature': `sha256=${signRequest(cfg.secret, timestamp, body)}`,
          'Idempotency-Key': order.code,
        },
        body,
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
    } catch (err) {
      lastError = `network: ${err.message}`;
      if (attempt < attempts) { await sleep(300 * attempt); continue; }
      return { state: 'failed', message: lastError, attempts: attempt, ref: null };
    }

    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }

    const result = interpret(json, response.status);
    if (result.state !== 'failed' || response.status < 500) {
      return { ...result, attempts: attempt, ref: result.ref, rawStatus: response.status };
    }
    lastError = result.message;
    if (attempt < attempts) await sleep(400 * attempt);
  }
  return { state: 'failed', message: lastError || 'Partner delivery failed', attempts, ref: null };
}
