/**
 * Downloads transparent PNG icons for each plant key from OpenMoji.
 * Run with: node scripts/download-plant-icons.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/plant-icons');

// Map each plant key to the most appropriate emoji for its icon.
// We avoid using 🥦 for non-broccoli plants.
const PLANT_EMOJI = {
  // ── Vegetables ─────────────────────────────────────────────────────────────
  tomato:              '🍅',
  cherry_tomato:       '🍅',   // same family as tomato
  pepper:              '🌶️',
  serrano:             '🌶️',
  jalapeno:            '🌶️',
  anaheim:             '🌶️',
  pasilla:             '🌶️',
  ghost_pepper:        '🌶️',
  scotch_bonnet:       '🌶️',
  thai_chili:          '🌶️',
  shishito:            '🌶️',
  cubanelle:           '🫑',   // sweet bell-type pepper
  cucumber:            '🥒',
  bean:                '🫘',
  pea:                 '🫛',
  edamame:             '🫛',   // pea pod (better than green circle)
  lettuce:             '🥬',
  spinach:             '🥬',
  kale:                '🥬',
  cabbage:             '🥬',
  broccoli:            '🥦',
  cauliflower:         '🥦',   // same family, no dedicated emoji
  brussels_sprouts:    '🌱',   // FIX: was 🥦 — sprout is closer
  carrot:              '🥕',
  radish:              '🔴',
  beet:                '🟣',
  parsnip:             '🥕',
  turnip:              '🥔',
  onion:               '🧅',
  garlic:              '🧄',
  leek:                '🧅',
  chive:               '🌱',
  eggplant:            '🍆',
  tomatillo:           '🍅',
  squash:              '🎃',
  winter_squash:       '🎃',
  pumpkin:             '🎃',
  corn:                '🌽',
  potato:              '🥔',
  sweet_potato:        '🍠',
  asparagus:           '🌱',
  celery:              '🌿',
  chard:               '🥬',
  arugula:             '🥬',
  okra:                '🫛',   // pod-shape (better than green circle)
  kohlrabi:            '🫑',
  endive:              '🥬',
  fennel:              '🌿',
  horseradish:         '🌿',
  ginger:              '🟤',
  turmeric:            '🟠',
  celeriac:            '🥔',
  rutabaga:            '🥔',
  jicama:              '🥔',
  salsify:             '🥕',
  artichoke:           '🥦',   // green, round — closest shape
  jerusalem_artichoke: '🌻',
  collard_greens:      '🥬',
  bok_choy:            '🥬',
  watercress:          '🥬',
  zucchini:            '🥒',
  snap_pea:            '🫛',
  shallot:             '🧅',
  scallion:            '🌱',
  napa_cabbage:        '🥬',
  mustard_greens:      '🥬',
  radicchio:           '🥬',
  sorrel:              '🌿',
  mizuna:              '🥬',
  ground_cherry:       '🍅',
  yam:                 '🍠',
  amaranth:            '🌺',
  malabar_spinach:     '🥬',

  // ── Herbs ───────────────────────────────────────────────────────────────────
  basil:               '🌿',
  parsley:             '🌱',
  cilantro:            '🍃',
  dill:                '🌾',
  mint:                '🌿',
  rosemary:            '🌲',
  thyme:               '🍃',
  sage:                '🌿',
  oregano:             '🍃',
  tarragon:            '🌿',
  lavender:            '💜',
  lemon_balm:          '🍋',
  chamomile:           '🌼',
  borage:              '💙',
  hyssop:              '🌸',
  lemongrass:          '🌾',
  stevia:              '🍃',
  bay:                 '🍂',
  marjoram:            '🌿',
  savory:              '🌿',
  shiso:               '🍃',
  lemon_verbena:       '🍋',
  fenugreek:           '🌱',
  caraway:             '🌾',
  catnip:              '😺',
  comfrey:             '🌿',
  bee_balm:            '🌺',
  anise:               '⭐',

  // ── Flowers ─────────────────────────────────────────────────────────────────
  marigold:            '🌼',
  nasturtium:          '🌸',
  sunflower:           '🌻',
  calendula:           '🌼',
  cosmos:              '🌸',
  zinnia:              '🌺',
  sweet_alyssum:       '🌸',
  rose:                '🌹',
  dahlia:              '🌸',
  hollyhock:           '🌸',
  snapdragon:          '🌸',
  pansy:               '💜',
  dianthus:            '🌸',
  foxglove:            '🌸',
  cornflower:          '💙',
  poppy:               '🌺',
  sweet_pea:           '🌸',
  echinacea:           '🌸',
  yarrow:              '🌼',
  salvia:              '💙',
  petunia:             '🌸',
  black_eyed_susan:    '🌻',
  verbena:             '🌸',

  // ── Fruits ─────────────────────────────────────────────────────────────────
  strawberry:          '🍓',
  raspberry:           '🍓',
  blueberry:           '🫐',
  blackberry:          '🫐',
  rhubarb:             '🌸',
  watermelon:          '🍉',
  cantaloupe:          '🍈',
  grape:               '🍇',
  fig:                 '🍇',
  apple:               '🍎',
  cherry:              '🍒',
  peach:               '🍑',
  plum:                '🍑',
  currant:             '🫐',
  gooseberry:          '🫐',
  pear:                '🍐',
  apricot:             '🍑',
  lemon:               '🍋',
  lime:                '🍋‍🟩',
  orange:              '🍊',
  nectarine:           '🍑',
  kiwi:                '🥝',
  pomegranate:         '🍎',
  elderberry:          '🫐',
  olive:               '🫒',
  mulberry:            '🍇',
  passion_fruit:       '🌺',
  persimmon:           '🍊',
};

// Convert emoji string to OpenMoji uppercase hex code
// (strips FE0F variation selectors, keeps ZWJ, joins with hyphens)
function emojiToCode(emoji) {
  const cps = [];
  for (const char of emoji) {
    const cp = char.codePointAt(0);
    if (cp === 0xFE0F) continue; // strip variation selector-16
    cps.push(cp.toString(16).toUpperCase().padStart(4, '0'));
  }
  return cps.join('-');
}

async function downloadFile(url, destPath) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  const buf = await resp.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Cache: emoji code → already-downloaded local path (avoid re-downloading)
  const cache = new Map();

  let downloaded = 0;
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  const entries = Object.entries(PLANT_EMOJI);

  for (const [key, emoji] of entries) {
    const destPath = path.join(OUT_DIR, `${key}.png`);
    if (fs.existsSync(destPath)) {
      skipped++;
      continue;
    }

    const code = emojiToCode(emoji);

    if (cache.has(code)) {
      fs.copyFileSync(cache.get(code), destPath);
      copied++;
      process.stdout.write(`  copy  ${key} (${code})\n`);
      continue;
    }

    const url = `https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/618x618/${code}.png`;

    try {
      await downloadFile(url, destPath);
      cache.set(code, destPath);
      downloaded++;
      process.stdout.write(`  ✓     ${key} (${code})\n`);
    } catch (err) {
      failed++;
      process.stdout.write(`  ✗     ${key} (${code}) — ${err.message}\n`);
    }

    // Small delay to be polite to GitHub
    await new Promise(r => setTimeout(r, 80));
  }

  console.log(`\nDone: ${downloaded} downloaded, ${copied} copied, ${skipped} already existed, ${failed} failed`);
}

main().catch(err => { console.error(err); process.exit(1); });
