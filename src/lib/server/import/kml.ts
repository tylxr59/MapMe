import { SaxesParser } from 'saxes';
import sanitizeHtml from 'sanitize-html';
import type { RawImportCandidate } from './common';

interface Placemark {
  name: string;
  address: string;
  description: string;
  coordinates: string;
  dataName: string;
  extended: Record<string, string>;
  folders: string[];
  insidePoint: boolean;
}

function localName(name: string): string {
  return name.split(':').at(-1)!.toLowerCase();
}

export function parseKmlImport(content: string): RawImportCandidate[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new Error('KML DTDs and entities are not allowed');
  const records: RawImportCandidate[] = [];
  const parser = new SaxesParser({ xmlns: false });
  const elementStack: string[] = [];
  const folderStack: Array<{ depth: number; name: string }> = [];
  let text = '';
  let placemark: Placemark | null = null;

  parser.on('opentag', (tag) => {
    if (elementStack.length > 64) throw new Error('KML nesting is too deep');
    const name = localName(tag.name);
    elementStack.push(name);
    text = '';
    if (name === 'placemark') {
      placemark = {
        name: '',
        address: '',
        description: '',
        coordinates: '',
        dataName: '',
        extended: {},
        folders: folderStack.map((folder) => folder.name).filter(Boolean),
        insidePoint: false
      };
    }
    if (placemark && name === 'point') placemark.insidePoint = true;
    if (placemark && name === 'data') {
      placemark.dataName = String((tag.attributes as any).name ?? '').slice(0, 100);
    }
    if (name === 'folder') folderStack.push({ depth: elementStack.length, name: '' });
  });
  parser.on('text', (value) => {
    text += value;
    if (text.length > 100_000) throw new Error('A KML text field is too large');
  });
  parser.on('cdata', (value) => {
    text += value;
    if (text.length > 100_000) throw new Error('A KML text field is too large');
  });
  parser.on('closetag', (tag) => {
    const name = localName(typeof tag === 'string' ? tag : tag.name);
    const value = text.trim();
    if (placemark) {
      if (name === 'name') placemark.name = value;
      if (name === 'address') placemark.address = value;
      if (name === 'description') placemark.description = value;
      if (name === 'coordinates' && placemark.insidePoint) placemark.coordinates = value;
      if (name === 'value' && placemark.dataName) {
        placemark.extended[placemark.dataName] = value;
      }
      if (name === 'data') placemark.dataName = '';
      if (name === 'point') placemark.insidePoint = false;
      if (name === 'placemark') {
        const coordinate = placemark.coordinates.split(/\s+/)[0]?.split(',') ?? [];
        records.push({
          sourceLabel: placemark.name || `Placemark ${records.length + 1}`,
          name: placemark.name,
          longitude: coordinate[0],
          latitude: coordinate[1],
          address: placemark.address || placemark.extended.address,
          description: sanitizeHtml(placemark.description || placemark.extended.description || '', {
            allowedTags: [],
            allowedAttributes: {}
          }),
          category: placemark.extended.category,
          status: placemark.extended.status,
          rating: placemark.extended.rating,
          dateVisited: placemark.extended.dateVisited ?? placemark.extended.date_visited,
          sourceUrl: placemark.extended.sourceUrl ?? placemark.extended.source_url,
          extraProperties: Object.fromEntries(
            Object.entries(placemark.extended)
              .filter(
                ([key]) =>
                  ![
                    'address',
                    'description',
                    'category',
                    'tags',
                    'status',
                    'rating',
                    'dateVisited',
                    'date_visited',
                    'sourceUrl',
                    'source_url'
                  ].includes(key)
              )
              .map(([key, data]) => [`kml.${key}`, data])
          ),
          warnings: placemark.coordinates ? [] : ['Placemark has no Point coordinates.']
        });
        placemark = null;
      }
    } else if (name === 'name' && folderStack.length) {
      folderStack[folderStack.length - 1].name = value;
    }
    if (name === 'folder') folderStack.pop();
    elementStack.pop();
    text = '';
  });
  parser.write(content).close();
  return records.slice(0, 10_000);
}
