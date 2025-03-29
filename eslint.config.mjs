import { defineConfig, globalIgnores } from 'eslint/config';
import react from 'eslint-plugin-react';
// import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
// import babelParser from '@babel/eslint-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import json from '@eslint/json';
import js from '@eslint/js';
import stylisticJs from '@stylistic/eslint-plugin-js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  // ignoring for now, many unformatted files
  // eslintPluginPrettierRecommended,
  {
    plugins: {
      json,
      '@stylistic/js': stylisticJs,
    },
  },
  {
    files: ['**/*.json'],
    language: 'json/json',
    rules: {
      'json/no-duplicate-keys': 'error',
    },
  },

  {
    files: ['**/*.js'],
    plugins: {
      js,
    },
    extends: ['js/recommended'],
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'warn',
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {
      react,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser, // causes error
        ...globals.node,
        ...globals.commonjs,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'no-async-promise-executor': 'off',
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off',
      // ignoring for now, many long lines
      // '@stylistic/js/max-len': ['error', { code: 100 }],
    },
  },
  {
    files: ['test/**/*.{js,mjs,cjs,ts}'],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
  },
  //   {
  //     extends: compat.extends('prettier', 'plugin:json/recommended'),

  //     plugins: {
  //       react,
  //       prettier,
  //     },

  //     languageOptions: {
  //       globals: {
  //         ...globals.node,
  //         // causes error:
  //         // TypeError: Key "languageOptions": Key "globals": Global "AudioWorkletGlobalScope " has leading or trailing whitespace.
  //         // ...globals.browser,
  //         ...globals.commonjs,
  //         ...globals.mocha,
  //       },

  //       parser: babelParser,
  //       ecmaVersion: 12,
  //       sourceType: 'module',

  //       parserOptions: {
  //         requireConfigFile: false,

  //         ecmaFeatures: {
  //           jsx: true,
  //           modules: true,
  //         },

  //         babelOptions: {
  //           presets: ['@babel/preset-react'],
  //         },
  //       },
  //     },
  //   },
]);
