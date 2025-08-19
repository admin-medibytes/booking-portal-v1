import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          vars: "all",
          args: "after-used",
          ignoreRestSiblings: false,
          varsIgnorePattern: "^_", // Ignores variables starting with '_'
          argsIgnorePattern: "^_", // Ignores function parameters starting with '_'
          caughtErrorsIgnorePattern: "^_", // Ignores caught errors in catch blocks starting with '_'
          destructuredArrayIgnorePattern: "^_", // Ignores destructured array elements starting with '_'
        },
      ],
    },
  },
];

export default eslintConfig;
