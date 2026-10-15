import { test, expect } from '@playwright/test';

test('public ballroom and health endpoint render', async ({ page, request }) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  await page.goto('/');
  await expect(page).toHaveTitle(/BHARASENA/);
  await expect(page.locator('h1')).toContainText('BHARASENA');
});
