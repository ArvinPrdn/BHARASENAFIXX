import { test, expect } from '@playwright/test';

test('public ballroom and health endpoint render', async ({ page, request }) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  await page.goto('/');
  await expect(page).toHaveTitle(/bharasena/i);
  await expect(page.locator('h1')).toContainText('BHARASENA');
});

test('participants can find, enlarge, and download the event maps', async ({ page, isMobile }) => {
  await page.clock.setFixedTime(new Date('2026-11-16T08:00:00+07:00'));
  await page.addInitScript(() => sessionStorage.setItem('bharasena-opened', '1'));
  await page.goto('/#info-peserta');

  const cards = page.locator('#info-peserta .envelope');
  await expect(cards).toHaveCount(5);
  if (!isMobile) {
    const rows = await cards.evaluateAll((elements) =>
      elements.map((element) => (element as HTMLElement).offsetTop),
    );
    expect(rows.slice(0, 3)).toEqual([rows[0], rows[0], rows[0]]);
    expect(rows[3]).toBeGreaterThan(rows[0]!);
    expect(rows[4]).toBe(rows[3]);
  }

  const trigger = page.getByRole('button', { name: 'Lihat denah acara' });
  await trigger.click();
  const maps = page.getByRole('dialog', { name: 'Denah acara', exact: true });
  await expect(maps.getByRole('tabpanel').getByRole('heading')).toHaveText([
    'Donor Darah',
    'Talkshow Tiga Agama',
  ]);
  await expect.poll(() => maps.getByRole('img').first().evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);

  const enlarge = maps.getByRole('button', { name: 'Perbesar denah Donor Darah' });
  await enlarge.click();
  const viewer = page.getByRole('dialog', { name: 'Donor Darah', exact: true });
  const mapImage = viewer.getByRole('img');
  const initialWidth = (await mapImage.boundingBox())!.width;
  await viewer.getByRole('button', { name: 'Perbesar gambar' }).click();
  expect((await mapImage.boundingBox())!.width).toBeGreaterThan(initialWidth);
  await viewer.getByRole('button', { name: 'Kembali ke denah' }).click();
  await expect(enlarge).toBeFocused();

  const download = page.waitForEvent('download');
  await maps.getByRole('link', { name: 'Unduh denah Donor Darah' }).click();
  expect((await download).suggestedFilename()).toBe('day-1-donor-darah.svg');

  await maps.getByRole('tab', { name: 'Day 2 12 Des' }).click();
  await expect(maps.getByRole('tabpanel')).toHaveText('Denah Day 2 sedang disiapkan panitia.');
  await maps.getByRole('tab', { name: 'Day 2 12 Des' }).press('ArrowRight');
  await expect(maps.getByRole('tabpanel')).toHaveText('Denah Day 3 sedang disiapkan panitia.');
  await maps.getByRole('button', { name: 'Tutup', exact: true }).click();
  await expect(trigger).toBeFocused();

  await page.clock.setFixedTime(new Date('2026-12-12T01:00:00+07:00'));
  await trigger.click();
  await expect(maps.getByRole('tab', { name: 'Day 2 12 Des' })).toHaveAttribute('aria-selected', 'true');
});
