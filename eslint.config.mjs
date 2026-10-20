import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

// Module boundaries (see src/modules/README.md):
// - other code reaches a module through its index, or its client-safe schema/types files
// - only app/api route files may import a module's handlers
// - only the db layer, models and repos may import mongoose
const internalLayers = ["model", "repo", "service"];
const deepModuleImports = {
  group: internalLayers.map((layer) => `@/modules/*/${layer}`),
  message: "Import another module through its index (@/modules/<name>), never its internals.",
};
const handlerImports = {
  group: ["@/modules/*/handlers"],
  message: "Only app/api route files may import module handlers.",
};
const parentImports = {
  group: ["../*"],
  message: "Use the @/ alias instead of parent-relative imports.",
};
const mongooseImport = {
  name: "mongoose",
  message: "Only src/lib/db, model.ts and repo.ts files may import mongoose.",
};

const restrictImports = ({ patterns = [], paths = [] }) => ({
  "no-restricted-imports": ["error", { patterns, paths }],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,mts}"],
    extends: [tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: restrictImports({
      patterns: [deepModuleImports, handlerImports, parentImports],
      paths: [mongooseImport],
    }),
  },
  {
    files: ["src/app/api/**/route.ts"],
    rules: restrictImports({
      patterns: [deepModuleImports, parentImports],
      paths: [mongooseImport],
    }),
  },
  {
    files: ["src/lib/db/**/*.ts", "src/modules/*/model.ts", "src/modules/*/repo.ts"],
    rules: restrictImports({ patterns: [deepModuleImports, handlerImports, parentImports] }),
  },
  {
    files: ["src/**/*.test.ts", "tests/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  prettier,
  globalIgnores([".next/**", "out/**", "build/**", "coverage/**", "next-env.d.ts"]),
]);

export default eslintConfig;
