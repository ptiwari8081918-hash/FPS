/**
 * One-time migration: hash any legacy plaintext Shop.password values.
 *
 * Before this security update, Shop.password was stored as plaintext
 * (default 'jaihind', or whatever the FPS PATCH /api/shop/:shopId endpoint
 * was given). This script finds any password that is NOT already a bcrypt
 * hash and re-hashes it in place, and marks that shop mustChangePassword:
 * true so the owner is forced to pick a fresh password on next login
 * (since the plaintext value may have been exposed in old DB backups/logs).
 *
 * SAFE BY DEFAULT: running with no flags only reports what it *would* do.
 * Nothing is written until you pass --apply.
 *
 * Usage:
 *   node scripts/migratePasswords.js            # dry run, prints a report
 *   node scripts/migratePasswords.js --apply     # actually writes the hashes
 *
 * Requires MONGO_URI in the environment (server/.env), same as the app.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Shop = require('../models/Shop');

const APPLY = process.argv.includes('--apply');
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$/; // matches $2a$/$2b$/$2y$ + cost + salt

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected to MongoDB');
  console.log(APPLY ? '⚠️  RUNNING IN --apply MODE — this will write changes.' : 'ℹ️  Dry run — no changes will be written. Pass --apply to actually migrate.');

  const shops = await Shop.find({}).select('+password');
  console.log(`Found ${shops.length} shop record(s).\n`);

  let alreadyHashed = 0;
  let migrated = 0;
  let skippedNoPassword = 0;

  for (const shop of shops) {
    if (!shop.password) {
      skippedNoPassword++;
      console.log(`⚠️  ${shop.shopId}: no password set at all — skipping (will need a manual reset).`);
      continue;
    }
    if (BCRYPT_RE.test(shop.password)) {
      alreadyHashed++;
      continue;
    }

    console.log(`🔧 ${shop.shopId}: plaintext password detected — ${APPLY ? 'hashing now' : 'would hash'}.`);
    if (APPLY) {
      const hash = await bcrypt.hash(shop.password, 12);
      // Bypass the pre-save hook's isModified check being redundant — direct
      // updateOne avoids re-running full document validation on legacy docs
      // that may be missing newer required fields' defaults.
      await Shop.updateOne(
        { _id: shop._id },
        { $set: { password: hash, mustChangePassword: true } }
      );
    }
    migrated++;
  }

  console.log('\n--- Summary ---');
  console.log(`Already bcrypt-hashed: ${alreadyHashed}`);
  console.log(`${APPLY ? 'Migrated' : 'Would migrate'}: ${migrated}`);
  console.log(`Skipped (no password field): ${skippedNoPassword}`);
  if (!APPLY && migrated > 0) {
    console.log('\nRe-run with --apply to write these changes.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
