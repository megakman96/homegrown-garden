#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Stamp the service worker cache version so every deploy forces a new SW install
const swPath = path.join(__dirname, '../dist/sw.js');
if (fs.existsSync(swPath)) {
  const build = Date.now().toString();
  fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace('__BUILD__', build));
  console.log(`✅ Stamped SW cache version: homegrown-${build}`);
}

const htmlPath = path.join(__dirname, '../dist/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const pwa = `
  <link rel="manifest" href="/manifest.json" />
  <link rel="apple-touch-icon" href="/assets/images/apple-touch-icon.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="GardenGrid" />`;

if (!html.includes('rel="manifest"')) {
  html = html.replace('</head>', pwa + '\n</head>');
  fs.writeFileSync(htmlPath, html);
  console.log('✅ PWA tags injected into dist/index.html');
} else {
  console.log('✅ PWA tags already present');
}
