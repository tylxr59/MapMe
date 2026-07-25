import iconNodes from 'lucide-static/icon-nodes.json';

type IconNode = [string, Record<string, string>];
const icons = iconNodes as unknown as Record<string, IconNode[]>;

export const suggestedCategoryIcons = [
  'pin',
  'utensils',
  'footprints',
  'coffee',
  'shopping-bag',
  'mountain-snow',
  'camera',
  'ticket',
  'trees',
  'waves',
  'building-2',
  'landmark',
  'music',
  'beer',
  'ice-cream-bowl',
  'bike',
  'tent-tree',
  'binoculars',
  'palette',
  'star'
] as const;

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
