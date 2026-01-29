import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * Tests the Electron app end-to-end with real user interactions
 */
export default defineConfig({
  testDir: './src/tests/e2e',
  fullyParallel: false, // Run tests sequentially for Electron
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for Electron tests
  reporter: [
    ['html'],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test against different configurations
  projects: [
    {
      name: 'electron',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Run local dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
