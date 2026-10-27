#!/usr/bin/env node
/** Browse real Shop2Topup category and diamond item IDs from the CLI. */
import 'dotenv/config';
import { getCatalog } from '../server/shop2topup.js';
import { shop2topupConfig } from '../server/config.js';

const arg = process.argv.find((a) => a.startsWith('--category='));
const cfg = shop2topupConfig();
const categoryId = arg ? arg.split('=').slice(1).join('=') : (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : cfg.categoryId);

try {
  const data = await getCatalog(categoryId);
  if (!categoryId) {
    console.log('\nBig categories (use --category=<ID> to list items):');
    for (const c of data.bigCategories) console.log(`  ${String(c.id).padEnd(8)} ${c.name}`);
    if (data.categories.length) {
      console.log('\nCategories:');
      for (const c of data.categories) console.log(`  ${String(c.id).padEnd(8)} ${c.name}  [big=${c.bigCategoryId || '-'}]`);
    }
  } else {
    console.log(`\nCategory ${categoryId} — ${data.items.length} items`);
    for (const item of data.items) {
      const price = Number.isFinite(item.unitPrice) ? `${item.unitPrice.toFixed(6)} ${item.currency}` : 'price unavailable';
      console.log(`  ${String(item.id).padEnd(8)} ${price.padEnd(18)} ${item.name}${item.available ? '' : '  (unavailable)'}`);
    }
    if (data.requirements.length) {
      console.log('\nRequirements:');
      for (const r of data.requirements) console.log(`  ${r.field_name || r.name || r.key}${r.required ? ' *' : ''}`);
    }
  }
  console.log('\nMap these numeric IDs in Admin → Real integrations (or SHOP2TOPUP_ITEM_MAP).\n');
} catch (err) {
  console.error(`\nCould not load provider catalogue: ${err.message}`);
  console.error('Check SHOP2TOPUP_API_KEY, IP allowlist, and SHOP2TOPUP_BASE_URL.\n');
  process.exitCode = 1;
}
