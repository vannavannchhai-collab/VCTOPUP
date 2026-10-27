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
 *  2. `paid` is set ONLY by server-side verification (Bakong / admin / wallet),
 *     never by any value coming from the browser.
 *  3. Settling is done inside an atomic `transact()` with a re-check, so two
 *     concurrent polling requests can never deliver the same order twice.
 *  4. The partner request carries `Idempotency-Key: <order code>` so even a
 *     network retry cannot double-credit a player's account.
 */
import crypto from 'node:crypto';
import { generateKHQR } from './khqr.js';
import { checkTransactionByMd5 } from './bakong.js';
import { fulfill, verifyCallback } from './partner.js';
import { bakongConfig, integrationStatus, isLive } from './config.js';
import { readFresh, transact, getDB } from './db.js';

const nowIso = () => new Date().toISOString();
const findOrder = (db, code) => db.orders.find((o) => String(o.code).toLowerCase() === String(code).toLowerCase());

function logSecurity(db, level, message, extra = {}) {
  db.securityEvents ||= [];
  db.securityEvents.unshift({ id: crypto.randomBytes(6).toString('hex'), level, message, at: nowIso(), ...extra });
  db.securityEvents = db.securityEvents.slice(0, 200);
}

/** Attach a KHQR (or manual / wallet payment) to a newly-created order. */
export function attachPayment(order, methodConfig, settings) {
  const cfg = bakongConfig();
  const status = integrationStatus();
  const kind = methodConfig?.kind || 'khqr';
  const base = {
    method: order.payment.method,
    status: 'pending',
    mode: status.mode,
    merchantName: status.merchantName,
    currency: cfg.currency,
    amount: order.total,
    verifiedAmount: null,
    bakongHash: null,
    transactionId: order.payment.transactionId || '',
    paidAt: null,
    lastCheckedAt: null,
    attempts: 0,
    sandboxPaid: false,
  };

  if (kind === 'balance') {
    // VC Wallet is an internal ledger: the debit IS the settlement.
    return { ...base, status: 'paid', verification: 'wallet', paidAt: nowIso(), transactionId: `WALLET-${order.code}` };
  }

  if (kind === 'khqr') {
    // CRITICAL: in sandbox the QR must NEVER point at a real merchant account,
    // even if BAKONG_ACCOUNT_ID was filled in for a future live deployment.
    const accountId = isLive ? cfg.accountId : 'vctopup@sandbox';
    const intent = generateKHQR({
      accountId,
      merchantName: isLive ? cfg.merchantName : `SANDBOX ${cfg.merchantName}`,
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
      ...base,
      verification: isLive ? 'bakong' : 'sandbox',
      qr: intent.qr,
      md5: intent.md5,
      billNumber: intent.billNumber,
      expiresAt: intent.expiresAt,
      accountId,
      sandbox: !isLive,
    };
  }

  // Wing / TrueMoney etc. have no automatic Bakong confirmation: a human must
  // confirm the transfer in admin before anything is delivered.
  return { ...base, verification: 'manual', accountName: methodConfig.account, accountNumber: methodConfig.number };
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
    sandbox: Boolean(p.sandbox),
    sandboxPaid: Boolean(p.sandboxPaid),
  };
}

/** Verify the Bakong evidence before we accept it as payment. */
function validateEvidence(evidence, order, cfg, db) {
  const problems = [];
  const exchangeRate = Number(getDB().settings?.exchangeRate || 4100);
  const expectedAmount = cfg.currency === 'KHR'
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
  if (isLive && now - last < cfg.pollThrottleMs) return { order, shouldDeliver: false, throttled: true };

  let evidence = null;
  try {
    if (order.payment.verification === 'sandbox') {
      evidence = order.payment.sandboxPaid ? {
        paid: true, hash: `SANDBOX-${order.code}`, amount: order.total,
        currency: cfg.currency, toAccountId: order.payment.accountId,
      } : { paid: false };
    } else if (order.payment.verification === 'bakong') {
      evidence = await checkTransactionByMd5(order.payment.md5);
    } else if (order.payment.verification === 'wallet') {
      evidence = { paid: true, hash: `WALLET-${order.code}`, amount: order.total, currency: cfg.currency };
    } else {
      // Manual transfer: only an admin can settle. Never auto-confirm.
      evidence = { paid: false };
    }
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
      note: isLive
        ? `Payment confirmed by Bakong (${evidence.hash || 'no hash'})${expired ? ' — late settlement' : ''}`
        : 'SANDBOX: payment simulated',
    });
    logSecurity(d, 'info', 'Order settled', { code, hash: evidence.hash, amount: evidence.amount });
    return { already: false, order: o };
  });

  return { order: settled.order, shouldDeliver: !settled.already, settled: true };
}

function awardPoints(d, order) {
  if (order.pointsAwarded) return;
  order.pointsAwarded = true;
  if (!order.userId) return;
  const u = d.users.find((x) => x.id === order.userId);
  if (u) u.points = (u.points || 0) + (order.pointsEarned || 0);
}

/** Run the partner delivery for a PAID order and persist the result atomically. */
export async function deliverOrder(code, { force = false } = {}) {
  const db = await readFresh();
  const order = findOrder(db, code);
  if (!order) return { error: 'Order not found', status: 404 };
  if (order.status === 'completed' && !force) return { order, skipped: true };
  if (order.payment.status !== 'paid' && !force) {
    return { error: 'Refusing to deliver: payment has not been verified', status: 409, order };
  }

  // Atomic claim. Under Postgres the row lock makes two concurrent pollers
  // serialize: the first sets `processing`, the second sees it and backs off.
  // A 2-minute stale lease lets the system recover from a crashed Function.
  const claimed = await transact((d) => {
    const o = findOrder(d, code);
    if (!o) return false;
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

  const result = await fulfill(findOrder(getDB(), code) || order);

  const updated = await transact((d) => {
    const o = findOrder(d, code);
    o.fulfillment = {
      ...(o.fulfillment || {}),
      status: result.state,
      ref: result.ref || o.fulfillment?.ref || null,
      message: result.message,
      attempts: result.attempts || o.fulfillment?.attempts || 1,
      lastAttemptAt: nowIso(),
      sandbox: Boolean(result.sandbox),
    };
    if (result.state === 'completed') {
      o.status = 'completed';
      o.deliveredAt = nowIso();
      o.payment.status = 'paid';
      o.timeline.push({ status: 'completed', at: nowIso(), note: result.sandbox ? 'SANDBOX: simulated delivery' : `Credits delivered (${result.ref || 'partner confirmed'})` });
      awardPoints(d, o);
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

  return { order: updated, result };
}

/** SANDBOX ONLY — stand in for a bank app scan so the flow can be tested. */
export async function simulateSandboxPayment(code) {
  if (isLive) return { error: 'Simulation is disabled in live mode', status: 403 };
  const order = await transact((d) => {
    const o = findOrder(d, code);
    if (!o) return null;
    if (o.payment.verification !== 'sandbox') return null;
    o.payment.sandboxPaid = true;
    o.payment.status = 'pending';
    o.payment.lastCheckedAt = null;
    o.timeline.push({ status: 'pending', at: nowIso(), note: 'SANDBOX: bank payment simulated' });
    return o;
  });
  if (!order) return { error: 'Order not found or not a sandbox KHQR payment', status: 404 };
  return { order };
}

/** Regenerate an expired KHQR for an unpaid order (never for a paid one). */
export async function refreshPaymentQR(code) {
  const status = integrationStatus();
  const cfg = bakongConfig();
  const updated = await transact((d) => {
    const o = findOrder(d, code);
    if (!o) return null;
    if (o.payment.status === 'paid' || o.status !== 'pending') return o;
    if (!['bakong', 'sandbox', 'khqr'].includes(o.payment.verification)) return o;
    const intent = generateKHQR({
      accountId: o.payment.accountId,
      merchantName: isLive ? status.merchantName : `SANDBOX ${status.merchantName}`,
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
      expiresAt: intent.expiresAt, status: 'pending', sandboxPaid: false,
      lastCheckedAt: null, discrepancy: null,
    });
    o.timeline.push({ status: 'pending', at: nowIso(), note: 'New KHQR generated' });
    return o;
  });
  return updated ? { order: updated } : { error: 'Order not found', status: 404 };
}

/** Admin: confirm a manual bank/e-wallet transfer, then deliver. */
export async function adminConfirmPayment(code, adminId, note = '') {
  const settled = await transact((d) => {
    const o = findOrder(d, code);
    if (!o) return null;
    if (o.payment.status === 'paid' || o.status !== 'pending') return { already: true, order: o };
    o.payment.status = 'paid';
    o.payment.paidAt = nowIso();
    o.payment.verifiedAmount = o.total;
    o.payment.manualConfirmedBy = adminId;
    o.status = 'paid';
    o.timeline.push({ status: 'paid', at: nowIso(), note: note || 'Payment manually confirmed by admin' });
    logSecurity(d, 'info', 'Manual payment confirmation', { code, adminId });
    return { already: false, order: o };
  });
  if (!settled) return { error: 'Order not found', status: 404 };
  return { order: settled.order, shouldDeliver: !settled.already };
}

/** Signed partner callback (for partners that deliver asynchronously). */
export async function handlePartnerCallback(rawBody, signature, timestamp) {
  const check = verifyCallback(rawBody, signature, timestamp);
  if (!check.ok) return { error: check.reason, status: 401 };
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return { error: 'Invalid JSON', status: 400 }; }
  const code = payload.orderId || payload.reference || payload.order_id;
  if (!code) return { error: 'Missing order reference', status: 400 };

  const state = String(payload.status || payload.result || '').toUpperCase();
  const delivered = ['SUCCESS', 'COMPLETED', 'DELIVERED', 'PAID'].includes(state) || payload.success === true;
  const failed = ['FAILED', 'REJECTED', 'CANCELLED', 'REFUNDED'].includes(state);

  const result = await transact((d) => {
    const o = findOrder(d, code);
    if (!o) return null;
    o.fulfillment = { ...(o.fulfillment || {}), ref: payload.transactionId || o.fulfillment?.ref || null, status: delivered ? 'completed' : failed ? 'failed' : 'pending', callbackAt: nowIso(), callbackStatus: state };
    if (delivered && o.payment.status === 'paid' && o.status !== 'completed') {
      o.status = 'completed';
      o.deliveredAt = nowIso();
      o.timeline.push({ status: 'completed', at: nowIso(), note: `Partner callback confirmed delivery (${payload.transactionId || state})` });
      awardPoints(d, o);
    } else if (failed && o.status !== 'completed') {
      o.status = 'delivery_failed';
      o.timeline.push({ status: 'delivery_failed', at: nowIso(), note: `Partner callback reported ${state}` });
    }
    logSecurity(d, 'info', 'Partner callback', { code, state, transactionId: payload.transactionId });
    return o;
  });
  if (!result) return { error: 'Order not found', status: 404 };
  return { order: result };
}
