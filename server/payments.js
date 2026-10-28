/**
 * server/payments.js — the "real money -> real diamonds" state machine.
 *
 *                 ┌────────────── DELIVERY IS ONLY REACHED FROM HERE ──────────────┐
 *  pending ──(Bakong says PAID)──> paid ──(partner API)──> processing ──> completed
 *     │                                                        │
 *     └──(QR expired)──> expired                                └──(partner failed)──> delivery_failed ──(admin retry)──> processing
 *
 * INVARIANTS (do not break these):
 *  1. `fulfill()` is called ONLY when `order.payment.status === 'paid'`.
 *  2. `paid` is set ONLY by server-side Bakong verification,
 *     never by any value coming from the browser.
 *  3. Settling is done inside an atomic `transact()` with a re-check, so two
 *     concurrent polling requests can never deliver the same order twice.
 *  4. The partner request carries `Idempotency-Key: <order code>` so even a
 *     network retry cannot double-credit a player's account.
 */
import crypto from 'node:crypto';
import { generateKHQR } from './khqr.js';
import { checkTransactionByMd5 } from './bakong.js';
import { fulfill, verifyCallback, planShop2TopupOrders, providerOrderRefs } from './partner.js';
import { bakongConfig, partnerConfig, isLive } from './config.js';
import { readFresh, transact, getDB } from './db.js';

const nowIso = () => new Date().toISOString();
const findOrder = (db, code) => db.orders.find((o) => String(o.code).toLowerCase() === String(code).toLowerCase());

function logSecurity(db, level, message, extra = {}) {
  db.securityEvents ||= [];
  db.securityEvents.unshift({ id: crypto.randomBytes(6).toString('hex'), level, message, at: nowIso(), ...extra });
  db.securityEvents = db.securityEvents.slice(0, 200);
}

/** Attach a real Bakong KHQR to an order after the live readiness gate passes. */
export function attachPayment(order, methodConfig, settings) {
  if (!isLive || methodConfig?.id !== 'bakong' || methodConfig?.kind !== 'khqr') {
    throw new Error('Only live Bakong KHQR checkout is supported.');
  }
  const cfg = bakongConfig();
  const intent = generateKHQR({
    accountId: cfg.accountId,
    merchantName: cfg.merchantName,
    merchantCity: cfg.merchantCity,
    merchantId: cfg.merchantId,
    acquiringBank: cfg.acquiringBank,
    amount: order.total,
    currency: cfg.currency,
    billNumber: order.code,
    storeLabel: 'VC TOPUP',
    terminalLabel: 'WEB',
    phoneNumber: settings?.phone || '',
    ttlMs: cfg.ttlMs,
  });
  return {
    method: order.payment.method,
    status: 'pending',
    mode: 'live',
    verification: 'bakong',
    merchantName: cfg.merchantName,
    currency: cfg.currency,
    amount: order.total,
    verifiedAmount: null,
    bakongHash: null,
    transactionId: '',
    paidAt: null,
    lastCheckedAt: null,
    attempts: 0,
    qr: intent.qr,
    md5: intent.md5,
    billNumber: intent.billNumber,
    expiresAt: intent.expiresAt,
    accountId: cfg.accountId,
  };
}

/** Public projection: never leak tokens, secrets, or internal signatures. */
export function publicPayment(order) {
  const p = order.payment || {};
  return {
    method: p.method,
    status: p.status,
    mode: p.mode,
    verification: p.verification,
    merchantName: p.merchantName,
    accountName: p.accountName,
    accountNumber: p.accountNumber,
    accountId: p.accountId,
    amount: p.amount,
    currency: p.currency,
    qr: p.qr || null,
    md5: p.md5 || null,
    billNumber: p.billNumber || null,
    expiresAt: p.expiresAt || null,
    paidAt: p.paidAt || null,
  };
}

/** Verify the Bakong evidence before we accept it as payment. */
function validateEvidence(evidence, order, cfg, db) {
  const problems = [];
  const exchangeRate = Number(process.env.BAKONG_KHR_PER_USD || getDB().settings?.exchangeRate || 0);
  if (cfg.currency === 'KHR' && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) problems.push('KHR/USD settlement rate is not configured');
  const expectedAmount = cfg.currency === 'KHR' && exchangeRate > 0
    ? Math.round(order.total * exchangeRate)
    : order.total;
  const tolerance = cfg.currency === 'KHR' ? 1 : 0.011;

  if (evidence.amount === null || !Number.isFinite(evidence.amount)) {
    problems.push('Bakong did not report a transaction amount');
  } else if (Math.abs(evidence.amount - expectedAmount) > tolerance) {
    problems.push(`Amount mismatch: expected ${expectedAmount} ${cfg.currency}, got ${evidence.amount} ${evidence.currency || ''}`);
  }
  if (evidence.currency && String(evidence.currency).toUpperCase() !== cfg.currency) {
    problems.push(`Currency mismatch: expected ${cfg.currency}, got ${evidence.currency}`);
  }
  if (evidence.toAccountId && cfg.accountId && isLive) {
    if (String(evidence.toAccountId).toLowerCase() !== String(cfg.accountId).toLowerCase()) {
      problems.push('Payment was sent to a different Bakong account');
    }
  }
  if (evidence.hash && db.orders.some((o) => o.code !== order.code && o.payment?.bakongHash === evidence.hash)) {
    problems.push(`Transaction hash ${evidence.hash} was already used for another order (replay)`);
  }
  return problems;
}

/**
 * Poll-and-settle. Returns `{ order, shouldDeliver }`; the caller runs
 * `deliverOrder()` afterwards (outside the DB transaction, so the row lock is
 * never held during a network call).
 */
export async function verifyPayment(code) {
  const db = await readFresh();
  const order = findOrder(db, code);
  if (!order) return { error: 'Order not found', status: 404 };
  if (!isLive) return { error: 'Live Bakong verification is not enabled.', status: 503 };
  if (order.payment?.verification !== 'bakong') return { error: 'This order has no verified Bakong payment intent.', status: 409 };
  if (!['pending', 'expired'].includes(order.payment.status)) {
    // Already settled (e.g. VC Wallet, admin confirmation, or a crash after
    // payment but before delivery). Self-heal by requesting a delivery.
    const stale = order.status === 'processing' && order.fulfillment?.lastAttemptAt &&
      Date.now() - new Date(order.fulfillment.lastAttemptAt).getTime() > 120_000;
    const needsDelivery = order.status === 'paid' || stale;
    return { order, shouldDeliver: needsDelivery, settled: false };
  }
  if (order.status !== 'pending' || order.payment.status === 'discrepancy') {
    return { order, shouldDeliver: false, settled: false };
  }

  const cfg = bakongConfig();
  const now = Date.now();
  const expired = order.payment.expiresAt && now > new Date(order.payment.expiresAt).getTime();

  // Throttle outbound Bakong calls (one per QR per N seconds).
  const last = order.payment.lastCheckedAt ? new Date(order.payment.lastCheckedAt).getTime() : 0;
  if (now - last < cfg.pollThrottleMs) return { order, shouldDeliver: false, throttled: true };

  let evidence = null;
  try {
    evidence = await checkTransactionByMd5(order.payment.md5);
  } catch (err) {
    await transact((d) => {
      const o = findOrder(d, code);
      if (o) o.payment.lastCheckedAt = nowIso();
      logSecurity(d, 'warn', `Payment verification failed: ${err.message}`, { code, codeReason: err.code || null });
    }).catch(() => {});
    return { order: findOrder(getDB(), code) || order, shouldDeliver: false, verificationError: err.message };
  }

  if (!evidence.paid) {
    await transact((d) => {
      const o = findOrder(d, code);
      if (!o) return;
      o.payment.lastCheckedAt = nowIso();
      o.payment.attempts = (o.payment.attempts || 0) + 1;
      if (expired && o.payment.status === 'pending') {
        o.payment.status = 'expired';
        o.timeline.push({ status: 'pending', at: nowIso(), note: 'KHQR expired — generate a new code' });
      }
    }).catch(() => {});
    return { order: findOrder(getDB(), code) || order, shouldDeliver: false, expired: Boolean(expired) };
  }

  const problems = validateEvidence(evidence, order, cfg, db);
  if (problems.length) {
    await transact((d) => {
      const o = findOrder(d, code);
      if (!o) return;
      o.payment.status = 'discrepancy';
      o.payment.discrepancy = problems;
      o.timeline.push({ status: 'pending', at: nowIso(), note: `Payment held for review: ${problems.join('; ')}` });
      logSecurity(d, 'critical', 'Payment evidence rejected', { code, problems, hash: evidence.hash });
    }).catch(() => {});
    return { order: findOrder(getDB(), code) || order, shouldDeliver: false, discrepancy: problems };
  }

  const settled = await transact((d) => {
    const o = findOrder(d, code);
    if (!o || o.status !== 'pending' || o.payment.status === 'paid') return { already: true, order: o };
    const at = nowIso();
    o.payment.status = 'paid';
    o.payment.paidAt = at;
    o.payment.bakongHash = evidence.hash || null;
    o.payment.verifiedAmount = evidence.amount;
    o.payment.verifiedCurrency = evidence.currency || cfg.currency;
    o.payment.lastCheckedAt = at;
    o.status = 'paid';
    o.timeline.push({
      status: 'paid', at,
      note: `Payment confirmed by Bakong (${evidence.hash || 'no hash'})${expired ? ' — late settlement' : ''}`,
    });
    logSecurity(d, 'info', 'Order settled', { code, hash: evidence.hash, amount: evidence.amount });
    return { already: false, order: o };
  });

  return { order: settled.order, shouldDeliver: !settled.already, settled: true };
}

/** Persist a partner result and keep the provider webhook lookup up to date. */
function applyFulfillmentResult(code, result) {
  return transact((d) => {
    const o = findOrder(d, code);
    if (!o) return null;
    o.fulfillment = {
      ...(o.fulfillment || {}),
      status: result.state,
      ref: result.ref || o.fulfillment?.ref || null,
      message: result.message,
      attempts: result.attempts || o.fulfillment?.attempts || 1,
      lastAttemptAt: nowIso(),
      ...(result.provider ? { provider: result.provider } : {}),
      ...(result.providerOrders ? { providerOrders: result.providerOrders } : {}),
      ...(result.providerResults ? { providerResults: result.providerResults } : {}),
    };
    d.partnerOrderMap ||= {};
    for (const ref of providerOrderRefs(o)) d.partnerOrderMap[ref.id] = o.code;

    if (result.state === 'completed') {
      o.status = 'completed';
      o.deliveredAt = nowIso();
      o.payment.status = 'paid';
      o.timeline.push({ status: 'completed', at: nowIso(), note: `Provider confirmed delivery (${result.ref || 'partner confirmed'})` });
      for (const item of o.items) {
        const p = d.products.find((x) => x.id === item.productId || x.slug === item.productSlug);
        if (p) p.sold = (p.sold || 0) + item.qty;
      }
    } else if (result.state === 'failed') {
      o.status = 'delivery_failed';
      o.timeline.push({ status: 'delivery_failed', at: nowIso(), note: `Partner delivery failed: ${result.message}` });
      logSecurity(d, 'error', 'Partner delivery failed', { code, message: result.message });
    } else {
      o.timeline.push({ status: 'processing', at: nowIso(), note: `Partner is processing (${result.ref || 'queued'})` });
    }
    return o;
  });
}

/** Run the partner delivery for a PAID order and persist the result atomically. */
export async function deliverOrder(code, { force = false } = {}) {
  const db = await readFresh();
  const order = findOrder(db, code);
  if (!order) return { error: 'Order not found', status: 404 };
  if (order.status === 'completed' && !force) return { order, skipped: true };
  if (order.payment.status !== 'paid') {
    return { error: 'Refusing to deliver: payment has not been verified by Bakong', status: 409, order };
  }

  // Atomic claim. Under Postgres the row lock makes two concurrent pollers
  // serialize: the first sets `processing`, the second sees it and backs off.
  // A 2-minute stale lease lets the system recover from a crashed Function.
  const claimed = await transact((d) => {
    const o = findOrder(d, code);
    if (!o || o.payment?.status !== 'paid' || o.status === 'cancelled') return false;
    if (o.status === 'completed' && !force) return false;
    const inFlight = o.status === 'processing' && o.fulfillment?.lastAttemptAt &&
      Date.now() - new Date(o.fulfillment.lastAttemptAt).getTime() < 120_000;
    if (inFlight && !force) return false;
    o.status = 'processing';
    o.fulfillment = { ...(o.fulfillment || {}), status: 'delivering', attempts: (o.fulfillment?.attempts || 0) + 1, lastAttemptAt: nowIso() };
    o.timeline.push({ status: 'processing', at: nowIso(), note: 'Sending top-up request to game partner' });
    return true;
  });
  if (!claimed) return { order: findOrder(getDB(), code) || order, skipped: true };

  let fresh = findOrder(getDB(), code) || order;

  // Build and persist the real provider plan BEFORE creating any provider
  // order. This makes webhook lookup and crash recovery deterministic.
  if (isLive && partnerConfig().provider === 'shop2topup' && !fresh.fulfillment?.providerOrders?.length) {
    let prepared;
    try { prepared = await planShop2TopupOrders(fresh); }
    catch (err) { prepared = { error: err.message }; }
    if (prepared.error) {
      const failed = { state: 'failed', message: prepared.error, ref: null, provider: 'shop2topup', attempts: 1 };
      const updated = await applyFulfillmentResult(code, failed);
      return { order: updated, result: failed };
    }
    fresh = await transact((d) => {
      const o = findOrder(d, code);
      if (!o) return fresh;
      o.fulfillment = { ...(o.fulfillment || {}), providerOrders: prepared.orders };
      d.partnerOrderMap ||= {};
      for (const ref of providerOrderRefs(o)) d.partnerOrderMap[ref.id] = o.code;
      return o;
    }) || fresh;
  }

  const result = await fulfill(findOrder(getDB(), code) || fresh);
  const updated = await applyFulfillmentResult(code, result);
  return { order: updated, result };
}

/** Regenerate an expired KHQR for an unpaid order (never for a paid one). */
export async function refreshPaymentQR(code) {
  if (!isLive) return { error: 'Live Bakong payment is not enabled.', status: 503 };
  const cfg = bakongConfig();
  const updated = await transact((d) => {
    const o = findOrder(d, code);
    if (!o) return null;
    if (o.payment.status === 'paid' || o.status !== 'pending') return o;
    if (o.payment.verification !== 'bakong') return o;
    const intent = generateKHQR({
      accountId: o.payment.accountId,
      merchantName: cfg.merchantName,
      merchantCity: cfg.merchantCity,
      merchantId: cfg.merchantId,
      acquiringBank: cfg.acquiringBank,
      amount: o.total,
      currency: cfg.currency,
      billNumber: `${o.code}R${(o.payment.attempts || 0) + 1}`,
      phoneNumber: d.settings?.phone || '',
      ttlMs: cfg.ttlMs,
    });
    Object.assign(o.payment, {
      qr: intent.qr, md5: intent.md5, billNumber: intent.billNumber,
      expiresAt: intent.expiresAt, status: 'pending',
      lastCheckedAt: null, discrepancy: null,
    });
    o.timeline.push({ status: 'pending', at: nowIso(), note: 'New KHQR generated' });
    return o;
  });
  return updated ? { order: updated } : { error: 'Order not found', status: 404 };
}

/** Signed partner callback (for partners that deliver asynchronously). */
export async function handlePartnerCallback(rawBody, signature = '', timestamp = '', headers = {}) {
  const check = verifyCallback(rawBody, signature, timestamp, headers);
  if (!check.ok) return { error: check.reason, status: 401 };

  let payload;
  try { payload = check.payload || JSON.parse(rawBody); } catch { return { error: 'Invalid JSON', status: 400 }; }
  const provider = partnerConfig().provider;
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;
  const event = String(payload.event || '').toLowerCase();

  if (provider === 'shop2topup' && event === 'webhook.test') return { test: true, received: true };

  let code = '';
  let providerOrderId = '';
  let state = String(payload.status || payload.result || data.status || data.order_status || '').toUpperCase();
  let transactionId = payload.transactionId || data.transaction_id || data.transactionId || '';

  if (provider === 'shop2topup') {
    providerOrderId = String(data.order_id || data.orderId || payload.order_id || '');
    const db = getDB();
    code = db.partnerOrderMap?.[providerOrderId] || '';
    if (!code && providerOrderId) {
      const match = db.orders.find((o) => o.fulfillment?.providerOrders?.some((r) => r.id === providerOrderId || r.ref === providerOrderId));
      code = match?.code || '';
    }
    code ||= data.partner_ref || data.reference || payload.reference || payload.orderId || '';
    if (event === 'order.completed') state = 'COMPLETED';
    if (event === 'order.failed') state = 'FAILED';
    if (event === 'order.refunded') state = 'REFUNDED';
    transactionId ||= providerOrderId;
  } else {
    code = payload.orderId || payload.reference || payload.order_id || data.order_id || '';
  }
  if (!code) return { error: 'Unknown provider order reference', status: 404 };

  const delivered = ['SUCCESS', 'COMPLETED', 'COMPLETE', 'DELIVERED', 'PAID'].includes(state) || payload.success === true;
  const failed = ['FAILED', 'REJECTED', 'CANCELLED', 'CANCELED', 'REFUNDED'].includes(state);
  const eventHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  const result = await transact((d) => {
    d.webhookEvents ||= [];
    if (d.webhookEvents.includes(eventHash)) {
      return { duplicate: true, order: findOrder(d, code) };
    }
    d.webhookEvents.unshift(eventHash);
    d.webhookEvents = d.webhookEvents.slice(0, 200);

    const o = findOrder(d, code);
    if (!o) return null;
    if (delivered && o.payment.status !== 'paid') {
      o.fulfillment = { ...(o.fulfillment || {}), callbackAt: nowIso(), callbackStatus: 'REJECTED_UNPAID', callbackEvent: event || null };
      logSecurity(d, 'critical', 'Callback ignored: payment was not verified', { code, state, providerOrderId });
      return { ignored: true, order: o };
    }
    o.fulfillment = {
      ...(o.fulfillment || {}),
      ref: transactionId || o.fulfillment?.ref || null,
      status: delivered ? 'completed' : failed ? 'failed' : 'pending',
      callbackAt: nowIso(),
      callbackStatus: state,
      ...(providerOrderId ? { providerOrderId } : {}),
      ...(event ? { callbackEvent: event } : {}),
    };
    if (delivered && o.status !== 'completed') {
      o.status = 'completed';
      o.deliveredAt = nowIso();
      o.timeline.push({ status: 'completed', at: nowIso(), note: `Partner callback confirmed delivery (${transactionId || state})` });
    } else if (failed && o.status !== 'completed') {
      o.status = 'delivery_failed';
      o.timeline.push({ status: 'delivery_failed', at: nowIso(), note: `Partner callback reported ${state}` });
    }
    logSecurity(d, 'info', 'Partner callback', { code, state, transactionId, providerOrderId });
    return { order: o };
  });
  if (!result) return { error: 'Order not found', status: 404 };
  return result;
}
