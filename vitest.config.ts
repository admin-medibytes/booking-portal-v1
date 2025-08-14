import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { config } from 'dotenv'

// Load test environment variables if running tests
if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
  config({ path: '.env.test' })
}

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    globalSetup: './tests/teardown.ts',
    // Use different environments for different test types
    environmentMatchGlobs: [
      ['tests/integration/**', 'node'],
      ['tests/unit/**', 'jsdom'],
    ],
    // Configure test timeouts for database operations
    testTimeout: 30000,
    hookTimeout: 30000,
    // Pool configuration for parallel tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run integration tests sequentially to avoid DB conflicts
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})