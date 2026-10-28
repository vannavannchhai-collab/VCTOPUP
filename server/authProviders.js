import crypto from 'node:crypto';
import './env.js';

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
};

export function authProviderConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const botUsername = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const googleReady = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(clientId);
  const telegramReady = /^[A-Za-z0-9_]{5,32}$/.test(botUsername) && /^\d+:[A-Za-z0-9_-]{30,}$/.test(botToken);
  return {
    googleClientId: googleReady ? clientId : '',
    telegramBotUsername: telegramReady ? botUsername : '',
    googleReady,
    telegramReady,
  };
}

export async function verifyGoogleCredential(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  if (!clientId) throw Object.assign(new Error('Google sign-in is not configured yet.'), { status: 503 });
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 10000) {
    throw Object.assign(new Error('Invalid Google credential.'), { status: 401 });
  }
  let response;
  try {
    const url = new URL('https://oauth2.googleapis.com/tokeninfo');
    url.searchParams.set('id_token', idToken);
    response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch {
    throw Object.assign(new Error('Google sign-in verification is temporarily unavailable.'), { status: 503 });
  }
  if (!response.ok) throw Object.assign(new Error('Google rejected this sign-in. Please try again.'), { status: 401 });
  const claims = await response.json().catch(() => null);
  const issuerOk = ['accounts.google.com', 'https://accounts.google.com'].includes(claims?.iss);
  const exp = Number(claims?.exp) * 1000;
  if (!claims?.sub || claims.aud !== clientId || !issuerOk || !Number.isFinite(exp) || exp <= Date.now() || claims.email_verified !== 'true') {
    throw Object.assign(new Error('Google account verification failed.'), { status: 401 });
  }
  const email = String(claims.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Google did not provide a verified email.'), { status: 401 });
  return {
    provider: 'google',
    providerId: String(claims.sub),
    email,
    name: String(claims.name || claims.given_name || email.split('@')[0]).slice(0, 100),
    picture: String(claims.picture || '').slice(0, 1000),
    emailVerified: true,
  };
}

/** Verify Telegram Login Widget fields using the bot-token HMAC scheme. */
export function verifyTelegramLogin(data) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!botToken) throw Object.assign(new Error('Telegram sign-in is not configured yet.'), { status: 503 });
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Object.assign(new Error('Invalid Telegram sign-in payload.'), { status: 401 });
  const { hash, ...fields } = data;
  const authDate = Number(fields.auth_date);
  const now = Math.floor(Date.now() / 1000);
  if (!/^[a-f0-9]{64}$/i.test(String(hash || '')) || !Number.isInteger(Number(fields.id)) ||
      !Number.isFinite(authDate) || authDate > now + 30 || now - authDate > 300) {
    throw Object.assign(new Error('Telegram sign-in expired or invalid. Please try again.'), { status: 401 });
  }
  const checkString = Object.keys(fields).sort().map((key) => `${key}=${fields[key]}`).join('\n');
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const expected = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  if (!safeEqual(expected, hash)) throw Object.assign(new Error('Telegram account verification failed.'), { status: 401 });
  const id = String(fields.id);
  const name = [fields.first_name, fields.last_name].filter(Boolean).join(' ').slice(0, 100) || `Telegram user ${id}`;
  return {
    provider: 'telegram',
    providerId: id,
    email: null,
    name,
    username: String(fields.username || '').replace(/^@/, '').slice(0, 64),
    picture: String(fields.photo_url || '').slice(0, 1000),
    emailVerified: false,
  };
}
