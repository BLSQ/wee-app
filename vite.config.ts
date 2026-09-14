import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Nitro detects Vercel at build time and emits the matching output.
  // The Start plugin must come before the React plugin.
  plugins: [nitro(), tanstackStart(), viteReact()],
})
