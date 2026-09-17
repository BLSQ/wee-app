import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // The Start plugin must come before the React plugin.
  plugins: [tanstackStart(), viteReact()],
})
