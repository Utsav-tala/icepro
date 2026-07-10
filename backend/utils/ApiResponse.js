// backend/utils/ApiResponse.js
// Standard response builder for all successful API responses.
// Usage:  res.status(200).json(new ApiResponse(200, { agencies }, "Fetched successfully"))
//         res.status(201).json(new ApiResponse(201, { bill }, "Bill created"))

class ApiResponse {
  constructor(statusCode, data, message = "Success") {
    this.statusCode = statusCode;
    this.success    = statusCode < 400;
    this.message    = message;
    this.data       = data;
  }
}

module.exports = ApiResponse;
