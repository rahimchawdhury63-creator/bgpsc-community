import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1920, height: 1080 } },
    },

    // Responsive testing - 15 viewport widths (200px to 6000px)
    {
      name: 'responsive-200px',
      use: { viewport: { width: 200, height: 600 } },
    },
    {
      name: 'responsive-240px',
      use: { viewport: { width: 240, height: 600 } },
    },
    {
      name: 'responsive-320px',
      use: { viewport: { width: 320, height: 600 } },
    },
    {
      name: 'responsive-360px',
      use: { viewport: { width: 360, height: 640 } },
    },
    {
      name: 'responsive-390px',
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: 'responsive-414px',
      use: { viewport: { width: 414, height: 896 } },
    },
    {
      name: 'responsive-768px',
      use: { viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'responsive-834px',
      use: { viewport: { width: 834, height: 1194 } },
    },
    {
      name: 'responsive-1024px',
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: 'responsive-1280px',
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'responsive-1440px',
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'responsive-2560px',
      use: { viewport: { width: 2560, height: 1440 } },
    },
    {
      name: 'responsive-3840px',
      use: { viewport: { width: 3840, height: 2160 } },
    },
    {
      name: 'responsive-6000px',
      use: { viewport: { width: 6000, height: 4000 } },
    },

    // Mobile devices
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablet devices
    {
      name: 'tablet-chrome',
      use: { ...devices['Galaxy Tab S4'] },
    },
    {
      name: 'tablet-safari',
      use: { ...devices['iPad Pro 11'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
