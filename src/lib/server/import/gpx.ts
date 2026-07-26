import { SaxesParser } from 'saxes';
import sanitizeHtml from 'sanitize-html';
import type { RawImportCandidate } from './common';

const MAX_WAYPOINTS = 10_000;
const MAX_DEPTH = 64;
const MAX_TEXT_LENGTH = 100_000;
const MAX_EXTENSION_PROPERTIES_SIZE = 65_536;

interface GpxWaypoint {
  index: number;
  latitude: string;
  longitude: string;
  name: string;
  address: string;
  description: string;
  comment: string;
  type: string;
  time: string;
  elevation: string;
  symbol: string;
  sourceUrl: string;
  extensions: Record<string, string>;
  warnings: string[];
}

function localName(name: string): string {
  return name.split(':').at(-1)!.toLowerCase();
}

function extensionKey(qualifiedName: string): string {
  const normalized = qualifiedName.toLowerCase().replaceAll(/[^a-z0-9_.:-]/g, '');
  const local = localName(normalized);
  return normalized.startsWith('osmand:') ? `osmand.${local}` : `gpx.extension.${normalized}`;
}

function plainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).trim();
}

function safeHttpUrl(value: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function finalizeWaypoint(waypoint: GpxWaypoint): RawImportCandidate {
  const warnings = [...waypoint.warnings];
  const fallbackName = `Waypoint ${waypoint.index}`;
  if (!waypoint.name) warnings.push(`Waypoint had no name and was named "${fallbackName}".`);

  const extensionAddress =
    waypoint.extensions['osmand.address'] ?? waypoint.extensions['gpx.extension.address'] ?? '';
  const extensionDescription =
    waypoint.extensions['osmand.description'] ??
    waypoint.extensions['gpx.extension.description'] ??
    '';
  const rawSourceUrl =
    waypoint.sourceUrl ||
    waypoint.extensions['osmand.website'] ||
    waypoint.extensions['osmand.url'] ||
    '';
  const sourceUrl = safeHttpUrl(rawSourceUrl);
  if (rawSourceUrl && !sourceUrl) warnings.push('A non-HTTP source URL was ignored.');

  const extraProperties: Record<string, unknown> = { ...waypoint.extensions };
  if (waypoint.time) extraProperties['gpx.time'] = waypoint.time;
  if (waypoint.elevation) extraProperties['gpx.elevation'] = waypoint.elevation;
  if (waypoint.symbol) extraProperties['gpx.symbol'] = waypoint.symbol;
  if (waypoint.type) extraProperties['gpx.type'] = waypoint.type;

  if (JSON.stringify(extraProperties).length > MAX_EXTENSION_PROPERTIES_SIZE) {
    for (const key of Object.keys(extraProperties)) delete extraProperties[key];
    warnings.push('GPX extension properties exceeded 64 KiB and were discarded.');
  }

  return {
    sourceLabel: waypoint.name || fallbackName,
    name: waypoint.name || fallbackName,
    latitude: waypoint.latitude,
    longitude: waypoint.longitude,
    address: plainText(waypoint.address || extensionAddress),
    description: plainText(waypoint.description || waypoint.comment || extensionDescription),
    status: 'saved',
    favorite: true,
    sourceUrl,
    extraProperties,
    warnings
  };
}

export function parseGpxImport(content: string): RawImportCandidate[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(content)) throw new Error('GPX DTDs and entities are not allowed');

  const records: RawImportCandidate[] = [];
  const parser = new SaxesParser({ xmlns: false });
  const elementStack: string[] = [];
  const qualifiedNameStack: string[] = [];
  const textStack: string[] = [];
  let waypoint: GpxWaypoint | null = null;
  let sawGpxRoot = false;
  let routeCount = 0;
  let trackCount = 0;

  parser.on('opentag', (tag) => {
    if (elementStack.length >= MAX_DEPTH) throw new Error('GPX nesting is too deep');
    const qualifiedName = tag.name;
    const name = localName(qualifiedName);
    const parent = elementStack.at(-1);

    elementStack.push(name);
    qualifiedNameStack.push(qualifiedName);
    textStack.push('');

    if (elementStack.length === 1 && name === 'gpx') sawGpxRoot = true;
    if (name === 'rte') routeCount += 1;
    if (name === 'trk') trackCount += 1;

    if (name === 'wpt') {
      if (waypoint) throw new Error('Nested GPX waypoints are not supported');
      if (records.length >= MAX_WAYPOINTS) {
        throw new Error(`GPX contains more than ${MAX_WAYPOINTS.toLocaleString()} waypoints`);
      }
      waypoint = {
        index: records.length + 1,
        latitude: String((tag.attributes as Record<string, string>).lat ?? ''),
        longitude: String((tag.attributes as Record<string, string>).lon ?? ''),
        name: '',
        address: '',
        description: '',
        comment: '',
        type: '',
        time: '',
        elevation: '',
        symbol: '',
        sourceUrl: '',
        extensions: {},
        warnings: []
      };
    }

    if (waypoint && parent === 'wpt' && name === 'link') {
      waypoint.sourceUrl = String((tag.attributes as Record<string, string>).href ?? '');
    }
  });

  const appendText = (value: string) => {
    const index = textStack.length - 1;
    if (index < 0) return;
    textStack[index] += value;
    if (textStack[index].length > MAX_TEXT_LENGTH) {
      throw new Error('A GPX text field is too large');
    }
  };
  parser.on('text', appendText);
  parser.on('cdata', appendText);

  parser.on('closetag', (tag) => {
    const name = localName(typeof tag === 'string' ? tag : tag.name);
    const parent = elementStack.at(-2);
    const qualifiedName = qualifiedNameStack.at(-1) ?? name;
    const value = (textStack.at(-1) ?? '').trim();
    const insideExtensions = elementStack.includes('extensions');

    if (waypoint) {
      if (parent === 'wpt') {
        if (name === 'name') waypoint.name = value;
        if (name === 'address') waypoint.address = value;
        if (name === 'desc') waypoint.description = value;
        if (name === 'cmt') waypoint.comment = value;
        if (name === 'type') waypoint.type = value;
        if (name === 'time') waypoint.time = value;
        if (name === 'ele') waypoint.elevation = value;
        if (name === 'sym') waypoint.symbol = value;
        if (name === 'url' && !waypoint.sourceUrl) waypoint.sourceUrl = value;
      }

      if (insideExtensions && value && name !== 'extensions') {
        const key = extensionKey(qualifiedName);
        if (Object.keys(waypoint.extensions).length < 100) {
          waypoint.extensions[key] = value.slice(0, 2_000);
        }
      }

      if (name === 'wpt') {
        records.push(finalizeWaypoint(waypoint));
        waypoint = null;
      }
    }

    elementStack.pop();
    qualifiedNameStack.pop();
    textStack.pop();
  });

  parser.write(content).close();

  if (!sawGpxRoot) throw new Error('File is not a GPX document');
  if (!records.length) {
    if (routeCount || trackCount) {
      throw new Error('GPX contains no waypoints. Tracks and routes are not imported as places.');
    }
    throw new Error('GPX contains no waypoints to import');
  }

  if (routeCount || trackCount) {
    const skipped = [
      routeCount ? `${routeCount} route${routeCount === 1 ? '' : 's'}` : '',
      trackCount ? `${trackCount} track${trackCount === 1 ? '' : 's'}` : ''
    ]
      .filter(Boolean)
      .join(' and ');
    for (const record of records) {
      record.warnings = [
        ...(record.warnings ?? []),
        `Skipped ${skipped}; only waypoints are imported.`
      ];
    }
  }

  return records;
}
