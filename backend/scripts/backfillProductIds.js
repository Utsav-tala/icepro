// backend/scripts/backfillProductIds.js
// ONE-TIME migration to prepare existing data for the inventory module.
//
//   node scripts/backfillProductIds.js            → DRY RUN (default, writes nothing)
//   node scripts/backfillProductIds.js --commit   → actually apply the changes
//
// It does three things:
//   1. Swaps Bill's plain-unique `billNo_1` index for a PARTIAL unique index, so that
//      pending bills (which have no invoice number yet) don't collide with each other.
//      Mongoose will not do this swap for you — a plain unique index already exists in
//      the database and would silently keep enforcing the old rule.
//   2. Stamps status: "delivered" on every existing bill. They are all real, shipped
//      invoices; the schema default covers new documents but does not rewrite old ones.
//   3. Backfills items[].productId by matching the line's free-text `name` against the
//      Product catalog (case-insensitive, whitespace-normalized).
//
// ── What it deliberately does NOT do ─────────────────────────────────────────
// It writes NO StockMovement rows and touches NO stock counters. Historical bills do
// not retroactively drain inventory — your real stock count starts from today, entered
// as `opening` movements on the Inventory page. Backfilling productId only means that
// IF you ever look at an old bill, its lines point at the right catalog entries.
//
// Line items whose name matches no product (renamed or deleted since) are left with
// productId: null and reported at the end. That is intentional — guessing at a match
// would be worse than leaving it honest and empty. A null productId simply moves no stock.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const mongoose = require("mongoose");
const Bill     = require("../models/Bill");
const Product  = require("../models/Product");
const { BILL_STATUS } = require("../constants");

const COMMIT = process.argv.includes("--commit");

// Same normalization on both sides of the match: trim, collapse inner whitespace, lowercase.
const normalize = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

const log = (...args) => console.log(...args);

// ── Step 1: swap the billNo index ─────────────────────────────────────────────
const swapBillNoIndex = async () => {
  log("\n── Step 1: billNo index ──────────────────────────────────────");

  const indexes = await Bill.collection.indexes();
  const existing = indexes.find((i) => i.name === "billNo_1");

  if (existing?.partialFilterExpression) {
    log("   ✓ Partial unique index already in place — nothing to do.");
    return;
  }

  if (!existing) {
    log("   • No billNo_1 index found (fresh database).");
  } else {
    log("   • Found the old PLAIN unique index on billNo. It must be dropped:");
    log("     with it in place, the second pending bill would be rejected as a");
    log("     duplicate, because MongoDB treats two missing billNo values as equal.");
  }

  if (!COMMIT) {
    log("   [dry run] would drop billNo_1 and recreate it as a partial unique index");
    return;
  }

  if (existing) {
    await Bill.collection.dropIndex("billNo_1");
    log("   ✓ Dropped old billNo_1");
  }

  await Bill.collection.createIndex(
    { billNo: 1 },
    { unique: true, partialFilterExpression: { billNo: { $type: "string" } } }
  );
  log("   ✓ Created partial unique index (unique only among bills that HAVE a billNo)");
};

// ── Step 2: stamp status on existing bills ────────────────────────────────────
const stampStatus = async () => {
  log("\n── Step 2: bill status ───────────────────────────────────────");

  const missing = await Bill.countDocuments({ status: { $exists: false } });

  if (missing === 0) {
    log("   ✓ Every bill already has a status — nothing to do.");
    return;
  }

  log(`   • ${missing} existing bill(s) have no status field.`);
  log(`     All of them are real, shipped invoices → status: "${BILL_STATUS.DELIVERED}"`);

  if (!COMMIT) {
    log("   [dry run] would stamp them as delivered");
    return;
  }

  const res = await Bill.updateMany(
    { status: { $exists: false } },
    { $set: { status: BILL_STATUS.DELIVERED, revision: 0 } }
  );
  log(`   ✓ Updated ${res.modifiedCount} bill(s)`);
};

// ── Step 3: backfill items[].productId ────────────────────────────────────────
const backfillProductIds = async () => {
  log("\n── Step 3: backfill items[].productId ────────────────────────");

  // Include inactive products — an old bill may well reference a since-retired product,
  // and pointing at the retired catalog entry is still more correct than pointing at nothing.
  const products = await Product.find({}).select("_id name").lean();
  const byName = new Map(products.map((p) => [normalize(p.name), p._id]));
  log(`   • Loaded ${products.length} product(s) from the catalog`);

  const bills = await Bill.find({}).select("_id billNo items").lean();
  log(`   • Scanning ${bills.length} bill(s)`);

  const ops = [];
  const unmatched = new Map();   // normalized name → count of line items
  let matchedLines = 0;
  let alreadyLinked = 0;

  for (const bill of bills) {
    let billChanged = false;
    const items = (bill.items || []).map((item) => {
      if (item.productId) {
        alreadyLinked++;
        return item;
      }

      const productId = byName.get(normalize(item.name));
      if (!productId) {
        const key = normalize(item.name);
        unmatched.set(key, (unmatched.get(key) || 0) + 1);
        return item;                       // left null on purpose — moves no stock
      }

      matchedLines++;
      billChanged = true;
      return { ...item, productId };
    });

    if (billChanged) {
      ops.push({
        updateOne: { filter: { _id: bill._id }, update: { $set: { items } } },
      });
    }
  }

  log(`   • ${matchedLines} line item(s) matched to a product`);
  log(`   • ${alreadyLinked} line item(s) already linked (skipped)`);
  log(`   • ${ops.length} bill(s) need updating`);

  if (unmatched.size > 0) {
    const totalUnmatched = [...unmatched.values()].reduce((a, b) => a + b, 0);
    log(`\n   ⚠️  ${totalUnmatched} line item(s) across ${unmatched.size} distinct name(s)`);
    log("      matched NO product in the catalog. Left as productId: null — they will");
    log("      move no stock. Most likely renamed or deleted products:\n");
    [...unmatched.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, count]) => log(`        ${String(count).padStart(4)} ×  "${name}"`));
    log("");
  }

  if (!COMMIT) {
    log(`   [dry run] would update ${ops.length} bill(s)`);
    return;
  }

  if (ops.length === 0) {
    log("   ✓ Nothing to write.");
    return;
  }

  const res = await Bill.bulkWrite(ops, { ordered: false });
  log(`   ✓ Updated ${res.modifiedCount} bill(s)`);
};

// ── Main ──────────────────────────────────────────────────────────────────────
const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set — check backend/.env");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  log(`Connected to MongoDB (${mongoose.connection.name})`);
  log(COMMIT
    ? "\n*** COMMIT MODE — changes WILL be written ***"
    : "\n*** DRY RUN — nothing will be written. Re-run with --commit to apply. ***");

  try {
    await swapBillNoIndex();
    await stampStatus();
    await backfillProductIds();

    log("\n──────────────────────────────────────────────────────────────");
    log(COMMIT
      ? "Migration complete."
      : "Dry run complete. Re-run with --commit to apply these changes.");
    log("");
  } finally {
    await mongoose.connection.close();
  }
};

run().catch((err) => {
  console.error("\nMigration failed:", err.message);
  process.exit(1);
});
