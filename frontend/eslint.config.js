// @ts-check
import eslint from "@eslint/js";

export default [
  eslint.configs.recommended,
  {
    ignores: ["node_modules/**", "dist/**"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        fetch: "readonly",
        FormData: "readonly",
        alert: "readonly",
      },
    },
    settings: { react: { version: "18" } },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
