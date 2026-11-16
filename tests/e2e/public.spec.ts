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
  await expect(maps.locator('.letter-scroll')).toHaveCSS('animation-name', 'letter-unroll');
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

  const content = maps.locator('.letter-content');
  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const close = maps.getByRole('button', { name: 'Tutup denah acara' });
  const dayTwo = maps.getByRole('tab', { name: 'Hari 2 Sabtu, 12 Des' });
  await expect(close).toBeInViewport({ ratio: 0.99 });
  await expect(dayTwo).toBeInViewport({ ratio: 0.99 });
  await close.click();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(0);

  await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await dayTwo.click();
  await expect(maps.getByRole('tabpanel')).toHaveText('Denah Hari 2 sedang disiapkan panitia.');
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(0);
  await dayTwo.press('ArrowRight');
  await expect(maps.getByRole('tabpanel')).toHaveText('Denah Hari 3 sedang disiapkan panitia.');
  await close.click();
  await expect(trigger).toBeFocused();

  await page.clock.setFixedTime(new Date('2026-12-12T01:00:00+07:00'));
  await trigger.click();
  await expect(maps.getByRole('tab', { name: 'Hari 2 Sabtu, 12 Des' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await expect(maps).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('participant letters keep their close button available while reading', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('bharasena-opened', '1'));
  await page.goto('/#info-peserta');

  for (const [title, label] of [
    ['Tempat acara', 'Buka surat Tempat acara'],
    ['Ketentuan masuk', 'Buka surat Ketentuan masuk'],
    ['Denah parkir', 'Buka denah parkir motor dan mobil'],
    ['Busana acara', 'Buka surat Busana acara'],
  ] as const) {
    const trigger = page.getByRole('button', { name: label, exact: true });
    await trigger.click();
    const letter = page.getByRole('dialog', { name: title, exact: true });
    const content = letter.locator('.letter-content');
    const close = letter.getByRole('button', { name: /^Tutup/ });
    await expect(close).toBeFocused();
    await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBe(0);

    if (title === 'Tempat acara') {
      await expect(letter.getByRole('link', { name: /Buka di Google Maps/ })).toBeVisible();
    } else if (title === 'Ketentuan masuk') {
      await expect(letter.getByRole('link', { name: /Buka di Google Maps/ })).toBeHidden();
    } else if (title === 'Denah parkir') {
      await expect.poll(() => letter.getByRole('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
      await expect(letter.getByRole('link', { name: 'Unduh denah' }))
        .toHaveAttribute('href', 'assets/denah-parkir.svg');
      const enlarge = letter.getByRole('button', { name: 'Perbesar denah' });
      await enlarge.click();
      const viewer = page.locator('#event-map-viewer');
      await expect(viewer).toBeVisible();
      await viewer.getByRole('button', { name: 'Kembali ke denah' }).click();
      await expect(enlarge).toBeFocused();
    } else if (title === 'Busana acara') {
      const catalogueLink = letter.getByRole('button', { name: /Lihat desain baju/ });
      await catalogueLink.click();
      const catalogue = page.getByRole('dialog', { name: /Kenakan.*identitas kita/ });
      await expect(catalogue.getByRole('img')).toBeVisible();
      await catalogue.getByRole('button', { name: /Panduan busana/ }).click();
      await expect(catalogueLink).toBeFocused();
    }

    await content.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(close).toBeInViewport({ ratio: 0.99 });
    await close.click();
    await expect(letter).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test('visitors can enter, find the location, and open music on demand', async ({ page }) => {
  await page.goto('/');
  const opening = page.getByRole('dialog', { name: 'BHARASENA' });
  await opening.getByRole('button', { name: 'Buka undangan' }).click();
  await expect(opening).toBeHidden();
  const music = page.getByRole('dialog', { name: 'Lagu Budi Doremi' });
  await expect(music).toBeHidden();

  const location = page.getByRole('link', { name: /Lihat tempat acara/ });
  await location.click();
  await expect(page.getByRole('dialog', { name: 'Tempat acara' })).toBeVisible();
  await page.getByRole('button', { name: 'Tutup surat' }).click();
  await expect(location).toBeFocused();

  const listen = page.getByRole('button', { name: 'Dengarkan lagunya' });
  await listen.click();
  const close = music.getByRole('button', { name: 'Tutup pilihan lagu' });
  await music.locator('.music-panel__body').evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(close).toBeInViewport({ ratio: 0.99 });
  await close.click();
  await expect(listen).toBeFocused();
});

test('schedule opens the linked day and the relevant map', async ({ page }) => {
  await page.goto('/#penampil');
  await page.getByRole('link', { name: /Jadwal konser/ }).click();
  await expect(page.getByRole('tab', { name: /Hari 3 Minggu/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: /Hari 1 Jumat/ }).click();
  await page.getByRole('tab', { name: 'Dalam Ksatrian' }).click();
  const link = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Talkshow tiga agama', exact: true }) }).getByRole('link', { name: 'Lihat denah' });
  await link.click();
  const maps = page.getByRole('dialog', { name: 'Denah acara', exact: true });
  await expect(maps.getByRole('heading', { name: 'Talkshow Tiga Agama' })).toBeFocused();
  await maps.getByRole('button', { name: 'Tutup denah acara' }).click();
  await expect(link).toBeFocused();
});

test('gallery navigation stays within the selected day', async ({ page }) => {
  await page.route('**/api/content', (route) => route.fulfill({ json: { gallery: [
    { src: '/assets/favicon-192.png', alt: 'Foto pertama', day: 'Hari 1' },
    { src: '/assets/favicon-192.png', alt: 'Foto kedua', day: 'Hari 1' },
    { src: '/assets/favicon-192.png', alt: 'Foto ketiga', day: 'Hari 2' },
  ] } }));
  await page.goto('/galeri');
  await page.getByRole('button', { name: 'Hari 1', exact: true }).click();
  const photo = page.getByRole('button', { name: /Buka foto 2/ });
  await photo.click();
  const viewer = page.getByRole('dialog', { name: 'Foto dokumentasi BHARASENA' });
  await viewer.getByRole('button', { name: 'Foto berikutnya' }).click();
  await expect(viewer.getByRole('img', { name: 'Foto pertama' })).toBeVisible();
  await expect(viewer.getByText('1 dari 2')).toBeVisible();
  await viewer.getByRole('button', { name: 'Tutup foto' }).click();
  await expect(photo).toBeFocused();
});

test('a personal invitation can be previewed and downloaded', async ({ page }) => {
  await page.goto('/#undangan');
  const downloadButton = page.getByRole('button', { name: 'Unduh kartu' });
  await expect(downloadButton).toBeHidden();
  await page.getByLabel('Nama pada kartu').fill('Peserta Contoh');
  await page.getByRole('button', { name: 'Lihat kartu' }).click();
  await expect(page.locator('#invite-preview-name')).toHaveText('Peserta Contoh');
  const download = page.waitForEvent('download');
  await downloadButton.click();
  expect((await download).suggestedFilename()).toBe('undangan-bharasena.png');
});
