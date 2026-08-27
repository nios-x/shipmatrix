import { chromium } from 'playwright';

const url = 'http://localhost:8098';
const errors = [];
const consoleMsgs = [];

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  const text = msg.text();
  consoleMsgs.push(`[${msg.type()}] ${text}`);
  if (msg.type() === 'error') errors.push(text);
});
page.on('pageerror', (err) => {
  errors.push(`PAGEERROR: ${err.message}\n${err.stack}`);
});

async function snap(label) {
  await page.screenshot({ path: `.debug-screens/${label}.png` }).catch(() => {});
  console.log(`--- SNAP: ${label} ---`);
  console.log('URL:', page.url());
}

async function report() {
  if (errors.length > 0) {
    console.log('\n=== ERRORS SO FAR ===');
    errors.forEach((e) => console.log(e, '\n---'));
  }
}

try {
  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await snap('01-initial');
  await report();

  // Dump body text to see what screen we're on
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log('BODY TEXT:', bodyText);

  await page.waitForTimeout(2000);
  await snap('02-after-wait');
  await report();
} catch (e) {
  console.log('SCRIPT ERROR:', e.message);
} finally {
  console.log('\n=== ALL CONSOLE MESSAGES ===');
  consoleMsgs.forEach((m) => console.log(m));
  await browser.close();
}
