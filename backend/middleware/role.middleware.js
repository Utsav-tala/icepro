// backend/middleware/role.middleware.js
// Role-Based Access Control middleware.
// Usage: router.delete("/agencies/:id", protect, requireRole("owner"), controller)

const ApiError = require("../utils/ApiError");

const requireRole = (...roles) => {
  return (req, res, next) => {
    // Ensure req.user exists (meaning protect middleware was used)
    if (!req.user) {
      return next(new ApiError(401, "Not authorized, no user found in request"));
    }

    // Check if user role matches one of the required roles
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, `Access denied — requires role: ${roles.join(" or ")}`));
    }
    
    next();
  };
};

module.exports = { requireRole };
