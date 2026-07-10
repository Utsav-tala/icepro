// backend/.eslintrc.js — Backend (Node.js / Express)
// Applies to all JS files in the backend/ directory.
module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021,
  },
  rules: {
    // Warn on console.log — use utils/logger.js instead in production code
    "no-console": "warn",
    // Prevent unused variables (except those prefixed with _)
    "no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
    // Enforce const/let over var
    "no-var": "error",
    "prefer-const": "warn",
  },
};
