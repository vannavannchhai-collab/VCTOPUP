/**
 * server/bakong.js — Bakong Open API client (payment VERIFICATION only).
 *
 * The QR itself is generated locally (see khqr.js). Bakong is queried to
 * confirm that money actually arrived. We never trust a browser-supplied
 * "I paid" flag: the only source of truth is this server-to-server call.
 *
 * Docs: https://api-bakong.nbc.gov.kh/document
 *   POST {base}/v1/check_transaction_by_md5   { md5 }
 *   Header: Authorization: Bearer <developer token>
 */
import { bakongConfig } from './config.js';

function normalizeResponse(json, httpStatus) {
  const data = json?.data && typeof json.data === 'object' ? json.data : null;
  const code = json?.responseCode;
  // NBC: responseCode 0 + a data object == a settled transaction.
  const paid = httpStatus >= 200 && httpStatus < 300 && code === 0 && Boolean(data);
  return {
    paid,
    hash: data?.hash || null,
    amount: data?.amount !== undefined ? Number(data.amount) : null,
    currency: data?.currency || null,
    toAccountId: data?.toAccountId || null,
    fromAccountId: data?.fromAccountId || null,
    description: data?.description || null,
    createdDateMs: data?.createdDateMs || null,
    responseCode: code ?? null,
    responseMessage: json?.responseMessage || null,
  };
}

/**
 * Look up a transaction by the MD5 of the KHQR string we generated.
 * Throws only on transport/credential problems; an unpaid result is a value.
 */
export async function checkTransactionByMd5(md5, { timeout = 10_000 } = {}) {
  const cfg = bakongConfig();
  if (!cfg.token) throw Object.assign(new Error('BAKONG_API_TOKEN is not configured'), { code: 'BAKONG_NO_TOKEN' });
  if (!/^[a-f0-9]{32}$/i.test(md5)) throw Object.assign(new Error('Invalid KHQR md5'), { code: 'BAD_MD5' });

  let response;
  try {
    response = await fetch(`${cfg.base}/check_transaction_by_md5`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ md5 }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (err) {
    throw Object.assign(new Error(`Bakong unreachable: ${err.message}`), { code: 'BAKONG_NETWORK', cause: err });
  }

  let json = null;
  try { json = await response.json(); }
  catch { /* fall through to the HTTP error below */ }

  if (response.status === 401 || response.status === 403) {
    throw Object.assign(new Error('Bakong rejected the developer token (expired, wrong, or IP-restricted).'), { code: 'BAKONG_AUTH' });
  }
  if (response.status >= 500 || response.status === 429) {
    throw Object.assign(new Error(`Bakong temporary failure (HTTP ${response.status}).`), { code: 'BAKONG_TEMPORARY' });
  }
  if (!json) throw Object.assign(new Error(`Bakong returned a non-JSON response (HTTP ${response.status}).`), { code: 'BAKONG_BAD_RESPONSE' });

  return normalizeResponse(json, response.status);
}

/** NFC tokens expire (~90 days); this helper lets an operator renew one. */
export async function renewToken(email) {
  const cfg = bakongConfig();
  if (!cfg.token || !email) throw new Error('BAKONG_API_TOKEN and an email are required to renew');
  const res = await fetch(`${cfg.base}/renew_token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
    signal: AbortSignal.timeout(10_000),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
