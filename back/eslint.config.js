import eslint from "@eslint/js"
import TSESLint from "typescript-eslint"
import { defineConfig } from "eslint/config"

export default defineConfig([
  {
    files: ["**/*.{ts,tsx}"],
    extends: [eslint.configs.recommended, TSESLint.configs.strictTypeChecked, TSESLint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: import.meta.dirname,
      },
      ecmaVersion: 2020,
    },
    rules: {
      "@typescript-eslint/no-confusing-void-expression": "off",
    },
  },
])
