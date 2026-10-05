import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  {
    ignores: [
      "build/**",
      "scripts/**",
      "src/backend/migrations/**",
      "src/_messages.ts",
      "jest.config.js",
      "eslint.config.js",
    ],
  },
  ...compat.extends("airbnb-base"),
  ...compat.extends("plugin:@typescript-eslint/recommended"),
  prettierRecommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      globals: globals.node,
      parser: tsParser,
      parserOptions: { project: ["tsconfig.json"] },
    },
    settings: {
      "import/parsers": { "@typescript-eslint/parser": [".ts"] },
      "import/resolver": { typescript: { extensions: [".js", ".ts"] } },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
      "arrow-body-style": "off",
      "max-classes-per-file": "off",
      "no-use-before-define": "off",
      "no-continue": "off",
      "no-shadow": "off",
      "no-else-return": "off",
      "prefer-arrow-callback": "off",
      "consistent-return": "off",
      "default-case": "off",
      "import/prefer-default-export": "off",
      "import/extensions": "off",
      "import/no-cycle": "off",
      "no-underscore-dangle": "off",
      "class-methods-use-this": "off",
      "no-await-in-loop": "off",
      "no-constant-condition": "off",
      "no-param-reassign": "off",
      "lines-between-class-members": "off",
      "no-nested-ternary": "off",
      "no-restricted-syntax": "off",
      "prettier/prettier": "warn",
    },
  },
  {
    files: ["**/*.test.*", "test/**/*"],
    rules: { "import/no-extraneous-dependencies": "off" },
  },
];
