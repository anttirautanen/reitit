import eslint from "@eslint/js"
import TSESLint from "typescript-eslint"
import perfectionist from "eslint-plugin-perfectionist"

export default TSESLint.config([
  {
    ignores: ["**/*.js"],
  },
  eslint.configs.recommended,
  TSESLint.configs.strictTypeChecked,
  TSESLint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  perfectionist.configs["recommended-natural"],
])
