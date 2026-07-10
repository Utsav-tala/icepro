// backend/services/dashboard.service.js
// Business logic for dashboard metrics using MongoDB aggregation pipelines.

const Bill = require("../models/Bill");
const Payment = require("../models/Payment");
const Agency = require("../models/Agency");
const Transaction = require("../models/Transaction");
const { getCurrentFY } = require("../utils/helpers");

// ── Get Dashboard Metrics ─────────────────────────────────────────────────────
const getDashboardMetrics = async () => {
  const now = new Date();
  
  // Create start and end of today
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  // 1. Total active agencies
  const activeAgencies = await Agency.countDocuments({ status: "active" });

  // 2. Today's Sales (total of bills created today)
  const todaySalesAgg = await Bill.aggregate([
    { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday } } },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]);
  const todaySales = todaySalesAgg[0]?.total || 0;

  // 3. Today's Collections (total of payments received today)
  const todayCollectionAgg = await Payment.aggregate([
    { $match: { createdAt: { $gte: startOfToday, $lte: endOfToday } } },
    { $group: { _id: null, total: { $sum: "$total" } } },
  ]);
  const todayCollection = todayCollectionAgg[0]?.total || 0;

  // 4. Total Outstanding (Total Billed - Total Paid across all time)
  const [totalBilledAgg, totalPaidAgg] = await Promise.all([
    Bill.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: "$total" } } }]),
  ]);
  const totalBilled = totalBilledAgg[0]?.total || 0;
  const totalPaid   = totalPaidAgg[0]?.total || 0;
  const totalOutstanding = totalBilled - totalPaid;

  // 5. Recent Transactions (last 10 across all agencies)
  const recentTransactions = await Transaction.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("agencyId", "name city");

  return {
    activeAgencies,
    todaySales,
    todayCollection,
    totalOutstanding,
    recentTransactions,
  };
};

module.exports = { getDashboardMetrics };
