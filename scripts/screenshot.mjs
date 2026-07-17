// Usage: node scripts/screenshot.mjs <url-path> <out.png> [--mobile] [--full] [--actions=file.mjs]
import { chromium } from 'playwright-core';

const [, , urlPath = '/', out = 'tmp/screenshots/shot.png', ...flags] = process.argv;
const mobile = flags.includes('--mobile');
const actionsFlag = flags.find((f) => f.startsWith('--actions='));

// Chemin du binaire Chromium: configurable pour tourner sur une autre machine
// (CHROME_BIN), avec un repli sur les emplacements Linux usuels.
const CHROME_BIN =
  process.env.CHROME_BIN || process.env.CHROMIUM_PATH || '/usr/sbin/chromium';

const browser = await chromium.launch({
  executablePath: CHROME_BIN,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=2'],
});
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
  isMobile: mobile,
  hasTouch: mobile,
  locale: 'fr-FR',
  geolocation: { latitude: 45.7602, longitude: 4.8357 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
await page.goto(`http://localhost:5173${urlPath}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

if (actionsFlag) {
  const mod = await import(new URL(actionsFlag.split('=')[1], `file://${process.cwd()}/`).href);
  await mod.default(page);
}

await page.screenshot({ path: out, fullPage: flags.includes('--full') });
await browser.close();
console.log(`saved ${out}`);
