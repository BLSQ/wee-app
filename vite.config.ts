import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  // The deployed function runs without node_modules, so the production server build
  // has to carry its dependencies. Only the build: bundling them in dev breaks the
  // module runner. See docs/adr/0014.
  // `false` is not a valid value here, only true / string / RegExp / array.
  ssr: { noExternal: command === 'build' ? true : undefined },
  // The Start plugin must come before the React plugin.
  plugins: [tanstackStart(), viteReact()],
}))
