import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const url = process.argv[2] || 'http://localhost:4058/portfolio';
  console.log(`Navigating to ${url}...`);

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: '/home/coder/mobula-api/apps/mtt/current-portfolio.png',
    fullPage: false
  });

  console.log('Screenshot saved to current-portfolio.png');
  await browser.close();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
