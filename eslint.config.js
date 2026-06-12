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
      // Intentional `catch (err) {}` blocks that deliberately ignore the error;
      // ignoreRestSiblings cho phép idiom tách-bỏ field qua rest: `const { x: _omit, ...rest } = obj`
      'no-unused-vars': ['error', { caughtErrors: 'none', ignoreRestSiblings: true }],
      // Mọi rule react-hooks giữ mặc định (error). Các trường hợp hợp lệ (loader async,
      // bật cờ loading rồi fetch, đồng bộ state từ prop, deep-link, mapper ngoài deps) đã được
      // vô hiệu hoá có chủ đích kèm lý do tại từng chỗ bằng eslint-disable.
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
