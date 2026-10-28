#!/usr/bin/env node
/** Securely provision the first administrator in the durable production store. */
import 'dotenv/config';
import readline from 'node:readline';
import { ensureStore, isDurableStore, hashPassword, uid, transact } from '../server/db.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const original = rl._writeToOutput;
    if (hidden && process.stdin.isTTY) rl._writeToOutput = (s) => { if (s === question) process.stdout.write(s); };
    rl.question(question, (answer) => {
      if (hidden && process.stdin.isTTY) { rl._writeToOutput = original; process.stdout.write('\n'); }
      resolve(String(answer || '').trim());
    });
  });
}

try {
  if (!isDurableStore()) throw new Error('DATABASE_URL is required. Admin accounts are never created in an ephemeral demo store.');
  await ensureStore();
  const email = (process.env.ADMIN_EMAIL || await ask('Owner/admin email: ')).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || await ask('Strong admin password (min. 12 chars): ', { hidden: true });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid admin email address.');
  if (password.length < 12) throw new Error('Admin password must be at least 12 characters.');

  const result = await transact((db) => {
    db.users ||= [];
    if (db.users.some((u) => u.role === 'admin')) throw new Error('An admin already exists. Use social sign-in or password reset; refusing to create a second bootstrap admin.');
    let user = db.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      user = { id: uid('usr'), name: email.split('@')[0], email, phone: '', role: 'user', createdAt: new Date().toISOString() };
      db.users.push(user);
    }
    user.password = hashPassword(password);
    user.authProvider = 'password';
    user.role = 'admin';
    return { id: user.id, email: user.email };
  });
  console.log(`\nAdmin account provisioned: ${result.email}`);
  console.log('Sign in with the password you entered, or link Google using the same verified email.');
  rl.close();
  process.exit(0);
} catch (err) {
  console.error(`\nAdmin setup failed: ${err.message}`);
  rl.close();
  process.exit(1);
}
