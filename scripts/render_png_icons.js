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
  const svgPath = path.join(publicDir, 'favicon.svg');
  
  const sizes = [
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'apple-touch-icon-180x180.png', size: 180 },
    { name: 'apple-touch-icon-167x167.png', size: 167 },
    { name: 'apple-touch-icon-152x152.png', size: 152 },
    { name: 'apple-touch-icon-120x120.png', size: 120 },
  ];

  for (const { name, size } of sizes) {
    const page = await browser.newPage({ viewport: { width: size, height: size, deviceScaleFactor: 1 } });
    await page.goto(`file://${svgPath}`);
    await page.screenshot({ path: path.join(publicDir, name), type: 'png' });
    await page.close();
    console.log(`Saved ${name} (${size}x${size})`);
  }

  await browser.close();
  console.log('All icons generated successfully!');
}

render().catch(err => {
  console.error('Error rendering icons:', err);
  process.exit(1);
});

