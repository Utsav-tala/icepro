// backend/services/agency.service.js
// Business logic layer for agencies — no req/res awareness.
// Key design decision: outstanding balance is NEVER stored; always computed on-demand.

const Agency      = require("../models/Agency");
const Bill        = require("../models/Bill");
const Payment     = require("../models/Payment");
const Transaction = require("../models/Transaction");
const ApiError    = require("../utils/ApiError");

// ── Get all agencies ──────────────────────────────────────────────────────────
// Optionally includes computed outstanding balance for each agency.
const getAgencies = async (query = {}) => {
  const { search, status, withBalance } = query;

  const filter = {};
  if (status) filter.status = status;
  if (search) {
    filter.$or = [
      { name:  { $regex: search, $options: "i" } },
      { owner: { $regex: search, $options: "i" } },
      { city:  { $regex: search, $options: "i" } },
    ];
  }

  const agencies = await Agency.find(filter).sort({ createdAt: -1 });

  // Attach outstanding balance if requested
  if (withBalance === "true" || withBalance === true) {
    const agencyIds = agencies.map((a) => a._id);

    // Aggregate total billed per agency
    const billTotals = await Bill.aggregate([
      { $match: { agencyId: { $in: agencyIds } } },
      { $group: { _id: "$agencyId", totalBilled: { $sum: "$total" } } },
    ]);

    // Aggregate total paid per agency
    const paymentTotals = await Payment.aggregate([
      { $match: { agencyId: { $in: agencyIds } } },
      { $group: { _id: "$agencyId", totalPaid: { $sum: "$total" } } },
    ]);

    // Build lookup maps
    const billedMap  = Object.fromEntries(billTotals.map((r) => [r._id.toString(), r.totalBilled]));
    const paidMap    = Object.fromEntries(paymentTotals.map((r) => [r._id.toString(), r.totalPaid]));

    return agencies.map((a) => {
      const totalBilled = billedMap[a._id.toString()]  || 0;
      const totalPaid   = paidMap[a._id.toString()]    || 0;
      const outstanding = totalBilled - totalPaid;
      return { ...a.toObject(), outstanding };
    });
  }

  return agencies;
};

// ── Get single agency by ID ────────────────────────────────────────────────────
const getAgencyById = async (id) => {
  const agency = await Agency.findById(id);
  if (!agency) throw new ApiError(404, "Agency not found");

  // Always compute outstanding on single agency fetch
  const [billAgg, payAgg] = await Promise.all([
    Bill.aggregate([
      { $match: { agencyId: agency._id } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    Payment.aggregate([
      { $match: { agencyId: agency._id } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  const totalBilled  = billAgg[0]?.total  || 0;
  const totalPaid    = payAgg[0]?.total   || 0;
  const outstanding  = totalBilled - totalPaid;

  return { ...agency.toObject(), outstanding, totalBilled, totalPaid };
};

// ── Create agency ──────────────────────────────────────────────────────────────
const createAgency = async (data) => {
  // Check for duplicate agency name
  const existing = await Agency.findOne({
    name: { $regex: `^${data.name.trim()}$`, $options: "i" },
  });
  if (existing) {
    throw new ApiError(409, "An agency with this name already exists", [
      { field: "name", message: "Agency name must be unique" },
    ]);
  }

  const agency = await Agency.create({
    name:        data.name.trim(),
    owner:       data.owner.trim(),
    phone:       data.phone.trim(),
    city:        data.city.trim(),
    email:       data.email       || "",
    creditLimit: data.creditLimit !== undefined ? Number(data.creditLimit) : 100000,
    address:     data.address     || "",
    gst:         data.gst         || "",
    totalShops:  data.totalShops  !== undefined ? Number(data.totalShops) : 0,
    status:      "active",
  });

  return agency;
};

// ── Update agency ──────────────────────────────────────────────────────────────
const updateAgency = async (id, data) => {
  const agency = await Agency.findById(id);
  if (!agency) throw new ApiError(404, "Agency not found");

  // Check for duplicate name if name is being changed
  if (data.name && data.name.trim().toLowerCase() !== agency.name.toLowerCase()) {
    const existing = await Agency.findOne({
      _id:  { $ne: id },
      name: { $regex: `^${data.name.trim()}$`, $options: "i" },
    });
    if (existing) {
      throw new ApiError(409, "An agency with this name already exists", [
        { field: "name", message: "Agency name must be unique" },
      ]);
    }
  }

  // Apply updates only for fields that were sent
  const updatable = ["name", "owner", "phone", "city", "email", "creditLimit", "address", "gst", "totalShops"];
  updatable.forEach((field) => {
    if (data[field] !== undefined) {
      agency[field] = typeof data[field] === "string" ? data[field].trim() : data[field];
    }
  });

  await agency.save();
  return agency;
};

// ── Toggle agency active/inactive ─────────────────────────────────────────────
const toggleAgencyStatus = async (id, status) => {
  const agency = await Agency.findById(id);
  if (!agency) throw new ApiError(404, "Agency not found");

  if (!["active", "inactive"].includes(status)) {
    throw new ApiError(400, "Status must be 'active' or 'inactive'");
  }

  agency.status = status;
  await agency.save();
  return agency;
};

// ── Get agency transaction history ────────────────────────────────────────────
// Returns all bills + payments for an agency, sorted newest first.
// This replaces the Firestore `agencies/{id}/transactions` sub-collection.
const getAgencyTransactions = async (agencyId, query = {}) => {
  const agency = await Agency.findById(agencyId);
  if (!agency) throw new ApiError(404, "Agency not found");

  const { type, limit = 50, page = 1 } = query;

  const filter = { agencyId };
  if (type) filter.type = type; // "bill" or "payment"

  const skip = (Number(page) - 1) * Number(limit);

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("billId",    "billNo billType grandTotal")
      .populate("paymentId", "cashAmt bankAmt total"),
    Transaction.countDocuments(filter),
  ]);

  return {
    agency: { _id: agency._id, name: agency.name },
    transactions,
    total,
    page:  Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  };
};

module.exports = {
  getAgencies,
  getAgencyById,
  createAgency,
  updateAgency,
  toggleAgencyStatus,
  getAgencyTransactions,
};
