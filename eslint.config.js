import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'public/**',
      '.vercel/**',
      'coverage/**',
      '_qa/**',
      'data/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },
  {
    files: ['src/**/*.js', 'src/scripts/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/scripts/experience.js', 'src/scripts/experience.ts'],
    rules: {
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-nocheck': false }],
    },
  },
);
