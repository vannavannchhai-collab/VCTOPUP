/**
 * server/khqr.js — EMVCo / Bakong KHQR dynamic QR generator (zero dependencies)
 *
 * Tag layout follows the Bakong KHQR content guideline:
 *   00 payload format indicator   01 point of initiation (12 = dynamic)
 *   29/30 merchant account info   52 MCC   53 currency   54 amount
 *   58 country   59 merchant name   60 merchant city   62 additional data
 *   99 timestamp / expiration     63 CRC16-CCITT
 *
 * A dynamic KHQR is UNIQUE per order (bill number + millisecond timestamp),
 * which is what makes `md5(qr)` a safe lookup key for Bakong's
 * `check_transaction_by_md5` verification API.
 */
import crypto from 'node:crypto';

/** TAG + 2-digit BYTE length + VALUE (EMVCo counts bytes, not characters). */
export function tlv(tag, value) {
  const s = String(value ?? '');
  const len = Buffer.byteLength(s, 'utf8');
  if (len > 99) throw new Error(`KHQR: value for tag ${tag} exceeds 99 bytes`);
  if (!/^\d{2}$/.test(tag)) throw new Error(`KHQR: invalid tag ${tag}`);
  return `${tag}${String(len).padStart(2, '0')}${s}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), uppercase 4 hex chars. */
export function crc16(data) {
  let crc = 0xFFFF;
  const buf = Buffer.from(data, 'utf8');
  for (const byte of buf) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** "9.490" -> "9.49", "10.000" -> "10" (Bakong amount formatting). */
function formatAmount(amount) {
  return Number(amount).toFixed(2).replace(/\.?0+$/, '');
}

function normalizePhone(v) {
  let digits = String(v || '').replace(/\D/g, '');
  if (digits.startsWith('855')) digits = digits.slice(3);
  if (digits && !digits.startsWith('0')) digits = `0${digits}`;
  return digits.slice(0, 25);
}

const clip = (v, max) => String(v ?? '').slice(0, max);

/**
 * Build a dynamic KHQR for one order.
 *
 * @returns {{ qr: string, md5: string, billNumber: string, expiresAt: string, amount: number, currency: string }}
 */
export function generateKHQR({
  accountId,
  merchantName = 'VC TOPUP',
  merchantCity = 'Siem Reap',
  merchantId = '',
  acquiringBank = '',
  amount,
  currency = 'USD',
  billNumber,
  storeLabel = 'VC TOPUP',
  terminalLabel = 'WEB',
  phoneNumber = '',
  ttlMs = 10 * 60 * 1000,
  now = Date.now(),
}) {
  if (!accountId) throw new Error('KHQR: BAKONG_ACCOUNT_ID is required');
  if (!(amount > 0)) throw new Error('KHQR: a positive amount is required for a dynamic QR');
  if (!['USD', 'KHR'].includes(currency)) throw new Error('KHQR: currency must be USD or KHR');

  const bill = clip(String(billNumber || `VC${now}`).replace(/[^A-Za-z0-9]/g, ''), 25);
  const expiresMs = now + Math.max(60_000, Number(ttlMs) || 600_000);

  let qr = tlv('00', '01');           // payload format indicator
  qr += tlv('01', '12');              // dynamic QR (unique per transaction)

  // Merchant account information. Individual (29) uses sub-tag 00 = Bakong
  // account ID. Merchant (30) additionally carries merchant ID + acquiring bank.
  let mai = tlv('00', clip(accountId, 32));
  if (merchantId) mai += tlv('01', clip(merchantId, 32));
  if (acquiringBank) mai += tlv('02', clip(acquiringBank, 32));
  qr += tlv(merchantId ? '30' : '29', mai);

  qr += tlv('52', '5999');                                  // merchant category code
  qr += tlv('53', currency === 'KHR' ? '116' : '840');      // transaction currency
  qr += tlv('54', formatAmount(amount));                     // transaction amount
  qr += tlv('58', 'KH');                                     // country
  qr += tlv('59', clip(merchantName, 25));
  qr += tlv('60', clip(merchantCity, 15));

  // Additional data field (62): bill number, phone, store/terminal labels.
  let add = '';
  if (storeLabel) add += tlv('03', clip(storeLabel, 25));
  if (phoneNumber && normalizePhone(phoneNumber)) add += tlv('02', normalizePhone(phoneNumber));
  if (bill) add += tlv('01', bill);
  if (terminalLabel) add += tlv('07', clip(terminalLabel, 25));
  if (add) qr += tlv('62', add);

  // Timestamp (99): creation time + expiration time (dynamic QR only).
  let ts = tlv('00', String(now));
  ts += tlv('01', String(expiresMs));
  qr += tlv('99', ts);

  // CRC covers the payload INCLUDING the literal "6304" tag/length.
  qr += '6304' + crc16(qr + '6304');

  return {
    qr,
    md5: crypto.createHash('md5').update(qr, 'utf8').digest('hex'),
    billNumber: bill,
    expiresAt: new Date(expiresMs).toISOString(),
    amount: Number(amount),
    currency,
  };
}

/** Parse top-level TLVs — used by tests and the admin "inspect QR" helper. */
export function parseKHQR(qr) {
  const out = {};
  for (let i = 0; i + 4 <= qr.length;) {
    const tag = qr.slice(i, i + 2);
    const len = Number(qr.slice(i + 2, i + 4));
    out[tag] = qr.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}
