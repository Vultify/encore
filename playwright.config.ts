import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  outputDir: 'test-results',
  reporter: 'list',
  workers: 1
})
