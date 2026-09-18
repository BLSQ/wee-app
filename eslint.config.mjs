import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { localRules } from './eslint-rules/index.mjs'

export default tseslint.config(
  { ignores: ['dist', '.output', '.vercel', '.tanstack', '.claude', 'src/routeTree.gen.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { local: localRules },
    rules: {
      'local/no-cross-feature-import': 'error',
      'local/no-browser-server-import': 'error',
    },
  },
)
