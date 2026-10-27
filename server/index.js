/**
 * Local / self-hosted entry point.
 *
 * Vercel does NOT run this file — it imports the same Express app through
 * api/index.js as a serverless Function. Keeping listen() here (and only here)
 * means one codebase works on both a long-running server and Vercel.
 */
import './env.js';
import app, { PORT } from './app.js';
import { ensureStore, getDB } from './db.js';
import { integrationStatus } from './config.js';

await ensureStore();

const s = integrationStatus();
app.listen(PORT, '0.0.0.0', () => {
  const db = getDB();
  console.log(`\n  ⚡ VC TOPUP API running on http://0.0.0.0:${PORT}`);
  console.log(`  📦 ${db.products.length} products · ${db.orders.length} orders · ${db.users.length} users`);
  console.log(`  💳 PAYMENT_MODE=${s.mode}${s.live ? (s.ready ? ' (LIVE — real money)' : ` (LIVE BLOCKED: ${s.blockers.join(', ')})`) : ' (sandbox — no real money)'}`);
  console.log(`  💎 Provider=${s.providerLabel} · real SKUs ${s.skuCoverage.mapped}/${s.skuCoverage.total}`);
  if (s.webhookUrl) console.log(`  🔔 Webhook=${s.webhookUrl} (${s.webhookSignatureHeader})`);
  if (!s.checks.durableStore) console.log('  ⚠️  No DATABASE_URL — orders are stored in a local JSON file, NOT safe for live payments.');
  console.log('');
});
