/**
 * Vercel Function entry point for the whole REST API.
 *
 * Any file inside `/api` becomes a Function. This one is reachable at `/api`,
 * and vercel.json rewrites every `/api/*` request to it.
 *
 * A Vercel Function must default-export a (req, res) handler. An Express app
 * IS such a function, but we wrap it explicitly so the contract is obvious
 * and so we never accidentally call app.listen() in a serverless runtime.
 */
import '../server/env.js';
import app from '../server/app.js';
import { ensureStore } from '../server/db.js';

// Cold start: load durable state from Postgres before the first request.
// Cached after the first call so warm invocations pay no cost.
let ready = null;

export default async function handler(req, res) {
  ready ||= ensureStore();
  await ready;
  return app(req, res);
}
