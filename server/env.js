/**
 * Load a local .env file before any other server module reads process.env.
 *
 * Vercel injects Environment Variables directly, so this is a no-op there.
 * `.env` and `.env.local` are git-ignored and must NEVER contain demo values
 * when PAYMENT_MODE=live.
 */
import 'dotenv/config';
