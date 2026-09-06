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
  const slider = page.getByRole('slider', { name: /Observation/ });
  await slider.waitFor();
  assert.equal(
    await page.getByRole('button', { name: 'Play observations' }).isDisabled(),
    true,
  );
  await slider.focus();
  await page.keyboard.press('End');
  await page.getByText('Observation 11 of 11').waitFor();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page
    .getByRole('combobox', { name: 'Exchange model' })
    .selectOption('fixed');
  assert.equal(await slider.inputValue(), '0');
  await page.getByRole('tab', { name: 'Scientific', exact: true }).click();
  await page.locator('canvas').first().waitFor();
  await page.getByText('Read observation data as a table').click();
  assert.equal(await page.locator('table tbody tr').count(), 11);
  await page.screenshot({
    path: 'test-results/scientific.png',
    fullPage: true,
  });
  await page.getByRole('tab', { name: 'Compare models' }).click();
  await page.waitForFunction(
    () => document.querySelectorAll('canvas').length === 4,
  );
  await slider.focus();
  await page.keyboard.press('End');
  await page.getByText('Observation 11 of 11').waitFor();
  assert.equal(await page.getByText(/Observed at 2.5 attempts/).count(), 4);
  await page.screenshot({
    path: 'test-results/comparison.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.setViewportSize({ width: 720, height: 500 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  );
  await page.screenshot({
    path: 'test-results/large-text.png',
    fullPage: true,
  });
  await context.close();

  const failureContext = await browser.newContext();
  await failureContext.route('**/data/fixed.json', (route) =>
    route.fulfill({ status: 503, body: 'Unavailable' }),
  );
  const failure = await failureContext.newPage();
  failure.on('pageerror', (error) => errors.push(error.message));
  await failure.goto(baseURL);
  await failure.getByRole('slider').waitFor();
  await failure
    .getByRole('combobox', { name: 'Exchange model' })
    .selectOption('fixed');
  await failure.getByRole('alert').waitFor();
  await failure
    .getByRole('combobox', { name: 'Exchange model' })
    .selectOption('pair-average');
  await failure.getByRole('slider').waitFor();
  await failureContext.unroute('**/data/fixed.json');
  await failure
    .getByRole('combobox', { name: 'Exchange model' })
    .selectOption('fixed');
  await failure.getByRole('button', { name: 'Retry this model' }).click();
  await failure.getByRole('slider').waitFor();
  await failure.getByRole('button', { name: 'Play observations' }).click();
  await failure.waitForFunction(
    () => Number(document.querySelector('input[type=range]').value) > 0,
  );
  await failure.getByRole('button', { name: 'Pause observations' }).click();
  assert.deepEqual(errors, []);
  await failureContext.close();
  console.log(
    'PASS: shared time, four-model comparison, tables, model reset, reduced motion, mobile, large text, isolated failure, retry and playback; no uncaught browser errors.',
  );
} finally {
  await browser.close();
}
