// Unique emoji + color for each plant key in the catalog.
// Falls back to category defaults for unlisted plants.

export interface PlantIconDef {
  emoji: string;
  bg: string;
}

const ICONS: Record<string, PlantIconDef> = {
  // ── Vegetables ─────────────────────────────────────────────────────────────
  tomato:              { emoji: '🍅', bg: '#ffe3e3' },
  cherry_tomato:       { emoji: '🍒', bg: '#ffe3e3' },
  pepper:              { emoji: '🌶️', bg: '#ffe8cc' },
  serrano:             { emoji: '🌶️', bg: '#ffe8cc' },
  jalapeno:            { emoji: '🌶️', bg: '#ffe8cc' },
  anaheim:             { emoji: '🌶️', bg: '#d3f9d8' },
  pasilla:             { emoji: '🌶️', bg: '#ffe8cc' },
  ghost_pepper:        { emoji: '🌶️', bg: '#ffe3e3' },
  scotch_bonnet:       { emoji: '🌶️', bg: '#fff3bf' },
  thai_chili:          { emoji: '🌶️', bg: '#ffe3e3' },
  shishito:            { emoji: '🌶️', bg: '#d3f9d8' },
  cubanelle:           { emoji: '🌶️', bg: '#fff9db' },
  cucumber:            { emoji: '🥒', bg: '#d3f9d8' },
  bean:                { emoji: '🫘', bg: '#d3f9d8' },
  pea:                 { emoji: '🫛', bg: '#d3f9d8' },       // was 🟢
  edamame:             { emoji: '🟢', bg: '#d3f9d8' },
  lettuce:             { emoji: '🥬', bg: '#d3f9d8' },
  spinach:             { emoji: '🌿', bg: '#d3f9d8' },
  kale:                { emoji: '🥬', bg: '#c3fae8' },       // leafy, not 🥦
  cabbage:             { emoji: '🥬', bg: '#d3f9d8' },
  broccoli:            { emoji: '🥦', bg: '#d3f9d8' },
  cauliflower:         { emoji: '🤍', bg: '#f8f9fa' },
  brussels_sprouts:    { emoji: '🌱', bg: '#d3f9d8' },
  carrot:              { emoji: '🥕', bg: '#ffe8cc' },
  radish:              { emoji: '🔴', bg: '#ffe3e3' },       // was 🌰 (chestnut?)
  beet:                { emoji: '🟣', bg: '#f3d9fa' },
  parsnip:             { emoji: '🥕', bg: '#fff9db' },       // pale white root like carrot
  turnip:              { emoji: '🌰', bg: '#f5e5d0' },       // round root veg
  onion:               { emoji: '🧅', bg: '#fff9db' },
  garlic:              { emoji: '🧄', bg: '#fff9db' },
  leek:                { emoji: '🌿', bg: '#d3f9d8' },
  chive:               { emoji: '🌱', bg: '#d3f9d8' },
  eggplant:            { emoji: '🍆', bg: '#f3d9fa' },
  tomatillo:           { emoji: '🍈', bg: '#d3f9d8' },       // was 🫐 (wrong!)
  squash:              { emoji: '🟡', bg: '#fff3bf' },
  winter_squash:       { emoji: '🎃', bg: '#ffe8cc' },
  pumpkin:             { emoji: '🎃', bg: '#ffe8cc' },
  corn:                { emoji: '🌽', bg: '#fff9db' },
  potato:              { emoji: '🥔', bg: '#f5e5d0' },
  sweet_potato:        { emoji: '🍠', bg: '#ffe8cc' },
  asparagus:           { emoji: '🌱', bg: '#d3f9d8' },
  celery:              { emoji: '🌾', bg: '#d3f9d8' },       // was 🌿
  chard:               { emoji: '🌿', bg: '#d3f9d8' },
  arugula:             { emoji: '🍃', bg: '#d3f9d8' },       // was 🌿
  okra:                { emoji: '🟢', bg: '#d3f9d8' },
  kohlrabi:            { emoji: '🫑', bg: '#e0d5fa' },       // was 🫐 (blueberry?)
  endive:              { emoji: '🥬', bg: '#e8f5e9' },
  fennel:              { emoji: '🌾', bg: '#d3f9d8' },       // was 🌿
  horseradish:         { emoji: '🌿', bg: '#f0f7ee' },
  ginger:              { emoji: '🟤', bg: '#f5e5d0' },
  turmeric:            { emoji: '🟠', bg: '#ffe8cc' },
  celeriac:            { emoji: '🥔', bg: '#f5e5d0' },
  rutabaga:            { emoji: '🥔', bg: '#fff9db' },
  jicama:              { emoji: '🤍', bg: '#f8f9fa' },
  salsify:             { emoji: '🥕', bg: '#f5e5d0' },
  artichoke:           { emoji: '💚', bg: '#d3f9d8' },
  jerusalem_artichoke: { emoji: '🌻', bg: '#fff3bf' },
  collard_greens:      { emoji: '🥬', bg: '#d3f9d8' },
  bok_choy:            { emoji: '🌿', bg: '#d3f9d8' },
  watercress:          { emoji: '🍃', bg: '#c3fae8' },

  // ── Herbs ───────────────────────────────────────────────────────────────────
  basil:               { emoji: '🌿', bg: '#d3f9d8' },
  parsley:             { emoji: '🌱', bg: '#d3f9d8' },       // was 🌿
  cilantro:            { emoji: '🍃', bg: '#d3f9d8' },       // was 🌿
  dill:                { emoji: '🌾', bg: '#f5f0dc' },
  mint:                { emoji: '💚', bg: '#c3fae8' },       // was 🌿 — mint-green
  rosemary:            { emoji: '🌲', bg: '#d3f9d8' },       // was 🌿 — piney/needle-like
  thyme:               { emoji: '🍃', bg: '#d3f9d8' },       // was 🌿
  sage:                { emoji: '🌿', bg: '#dce8d4' },       // grey-green, keep 🌿
  oregano:             { emoji: '🍃', bg: '#d3f9d8' },       // was 🌿
  tarragon:            { emoji: '🌿', bg: '#d3f9d8' },
  lavender:            { emoji: '💜', bg: '#f3d9fa' },
  lemon_balm:          { emoji: '🍋', bg: '#fff9db' },
  chamomile:           { emoji: '🌼', bg: '#fff9db' },
  borage:              { emoji: '💙', bg: '#d0ebff' },
  hyssop:              { emoji: '🌸', bg: '#fce4ec' },
  lemongrass:          { emoji: '🌾', bg: '#f5f0dc' },
  stevia:              { emoji: '🍃', bg: '#d3f9d8' },
  bay:                 { emoji: '🍂', bg: '#f5e5d0' },       // was 🌿 — dried bay leaf

  // ── Flowers ─────────────────────────────────────────────────────────────────
  marigold:            { emoji: '🌼', bg: '#fff3bf' },
  nasturtium:          { emoji: '🌸', bg: '#ffe8cc' },
  sunflower:           { emoji: '🌻', bg: '#fff3bf' },
  calendula:           { emoji: '🧡', bg: '#ffe8cc' },       // was 🌸 — orange calendula
  cosmos:              { emoji: '🌸', bg: '#fce4ec' },
  zinnia:              { emoji: '🌺', bg: '#ffe3e3' },
  sweet_alyssum:       { emoji: '🤍', bg: '#f8f9fa' },

  // ── Fruits ─────────────────────────────────────────────────────────────────
  strawberry:          { emoji: '🍓', bg: '#ffe3e3' },
  raspberry:           { emoji: '🩷', bg: '#fce4ec' },       // was 🫐 (same as blueberry!)
  blueberry:           { emoji: '🫐', bg: '#e0d5fa' },
  blackberry:          { emoji: '🍇', bg: '#e0d5fa' },       // dark berry cluster
  rhubarb:             { emoji: '🌸', bg: '#fce4ec' },       // was 🩷 — pink stalks/flowers
  watermelon:          { emoji: '🍉', bg: '#d3f9d8' },
  cantaloupe:          { emoji: '🍈', bg: '#fff9db' },
  grape:               { emoji: '🍇', bg: '#f3d9fa' },
  fig:                 { emoji: '🟣', bg: '#f3d9fa' },
  apple:               { emoji: '🍎', bg: '#ffe3e3' },
  cherry:              { emoji: '🍒', bg: '#ffe3e3' },
  peach:               { emoji: '🍑', bg: '#ffe8cc' },
  plum:                { emoji: '🔵', bg: '#e0d5fa' },
  currant:             { emoji: '🔴', bg: '#ffe3e3' },
  gooseberry:          { emoji: '🍈', bg: '#d3f9d8' },

  // ── More Vegetables ─────────────────────────────────────────────────────────
  zucchini:            { emoji: '🥒', bg: '#d3f9d8' },
  snap_pea:            { emoji: '🫛', bg: '#d3f9d8' },
  shallot:             { emoji: '🧅', bg: '#f5e5d0' },
  scallion:            { emoji: '🌿', bg: '#d3f9d8' },
  napa_cabbage:        { emoji: '🥬', bg: '#e8f5e9' },
  mustard_greens:      { emoji: '🌿', bg: '#d3f9d8' },
  radicchio:           { emoji: '🔴', bg: '#fce4ec' },
  sorrel:              { emoji: '🍃', bg: '#d3f9d8' },
  mizuna:              { emoji: '🥬', bg: '#f0fff0' },
  ground_cherry:       { emoji: '🟡', bg: '#fff9db' },
  yam:                 { emoji: '🍠', bg: '#f5e5d0' },
  amaranth:            { emoji: '🌺', bg: '#fce4ec' },
  malabar_spinach:     { emoji: '🌿', bg: '#c3fae8' },

  // ── More Herbs ───────────────────────────────────────────────────────────────
  marjoram:            { emoji: '🌿', bg: '#dce8d4' },
  savory:              { emoji: '🌿', bg: '#d3f9d8' },
  shiso:               { emoji: '🍃', bg: '#f0f7ee' },
  lemon_verbena:       { emoji: '🍋', bg: '#fff9db' },
  fenugreek:           { emoji: '🌱', bg: '#d3f9d8' },
  caraway:             { emoji: '🌾', bg: '#f5f0dc' },
  catnip:              { emoji: '😺', bg: '#f3d9fa' },
  comfrey:             { emoji: '🌿', bg: '#d3f9d8' },
  bee_balm:            { emoji: '🐝', bg: '#fff3bf' },
  anise:               { emoji: '⭐', bg: '#fff9db' },

  // ── Tree Fruits & Citrus ────────────────────────────────────────────────────
  pear:                { emoji: '🍐', bg: '#f0fff0' },
  apricot:             { emoji: '🟠', bg: '#ffe8cc' },
  lemon:               { emoji: '🍋', bg: '#fff9db' },
  lime:                { emoji: '🍋‍🟩', bg: '#d3f9d8' },
  orange:              { emoji: '🍊', bg: '#ffe8cc' },
  nectarine:           { emoji: '🍑', bg: '#ffd8a8' },
  kiwi:                { emoji: '🥝', bg: '#d3f9d8' },
  pomegranate:         { emoji: '🍎', bg: '#ffe3e3' },
  elderberry:          { emoji: '🫐', bg: '#e0d5fa' },
  olive:               { emoji: '🫒', bg: '#d3f9d8' },
  mulberry:            { emoji: '🍇', bg: '#e0d5fa' },
  passion_fruit:       { emoji: '🌺', bg: '#f3d9fa' },
  persimmon:           { emoji: '🟠', bg: '#ffe8cc' },

  // ── More Flowers ────────────────────────────────────────────────────────────
  rose:                { emoji: '🌹', bg: '#fce4ec' },
  dahlia:              { emoji: '🌸', bg: '#fce4ec' },
  hollyhock:           { emoji: '🌸', bg: '#f3d9fa' },
  snapdragon:          { emoji: '🐉', bg: '#ffe8cc' },
  pansy:               { emoji: '💜', bg: '#f3d9fa' },
  dianthus:            { emoji: '🩷', bg: '#fce4ec' },
  foxglove:            { emoji: '🔔', bg: '#f3d9fa' },
  cornflower:          { emoji: '💙', bg: '#d0ebff' },
  poppy:               { emoji: '🌺', bg: '#ffe3e3' },
  sweet_pea:           { emoji: '🌸', bg: '#f8d7da' },
  echinacea:           { emoji: '🌸', bg: '#fce4ec' },
  yarrow:              { emoji: '🌼', bg: '#fff9db' },
  salvia:              { emoji: '💙', bg: '#d0ebff' },
  petunia:             { emoji: '🌸', bg: '#f8d7da' },
  black_eyed_susan:    { emoji: '🌻', bg: '#fff3bf' },
  verbena:             { emoji: '🌸', bg: '#f3d9fa' },
};

const CATEGORY_DEFAULTS: Record<string, PlantIconDef> = {
  vegetable: { emoji: '🥗', bg: '#d3f9d8' },
  herb:      { emoji: '🌿', bg: '#d3f9d8' },
  fruit:     { emoji: '🍇', bg: '#f3d9fa' },
  flower:    { emoji: '🌸', bg: '#fce4ec' },
};

export function getPlantIcon(plantName: string, category?: string): PlantIconDef {
  const key = plantName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');
  if (ICONS[key]) return ICONS[key];

  // Try partial match
  for (const [k, icon] of Object.entries(ICONS)) {
    if (key.includes(k) || k.includes(key)) return icon;
  }

  return CATEGORY_DEFAULTS[category ?? 'vegetable'] ?? { emoji: '🌱', bg: '#d3f9d8' };
}
