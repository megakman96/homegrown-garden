// Default emoji + color for each plant key in the catalog.
// Falls back to category defaults for unlisted plants.

export interface PlantIconDef {
  emoji: string;
  bg: string;   // background color
}

const ICONS: Record<string, PlantIconDef> = {
  // Vegetables
  tomato:           { emoji: '🍅', bg: '#ffe3e3' },
  pepper:           { emoji: '🌶️', bg: '#ffe8cc' },
  cucumber:         { emoji: '🥒', bg: '#d3f9d8' },
  bean:             { emoji: '🫘', bg: '#d3f9d8' },
  pea:              { emoji: '🟢', bg: '#d3f9d8' },
  lettuce:          { emoji: '🥬', bg: '#d3f9d8' },
  spinach:          { emoji: '🌿', bg: '#d3f9d8' },
  kale:             { emoji: '🥦', bg: '#d3f9d8' },
  cabbage:          { emoji: '🥬', bg: '#d3f9d8' },
  broccoli:         { emoji: '🥦', bg: '#d3f9d8' },
  cauliflower:      { emoji: '🤍', bg: '#f8f9fa' },
  brussels_sprouts: { emoji: '🥦', bg: '#d3f9d8' },
  carrot:           { emoji: '🥕', bg: '#ffe8cc' },
  radish:           { emoji: '🌰', bg: '#ffe3e3' },
  beet:             { emoji: '🟣', bg: '#f3d9fa' },
  parsnip:          { emoji: '🤍', bg: '#fff9db' },
  turnip:           { emoji: '🪻', bg: '#f3d9fa' },
  onion:            { emoji: '🧅', bg: '#fff9db' },
  garlic:           { emoji: '🧄', bg: '#fff9db' },
  leek:             { emoji: '🌱', bg: '#d3f9d8' },
  chive:            { emoji: '🌱', bg: '#d3f9d8' },
  eggplant:         { emoji: '🍆', bg: '#f3d9fa' },
  tomatillo:        { emoji: '🫐', bg: '#d3f9d8' },
  squash:           { emoji: '🟡', bg: '#fff3bf' },
  winter_squash:    { emoji: '🎃', bg: '#ffe8cc' },
  pumpkin:          { emoji: '🎃', bg: '#ffe8cc' },
  corn:             { emoji: '🌽', bg: '#fff9db' },
  potato:           { emoji: '🥔', bg: '#f5e5d0' },
  sweet_potato:     { emoji: '🍠', bg: '#ffe8cc' },
  asparagus:        { emoji: '🌱', bg: '#d3f9d8' },
  celery:           { emoji: '🌿', bg: '#d3f9d8' },
  chard:            { emoji: '🥬', bg: '#d3f9d8' },
  arugula:          { emoji: '🌿', bg: '#d3f9d8' },
  okra:             { emoji: '🟢', bg: '#d3f9d8' },
  kohlrabi:         { emoji: '🫐', bg: '#e0d5fa' },
  endive:           { emoji: '🥬', bg: '#e8f5e9' },
  fennel:           { emoji: '🌿', bg: '#d3f9d8' },

  // Herbs
  basil:            { emoji: '🌿', bg: '#d3f9d8' },
  parsley:          { emoji: '🌿', bg: '#d3f9d8' },
  cilantro:         { emoji: '🌿', bg: '#d3f9d8' },
  dill:             { emoji: '🌾', bg: '#f5f0dc' },
  mint:             { emoji: '🌿', bg: '#c3fae8' },
  rosemary:         { emoji: '🌿', bg: '#d3f9d8' },
  thyme:            { emoji: '🌿', bg: '#d3f9d8' },
  sage:             { emoji: '🌿', bg: '#dce8d4' },
  oregano:          { emoji: '🌿', bg: '#d3f9d8' },
  tarragon:         { emoji: '🌿', bg: '#d3f9d8' },
  lavender:         { emoji: '💜', bg: '#f3d9fa' },
  lemon_balm:       { emoji: '🍋', bg: '#fff9db' },
  chamomile:        { emoji: '🌼', bg: '#fff9db' },
  borage:           { emoji: '💙', bg: '#d0ebff' },
  hyssop:           { emoji: '🌸', bg: '#fce4ec' },
  lemongrass:       { emoji: '🌾', bg: '#f5f0dc' },
  stevia:           { emoji: '🍃', bg: '#d3f9d8' },
  bay:              { emoji: '🌿', bg: '#d3f9d8' },

  // Flowers
  marigold:         { emoji: '🌼', bg: '#fff3bf' },
  nasturtium:       { emoji: '🌸', bg: '#ffe8cc' },
  sunflower:        { emoji: '🌻', bg: '#fff3bf' },
  calendula:        { emoji: '🌸', bg: '#ffe8cc' },
  cosmos:           { emoji: '🌸', bg: '#fce4ec' },
  zinnia:           { emoji: '🌺', bg: '#ffe3e3' },
  sweet_alyssum:    { emoji: '🤍', bg: '#f8f9fa' },

  // Fruits
  strawberry:       { emoji: '🍓', bg: '#ffe3e3' },
  raspberry:        { emoji: '🫐', bg: '#f3d9fa' },
  blueberry:        { emoji: '🫐', bg: '#e0d5fa' },
  rhubarb:          { emoji: '🩷', bg: '#fce4ec' },
  watermelon:       { emoji: '🍉', bg: '#d3f9d8' },
  cantaloupe:       { emoji: '🍈', bg: '#fff9db' },
};

const CATEGORY_DEFAULTS: Record<string, PlantIconDef> = {
  vegetable: { emoji: '🥦', bg: '#d3f9d8' },
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
