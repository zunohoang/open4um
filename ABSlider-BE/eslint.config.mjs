import js from "@eslint/js";
import babelParser from "@babel/eslint-parser";
import globals from "globals";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: ["dist/*", "node_modules"],
  },
  eslintPluginPrettierRecommended,
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: ["@babel/preset-typescript"],
        },
      },
      globals: globals.node,
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "prettier/prettier": [
        "error",
        {
          singleQuote: true,
          semi: false,
          trailingComma: "none",
          endOfLine: "auto",
        },
      ],
    },
  },
]);
