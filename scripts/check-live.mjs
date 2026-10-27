#!/usr/bin/env node
/** Print the live readiness report; with --probe, test the real provider account. */
import 'dotenv/config';
import { integrationStatus, partnerConfig } from '../server/config.js';
import { testConnection } from '../server/shop2topup.js';

const status = integrationStatus();
console.log('\nVC TOPUP live readiness');
console.log('────────────────────────────────────────────────────────');
console.log(`mode              ${status.mode}`);
console.log(`provider          ${status.providerLabel}`);
console.log(`Bakong base       ${status.bakongBase}`);
console.log(`webhook           ${status.webhookUrl || '(not configured)'}`);
console.log(`signature header  ${status.webhookSignatureHeader}`);
console.log(`real SKUs         ${status.skuCoverage.mapped}/${status.skuCoverage.total}`);
if (status.skuMapError) console.log(`SKU map error     ${status.skuMapError}`);
console.log('\nchecks');
for (const [key, ok] of Object.entries(status.checks)) console.log(`  ${ok ? '✓' : '✗'} ${key}`);
console.log(`\nready             ${status.ready ? 'YES' : 'NO'}`);
if (status.blockers.length) console.log(`blockers          ${status.blockers.join(', ')}`);
if (status.mode !== 'live') console.log('note              PAYMENT_MODE is sandbox — no real money or diamonds are used.');
if (status.skuCoverage.missing.length) {
  console.log('\nfirst unmapped packages');
  for (const m of status.skuCoverage.missing) console.log(`  - ${m.product} / ${m.label}  [${m.slug}:${m.packageId}]`);
}

if (process.argv.includes('--probe')) {
  console.log('\nprovider account probe');
  if (partnerConfig().provider !== 'shop2topup') {
    console.log('  Remote probe is available for Shop2Topup only.');
  } else {
    const r = await testConnection();
    console.log(`  reachable       ${r.reachable ? 'YES' : 'NO'}`);
    if (r.account) {
      console.log(`  account         ${r.account.name || r.account.email || r.account.id || '(unnamed)'}`);
      console.log(`  balance         ${r.account.balance ?? '(unknown)'} ${r.account.currency || ''}`);
      console.log(`  funded          ${r.funded === null ? '(unknown)' : r.funded ? 'YES' : 'NO'}`);
    }
    if (r.reason) console.log(`  reason          ${r.reason}`);
  }
}
console.log('');
process.exitCode = status.ready ? 0 : 1;
