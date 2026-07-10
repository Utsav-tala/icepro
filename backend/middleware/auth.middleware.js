// backend/middleware/auth.middleware.js
// JWT verification middleware.
// Verifies the Authorization: Bearer <token> header,
// decodes the JWT, and attaches req.user to the request.

const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new ApiError(401, "Not authorized, no token provided");
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user and attach to request
    req.user = await User.findById(decoded._id).select("-password");

    if (!req.user) {
      throw new ApiError(401, "Not authorized, user not found");
    }
    
    // Check if user is active
    if (req.user.status === "inactive") {
      throw new ApiError(401, "Not authorized, user account is inactive");
    }

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect };
