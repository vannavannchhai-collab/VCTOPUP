/**
 * server/partner.js — the ONLY place that can convert a PAID order into real
 * diamonds. It is called from the payment engine after Bakong has confirmed
 * settlement — never from a browser or checkout form.
 *
 * Two adapters:
 *  • `shop2topup` (default): concrete Shop2Topup v1 reseller API. Real account
 *    key, real catalogue item IDs, player validation, UUID idempotency, status
 *    polling and signed webhooks.
 *  • `generic`: signed HMAC webhook for an official publisher/supplier contract.
 *
 * In both cases the same invariant holds: `fulfill()` is only reached when
 * `order.payment.status === 'paid'`.
 */
import crypto from 'node:crypto';
import './env.js';
import { partnerConfig, shop2topupConfig, isLive } from './config.js';
import { providerItemId, resolvePartnerSku, hasFulfillableSku } from './credentials.js';
import * as s2t from './shop2topup.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Stable UUID derived from our order code — retries never create a new charge. */
export function deterministicUuid(seed) {
  const bytes = crypto.createHash('sha256').update(`vctopup:${seed}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Env mapping overrides the seeded placeholder SKU. */
export function resolveSku(item, skuMap = partnerConfig().skuMap) {
  return resolvePartnerSku(item, skuMap);
}

export function signRequest(secret, timestamp, rawBody) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

/** Constant-time callback verification; provider-specific signature scheme. */
export function verifyCallback(rawBody, signature = '', timestamp = '', headersOrSkew = {}, maxSkewMs = 5 * 60_000) {
  const headers = typeof headersOrSkew === 'number' ? {} : (headersOrSkew || {});
  const skew = typeof headersOrSkew === 'number' ? headersOrSkew : maxSkewMs;
  const cfg = partnerConfig();

  if (cfg.provider === 'shop2topup') {
    const sig = headers['x-shop2topup-signature'] || headers['X-Shop2Topup-Signature'] || signature;
    return s2t.verifyWebhook(rawBody, sig, skew);
  }
  if (!cfg.callbackSecret) return { ok: false, reason: 'No callback secret configured' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > skew) return { ok: false, reason: 'Stale or invalid timestamp' };
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

/** Stable provider-order IDs, used to map webhooks before the first API call. */
export function providerOrderRefs(order) {
  if (partnerConfig().provider !== 'shop2topup') return [];
  return order.items.map((item, i) => ({
    id: deterministicUuid(`${order.code}:${i}`),
    itemIndex: i,
    productSlug: item.productSlug,
    packageId: item.packageId,
  }));
}

let requirementsCache = { key: '', at: 0, value: [] };
export function clearRequirementsCache() { requirementsCache = { key: '', at: 0, value: [] }; }
async function categoryRequirements(categoryId) {
  if (!categoryId) return [];
  const key = String(categoryId);
  if (requirementsCache.key === key && Date.now() - requirementsCache.at < 5 * 60_000) return requirementsCache.value;
  const value = await s2t.getCategoryRequirements(key).catch(() => []);
  requirementsCache = { key, at: Date.now(), value };
  return value;
}

/**
 * Build a complete, immutable fulfillment plan BEFORE any provider order is
 * created. Persisting this plan makes retries and webhooks deterministic.
 */
export async function planShop2TopupOrders(order) {
  const cfg = shop2topupConfig();
  if (!cfg.apiKey) return { error: 'SHOP2TOPUP_API_KEY is not configured' };
  const definitions = await categoryRequirements(cfg.categoryId);
  const plans = [];
  const playerNames = [];

  for (const [i, item] of order.items.entries()) {
    const resolved = resolveSku(item, cfg.skuMap);
    const itemId = providerItemId(resolved);
    const label = `${item.productName || item.productSlug} / ${item.packageLabel || item.packageId}`;
    if (!itemId) {
      return { error: `No real Shop2Topup item ID mapped for ${label} (key ${item.productSlug}:${item.packageId}). Map it in Admin → Real integrations.` };
    }

    const parsed = s2t.parseAccountId(item.accountId);
    const built = s2t.buildRequirements(definitions, {
      playerId: parsed.playerId,
      server: parsed.server,
      defaultServer: cfg.defaultServer,
      quantity: item.qty || 1,
      email: order.customer?.email || '',
      phone: order.customer?.phone || '',
    });
    if (built.missing.length) {
      return { error: `Provider requires ${built.missing.join(', ')} for ${label}. Check the Player / Zone ID and SHOP2TOPUP_CATEGORY_ID.` };
    }
    const requirements = { ...built.requirements };
    if (resolved && typeof resolved === 'object' && resolved.requirements && typeof resolved.requirements === 'object') {
      Object.assign(requirements, resolved.requirements);
    }

    let price;
    try { price = await s2t.getItemPrice(itemId); }
    catch (err) { return { error: `Could not read the real price for ${label}: ${err.message}` }; }
    if (!Number.isFinite(price.unitPrice) || price.unitPrice <= 0) {
      return { error: `Provider returned an invalid price for ${label}` };
    }
    const saleCurrency = String(order.payment?.currency || 'USD').toUpperCase();
    if (price.currency && price.currency !== saleCurrency) {
      return { error: `Provider price is ${price.currency} but the order is ${saleCurrency} for ${label}` };
    }
    const retail = Number(item.price);
    if (price.unitPrice > retail * cfg.maxCostRatio + 0.000001) {
      return { error: `Provider cost ${price.unitPrice.toFixed(4)} exceeds the safe sale price ${(retail * cfg.maxCostRatio).toFixed(4)} for ${label}. Update pricing before selling this package.` };
    }

    if (cfg.validatePlayer) {
      let validation;
      try { validation = await s2t.validatePlayer(itemId, item.accountId); }
      catch (err) { return { error: `Could not verify the game account for ${label}: ${err.message}` }; }
      if (!validation.valid) {
        return { error: `Player ID ${parsed.playerId} was rejected for ${label}: ${validation.reason || 'player not found'}` };
      }
      if (validation.playerName) playerNames.push(validation.playerName);
    }

    plans.push({
      id: deterministicUuid(`${order.code}:${i}`),
      itemIndex: i,
      itemId,
      quantity: Math.max(1, Number(item.qty) || 1),
      requirements,
      expectedUnitPrice: Number(price.unitPrice).toFixed(6),
      retailUnitPrice: retail,
      currency: price.currency,
      playerId: parsed.playerId,
      server: parsed.server,
      label,
    });
  }
  return { orders: plans, playerNames };
}

/** Checkout-time player validation: no unverified game ID can reach payment. */
export async function validateOrderRecipients(items, { customer = {}, currency = 'USD' } = {}) {
  if (!isLive || partnerConfig().provider !== 'shop2topup') return { ok: true };
  const fakeOrder = {
    code: `PRECHECK-${crypto.randomBytes(4).toString('hex')}`,
    items,
    payment: { currency },
    customer,
  };
  const plan = await planShop2TopupOrders(fakeOrder);
  if (plan.error) return { ok: false, message: plan.error };
  return { ok: true, playerNames: plan.playerNames || [] };
}

async function fulfillShop2Topup(order) {
  const cfg = shop2topupConfig();
  let plans = order.fulfillment?.providerOrders;
  if (!Array.isArray(plans) || !plans.length) {
    const prepared = await planShop2TopupOrders(order);
    if (prepared.error) return { state: 'failed', message: prepared.error, ref: null, provider: 'shop2topup' };
    plans = prepared.orders;
  }

  const results = [];
  try {
    for (const entry of plans) {
      let state = await s2t.getOrder(entry.id);
      if (!state) {
        state = await s2t.createOrder({
          order_id: entry.id,
          sub_category_id: entry.itemId,
          quantity: entry.quantity,
          requirements: entry.requirements,
          expected_unit_price: entry.expectedUnitPrice,
        });
      }
      results.push({ ...entry, ...state });
    }
  } catch (err) {
    return {
      state: 'failed',
      message: `Shop2Topup delivery failed: ${err.message}`,
      ref: results.map((r) => r.ref || r.id).join(',') || null,
      provider: 'shop2topup', providerOrders: plans, providerResults: results, attempts: 1,
    };
  }

  const anyFailed = results.some((r) => r.state === 'failed');
  const allCompleted = results.length > 0 && results.every((r) => r.state === 'completed');
  const state = anyFailed ? 'failed' : allCompleted ? 'completed' : 'pending';
  return {
    state,
    message: state === 'completed' ? 'Real diamonds delivered by Shop2Topup'
      : state === 'failed' ? 'Shop2Topup reported a failed order'
        : 'Shop2Topup accepted the order; waiting for final delivery',
    ref: results.map((r) => r.ref || r.id).join(','),
    provider: 'shop2topup',
    providerOrders: plans,
    providerResults: results,
    attempts: 1,
  };
}

/** Generic HMAC adapter for a separately contracted official partner API. */
async function fulfillGeneric(order) {
  const cfg = partnerConfig();
  if (!cfg.url) return { state: 'failed', message: 'PARTNER_API_URL is not configured', ref: null };
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
    ...(cfg.webhookUrl ? { callbackUrl: cfg.webhookUrl } : {}),
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

/**
 * Deliver a paid order. Shop2Topup uses one idempotent provider order per cart
 * line and polls status; the generic adapter retries only transient failures.
 */
export async function fulfill(order) {
  if (!isLive) return { state: 'failed', message: 'Real payment mode is disabled; fulfillment is refused.', ref: null };
  if (partnerConfig().provider === 'shop2topup') return fulfillShop2Topup(order);
  return fulfillGeneric(order);
}

/** Used by the live gate to describe a missing real SKU. */
export function describeSku(item, skuMap = partnerConfig().skuMap) {
  return hasFulfillableSku(item, skuMap, partnerConfig().provider);
}
