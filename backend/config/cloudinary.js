// backend/config/cloudinary.js
// Cloudinary SDK configuration — scaffolded for Phase 5+ (image uploads).
// TODO Phase 5: run `npm install cloudinary` then uncomment the implementation below.

const logger = require("../utils/logger");

const connectCloudinary = () => {
  // TODO Phase 5: Uncomment after running `npm install cloudinary`
  // const cloudinary = require("cloudinary").v2;
  // cloudinary.config({
  //   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  //   api_key:    process.env.CLOUDINARY_API_KEY,
  //   api_secret: process.env.CLOUDINARY_API_SECRET,
  // });
  // logger.info("Cloudinary configured");
  // return cloudinary;

  logger.debug("Cloudinary: not yet configured (Phase 5 feature)");
  return null;
};

module.exports = connectCloudinary;
