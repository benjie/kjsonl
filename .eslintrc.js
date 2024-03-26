module.exports = {
  parser: "@babel/eslint-parser",
  parserOptions: {
    sourceType: "module",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/errors",
    "plugin:import/typescript",
    "prettier",
  ],
  plugins: ["tsdoc", "simple-import-sort", "import"],
  env: {
    node: true,
    es6: true,
  },
  rules: {
    "@typescript-eslint/consistent-type-imports": "error",
    "no-confusing-arrow": 0,
    "no-else-return": 0,
    "no-underscore-dangle": 0,
    "no-restricted-syntax": 0,
    "no-await-in-loop": 0,
    "tsdoc/syntax": 2,

    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        args: "after-used",
        ignoreRestSiblings: true,
      },
    ],

    /*
     * simple-import-sort seems to be the most stable import sorting currently,
     * disable others
     */
    "simple-import-sort/imports": "error",
    "simple-import-sort/exports": "error",
    "sort-imports": "off",
    "import/order": "off",

    "import/extensions": ["error", "ignorePackages"],
    "import/no-deprecated": "warn",

    // Apply has been more optimised than spread, use whatever feels right.
    "prefer-spread": "off",

    // note you must disable the base rule as it can report incorrect errors
    "no-duplicate-imports": "off",
    "import/no-duplicates": "error",
  },
  overrides: [
    // Rules for interfaces.ts files
    {
      files: ["**/interfaces.ts"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "TSModuleDeclaration[kind='global']",
            message:
              "No `declare global` allowed in `interface.ts` files since these type-only files may not be imported by dependents, recommend adding to `index.ts` instead.",
          },
        ],
      },
    },

    // Rules for TypeScript only
    {
      files: ["*.ts"],
      parser: "@typescript-eslint/parser",
      rules: {
        "no-dupe-class-members": "off",
        "no-undef": "off",
        // This rule doesn't understand import of './js'
        "import/no-unresolved": "off",
      },
    },

    // Rules for JavaScript only
    {
      files: ["*.js", "*.jsx", "*.mjs", "*.cjs"],
      rules: {
        "tsdoc/syntax": "off",
        "import/extensions": "off",
      },
    },

    // Stricter rules for source code
    {
      files: ["*/*/src/**/*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: true,
      },
      rules: {},
    },

    // Rules for tests only
    {
      files: ["**/__tests__/**/*.{m,c,}{ts,js}"],
      rules: {
        // Disable these to enable faster test writing
        "prefer-const": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/explicit-function-return-type": "off",

        // We don't normally care about race conditions in tests
        "require-atomic-updates": "off",
      },
    },
  ],
};
