// backend/utils/ApiError.js
// Custom error class for all API errors.
// Controllers throw this; error.middleware.js catches it and serializes to JSON.
// Usage:  throw new ApiError(404, "Agency not found")
//         throw new ApiError(400, "Validation failed", [{ field: "email", message: "Required" }])

class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.message    = message;
    this.success    = false;
    this.errors     = errors;  // array of { field, message } objects for validation errors

    // Capture the stack trace (Node.js V8 engine)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

module.exports = ApiError;
