/**
 * Local / self-hosted entry point.
 *
 * Vercel does NOT run this file — it imports the same Express app through
 * api/index.js as a serverless Function. Keeping listen() here (and only here)
 * means one codebase works on both a long-running server and Vercel.
 */
import app, { PORT } from './app.js';
import { getDB } from './db.js';

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ⚡ VC TOPUP API running on http://0.0.0.0:${PORT}`);
  console.log(`  📦 ${getDB().products.length} products · ${getDB().orders.length} orders · ${getDB().users.length} users\n`);
});
