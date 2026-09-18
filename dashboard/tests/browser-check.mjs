// Optional browser regression check. Use an installed Playwright or set PLAYWRIGHT_MODULE.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const moduleName = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(
  moduleName ? pathToFileURL(moduleName).href : 'playwright'
);
const baseURL = process.env.DASHBOARD_URL ?? 'http://localhost:3000';
await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByLabel('Wealth pyramid plate', { exact: true }).waitFor();
  assert.equal(await page.getByRole('slider').count(), 0);
  assert.equal(await page.locator('.pyramid-graphic').count(), 1);
  assert.ok((await page.locator('.pyramid-band').count()) > 10);
  // Both wings carry the same dot budget, so an equal ending would mirror.
  assert.deepEqual(
    await page.evaluate(() =>
      ['#46ffd9', '#ccff33'].map(
        (fill) =>
          document.querySelectorAll(`.pyramid-band circle[fill="${fill}"]`)
            .length,
      ),
    ),
    [400, 400],
  );
  assert.equal(await page.locator('.wealth-lorenz-graphic').count(), 1);
  assert.equal(await page.locator('[data-point="poor"]').count(), 1);
  assert.equal(await page.locator('[data-point="rich"]').count(), 1);
  assert.match(await page.locator('#wealth-title').innerText(), /^\d+%/);
  await page.getByRole('tab', { name: 'Diagnostics', exact: true }).click();
  const slider = page.getByRole('slider', { name: /Observation/ });
  await slider.waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Play observations' }).isDisabled(),
    true,
  );
  await slider.focus();
  await page.keyboard.press('End');
  await page.getByText('Observation 11 of 11').waitFor();
  await page
    .getByRole('button', { name: 'Open data and notes', exact: true })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('combobox', { name: 'Data section' })
    .selectOption('metrics');
  assert.equal(await dialog.locator('table tbody tr').count(), 3);
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByText(/Observation 2/).waitFor();
  await page.keyboard.press('Escape');
  await page
    .getByRole('combobox', { name: 'Exchange rule' })
    .selectOption('fixed');
  assert.equal(await slider.inputValue(), '0');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1366, height: 768 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    for (const tab of [
      'Wealth shares',
      'Distribution',
      'Diagnostics',
      'Compare',
    ]) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      if (tab !== 'Wealth shares')
        await page.locator('canvas:visible').first().waitFor();
      await page.waitForTimeout(150);
      const fit = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth <= innerWidth,
        tabs: [...document.querySelectorAll('[data-slot="tabs-list"]')].every(
          (e) =>
            e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
        ),
        plots: [...document.querySelectorAll('.wealth-edition, .chart-surface')]
          .filter((e) => e.getBoundingClientRect().width)
          .every((e) => {
            const r = e.getBoundingClientRect();
            return r.height >= 180 && r.width <= innerWidth;
          }),
        equalColumns: [...document.querySelectorAll('.analysis-grid')]
          .filter((grid) => grid.getBoundingClientRect().width)
          .every((grid) => {
            const [chart, information] = grid.children;
            return (
              chart &&
              information &&
              Math.abs(
                chart.getBoundingClientRect().width -
                  information.getBoundingClientRect().width,
              ) < 1
            );
          }),
      }));
      assert.deepEqual(
        fit,
        { page: true, tabs: true, plots: true, equalColumns: true },
        `${viewport.width}x${viewport.height} ${tab}`,
      );
      if (tab === 'Distribution')
        assert.equal(await page.locator('.analysis-chapter').count(), 4);
      if (tab === 'Diagnostics')
        assert.equal(await page.locator('.analysis-chapter').count(), 6);
      await page.screenshot({
        path: `test-results/fit-${viewport.width}-${tab.split(' ')[0]}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('tab', { name: 'Compare' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('canvas').length === 4,
  );
  await slider.focus();
  await page.keyboard.press('End');
  assert.equal(await page.getByText(/Observed at 2.5 attempts/).count(), 4);
  await context.close();

  const failureContext = await browser.newContext();
  await failureContext.route('**/data/fixed.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  const failure = await failureContext.newPage();
  failure.on('pageerror', (error) => errors.push(error.message));
  await failure.goto(baseURL);
  await failure
    .getByLabel('Wealth pyramid plate', { exact: true })
    .waitFor();
  await failure
    .getByRole('combobox', { name: 'Exchange rule' })
    .selectOption('fixed');
  await failure.getByRole('alert').waitFor();
  await failure
    .getByRole('combobox', { name: 'Exchange rule' })
    .selectOption('pair-average');
  await failure
    .getByLabel('Wealth pyramid plate', { exact: true })
    .waitFor();
  await failureContext.unroute('**/data/fixed.json');
  await failure
    .getByRole('combobox', { name: 'Exchange rule' })
    .selectOption('fixed');
  await failure.getByRole('button', { name: 'Retry this model' }).click();
  await failure
    .getByLabel('Wealth pyramid plate', { exact: true })
    .waitFor();
  await failure.getByRole('tab', { name: 'Distribution', exact: true }).click();
  await failure.getByRole('slider').waitFor();
  await failure.getByRole('button', { name: 'Play observations' }).click();
  await failure.waitForFunction(
    () => Number(document.querySelector('input[type=range]').value) > 0,
  );
  await failure.getByRole('button', { name: 'Pause observations' }).click();
  assert.deepEqual(errors, []);
  await failureContext.close();
  console.log(
    'PASS: wealth pyramid plate, viewport fit, scrollbar-free tabs, shared time, comparison, paginated data, model reset, reduced motion, independent failure and retry; no uncaught browser errors.',
  );
} finally {
  await browser.close();
}
