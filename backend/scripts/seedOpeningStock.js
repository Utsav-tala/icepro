// backend/scripts/seedOpeningStock.js
// Set the OPENING stock for products that do not have one yet.
//
//   node scripts/seedOpeningStock.js                  → DRY RUN (default, writes nothing)
//   node scripts/seedOpeningStock.js --commit         → apply, 200 boxes each
//   node scripts/seedOpeningStock.js --commit --qty=50 → apply, 50 boxes each
//
// IDEMPOTENT: a product that already has an `opening` movement is SKIPPED, never
// topped up. Running this twice does not double anyone's stock. To correct a count
// after the fact, use an `adjustment` movement from the Inventory page — that is what
// it is for, and unlike a second opening it leaves an honest audit trail.
//
// It goes through inventory.service.recordMovement() rather than writing to Product
// directly, so the ledger row and the cached counter are written in the same session
// and can never disagree.

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const mongoose        = require("mongoose");
const Product         = require("../models/Product");
const StockMovement   = require("../models/StockMovement");
const inventoryService = require("../services/inventory.service");
const { STOCK_MOVEMENT_TYPES } = require("../constants");

const COMMIT = process.argv.includes("--commit");
const qtyArg = process.argv.find((a) => a.startsWith("--qty="));
const QTY    = qtyArg ? Number(qtyArg.split("=")[1]) : 200;

const SYSTEM_USER = { firstName: "System", lastName: "(opening stock)" };

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set — check backend/.env");
    process.exit(1);
  }
  if (!Number.isFinite(QTY) || QTY <= 0) {
    console.error(`--qty must be a positive number (got "${QTY}")`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);
  console.log(COMMIT
    ? `\n*** COMMIT MODE — opening stock of ${QTY} boxes WILL be written ***\n`
    : `\n*** DRY RUN — nothing will be written. Re-run with --commit to apply. ***\n`);

  const products = await Product.find({ isActive: true }).sort({ name: 1 });

  // Which products already have an opening balance? Those are left alone.
  const seeded = new Set(
    (await StockMovement.distinct("productId", { type: STOCK_MOVEMENT_TYPES.OPENING }))
      .map(String)
  );

  const todo = products.filter((p) => !seeded.has(String(p._id)));
  const skip = products.filter((p) =>  seeded.has(String(p._id)));

  console.log(`${products.length} active product(s)`);
  if (skip.length) {
    console.log(`${skip.length} already have an opening balance — SKIPPED (not topped up):`);
    skip.forEach((p) => console.log(`     ·  ${p.name}  (on hand: ${p.onHand})`));
  }
  console.log(`${todo.length} will receive an opening balance of ${QTY} boxes\n`);

  if (todo.length === 0) {
    console.log("Nothing to do.");
    await mongoose.connection.close();
    return;
  }

  if (!COMMIT) {
    todo.forEach((p) =>
      console.log(`   [dry run]  ${p.name.padEnd(42)} ${p.onHand} → ${p.onHand + QTY}`)
    );
    console.log(`\nDry run complete. Re-run with --commit to apply.`);
    await mongoose.connection.close();
    return;
  }

  let done = 0;
  let failed = 0;
  for (const p of todo) {
    try {
      const m = await inventoryService.recordMovement(
        {
          productId: p._id,
          type:      STOCK_MOVEMENT_TYPES.OPENING,
          qty:       QTY,
          notes:     `Opening stock — ${QTY} boxes`,
        },
        SYSTEM_USER
      );
      done++;
      console.log(`   ✓ ${p.name.padEnd(42)} on hand → ${m.onHandAfter}`);
    } catch (err) {
      failed++;
      console.log(`   ✗ ${p.name.padEnd(42)} FAILED: ${err.message}`);
    }
  }

  console.log(`\n──────────────────────────────────────────────────────────────`);
  console.log(`Opening stock set for ${done} product(s)${failed ? `, ${failed} failed` : ""}.`);

  const totals = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: null, onHand: { $sum: "$onHand" }, committed: { $sum: "$committed" } } },
  ]);
  const t = totals[0] || { onHand: 0, committed: 0 };
  console.log(`Total across catalogue: ${t.onHand} on hand · ${t.committed} committed · ${t.onHand - t.committed} available\n`);

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
