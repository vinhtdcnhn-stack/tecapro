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
      // Các rule "thời React Compiler" (eslint-plugin-react-hooks bản mới) bắt cả pattern
      // fetch-on-mount (`useEffect(() => { load() }, [dep])`) vốn chạy đúng trong codebase này.
      // Viết lại ~34 chỗ đang hoạt động tốt là rủi ro không tương xứng → để 'warn' (vẫn hiện,
      // không chặn `npm run lint`) cho tới khi có đợt refactor riêng.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
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
