import { defineConfig } from 'vitest/config'

// The file extension picks the environment: *.test.ts runs in Node, *.test.tsx in jsdom.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'src/**/*.test.ts',
            'data/**/*.test.ts',
            'scripts/**/*.test.ts',
            'eslint-rules/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
          setupFiles: ['./src/ui/test-setup.ts'],
        },
      },
    ],
  },
})
