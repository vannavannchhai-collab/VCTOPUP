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
import app from '../server/app.js';

export default function handler(req, res) {
  return app(req, res);
}
