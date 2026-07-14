// .eslintrc.js — Frontend (React)
// Extends Create React App's built-in ESLint config.
// Add project-specific overrides below as needed.
module.exports = {
  extends: ["react-app", "react-app/jest"],
  rules: {
    // Warn on console.log in production-bound code; errors are expected in catch blocks.
    // console.error/warn are allowed — CI builds treat warnings as errors, and failing the
    // deploy over legitimate catch-block logging is not a useful signal.
    "no-console": ["warn", { allow: ["error", "warn"] }],
    // Prevent unused variables (except those prefixed with _)
    "no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
  },
};
