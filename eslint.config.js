import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Intentional `catch (err) {}` blocks that deliberately ignore the error
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    // Backend runs on Node.js — expose Node globals (process, Buffer, …)
    files: ['server/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
