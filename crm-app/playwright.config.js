import { defineConfig } from '@playwright/test';

// Deliberately invalid public TEST credentials. Never read .env.local in CI.
export default defineConfig({
  testDir: './tests/routing',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    reducedMotion: 'reduce',
    timezoneId: 'America/Asuncion',
    trace: 'off',
  },
  projects: [375, 768, 1440].map((width) => ({
    name: `chromium-${width}`,
    use: { viewport: { width, height: 900 } },
  })),
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort --mode test',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: 'https://routing-test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'sb_publishable_routing_test_placeholder',
    },
  },
});
