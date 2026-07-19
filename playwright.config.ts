import { defineConfig } from '@playwright/test';

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000',
    ...(storageState ? { storageState } : {}),
  },
});
