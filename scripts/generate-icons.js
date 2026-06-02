// Generates PNG icons from an SVG using Playwright
const { chromium } = require('/tmp/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const SVG = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="512" height="512" rx="96" fill="#1b4332"/>

  <!-- Soil -->
  <ellipse cx="256" cy="370" rx="130" ry="28" fill="#40916c"/>

  <!-- Stem -->
  <path d="M256 370 Q252 300 256 220" stroke="#74c69d" stroke-width="20" stroke-linecap="round" fill="none"/>

  <!-- Left leaf -->
  <path d="M256 300 Q200 265 175 210 Q215 195 256 260" fill="#52b788"/>

  <!-- Right leaf -->
  <path d="M256 270 Q312 235 338 178 Q298 163 256 230" fill="#95d5b2"/>

  <!-- Tip bud -->
  <circle cx="256" cy="216" r="18" fill="#d8f3dc"/>
  <circle cx="256" cy="216" r="10" fill="#b7e4c7"/>

  <!-- Shine highlight -->
  <ellipse cx="340" cy="100" rx="55" ry="35" fill="rgba(255,255,255,0.07)" transform="rotate(-30 340 100)"/>
</svg>`;

const SIZES = [16, 32, 180, 192, 512];
const OUT_DIR = path.join(__dirname, '../assets/images');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  for (const size of SIZES) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`
      <html><body style="margin:0;padding:0;background:transparent">
        <div style="width:${size}px;height:${size}px">${SVG}</div>
      </body></html>
    `);
    const el = await page.$('div');
    const buf = await el.screenshot({ type: 'png', omitBackground: false });
    const name = size === 180 ? 'apple-touch-icon.png'
                 : size === 32 ? 'favicon.png'
                 : size === 16 ? 'favicon-16.png'
                 : `icon-${size}.png`;
    fs.writeFileSync(path.join(OUT_DIR, name), buf);
    console.log(`✓ ${name} (${size}x${size})`);
  }

  // Also write the main icon.png at 1024
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.setContent(`
    <html><body style="margin:0;padding:0;background:transparent">
      <div style="width:1024px;height:1024px">
        <svg width="1024" height="1024" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" rx="96" fill="#1b4332"/>
          <ellipse cx="256" cy="370" rx="130" ry="28" fill="#40916c"/>
          <path d="M256 370 Q252 300 256 220" stroke="#74c69d" stroke-width="20" stroke-linecap="round" fill="none"/>
          <path d="M256 300 Q200 265 175 210 Q215 195 256 260" fill="#52b788"/>
          <path d="M256 270 Q312 235 338 178 Q298 163 256 230" fill="#95d5b2"/>
          <circle cx="256" cy="216" r="18" fill="#d8f3dc"/>
          <circle cx="256" cy="216" r="10" fill="#b7e4c7"/>
        </svg>
      </div>
    </body></html>
  `);
  const el2 = await page.$('div');
  const buf2 = await el2.screenshot({ type: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'icon.png'), buf2);
  console.log('✓ icon.png (1024x1024)');

  await browser.close();
  console.log('\nAll icons generated in assets/images/');
})();
