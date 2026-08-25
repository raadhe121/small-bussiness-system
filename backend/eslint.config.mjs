// @ts-check
import eslint from "@eslint/js";

export default [
  eslint.configs.recommended,
  {
    ignores: ["node_modules/**", "dist/**", "prisma/migrations/**"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        console: "readonly",
        require: "readonly",
        module: "writable",
        __dirname: "readonly",
        exports: "writable",
        Buffer: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_|^req$|^res$|^next$" }],
      "no-console": "off",
    },
  },
];
