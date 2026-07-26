import iconNodes from 'lucide-static/icon-nodes.json';

type IconNode = [string, Record<string, string>];
const icons = iconNodes as unknown as Record<string, IconNode[]>;

export const suggestedCategoryIcons = [
  'pin',
  'map-pin',
  'map',
  'compass',
  'navigation',
  'route',
  'target',
  'crosshair',
  'utensils',
  'utensils-crossed',
  'chef-hat',
  'pizza',
  'sandwich',
  'soup',
  'salad',
  'beef',
  'vegan',
  'footprints',
  'coffee',
  'wine',
  'martini',
  'cup-soda',
  'cake-slice',
  'cookie',
  'shopping-bag',
  'shopping-cart',
  'store',
  'shirt',
  'gift',
  'gem',
  'mountain-snow',
  'mountain',
  'tent-tree',
  'backpack',
  'tree-pine',
  'trees',
  'binoculars',
  'telescope',
  'fish',
  'bird',
  'paw-print',
  'dog',
  'cat',
  'flower-2',
  'leaf',
  'sun',
  'moon',
  'snowflake',
  'camera',
  'flashlight',
  'ticket',
  'clapperboard',
  'theater',
  'ferris-wheel',
  'roller-coaster',
  'gamepad-2',
  'dice-5',
  'drama',
  'guitar',
  'music',
  'headphones',
  'palette',
  'waves-horizontal',
  'sailboat',
  'ship',
  'anchor',
  'kayak',
  'building-2',
  'building',
  'house',
  'warehouse',
  'factory',
  'castle',
  'church',
  'landmark',
  'library',
  'book-open',
  'school',
  'graduation-cap',
  'brick-wall',
  'construction',
  'hard-hat',
  'pickaxe',
  'hammer',
  'wrench',
  'key-round',
  'skull',
  'ghost',
  'beer',
  'ice-cream-bowl',
  'bike',
  'motorbike',
  'car-front',
  'truck',
  'caravan',
  'tractor',
  'bus-front',
  'train-front',
  'plane',
  'fuel',
  'square-parking',
  'hospital',
  'ambulance',
  'heart-pulse',
  'pill',
  'dumbbell',
  'accessibility',
  'baby',
  'shield',
  'siren',
  'flame',
  'droplets',
  'zap',
  'radio-tower',
  'wifi',
  'recycle',
  'briefcase-business',
  'banknote',
  'scale',
  'gavel',
  'star'
] as const satisfies readonly string[];

export const categoryIconNames = Object.freeze(Object.keys(icons).sort());

const iconAliases: Record<string, string> = {
  target: 'shooting range gun firearms archery bullseye',
  crosshair: 'shooting range gun firearms tactical',
  truck: 'overlanding offroad 4x4 truck trail vehicle',
  caravan: 'overlanding rv camper camping road trip',
  'car-front': 'overlanding offroad 4x4 automotive',
  mountain: 'overlanding offroad trail hiking outdoors',
  warehouse: 'urbex abandoned industrial exploration',
  factory: 'urbex abandoned industrial exploration',
  'building-2': 'urbex abandoned city urban exploration',
  flashlight: 'urbex cave abandoned exploration night',
  'brick-wall': 'ruins abandoned historic urbex',
  castle: 'ruins historic fort palace',
  'tent-tree': 'camping campground outdoors campsite',
  footprints: 'hiking walking trail trek',
  'waves-horizontal': 'beach swimming water surf',
  'square-parking': 'parking garage car lot',
  fuel: 'gas petrol charging service station',
  utensils: 'restaurant food dining',
  coffee: 'cafe coffee shop',
  'shopping-bag': 'shopping retail mall',
  hospital: 'medical doctor clinic health',
  'heart-pulse': 'medical doctor clinic health',
  church: 'religious worship temple mosque synagogue',
  landmark: 'museum history monument attraction',
  camera: 'photo viewpoint scenic photography',
  'tree-pine': 'park forest nature outdoors',
  dumbbell: 'gym fitness exercise',
  'book-open': 'bookstore books reading',
  library: 'books reading study',
  music: 'concert venue live music',
  theater: 'cinema movies performance',
  ticket: 'event venue attraction',
  'paw-print': 'pet animal veterinary',
  dog: 'dog park pet animal',
  plane: 'airport aviation travel',
  'train-front': 'train railway station transit',
  'bus-front': 'bus station transit',
  ship: 'port ferry cruise marina',
  sailboat: 'marina boating sailing',
  bike: 'cycling bicycle trail',
  motorbike: 'motorcycle riding',
  'graduation-cap': 'college university education',
  school: 'education classroom',
  'briefcase-business': 'office work coworking',
  siren: 'police emergency fire station',
  flame: 'fire station firepit barbecue'
};

function fuzzyScore(haystack: string, needle: string): number {
  if (haystack === needle) return 1_000;
  if (haystack.startsWith(needle)) return 700 - haystack.length;
  const substring = haystack.indexOf(needle);
  if (substring >= 0) return 500 - substring;

  let cursor = 0;
  let gap = 0;
  for (const character of needle) {
    const next = haystack.indexOf(character, cursor);
    if (next < 0) return -1;
    gap += next - cursor;
    cursor = next + 1;
  }
  return 150 - gap;
}

export function searchCategoryIcons(query: string, limit = 36): string[] {
  const terms = query
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);

  if (!terms.length) return [...suggestedCategoryIcons].filter(isValidCategoryIcon).slice(0, limit);

  return categoryIconNames
    .map((name) => {
      const searchable = `${name} ${iconAliases[name] ?? ''}`;
      const scores = terms.map((term) =>
        Math.max(...searchable.split(/\s+/).map((word) => fuzzyScore(word, term)))
      );
      return {
        name,
        score: scores.every((score) => score >= 0) ? scores.reduce((a, b) => a + b) : -1
      };
    })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((item) => item.name);
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function isValidCategoryIcon(name: string): boolean {
  return Object.hasOwn(icons, name);
}

export function categoryIconSvg(name: string): string {
  const nodes = icons[name] ?? icons['pin'];
  const body = nodes
    .map(([element, attributes]) => {
      const safeElement = [
        'path',
        'circle',
        'line',
        'polyline',
        'polygon',
        'rect',
        'ellipse'
      ].includes(element)
        ? element
        : 'path';
      const attrs = Object.entries(attributes)
        .map(([key, value]) => `${key}="${escapeAttribute(String(value))}"`)
        .join(' ');
      return `<${safeElement} ${attrs}></${safeElement}>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
