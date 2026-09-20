// scripts/render_png_icons.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

async function render() {
  const browser = await chromium.launch();
  
  // 512x512
  const page512 = await browser.newPage({ viewport: { width: 512, height: 512, deviceScaleFactor: 1 } });
  const svgPath = path.join(publicDir, 'favicon.svg');
  await page512.goto(`file://${svgPath}`);
  await page512.screenshot({ path: path.join(publicDir, 'pwa-512x512.png'), type: 'png' });
  await page512.screenshot({ path: path.join(publicDir, 'apple-touch-icon.png'), type: 'png' });
  console.log('Saved pwa-512x512.png and apple-touch-icon.png');

  // 192x192
  const page192 = await browser.newPage({ viewport: { width: 192, height: 192, deviceScaleFactor: 1 } });
  await page192.goto(`file://${svgPath}`);
  await page192.screenshot({ path: path.join(publicDir, 'pwa-192x192.png'), type: 'png' });
  console.log('Saved pwa-192x192.png');

  await browser.close();
  console.log('All icons generated successfully!');
}

render().catch(err => {
  console.error('Error rendering icons:', err);
  process.exit(1);
});
