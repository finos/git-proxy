// @ts-check
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';
import react from 'eslint-plugin-react';
import json from '@eslint/json';
import cypress from 'eslint-plugin-cypress';
import prettierConfig from 'eslint-config-prettier/flat';

// paths shouldn't start with ./

const gitignorePath = fileURLToPath(
  new URL(
    '.gitignore',
    // @ts-expect-error ts doesn't respect this file as a module, can ignore
    import.meta.url,
  ),
);

export default defineConfig(
  includeIgnoreFile(gitignorePath, 'Imported .gitignore patterns'),
  {
    name: 'ignores',
    ignores: [
      // generated files we don't control
      '**/package-lock.json',
      'src/config/generated/**',
      // has it's own eslint
      'experimental/license-inventory',
      // vendored code we're not changing
      'src/ui/assets/js/**',
      'src/ui/assets/css/**',
    ],
  },

  {
    name: 'JSON',
    files: ['**/*.json'],
    plugins: { json },
    extends: [json.configs.recommended],
    language: 'json/json',
  },

  {
    name: 'JSON - proxy.config.json override',
    files: ['**/proxy.config.json'],
    // allow empty keys in proxy.config.json for now
    rules: { 'json/no-empty-keys': 'off' },
  },

  // attempt at accurately linting each "type" of code we have
  // much of this can be consolidated going forward, or split out in
  // the case of the frontend
  {
    name: 'JS',
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: { js },
    extends: [js.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
        // allow commonjs during the migration
        ...globals.commonjs,
      },
    },
    rules: { 'no-unused-vars': 'warn', 'no-undef': 'warn', 'guard-for-in': 'error' },
  },

  {
    name: 'TS',
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { '@typescript-eslint': ts.plugin },
    extends: [ts.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      'no-async-promise-executor': 'warn', // to resolve and return to default
      '@typescript-eslint/no-explicit-any': 'off', // temporary until TS refactor is complete
      // '@typescript-eslint/no-unused-vars': 'off', // temporary until TS refactor is complete
      // "no-unused-vars": 'off',
      '@typescript-eslint/no-unused-vars': [
        // TODO: increase this to error
        'off',
        {
          // allow ignoring/skipping a var with a _ prefix
          // also allow for `...otherStuff` syntax, particularly common in react
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/no-require-imports': 'off', // prevents error on old "require" imports
    },
  },

  {
    name: 'JS minus type checking',
    // disable type-aware linting on JS files
    files: ['**/*.js'],
    extends: [ts.configs.disableTypeChecked],
  },

  // web/react content
  {
    name: 'web/react',
    files: [
      'src/ui/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      // TODO: split website into separate linting
      'website/src/**/*.{js,jsx,mjs,cjs,ts,tsx}',
    ],
    plugins: { react },
    extends: [react.configs.flat.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.commonjs } },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off',
    },
  },

  // tests
  {
    name: 'tests',
    files: ['**/*.test.{js,mjs,cjs}'],
    languageOptions: {
      // allow global functions e.g. describe, it, expect, etc.
      // from mocha and chai in tests
      globals: { ...globals.mocha, ...globals.chai },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        // TODO: increase to 'error'
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          // same as rule above but exclude unused error vars in try catch for
          // now due to many warnings in tests
          caughtErrors: 'none',
        },
      ],
      // allow for chai `expect().to.xyz`
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  // cypress e2e tests
  {
    name: 'cypress',
    files: ['cypress/**/*.{js,mjs,cjs,ts}'],
    extends: [cypress.configs.recommended],
    rules: {
      // TODO: fix and remove 'warn' override
      'cypress/unsafe-to-chain-command': 'warn',
    },
  },

  // disables rules which prettier controls
  // https://prettier.io/docs/integrating-with-linters
  prettierConfig,
);
