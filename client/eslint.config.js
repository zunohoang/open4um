import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    ignores: ['dist/*', 'node_modules']
  },
  eslintPluginPrettierRecommended,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite
    ],
    rules: {
      'prettier/prettier': [
        'error',
        {
          singleQuote: true, // Bắt buộc dùng nháy đơn trong JavaScript
          jsxSingleQuote: true, // Bắt buộc dùng nháy đơn trong cả JSX (thuộc tính của thẻ)
          semi: false, // Không dùng ;
          trailingComma: 'none', // không thêm , ở cuối phần tử trong danh sách
          endOfLine: 'auto' // tự động xử lý kết thúc dòng theo hệ điều hành (Windows, Unix, etc.)
        }
      ],
      'react-refresh/only-export-components': 'off'
    }
  }
])
