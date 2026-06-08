export type SunRequirement = 'full_sun' | 'partial_sun' | 'shade';
export type WaterNeeds = 'low' | 'medium' | 'high';
export type PlantCategory = 'vegetable' | 'herb' | 'fruit' | 'flower';

export interface PlantVariety {
  name: string;
  notes?: string;
}

export interface CatalogEntry {
  name: string;
  aliases: string[];
  scientificName?: string;
  category: PlantCategory;
  sunRequirement: SunRequirement;
  waterNeeds: WaterNeeds;
  waterIntervalDays: number;
  goodCompanions: string[];
  badCompanions: string[];
  notes?: string;
  daysToMaturity?: { min: number; max: number };
  spacingCm?: number;
  depthCm?: number;
  varieties?: PlantVariety[];
}

// Keys are canonical IDs; aliases allow flexible lookup
export const PLANT_CATALOG: Record<string, CatalogEntry> = {
  // ─── TOMATOES ───────────────────────────────────────────────────────────────
  tomato: {
    name: 'Tomato', aliases: ['tomatoes', 'tomato'],
    scientificName: 'Solanum lycopersicum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['basil', 'carrot', 'marigold', 'parsley', 'borage', 'spinach', 'chive', 'asparagus', 'nasturtium'],
    badCompanions: ['fennel', 'cabbage', 'broccoli', 'cauliflower', 'kohlrabi', 'potato', 'corn', 'rosemary', 'dill'],
    notes: 'Basil repels aphids and improves flavor. Never plant near potatoes — share blight.',
    daysToMaturity: { min: 60, max: 85 }, spacingCm: 60,
    varieties: [
      { name: 'Cherry', notes: 'Small, sweet; 55–65 days' },
      { name: 'Beefsteak', notes: 'Large slicing; 80–85 days' },
      { name: 'Roma', notes: 'Paste tomato; 75–80 days' },
      { name: 'Heirloom', notes: 'Diverse flavors; 70–85 days' },
      { name: 'San Marzano', notes: 'Italian paste; 78 days' },
      { name: 'Sun Gold', notes: 'Orange cherry; very sweet' },
    ],
  },
  cherry_tomato: {
    name: 'Cherry Tomato', aliases: ['cherry tomatoes', 'cherry tomato', 'grape tomato'],
    scientificName: 'Solanum lycopersicum var. cerasiforme', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 2,
    goodCompanions: ['basil', 'carrot', 'marigold', 'parsley', 'borage', 'nasturtium', 'chive'],
    badCompanions: ['fennel', 'cabbage', 'broccoli', 'potato', 'corn'],
    notes: 'Prolific producer; great in containers. Basil repels aphids and enhances flavor.',
    daysToMaturity: { min: 55, max: 65 }, spacingCm: 45,
    varieties: [
      { name: 'Sun Gold', notes: 'Orange; very sweet; vigorous grower' },
      { name: 'Sweet 100', notes: 'Classic red; heavy clusters' },
      { name: 'Black Cherry', notes: 'Deep red-purple; rich flavor' },
      { name: 'Yellow Pear', notes: 'Pear-shaped; mild, sweet' },
      { name: 'Juliet', notes: 'Plum-shaped; crack-resistant' },
    ],
  },
  // ─── PEPPERS ─────────────────────────────────────────────────────────────────
  pepper: {
    name: 'Pepper', aliases: ['peppers', 'bell pepper', 'chili', 'chilli', 'capsicum', 'sweet pepper'],
    scientificName: 'Capsicum annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'carrot', 'marigold', 'tomato', 'parsley', 'spinach', 'oregano'],
    badCompanions: ['fennel', 'kohlrabi', 'apricot'],
    daysToMaturity: { min: 70, max: 90 }, spacingCm: 45,
    varieties: [
      { name: 'Bell', notes: 'Sweet; red/yellow/green/orange' },
      { name: 'Jalapeño', notes: 'Medium heat; 70–85 days' },
      { name: 'Habanero', notes: 'Very hot; 90–100 days' },
      { name: 'Banana', notes: 'Mild; yellow to red' },
      { name: 'Poblano', notes: 'Mild-medium; great for roasting' },
      { name: 'Cayenne', notes: 'Hot; drying pepper' },
    ],
  },
  // ─── SERRANO ─────────────────────────────────────────────────────────────────
  serrano: {
    name: 'Serrano', aliases: ['serrano pepper', 'serrano chile'],
    scientificName: 'Capsicum annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'carrot', 'marigold', 'tomato', 'onion', 'garlic'],
    badCompanions: ['fennel', 'kohlrabi'],
    notes: 'Hotter than jalapeño (10,000–25,000 SHU). Rarely sold commercial; easy to grow.',
    daysToMaturity: { min: 75, max: 90 }, spacingCm: 45,
  },
  // ─── ANAHEIM ──────────────────────────────────────────────────────────────────
  anaheim: {
    name: 'Anaheim Pepper', aliases: ['anaheim', 'california chile', 'new mexico chile'],
    scientificName: 'Capsicum annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'carrot', 'marigold', 'tomato', 'parsley'],
    badCompanions: ['fennel', 'kohlrabi'],
    notes: 'Mild heat (500–2,500 SHU). Great roasted. Classic for chiles rellenos.',
    daysToMaturity: { min: 75, max: 85 }, spacingCm: 45,
  },
  // ─── PASILLA ──────────────────────────────────────────────────────────────────
  pasilla: {
    name: 'Pasilla Pepper', aliases: ['pasilla', 'chile negro', 'mulato'],
    scientificName: 'Capsicum annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'marigold', 'tomato', 'onion'],
    badCompanions: ['fennel'],
    notes: 'Mild-medium (1,000–4,000 SHU). Rich, earthy flavor; essential in mole.',
    daysToMaturity: { min: 80, max: 90 }, spacingCm: 45,
  },
  // ─── GHOST PEPPER ─────────────────────────────────────────────────────────────
  ghost_pepper: {
    name: 'Ghost Pepper', aliases: ['bhut jolokia', 'ghost chili', 'naga jolokia', 'ghost pepper'],
    scientificName: 'Capsicum chinense', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'marigold', 'carrot', 'tomato'],
    badCompanions: ['fennel'],
    notes: 'Over 1 million SHU — one of the world\'s hottest. Handle with gloves.',
    daysToMaturity: { min: 100, max: 120 }, spacingCm: 60,
  },
  // ─── SCOTCH BONNET ────────────────────────────────────────────────────────────
  scotch_bonnet: {
    name: 'Scotch Bonnet', aliases: ['scotch bonnet', 'caribbean red pepper', 'bonney pepper'],
    scientificName: 'Capsicum chinense', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'marigold', 'tomato', 'onion'],
    badCompanions: ['fennel'],
    notes: '100,000–350,000 SHU. Fruity, tropical flavor. Essential in jerk seasoning.',
    daysToMaturity: { min: 90, max: 120 }, spacingCm: 60,
  },
  // ─── THAI CHILI ───────────────────────────────────────────────────────────────
  thai_chili: {
    name: 'Thai Chili', aliases: ['thai pepper', 'bird chili', 'bird\'s eye chili', 'prik kee noo'],
    scientificName: 'Capsicum annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'marigold', 'lemongrass', 'tomato'],
    badCompanions: ['fennel'],
    notes: '50,000–100,000 SHU. Tiny but fiery. Great in stir-fries and Thai cuisine.',
    daysToMaturity: { min: 75, max: 90 }, spacingCm: 45,
  },
  // ─── SHISHITO ─────────────────────────────────────────────────────────────────
  shishito: {
    name: 'Shishito Pepper', aliases: ['shishito', 'japanese pepper'],
    scientificName: 'Capsicum annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'marigold', 'tomato', 'eggplant'],
    badCompanions: ['fennel'],
    notes: 'Mostly mild with occasional hot one (1 in 10). Perfect blistered in a pan.',
    daysToMaturity: { min: 60, max: 80 }, spacingCm: 45,
  },
  // ─── CUBANELLE ────────────────────────────────────────────────────────────────
  cubanelle: {
    name: 'Cubanelle Pepper', aliases: ['cubanelle', 'italian frying pepper', 'sweet italian pepper'],
    scientificName: 'Capsicum annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'marigold', 'tomato', 'eggplant'],
    badCompanions: ['fennel'],
    notes: 'Very mild (100–1,000 SHU). Excellent for frying and stuffing.',
    daysToMaturity: { min: 65, max: 80 }, spacingCm: 45,
  },
  // ─── JALAPEÑO ────────────────────────────────────────────────────────────────
  jalapeno: {
    name: 'Jalapeño', aliases: [
      'jalapeno', 'jalapeños', 'jalapenos', 'jalapeño pepper', 'jalapeno pepper',
      'hot pepper', 'chili pepper', 'chile pepper', 'serrano',
    ],
    scientificName: 'Capsicum annuum var. annuum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'carrot', 'marigold', 'tomato', 'parsley', 'spinach', 'oregano', 'onion', 'garlic'],
    badCompanions: ['fennel', 'kohlrabi', 'apricot'],
    notes: 'Alliums (onion, garlic) deter aphids and spider mites. Avoid planting near fennel.',
    daysToMaturity: { min: 70, max: 85 }, spacingCm: 45,
    varieties: [
      { name: 'Classic', notes: '2,500–8,000 SHU; most common' },
      { name: 'Tam Jalapeño', notes: 'Very mild; 1,000–1,500 SHU' },
      { name: 'Mucho Nacho', notes: 'Extra large pods; mild-medium' },
      { name: 'Jalapeño M', notes: 'Heavy producer; consistent heat' },
      { name: 'Chipotle', notes: 'Smoked ripe jalapeño; same plant' },
    ],
  },
  // ─── CUCUMBER ────────────────────────────────────────────────────────────────
  cucumber: {
    name: 'Cucumber', aliases: ['cucumbers', 'cuke'],
    scientificName: 'Cucumis sativus', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['bean', 'pea', 'lettuce', 'radish', 'sunflower', 'marigold', 'dill', 'nasturtium'],
    badCompanions: ['sage', 'potato', 'fennel', 'rosemary', 'aromatic_herbs'],
    notes: '95% water — never let soil dry out. Mulch heavily.',
    daysToMaturity: { min: 50, max: 70 }, spacingCm: 45,
    varieties: [
      { name: 'Slicing', notes: 'Standard; 55–65 days' },
      { name: 'Pickling', notes: 'Shorter, bumpier; 50–55 days' },
      { name: 'English/Burpless', notes: 'Long, thin; mild flavor' },
      { name: 'Lemon', notes: 'Round, yellow; mild and crisp' },
      { name: 'Armenian', notes: 'Long; technically a melon' },
    ],
  },
  // ─── BEANS ───────────────────────────────────────────────────────────────────
  bean: {
    name: 'Bean', aliases: ['beans', 'green bean', 'snap bean', 'french bean', 'haricot'],
    scientificName: 'Phaseolus vulgaris', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['carrot', 'cucumber', 'pea', 'radish', 'strawberry', 'corn', 'squash', 'potato', 'celery', 'summer_savory'],
    badCompanions: ['onion', 'garlic', 'leek', 'fennel', 'shallot'],
    notes: 'Nitrogen fixer — improves soil for neighbors.',
    daysToMaturity: { min: 50, max: 65 }, spacingCm: 15,
    varieties: [
      { name: 'Bush', notes: 'No support needed; 50–55 days' },
      { name: 'Pole', notes: 'Needs trellis; higher yield; 60–70 days' },
      { name: 'Runner', notes: 'Ornamental flowers; 60–70 days' },
      { name: 'Broad/Fava', notes: 'Cool season; 80–90 days' },
      { name: 'Lima', notes: 'Buttery; warm season; 65–80 days' },
    ],
  },
  // ─── PEAS ────────────────────────────────────────────────────────────────────
  pea: {
    name: 'Pea', aliases: ['peas', 'garden pea'],
    scientificName: 'Pisum sativum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['carrot', 'cucumber', 'bean', 'radish', 'spinach', 'mint', 'turnip', 'lettuce', 'corn'],
    badCompanions: ['onion', 'garlic', 'leek', 'fennel', 'shallot'],
    notes: 'Cool-season crop. Nitrogen fixer. Plant early spring or fall.',
    daysToMaturity: { min: 55, max: 70 }, spacingCm: 8,
    varieties: [
      { name: 'Snow', notes: 'Flat pods eaten whole; 60–65 days' },
      { name: 'Sugar Snap', notes: 'Sweet; pods eaten whole; 60–70 days' },
      { name: 'Shelling/English', notes: 'Pods shelled; classic pea' },
    ],
  },
  // ─── LETTUCE ─────────────────────────────────────────────────────────────────
  lettuce: {
    name: 'Lettuce', aliases: ['salad', 'lettuce mix'],
    scientificName: 'Lactuca sativa', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['carrot', 'radish', 'strawberry', 'cucumber', 'onion', 'spinach', 'chive', 'dill'],
    badCompanions: ['celery', 'fennel', 'parsley'],
    notes: 'Bolts in heat — shade from taller plants in summer.',
    daysToMaturity: { min: 45, max: 70 }, spacingCm: 20,
    varieties: [
      { name: 'Butterhead', notes: 'Soft leaves; heat sensitive' },
      { name: 'Romaine/Cos', notes: 'Upright; more heat tolerant' },
      { name: 'Loose-leaf', notes: 'Cut-and-come-again; fastest' },
      { name: 'Iceberg', notes: 'Crisp head; 70–80 days' },
      { name: 'Oakleaf', notes: 'Lobed; slow to bolt' },
      { name: 'Mesclun Mix', notes: 'Mixed baby leaves; 30–40 days' },
    ],
  },
  // ─── SPINACH ─────────────────────────────────────────────────────────────────
  spinach: {
    name: 'Spinach', aliases: ['baby spinach'],
    scientificName: 'Spinacia oleracea', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['tomato', 'radish', 'strawberry', 'pea', 'lettuce', 'brassicas', 'bean'],
    badCompanions: ['fennel'],
    notes: 'Cool season. Bolts quickly in heat. Sow in spring and fall.',
    daysToMaturity: { min: 35, max: 45 }, spacingCm: 10,
  },
  // ─── KALE ────────────────────────────────────────────────────────────────────
  kale: {
    name: 'Kale', aliases: ['curly kale', 'leaf kale', 'lacinato kale', 'dinosaur kale', 'cavolo nero'],
    scientificName: 'Brassica oleracea var. acephala', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['onion', 'garlic', 'dill', 'chamomile', 'mint', 'rosemary', 'sage', 'thyme', 'beet', 'celery', 'nasturtium'],
    badCompanions: ['tomato', 'strawberry', 'pepper', 'bean', 'rue'],
    notes: 'Frost improves flavor. Companion herbs deter cabbage moths.',
    daysToMaturity: { min: 50, max: 70 }, spacingCm: 45,
    varieties: [
      { name: 'Curly', notes: 'Most common; hardy' },
      { name: 'Lacinato/Tuscan', notes: 'Flat dark leaves; tender flavor' },
      { name: 'Red Russian', notes: 'Mild, sweet; good raw' },
      { name: 'Redbor', notes: 'Ornamental purple; very hardy' },
    ],
  },
  // ─── CABBAGE ─────────────────────────────────────────────────────────────────
  cabbage: {
    name: 'Cabbage', aliases: ['cabbages'],
    scientificName: 'Brassica oleracea var. capitata', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['onion', 'dill', 'chamomile', 'sage', 'mint', 'rosemary', 'thyme', 'celery', 'beet', 'nasturtium', 'hyssop'],
    badCompanions: ['tomato', 'strawberry', 'pepper', 'bean', 'fennel', 'rue'],
    daysToMaturity: { min: 70, max: 120 }, spacingCm: 45,
    varieties: [
      { name: 'Green', notes: 'Classic; round head' },
      { name: 'Red', notes: 'Antioxidant-rich; slightly tougher' },
      { name: 'Savoy', notes: 'Crinkled; milder flavor' },
      { name: 'Napa/Chinese', notes: 'Elongated; mild; fast' },
    ],
  },
  // ─── BROCCOLI ────────────────────────────────────────────────────────────────
  broccoli: {
    name: 'Broccoli', aliases: ['broccolini', 'broccoli raab', 'rapini'],
    scientificName: 'Brassica oleracea var. italica', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['onion', 'garlic', 'dill', 'chamomile', 'mint', 'rosemary', 'sage', 'celery', 'beet', 'nasturtium'],
    badCompanions: ['tomato', 'strawberry', 'pepper', 'fennel'],
    daysToMaturity: { min: 60, max: 100 }, spacingCm: 45,
  },
  cauliflower: {
    name: 'Cauliflower', aliases: ['cauli'],
    scientificName: 'Brassica oleracea var. botrytis', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['onion', 'dill', 'chamomile', 'mint', 'sage', 'celery', 'spinach'],
    badCompanions: ['tomato', 'strawberry', 'pepper', 'fennel'],
    daysToMaturity: { min: 70, max: 100 }, spacingCm: 50,
    varieties: [
      { name: 'White', notes: 'Classic; needs blanching' },
      { name: 'Purple', notes: 'No blanching; slightly nutty' },
      { name: 'Romanesco', notes: 'Fractal spirals; nutty, mild' },
      { name: 'Orange', notes: 'Higher beta-carotene' },
    ],
  },
  brussels_sprouts: {
    name: 'Brussels Sprouts', aliases: ['brussels sprouts', 'brussel sprouts'],
    scientificName: 'Brassica oleracea var. gemmifera', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['onion', 'garlic', 'dill', 'chamomile', 'mint', 'sage', 'thyme', 'nasturtium'],
    badCompanions: ['tomato', 'strawberry', 'pepper', 'fennel'],
    notes: 'Long season — start indoors. Frost sweetens flavor.',
    daysToMaturity: { min: 90, max: 120 }, spacingCm: 60,
  },
  // ─── ROOT VEGETABLES ─────────────────────────────────────────────────────────
  carrot: {
    name: 'Carrot', aliases: ['carrots'],
    scientificName: 'Daucus carota', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['tomato', 'onion', 'lettuce', 'sage', 'rosemary', 'leek', 'chive', 'bean', 'radish'],
    badCompanions: ['dill', 'fennel', 'anise', 'parsnip'],
    notes: 'Deep, loose, stone-free soil essential. Thin early.',
    daysToMaturity: { min: 65, max: 80 }, spacingCm: 7, depthCm: 1,
    varieties: [
      { name: 'Nantes', notes: 'Cylindrical; sweet; most popular' },
      { name: 'Chantenay', notes: 'Short, wide; heavy soil tolerant' },
      { name: 'Imperator', notes: 'Long; commercial type' },
      { name: 'Danvers', notes: 'Medium length; good storage' },
      { name: 'Purple Haze', notes: 'Purple outside, orange inside' },
      { name: 'Little Finger', notes: 'Baby carrot; container-friendly' },
    ],
  },
  radish: {
    name: 'Radish', aliases: ['radishes'],
    scientificName: 'Raphanus sativus', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['lettuce', 'pea', 'cucumber', 'bean', 'carrot', 'spinach', 'chervil', 'nasturtium'],
    badCompanions: ['hyssop', 'turnip'],
    notes: 'Fastest vegetable — 25 days! Use as a row marker.',
    daysToMaturity: { min: 22, max: 70 }, spacingCm: 5,
    varieties: [
      { name: 'Cherry Belle', notes: 'Round, red; 22 days' },
      { name: 'French Breakfast', notes: 'Elongated, mild; 25 days' },
      { name: 'Daikon', notes: 'Long white Japanese; 60–70 days' },
      { name: 'Watermelon', notes: 'White outside, pink inside; mild' },
      { name: 'Black Spanish', notes: 'Dark skin, white flesh; winter' },
    ],
  },
  beet: {
    name: 'Beet', aliases: ['beetroot', 'beets', 'chard beet'],
    scientificName: 'Beta vulgaris', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['onion', 'lettuce', 'garlic', 'cabbage', 'kohlrabi', 'bean'],
    badCompanions: ['bean', 'fennel', 'charlock'],
    daysToMaturity: { min: 50, max: 70 }, spacingCm: 10,
    varieties: [
      { name: 'Detroit Dark Red', notes: 'Classic; deep red; 60 days' },
      { name: 'Chioggia', notes: 'Candy-striped; sweet; Italian heirloom' },
      { name: 'Golden', notes: 'Yellow; milder, less earthy' },
      { name: 'Cylindra', notes: 'Cylindrical; easy slicing' },
    ],
  },
  parsnip: {
    name: 'Parsnip', aliases: ['parsnips'],
    scientificName: 'Pastinaca sativa', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['pea', 'bean', 'lettuce', 'radish', 'pepper'],
    badCompanions: ['carrot', 'fennel', 'dill'],
    notes: 'Frost converts starch to sugar — leave in ground until needed.',
    daysToMaturity: { min: 100, max: 130 }, spacingCm: 15,
  },
  turnip: {
    name: 'Turnip', aliases: ['turnips'],
    scientificName: 'Brassica rapa', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['pea', 'bean', 'onion', 'nasturtium'],
    badCompanions: ['fennel', 'potato', 'radish'],
    daysToMaturity: { min: 35, max: 60 }, spacingCm: 15,
  },
  // ─── ALLIUMS ──────────────────────────────────────────────────────────────────
  onion: {
    name: 'Onion', aliases: ['onions', 'bulb onion'],
    scientificName: 'Allium cepa', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['carrot', 'lettuce', 'tomato', 'beet', 'chamomile', 'spinach', 'strawberry', 'pepper'],
    badCompanions: ['bean', 'pea', 'sage', 'asparagus'],
    daysToMaturity: { min: 90, max: 120 }, spacingCm: 10,
    varieties: [
      { name: 'Yellow Sweet', notes: 'All-purpose; long storage' },
      { name: 'Red', notes: 'Mild; good raw' },
      { name: 'White', notes: 'Sharp; good for cooking' },
      { name: 'Scallion/Green', notes: 'Harvest young; 60 days' },
      { name: 'Shallot', notes: 'Clusters; subtle; gourmet' },
      { name: 'Cipollini', notes: 'Small flat Italian' },
    ],
  },
  garlic: {
    name: 'Garlic', aliases: ['garlic cloves'],
    scientificName: 'Allium sativum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['tomato', 'rose', 'beet', 'cucumber', 'pepper', 'lettuce', 'raspberry'],
    badCompanions: ['bean', 'pea', 'asparagus', 'parsley'],
    notes: 'Plant in fall, harvest next summer. Remove scapes for larger bulbs.',
    daysToMaturity: { min: 90, max: 150 }, spacingCm: 15,
    varieties: [
      { name: 'Softneck', notes: 'Long shelf life; braid-able; milder' },
      { name: 'Hardneck', notes: 'More complex flavor; colder climates' },
      { name: 'Elephant', notes: 'Mild; actually a leek' },
    ],
  },
  leek: {
    name: 'Leek', aliases: ['leeks'],
    scientificName: 'Allium ampeloprasum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['carrot', 'celery', 'onion', 'spinach', 'strawberry'],
    badCompanions: ['bean', 'pea', 'asparagus'],
    daysToMaturity: { min: 100, max: 150 }, spacingCm: 15,
  },
  chive: {
    name: 'Chive', aliases: ['chives', 'garlic chives'],
    scientificName: 'Allium schoenoprasum', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['carrot', 'tomato', 'rose', 'apple', 'cucumber', 'lettuce'],
    badCompanions: ['bean', 'pea', 'asparagus'],
    notes: 'Repels aphids and carrot fly. Edible purple flowers.',
    daysToMaturity: { min: 60, max: 90 }, spacingCm: 20,
  },
  // ─── SOLANUMS ────────────────────────────────────────────────────────────────
  eggplant: {
    name: 'Eggplant', aliases: ['aubergine', 'eggplants', 'brinjal'],
    scientificName: 'Solanum melongena', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['pepper', 'tomato', 'basil', 'tarragon', 'thyme', 'marigold'],
    badCompanions: ['fennel', 'corn'],
    daysToMaturity: { min: 65, max: 85 }, spacingCm: 50,
    varieties: [
      { name: 'Classic/Globe', notes: 'Large, dark purple; most common' },
      { name: 'Japanese', notes: 'Long, slender; tender skin' },
      { name: 'Italian', notes: 'Medium; fewer seeds' },
      { name: 'White', notes: 'Mild, creamy; no bitterness' },
      { name: 'Fairy Tale', notes: 'Striped; small; sweet' },
    ],
  },
  tomatillo: {
    name: 'Tomatillo', aliases: ['tomatillos', 'ground cherry', 'husk tomato'],
    scientificName: 'Physalis ixocarpa', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['basil', 'marigold', 'carrot', 'pepper'],
    badCompanions: ['fennel', 'potato'],
    notes: 'Plant 2+ for pollination. Self-seeds prolifically.',
    daysToMaturity: { min: 65, max: 85 }, spacingCm: 60,
  },
  // ─── SQUASH FAMILY ───────────────────────────────────────────────────────────
  squash: {
    name: 'Squash', aliases: ['summer squash'],
    scientificName: 'Cucurbita pepo', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['corn', 'bean', 'marigold', 'nasturtium', 'radish', 'borage'],
    badCompanions: ['potato', 'fennel'],
    notes: 'Three Sisters: squash, corn, bean — classic polyculture.',
    daysToMaturity: { min: 45, max: 60 }, spacingCm: 90,
    varieties: [
      { name: 'Zucchini', notes: 'Prolific; harvest young for best flavor' },
      { name: 'Yellow Crookneck', notes: 'Curved; tender; 50 days' },
      { name: 'Pattypan', notes: 'Flying saucer shape; mild' },
    ],
  },
  winter_squash: {
    name: 'Winter Squash', aliases: ['butternut', 'butternut squash', 'acorn squash', 'delicata', 'kabocha'],
    scientificName: 'Cucurbita maxima / C. moschata', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['corn', 'bean', 'marigold', 'nasturtium', 'radish', 'borage'],
    badCompanions: ['potato', 'fennel'],
    daysToMaturity: { min: 80, max: 110 }, spacingCm: 120,
    varieties: [
      { name: 'Butternut', notes: 'Long shelf life; sweet orange flesh' },
      { name: 'Acorn', notes: 'Small; single serving size' },
      { name: 'Delicata', notes: 'Striped; sweet; edible skin' },
      { name: 'Spaghetti', notes: 'Flesh separates into noodles' },
      { name: 'Hubbard', notes: 'Very large; excellent storage' },
    ],
  },
  pumpkin: {
    name: 'Pumpkin', aliases: ['pumpkins', 'jack o lantern'],
    scientificName: 'Cucurbita pepo', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 3,
    goodCompanions: ['corn', 'bean', 'marigold', 'nasturtium', 'radish'],
    badCompanions: ['potato', 'fennel'],
    daysToMaturity: { min: 85, max: 120 }, spacingCm: 120,
    varieties: [
      { name: "Jack O'Lantern", notes: 'Carving pumpkin; hollow' },
      { name: 'Sugar Pie', notes: 'Small; sweet; cooking' },
      { name: 'Cinderella', notes: 'Flat, ribbed; ornamental and edible' },
      { name: 'Jarrahdale', notes: 'Blue-green; sweet flesh' },
    ],
  },
  // ─── CORN ────────────────────────────────────────────────────────────────────
  corn: {
    name: 'Corn', aliases: ['maize', 'sweetcorn', 'sweet corn'],
    scientificName: 'Zea mays', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['bean', 'squash', 'pea', 'cucumber', 'potato', 'parsley'],
    badCompanions: ['tomato', 'fennel', 'celery'],
    notes: 'Plant in blocks not rows for wind pollination.',
    daysToMaturity: { min: 60, max: 90 }, spacingCm: 30,
    varieties: [
      { name: 'Sweet', notes: 'Eat fresh; 70–80 days' },
      { name: 'Popcorn', notes: 'Dry for popping; 90–100 days' },
      { name: 'Ornamental', notes: 'Colorful; decorative' },
    ],
  },
  // ─── POTATOES ────────────────────────────────────────────────────────────────
  potato: {
    name: 'Potato', aliases: ['potatoes', 'spud', 'spuds'],
    scientificName: 'Solanum tuberosum', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['bean', 'corn', 'horseradish', 'marigold', 'pea', 'parsley', 'thyme'],
    badCompanions: ['tomato', 'cucumber', 'squash', 'fennel', 'sunflower', 'rosemary'],
    notes: 'Never plant near tomatoes — share blight. Hill up soil as plants grow.',
    daysToMaturity: { min: 70, max: 120 }, spacingCm: 35, depthCm: 10,
    varieties: [
      { name: 'Russet', notes: 'Baking; fluffy; common' },
      { name: 'Yukon Gold', notes: 'Yellow flesh; buttery; all-purpose' },
      { name: 'Red Pontiac', notes: 'Waxy; good boiling' },
      { name: 'Fingerling', notes: 'Small, elongated; gourmet' },
      { name: 'Purple/Blue', notes: 'Anthocyanin-rich; nutty' },
      { name: 'New Potato', notes: 'Any variety harvested young' },
    ],
  },
  sweet_potato: {
    name: 'Sweet Potato', aliases: ['sweet potatoes', 'yam', 'kumara'],
    scientificName: 'Ipomoea batatas', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['bean', 'parsnip', 'spinach', 'dill'],
    badCompanions: ['squash', 'sunflower'],
    notes: 'Not related to potato. Needs long warm season (90–150 days).',
    daysToMaturity: { min: 90, max: 150 }, spacingCm: 30,
  },
  // ─── ASPARAGUS ───────────────────────────────────────────────────────────────
  asparagus: {
    name: 'Asparagus', aliases: ['asparagus'],
    scientificName: 'Asparagus officinalis', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['tomato', 'parsley', 'basil', 'marigold', 'nasturtium', 'comfrey'],
    badCompanions: ['onion', 'garlic', 'potato', 'fennel'],
    notes: 'Perennial — 2-year establishment before harvest. Plant crowns 20cm deep.',
    daysToMaturity: { min: 365, max: 730 }, spacingCm: 45,
  },
  // ─── OTHER VEGETABLES ────────────────────────────────────────────────────────
  celery: {
    name: 'Celery', aliases: ['celeriac', 'celery root'],
    scientificName: 'Apium graveolens', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 1,
    goodCompanions: ['tomato', 'bean', 'leek', 'onion', 'spinach', 'brassicas'],
    badCompanions: ['corn', 'fennel', 'parsnip', 'lettuce'],
    notes: 'Needs consistent moisture — never let dry out.',
    daysToMaturity: { min: 100, max: 130 }, spacingCm: 25,
  },
  chard: {
    name: 'Chard', aliases: ['swiss chard', 'rainbow chard', 'silverbeet'],
    scientificName: 'Beta vulgaris var. cicla', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['bean', 'onion', 'lettuce', 'brassicas', 'radish'],
    badCompanions: ['fennel', 'beet'],
    notes: 'Heat and cold tolerant. Cut-and-come-again.',
    daysToMaturity: { min: 50, max: 60 }, spacingCm: 30,
  },
  arugula: {
    name: 'Arugula', aliases: ['rocket', 'roquette', 'rucola'],
    scientificName: 'Eruca vesicaria', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['lettuce', 'spinach', 'radish', 'carrot', 'bean'],
    badCompanions: ['fennel'],
    notes: 'Peppery flavor. Bolts quickly in heat — shade helps.',
    daysToMaturity: { min: 30, max: 45 }, spacingCm: 15,
  },
  okra: {
    name: 'Okra', aliases: ['ladies\' fingers', 'gumbo'],
    scientificName: 'Abelmoschus esculentus', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['pepper', 'eggplant', 'cucumber', 'basil', 'marigold'],
    badCompanions: ['fennel', 'sweet potato'],
    notes: 'Loves heat. Harvest pods at 5–8cm for best flavor.',
    daysToMaturity: { min: 50, max: 65 }, spacingCm: 45,
  },
  kohlrabi: {
    name: 'Kohlrabi', aliases: ['kohlrabi', 'German turnip'],
    scientificName: 'Brassica oleracea var. gongylodes', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['onion', 'garlic', 'beet', 'lettuce', 'cucumber'],
    badCompanions: ['tomato', 'pepper', 'fennel'],
    daysToMaturity: { min: 45, max: 60 }, spacingCm: 20,
  },
  endive: {
    name: 'Endive', aliases: ['chicory', 'escarole', 'frisee', 'radicchio', 'Belgian endive'],
    scientificName: 'Cichorium endivia', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['lettuce', 'spinach', 'carrot', 'onion'],
    badCompanions: ['fennel'],
    daysToMaturity: { min: 80, max: 100 }, spacingCm: 30,
  },
  fennel: {
    name: 'Fennel', aliases: ['florence fennel', 'finocchio', 'bulb fennel'],
    scientificName: 'Foeniculum vulgare', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: [],
    badCompanions: ['tomato', 'pepper', 'bean', 'pea', 'cucumber', 'squash', 'potato', 'carrot', 'kale', 'kohlrabi'],
    notes: 'Allelopathic — inhibits most vegetables. Best isolated or with dill.',
    daysToMaturity: { min: 80, max: 90 }, spacingCm: 30,
  },
  // ─── MORE ROOT VEGETABLES ─────────────────────────────────────────────────────
  horseradish: {
    name: 'Horseradish', aliases: ['horseradishes'],
    scientificName: 'Armoracia rusticana', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['potato', 'fruit_trees', 'rhubarb'],
    badCompanions: ['fennel'],
    notes: 'Perennial; spreads vigorously. Best grown in containers. Roots harvested in fall.',
    daysToMaturity: { min: 150, max: 200 }, spacingCm: 60,
  },
  ginger: {
    name: 'Ginger', aliases: ['ginger root', 'common ginger'],
    scientificName: 'Zingiber officinale', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['tomato', 'pepper', 'eggplant', 'cilantro'],
    badCompanions: ['fennel'],
    notes: 'Tropical; needs warm, humid conditions. Grow in pots in cold climates.',
    daysToMaturity: { min: 210, max: 240 }, spacingCm: 20,
  },
  turmeric: {
    name: 'Turmeric', aliases: ['turmeric root', 'golden root'],
    scientificName: 'Curcuma longa', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['ginger', 'pepper', 'eggplant'],
    badCompanions: [],
    notes: 'Tropical; grown same way as ginger. Vibrant yellow rhizomes for cooking.',
    daysToMaturity: { min: 210, max: 240 }, spacingCm: 25,
  },
  celeriac: {
    name: 'Celeriac', aliases: ['celery root', 'turnip-rooted celery'],
    scientificName: 'Apium graveolens var. rapaceum', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['tomato', 'leek', 'onion', 'bean', 'cabbage'],
    badCompanions: ['corn', 'fennel', 'parsnip'],
    notes: 'Edible root with celery flavor. Long season — start indoors early.',
    daysToMaturity: { min: 110, max: 130 }, spacingCm: 30,
  },
  rutabaga: {
    name: 'Rutabaga', aliases: ['swede', 'yellow turnip', 'neeps'],
    scientificName: 'Brassica napus', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['pea', 'bean', 'onion', 'nasturtium'],
    badCompanions: ['fennel', 'potato'],
    notes: 'Hardy root; frost improves flavor. Good winter storage crop.',
    daysToMaturity: { min: 80, max: 100 }, spacingCm: 25,
  },
  jicama: {
    name: 'Jicama', aliases: ['yam bean', 'Mexican turnip', 'singkamas'],
    scientificName: 'Pachyrhizus erosus', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['corn', 'squash', 'bean'],
    badCompanions: [],
    notes: 'Tropical vine; needs long warm season (150+ days). Only eat the tuber — leaves/seeds toxic.',
    daysToMaturity: { min: 150, max: 210 }, spacingCm: 30,
  },
  salsify: {
    name: 'Salsify', aliases: ['oyster plant', 'vegetable oyster', 'scorzonera'],
    scientificName: 'Tragopogon porrifolius', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['carrot', 'parsnip', 'lettuce'],
    badCompanions: ['fennel'],
    notes: 'Mild oyster-like flavor. Frost improves sweetness. Deep, stone-free soil needed.',
    daysToMaturity: { min: 120, max: 150 }, spacingCm: 10,
  },
  // ─── MORE VEGETABLES ──────────────────────────────────────────────────────────
  artichoke: {
    name: 'Artichoke', aliases: ['globe artichoke', 'artichokes'],
    scientificName: 'Cynara cardunculus', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['tarragon', 'sunflower', 'pea', 'bean'],
    badCompanions: ['fennel'],
    notes: 'Perennial in mild climates. Large architectural plant; 1.5m tall. Harvest before buds open.',
    daysToMaturity: { min: 365, max: 365 }, spacingCm: 120,
  },
  jerusalem_artichoke: {
    name: 'Jerusalem Artichoke', aliases: ['sunchoke', 'sunroot', 'earth apple'],
    scientificName: 'Helianthus tuberosus', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['corn', 'bean', 'squash'],
    badCompanions: ['potato', 'sunflower'],
    notes: 'Spreads aggressively — contain with barriers. Nutty, sweet tubers. Very hardy.',
    daysToMaturity: { min: 120, max: 150 }, spacingCm: 45,
  },
  collard_greens: {
    name: 'Collard Greens', aliases: ['collards', 'collard'],
    scientificName: 'Brassica oleracea var. viridis', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['onion', 'garlic', 'dill', 'chamomile', 'mint', 'thyme', 'celery', 'nasturtium'],
    badCompanions: ['tomato', 'strawberry', 'pepper', 'fennel'],
    notes: 'Southern US staple. Very cold-hardy; frost improves flavor.',
    daysToMaturity: { min: 60, max: 80 }, spacingCm: 45,
  },
  bok_choy: {
    name: 'Bok Choy', aliases: ['pak choi', 'pak choy', 'chinese cabbage', 'bai cai'],
    scientificName: 'Brassica rapa subsp. chinensis', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['onion', 'garlic', 'dill', 'chamomile', 'celery', 'nasturtium'],
    badCompanions: ['tomato', 'strawberry', 'pepper', 'fennel'],
    notes: 'Fast-growing cool-season crop. Bolts in heat — plant in spring or fall.',
    daysToMaturity: { min: 45, max: 65 }, spacingCm: 25,
  },
  watercress: {
    name: 'Watercress', aliases: ['watercess', 'cress'],
    scientificName: 'Nasturtium officinale', category: 'vegetable',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 1,
    goodCompanions: ['lettuce', 'spinach', 'mint', 'radish'],
    badCompanions: ['fennel'],
    notes: 'Aquatic plant; needs constant moisture or running water. Peppery flavor.',
    daysToMaturity: { min: 50, max: 70 }, spacingCm: 20,
  },
  edamame: {
    name: 'Edamame', aliases: ['edamame', 'vegetable soybean', 'soybean'],
    scientificName: 'Glycine max', category: 'vegetable',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['corn', 'carrot', 'celery', 'strawberry', 'cucumber', 'squash'],
    badCompanions: ['onion', 'garlic', 'leek', 'fennel', 'chive'],
    notes: 'Nitrogen fixer. Harvest when pods are plump but still green.',
    daysToMaturity: { min: 75, max: 100 }, spacingCm: 10,
  },
  // ─── MORE FRUITS ──────────────────────────────────────────────────────────────
  blackberry: {
    name: 'Blackberry', aliases: ['blackberries', 'bramble'],
    scientificName: 'Rubus fruticosus', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['garlic', 'marigold', 'tansy', 'grape'],
    badCompanions: ['raspberry', 'tomato', 'eggplant'],
    notes: 'Keep apart from raspberries to prevent viral spread. Thornless varieties available.',
    daysToMaturity: { min: 365, max: 730 }, spacingCm: 120,
    varieties: [
      { name: 'Thornless', notes: 'Easier harvesting; slightly less flavorful' },
      { name: 'Chester', notes: 'Large berries; late season; thornless' },
      { name: 'Triple Crown', notes: 'High yield; semi-erect' },
    ],
  },
  grape: {
    name: 'Grape', aliases: ['grapes', 'grapevine'],
    scientificName: 'Vitis vinifera', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['hyssop', 'basil', 'rosemary', 'oregano', 'geranium', 'blackberry'],
    badCompanions: ['cabbage', 'radish', 'fennel'],
    notes: 'Needs sturdy trellis. Annual pruning essential. Table vs wine varieties differ.',
    daysToMaturity: { min: 1095, max: 1460 }, spacingCm: 250,
    varieties: [
      { name: 'Concord', notes: 'American; blue-black; jam and juice' },
      { name: 'Thompson Seedless', notes: 'Green table grape; mild, sweet' },
      { name: 'Red Flame', notes: 'Large red; sweet; seedless' },
      { name: 'Muscat', notes: 'Aromatic; dessert grape' },
    ],
  },
  fig: {
    name: 'Fig', aliases: ['figs', 'common fig'],
    scientificName: 'Ficus carica', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['rue', 'basil', 'oregano', 'marigold'],
    badCompanions: ['fennel', 'potato'],
    notes: 'Mediterranean tree. Protect from frost. Two crops per year in warm climates.',
    daysToMaturity: { min: 1095, max: 1460 }, spacingCm: 500,
    varieties: [
      { name: 'Brown Turkey', notes: 'Cold-hardy; most common; large fruit' },
      { name: 'Celeste', notes: 'Small, sweet; very cold-hardy' },
      { name: 'Kadota', notes: 'Green-yellow; mild; canning variety' },
      { name: 'Black Mission', notes: 'Rich flavor; highly productive' },
    ],
  },
  apple: {
    name: 'Apple', aliases: ['apples', 'apple tree'],
    scientificName: 'Malus domestica', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['chive', 'lavender', 'marigold', 'nasturtium', 'sage', 'thyme'],
    badCompanions: ['fennel', 'potato', 'grass'],
    notes: 'Most varieties need a pollination partner. Choose chill-hour appropriate cultivar for your zone.',
    daysToMaturity: { min: 1460, max: 1825 }, spacingCm: 400,
    varieties: [
      { name: 'Fuji', notes: 'Sweet, crisp; excellent storage' },
      { name: 'Gala', notes: 'Mild, sweet; early harvest' },
      { name: 'Honeycrisp', notes: 'Crisp, juicy; popular; cold-hardy' },
      { name: 'Granny Smith', notes: 'Tart; great for baking' },
      { name: 'Braeburn', notes: 'Sweet-tart; aromatic' },
    ],
  },
  peach: {
    name: 'Peach', aliases: ['peaches', 'nectarine', 'peach tree'],
    scientificName: 'Prunus persica', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['garlic', 'basil', 'tansy', 'lavender', 'chive'],
    badCompanions: ['raspberry', 'tomato', 'potato'],
    notes: 'Needs chill hours in winter. Self-fertile; single tree will fruit.',
    daysToMaturity: { min: 1095, max: 1460 }, spacingCm: 600,
    varieties: [
      { name: 'Reliance', notes: 'Very cold-hardy; yellow flesh' },
      { name: 'Elberta', notes: 'Classic yellow freestone; excellent canning' },
      { name: 'Contender', notes: 'Cold-hardy; large; freestone' },
      { name: 'Nectarine', notes: 'Smooth-skinned peach; same care' },
    ],
  },
  cherry: {
    name: 'Cherry', aliases: ['cherries', 'cherry tree'],
    scientificName: 'Prunus avium', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['garlic', 'chive', 'marigold', 'lavender', 'nasturtium'],
    badCompanions: ['potato', 'tomato', 'grass'],
    notes: 'Sweet cherries need a pollinator. Sour/tart cherries are self-fertile.',
    daysToMaturity: { min: 1460, max: 2190 }, spacingCm: 600,
    varieties: [
      { name: 'Bing', notes: 'Large, dark red; sweet; classic' },
      { name: 'Rainier', notes: 'Yellow-red; very sweet; premium' },
      { name: 'Montmorency', notes: 'Sour/tart; self-fertile; pies' },
      { name: 'Stella', notes: 'Self-fertile sweet cherry; heavy producer' },
    ],
  },
  plum: {
    name: 'Plum', aliases: ['plums', 'plum tree', 'damson', 'prune plum'],
    scientificName: 'Prunus domestica', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['garlic', 'chive', 'marigold', 'lavender'],
    badCompanions: ['potato', 'tomato'],
    notes: 'European plums often self-fertile. Japanese plums need a pollinator.',
    daysToMaturity: { min: 1095, max: 1825 }, spacingCm: 500,
    varieties: [
      { name: 'Stanley', notes: 'European; self-fertile; excellent for drying' },
      { name: 'Santa Rosa', notes: 'Japanese; red skin, yellow flesh' },
      { name: 'Damson', notes: 'Small, tart; jam and preserves' },
      { name: 'Italian Prune', notes: 'Oval; dries easily; classic prune plum' },
    ],
  },
  gooseberry: {
    name: 'Gooseberry', aliases: ['gooseberries'],
    scientificName: 'Ribes uva-crispa', category: 'fruit',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['tomato', 'bean', 'pea', 'strawberry'],
    badCompanions: ['fennel', 'potato'],
    notes: 'Self-fertile. Cold-hardy. Thorny — wear gloves. Great for pies and jam.',
    daysToMaturity: { min: 730, max: 1095 }, spacingCm: 150,
    varieties: [
      { name: 'Invicta', notes: 'Very productive; large green berries; mildew resistant' },
      { name: 'Hinnonmaki Red', notes: 'Red; sweet; mildew resistant' },
      { name: 'Pixwell', notes: 'Pink-red; thornless; compact' },
    ],
  },
  currant: {
    name: 'Currant', aliases: ['currants', 'blackcurrant', 'redcurrant', 'whitecurrant'],
    scientificName: 'Ribes nigrum / Ribes rubrum', category: 'fruit',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['bean', 'pea', 'hyssop', 'sage'],
    badCompanions: ['fennel', 'pine'],
    notes: 'Self-fertile and cold-hardy. Black currants highest in vitamin C.',
    daysToMaturity: { min: 730, max: 1095 }, spacingCm: 150,
    varieties: [
      { name: 'Ben Sarek', notes: 'Black; compact; heavy fruiter; mildew resistant' },
      { name: 'Jonkheer van Tets', notes: 'Red; early; very productive' },
      { name: 'White Versailles', notes: 'White; very sweet; mild flavor' },
    ],
  },
  // ─── HERBS ───────────────────────────────────────────────────────────────────
  basil: {
    name: 'Basil', aliases: ['sweet basil', 'italian basil', 'ocimum'],
    scientificName: 'Ocimum basilicum', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 2,
    goodCompanions: ['tomato', 'pepper', 'oregano', 'marigold', 'asparagus'],
    badCompanions: ['sage', 'thyme', 'rosemary', 'fennel'],
    notes: 'Pinch flowers to keep producing. Grows in same bed as tomato beautifully.',
    daysToMaturity: { min: 25, max: 40 }, spacingCm: 25,
    varieties: [
      { name: 'Sweet/Italian', notes: 'Classic; large leaves' },
      { name: 'Thai', notes: 'Anise flavor; purple stems' },
      { name: 'Genovese', notes: 'Best for pesto; large crinkled' },
      { name: 'Purple/Dark Opal', notes: 'Ornamental; slightly spicy' },
      { name: 'Lemon', notes: 'Citrus flavor; good in fish dishes' },
      { name: 'Cinnamon', notes: 'Sweet spicy; Mexican cuisine' },
      { name: 'Spicy Globe', notes: 'Compact; great for containers' },
    ],
  },
  parsley: {
    name: 'Parsley', aliases: ['flat parsley', 'curly parsley', 'Italian parsley'],
    scientificName: 'Petroselinum crispum', category: 'herb',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['tomato', 'asparagus', 'pepper', 'carrot', 'corn', 'rose'],
    badCompanions: ['lettuce', 'onion', 'mint', 'fennel'],
    notes: 'Biennial. Attracts beneficial insects. Slow to germinate — soak seeds first.',
    daysToMaturity: { min: 70, max: 90 }, spacingCm: 20,
    varieties: [
      { name: 'Flat-leaf/Italian', notes: 'Stronger flavor; preferred for cooking' },
      { name: 'Curly', notes: 'Decorative; milder' },
      { name: 'Hamburg Root', notes: 'Grown for edible root' },
    ],
  },
  cilantro: {
    name: 'Cilantro', aliases: ['coriander', 'dhania', 'chinese parsley'],
    scientificName: 'Coriandrum sativum', category: 'herb',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['spinach', 'lettuce', 'bean', 'pea', 'tomato', 'dill'],
    badCompanions: ['fennel'],
    notes: 'Bolts in heat — plant in spring/fall or shade. Let some bolt for seeds (coriander).',
    daysToMaturity: { min: 45, max: 60 }, spacingCm: 15,
  },
  dill: {
    name: 'Dill', aliases: ['dillweed'],
    scientificName: 'Anethum graveolens', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 5,
    goodCompanions: ['cabbage', 'lettuce', 'onion', 'cucumber', 'broccoli', 'kale'],
    badCompanions: ['carrot', 'tomato', 'fennel', 'lavender'],
    notes: 'Attracts beneficial wasps. Keep away from fennel — they cross-pollinate.',
    daysToMaturity: { min: 40, max: 60 }, spacingCm: 30,
  },
  mint: {
    name: 'Mint', aliases: ['spearmint', 'peppermint', 'chocolate mint', 'apple mint', 'lemon mint'],
    scientificName: 'Mentha spp.', category: 'herb',
    sunRequirement: 'partial_sun', waterNeeds: 'high', waterIntervalDays: 2,
    goodCompanions: ['cabbage', 'pea', 'tomato', 'brassicas', 'carrot'],
    badCompanions: ['parsley'],
    notes: 'Spreads invasively — grow in buried containers. Repels pests.',
    daysToMaturity: { min: 60, max: 90 }, spacingCm: 30,
    varieties: [
      { name: 'Spearmint', notes: 'Milder; cooking and tea' },
      { name: 'Peppermint', notes: 'Strong menthol; tea and oil' },
      { name: 'Chocolate Mint', notes: 'Minty-chocolate scent; desserts' },
      { name: 'Apple Mint', notes: 'Woolly leaves; mild, fruity' },
      { name: 'Lemon Balm', notes: 'Lemon scent; calming tea' },
    ],
  },
  rosemary: {
    name: 'Rosemary', aliases: ['ros marinus'],
    scientificName: 'Salvia rosmarinus', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 10,
    goodCompanions: ['carrot', 'sage', 'bean', 'brassicas', 'onion'],
    badCompanions: ['cucumber', 'pumpkin', 'potato', 'tomato'],
    notes: 'Drought-tolerant Mediterranean herb. Repels carrot fly and bean beetles.',
    daysToMaturity: { min: 80, max: 180 }, spacingCm: 45,
    varieties: [
      { name: 'Common/Upright', notes: 'Standard cooking; 1–2m tall' },
      { name: 'Prostrate', notes: 'Ground cover; cascading' },
      { name: 'Tuscan Blue', notes: 'Vigorous; large leaves; culinary' },
    ],
  },
  thyme: {
    name: 'Thyme', aliases: ['common thyme', 'garden thyme', 'lemon thyme'],
    scientificName: 'Thymus vulgaris', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 8,
    goodCompanions: ['brassicas', 'tomato', 'eggplant', 'potato', 'strawberry', 'rose'],
    badCompanions: ['basil', 'cilantro'],
    notes: 'Drought tolerant. Repels cabbage worm and whitefly.',
    daysToMaturity: { min: 90, max: 180 }, spacingCm: 30,
    varieties: [
      { name: 'Common/English', notes: 'Most culinary use' },
      { name: 'Lemon', notes: 'Citrus flavor; ornamental' },
      { name: 'French/Summer', notes: 'Milder; annual' },
    ],
  },
  sage: {
    name: 'Sage', aliases: ['common sage', 'garden sage', 'culinary sage'],
    scientificName: 'Salvia officinalis', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 8,
    goodCompanions: ['carrot', 'cabbage', 'strawberry', 'rosemary', 'tomato', 'bean', 'brassicas'],
    badCompanions: ['onion', 'basil', 'cucumber', 'rue'],
    notes: 'Repels cabbage moth and carrot fly. Avoid moist soil.',
    daysToMaturity: { min: 75, max: 200 }, spacingCm: 40,
    varieties: [
      { name: 'Common/Garden', notes: 'Grey-green; best culinary' },
      { name: 'Purple', notes: 'Ornamental; milder' },
      { name: 'Tricolor', notes: 'Pink, white, purple; decorative' },
      { name: 'Pineapple', notes: 'Fruity scent; red flowers' },
    ],
  },
  oregano: {
    name: 'Oregano', aliases: ['marjoram', 'greek oregano', 'wild marjoram'],
    scientificName: 'Origanum vulgare', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['tomato', 'pepper', 'basil', 'asparagus', 'cucumber'],
    badCompanions: [],
    notes: 'Essential for Mediterranean cooking. Repels aphids and spider mites.',
    daysToMaturity: { min: 80, max: 100 }, spacingCm: 30,
    varieties: [
      { name: 'Greek', notes: 'Most pungent; best for drying' },
      { name: 'Italian', notes: 'Milder; also called sweet marjoram' },
    ],
  },
  tarragon: {
    name: 'Tarragon', aliases: ['french tarragon', 'estragon'],
    scientificName: 'Artemisia dracunculus', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 6,
    goodCompanions: ['eggplant', 'pepper', 'brassicas'],
    badCompanions: [],
    notes: 'French tarragon (culinary) must be propagated from cuttings, not seed.',
    daysToMaturity: { min: 60, max: 90 }, spacingCm: 30,
  },
  lavender: {
    name: 'Lavender', aliases: ['english lavender', 'french lavender', 'true lavender'],
    scientificName: 'Lavandula angustifolia', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 10,
    goodCompanions: ['rose', 'brassicas', 'apple', 'thyme', 'sage'],
    badCompanions: ['dill'],
    notes: 'Attracts pollinators. Repels deer and rabbits. Excellent near fruit trees.',
    daysToMaturity: { min: 90, max: 200 }, spacingCm: 45,
  },
  lemon_balm: {
    name: 'Lemon Balm', aliases: ['melissa', 'bee balm'],
    scientificName: 'Melissa officinalis', category: 'herb',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['tomato', 'squash', 'pumpkin', 'all vegetables'],
    badCompanions: [],
    notes: 'Attracts bees and pollinators. Can spread — best in a container.',
    daysToMaturity: { min: 70, max: 100 }, spacingCm: 45,
  },
  chamomile: {
    name: 'Chamomile', aliases: ['german chamomile', 'roman chamomile', 'mayweed'],
    scientificName: 'Matricaria chamomilla', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 6,
    goodCompanions: ['cabbage', 'onion', 'cucumber', 'all brassicas'],
    badCompanions: [],
    notes: '"The plant\'s physician" — improves health of neighbors. Calming tea.',
    daysToMaturity: { min: 60, max: 90 }, spacingCm: 20,
  },
  borage: {
    name: 'Borage', aliases: ['starflower'],
    scientificName: 'Borago officinalis', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['tomato', 'strawberry', 'squash', 'cucumber', 'brassicas'],
    badCompanions: [],
    notes: 'Deters tomato hornworm. Edible blue flowers. Self-seeds prolifically.',
    daysToMaturity: { min: 50, max: 70 }, spacingCm: 30,
  },
  hyssop: {
    name: 'Hyssop', aliases: [],
    scientificName: 'Hyssopus officinalis', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 8,
    goodCompanions: ['cabbage', 'grape', 'brassicas'],
    badCompanions: ['radish', 'fennel'],
    notes: 'Repels cabbage moth and flea beetle.',
    daysToMaturity: { min: 80, max: 100 }, spacingCm: 30,
  },
  lemongrass: {
    name: 'Lemongrass', aliases: ['lemon grass', 'citronella grass'],
    scientificName: 'Cymbopogon citratus', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['tomato', 'pepper', 'basil'],
    badCompanions: [],
    notes: 'Natural mosquito repellent. Tender perennial — bring indoors in cold climates.',
    daysToMaturity: { min: 90, max: 120 }, spacingCm: 60,
  },
  stevia: {
    name: 'Stevia', aliases: ['sweetleaf', 'sugar leaf'],
    scientificName: 'Stevia rebaudiana', category: 'herb',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['tomato', 'pepper'],
    badCompanions: [],
    notes: '200x sweeter than sugar. Harvest before flowering for best taste.',
    daysToMaturity: { min: 90, max: 120 }, spacingCm: 30,
  },
  bay: {
    name: 'Bay Laurel', aliases: ['bay', 'bay leaf', 'sweet bay', 'laurel'],
    scientificName: 'Laurus nobilis', category: 'herb',
    sunRequirement: 'partial_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['all vegetables', 'beans', 'tomato'],
    badCompanions: [],
    notes: 'Slow-growing tree/shrub. Repels weevils and moths. Harvest leaves year-round.',
    daysToMaturity: { min: 365, max: 730 }, spacingCm: 100,
  },
  // ─── FLOWERS ─────────────────────────────────────────────────────────────────
  marigold: {
    name: 'Marigold', aliases: ['french marigold', 'african marigold', 'tagetes'],
    scientificName: 'Tagetes spp.', category: 'flower',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 6,
    goodCompanions: ['tomato', 'pepper', 'cucumber', 'squash', 'rose', 'basil', 'eggplant'],
    badCompanions: ['bean', 'cabbage'],
    notes: 'Nematode repellent in soil. Universal pest deterrent. Plant everywhere.',
    daysToMaturity: { min: 45, max: 70 }, spacingCm: 20,
    varieties: [
      { name: 'French', notes: 'Compact; best nematode control' },
      { name: 'African', notes: 'Tall; strong scent; more ornamental' },
      { name: 'Signet', notes: 'Lacy foliage; edible flowers; licorice scent' },
    ],
  },
  nasturtium: {
    name: 'Nasturtium', aliases: ['nasturtiums', 'garden nasturtium'],
    scientificName: 'Tropaeolum majus', category: 'flower',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['tomato', 'squash', 'cucumber', 'brassicas', 'fruit_trees', 'bean'],
    badCompanions: ['fennel'],
    notes: 'Edible leaves and flowers. Trap crop for aphids. Poor soil = more flowers.',
    daysToMaturity: { min: 35, max: 55 }, spacingCm: 30,
  },
  sunflower: {
    name: 'Sunflower', aliases: ['sunflowers', 'helianthus'],
    scientificName: 'Helianthus annuus', category: 'flower',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['cucumber', 'corn', 'squash', 'tomato', 'lettuce'],
    badCompanions: ['potato', 'bean', 'pole_bean'],
    notes: 'Provides shade for lettuce. Birds eat seeds — plant away from strawberries.',
    daysToMaturity: { min: 60, max: 90 }, spacingCm: 45,
    varieties: [
      { name: 'Giant', notes: 'Tall; 1.8–3m; large seed heads' },
      { name: 'Dwarf', notes: 'Under 90cm; container-friendly' },
      { name: 'Multi-branching', notes: 'Many flowers; cut flower' },
    ],
  },
  calendula: {
    name: 'Calendula', aliases: ['pot marigold', 'calendula', 'English marigold'],
    scientificName: 'Calendula officinalis', category: 'flower',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 5,
    goodCompanions: ['tomato', 'asparagus', 'carrot', 'pea', 'all vegetables'],
    badCompanions: [],
    notes: 'Edible flowers. Medicinal. Attracts aphids away from vegetables (trap crop).',
    daysToMaturity: { min: 45, max: 60 }, spacingCm: 25,
  },
  cosmos: {
    name: 'Cosmos', aliases: ['cosmos flowers', 'mexican aster'],
    scientificName: 'Cosmos bipinnatus', category: 'flower',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 7,
    goodCompanions: ['vegetable garden', 'all vegetables'],
    badCompanions: [],
    notes: 'Attracts beneficial insects. Thrives on neglect — poor soil, no fertilizer.',
    daysToMaturity: { min: 55, max: 70 }, spacingCm: 30,
  },
  zinnia: {
    name: 'Zinnia', aliases: ['zinnias'],
    scientificName: 'Zinnia elegans', category: 'flower',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['tomato', 'pepper', 'cucumber', 'squash'],
    badCompanions: [],
    notes: 'Attracts butterflies and beneficial insects. Great cut flower.',
    daysToMaturity: { min: 55, max: 70 }, spacingCm: 25,
  },
  sweet_alyssum: {
    name: 'Sweet Alyssum', aliases: ['alyssum', 'lobularia'],
    scientificName: 'Lobularia maritima', category: 'flower',
    sunRequirement: 'full_sun', waterNeeds: 'low', waterIntervalDays: 5,
    goodCompanions: ['all vegetables', 'tomato', 'brassicas', 'strawberry'],
    badCompanions: [],
    notes: 'Attracts hoverflies (aphid predators). Honey scent. Living mulch.',
    daysToMaturity: { min: 45, max: 60 }, spacingCm: 15,
  },
  // ─── FRUITS ──────────────────────────────────────────────────────────────────
  strawberry: {
    name: 'Strawberry', aliases: ['strawberries'],
    scientificName: 'Fragaria × ananassa', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 3,
    goodCompanions: ['bean', 'lettuce', 'spinach', 'sage', 'borage', 'thyme', 'onion', 'carrot'],
    badCompanions: ['cabbage', 'broccoli', 'fennel', 'cauliflower'],
    notes: 'Borage deters pests and improves flavor. Replace every 3 years.',
    daysToMaturity: { min: 60, max: 90 }, spacingCm: 30,
    varieties: [
      { name: 'June-bearing', notes: 'Large crop once a year; June' },
      { name: 'Everbearing', notes: 'Two crops; spring and fall' },
      { name: 'Day-neutral', notes: 'Continuous throughout season' },
      { name: 'Alpine', notes: 'Small; wild type; intense flavor' },
    ],
  },
  raspberry: {
    name: 'Raspberry', aliases: ['raspberries'],
    scientificName: 'Rubus idaeus', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['garlic', 'marigold', 'yarrow', 'tansy', 'rue'],
    badCompanions: ['potato', 'tomato', 'eggplant', 'blackberry'],
    notes: 'Don\'t plant near tomatoes or potatoes — share verticillium wilt.',
    daysToMaturity: { min: 365, max: 730 }, spacingCm: 60,
  },
  blueberry: {
    name: 'Blueberry', aliases: ['blueberries'],
    scientificName: 'Vaccinium corymbosum', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'medium', waterIntervalDays: 4,
    goodCompanions: ['strawberry', 'azalea', 'rhododendron', 'heather', 'thyme'],
    badCompanions: ['tomato', 'pepper', 'eggplant'],
    notes: 'Needs acidic soil (pH 4.5–5.5). Plant 2+ varieties for best yield.',
    daysToMaturity: { min: 730, max: 1095 }, spacingCm: 150,
    varieties: [
      { name: 'Highbush', notes: 'Most common; 1.5–2m tall' },
      { name: 'Lowbush', notes: 'Groundcover; cold-hardy; small berries' },
      { name: 'Half-high', notes: 'Cross; compact; cold-hardy' },
      { name: 'Rabbiteye', notes: 'Southern US; heat tolerant' },
    ],
  },
  rhubarb: {
    name: 'Rhubarb', aliases: ['rhubarb', 'pie plant'],
    scientificName: 'Rheum rhabarbarum', category: 'fruit',
    sunRequirement: 'partial_sun', waterNeeds: 'medium', waterIntervalDays: 5,
    goodCompanions: ['onion', 'garlic', 'cabbage', 'rose'],
    badCompanions: ['dock', 'rumex'],
    notes: 'Leaves are toxic! Only eat stalks. Perennial — needs cold dormancy.',
    daysToMaturity: { min: 365, max: 730 }, spacingCm: 90,
  },
  watermelon: {
    name: 'Watermelon', aliases: ['watermelons'],
    scientificName: 'Citrullus lanatus', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 3,
    goodCompanions: ['corn', 'nasturtium', 'marigold', 'radish', 'oregano'],
    badCompanions: ['potato', 'fennel', 'cucumber'],
    notes: 'Needs long warm season and lots of space. Reduce water as fruit matures.',
    daysToMaturity: { min: 70, max: 90 }, spacingCm: 150,
    varieties: [
      { name: 'Crimson Sweet', notes: 'Large; classic; 80 days' },
      { name: 'Sugar Baby', notes: 'Icebox type; compact; 75 days' },
      { name: 'Yellow Doll', notes: 'Yellow flesh; sweet; 65 days' },
      { name: 'Seedless', notes: 'Requires pollenizer nearby' },
    ],
  },
  cantaloupe: {
    name: 'Cantaloupe', aliases: ['muskmelon', 'rockmelon', 'honeydew', 'melon'],
    scientificName: 'Cucumis melo', category: 'fruit',
    sunRequirement: 'full_sun', waterNeeds: 'high', waterIntervalDays: 3,
    goodCompanions: ['corn', 'nasturtium', 'marigold', 'radish', 'sunflower'],
    badCompanions: ['potato', 'fennel'],
    notes: 'Reduce water as fruit matures for sweeter flavor.',
    daysToMaturity: { min: 70, max: 90 }, spacingCm: 120,
  },
};

// ─── LOOKUP HELPERS ──────────────────────────────────────────────────────────

export function findPlantKey(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  // Exact key match
  if (PLANT_CATALOG[lower]) return lower;
  // Alias search
  for (const [key, entry] of Object.entries(PLANT_CATALOG)) {
    if (entry.name.toLowerCase() === lower) return key;
    if (entry.aliases.some((a) => a === lower || lower.includes(a) || a.includes(lower))) return key;
  }
  return null;
}

export type CompatibilityResult = 'good' | 'bad' | 'neutral' | 'unknown';

export function getCompatibility(plantA: string, plantB: string): CompatibilityResult {
  const keyA = findPlantKey(plantA);
  const keyB = findPlantKey(plantB);
  if (!keyA || !keyB) return 'unknown';
  if (keyA === keyB) return 'neutral';
  const a = PLANT_CATALOG[keyA];
  if (a.goodCompanions.includes(keyB)) return 'good';
  if (a.badCompanions.includes(keyB)) return 'bad';
  const b = PLANT_CATALOG[keyB];
  if (b.goodCompanions.includes(keyA)) return 'good';
  if (b.badCompanions.includes(keyA)) return 'bad';
  return 'neutral';
}

export type SunCompatibility = 'match' | 'tolerable' | 'mismatch';

export function getSunCompatibility(
  plantSun: SunRequirement,
  gardenSun: SunRequirement
): SunCompatibility {
  if (plantSun === gardenSun) return 'match';
  if (plantSun === 'full_sun' && gardenSun === 'partial_sun') return 'tolerable';
  if (plantSun === 'partial_sun' && gardenSun === 'full_sun') return 'tolerable';
  if (plantSun === 'partial_sun' && gardenSun === 'shade') return 'tolerable';
  return 'mismatch';
}

export function searchPlants(query: string, limit = 10): Array<{ key: string; entry: CatalogEntry }> {
  if (!query.trim()) return [];
  const lower = query.toLowerCase().trim();
  const results: Array<{ key: string; entry: CatalogEntry; score: number }> = [];
  for (const [key, entry] of Object.entries(PLANT_CATALOG)) {
    let score = 0;
    if (entry.name.toLowerCase().startsWith(lower)) score = 10;
    else if (entry.name.toLowerCase().includes(lower)) score = 7;
    else if (entry.aliases.some((a) => a.startsWith(lower))) score = 8;
    else if (entry.aliases.some((a) => a.includes(lower))) score = 5;
    else if (key.startsWith(lower)) score = 6;
    if (score > 0) results.push({ key, entry, score });
  }
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ key, entry }) => ({ key, entry }));
}

export const SUN_LABELS: Record<SunRequirement, string> = {
  full_sun: 'Full sun (6+ hrs)',
  partial_sun: 'Partial sun (3–6 hrs)',
  shade: 'Shade (<3 hrs)',
};

export const SUN_EMOJIS: Record<SunRequirement, string> = {
  full_sun: '☀️',
  partial_sun: '⛅',
  shade: '🌥️',
};

export const WATER_LABELS: Record<WaterNeeds, string> = {
  low: 'Low – drought tolerant',
  medium: 'Medium – regular watering',
  high: 'High – consistent moisture',
};

export const WATER_EMOJIS: Record<WaterNeeds, string> = {
  low: '🌵',
  medium: '💧',
  high: '🌊',
};

// Backward-compat re-export so existing imports of companion-plants still work
export const PLANTS = PLANT_CATALOG;
