// Flat ESLint config for the MediFlow monorepo.
// - Backend (Node, ESM): security-focused linting via eslint-plugin-security.
// - Frontend (Vue 3, browser): eslint-plugin-vue recommended rules.
import js from '@eslint/js';
import globals from 'globals';
import security from 'eslint-plugin-security';
import pluginVue from 'eslint-plugin-vue';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'frontend/dist/**',
      'frontend/.vite/**',
      '**/*.min.js',
    ],
  },

  js.configs.recommended,

  // Backend: Node.js ES modules with security rules.
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    plugins: { security },
    rules: {
      ...security.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Object-injection guard is noisy on validated DB params; keep as a warning.
      'security/detect-object-injection': 'off',
    },
  },

  // Frontend: Vue 3 single-file components in the browser.
  // 'flat/essential' = correctness / error-prevention rules (no stylistic noise).
  ...pluginVue.configs['flat/essential'],
  {
    files: ['frontend/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // Test files also use Node globals.
  {
    files: ['**/*.test.js'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Node-context tooling: build config and the Playwright E2E harness run under Node,
  // not in the browser, so they use Node globals (process, etc.). Placed last so it
  // overrides the browser globals the frontend block gives frontend/vite.config.js.
  {
    files: ['*.config.js', 'frontend/vite.config.js', 'e2e/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // Ops security/governance scripts (Node ESM modules) run under Node and use
  // Node globals (process, etc.). Mirrors the Node-context block above.
  {
    files: ['ops/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
];
