import { describe, expect, it } from 'vitest';
import { parseCsvImport } from '$lib/server/import/csv';
import { parseGeoJsonImport } from '$lib/server/import/geojson';
import { parseKmlImport } from '$lib/server/import/kml';

describe('GeoJSON import', () => {
  it('reads point geometry and preserves unknown properties', () => {
    const [record] = parseGeoJsonImport(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [-73.9, 40.7] },
            properties: { name: 'Cafe', custom: 'remember this' }
          }
        ]
      })
    );
    expect(record.name).toBe('Cafe');
    expect(record.longitude).toBe(-73.9);
    expect(record.extraProperties).toEqual({ custom: 'remember this' });
  });
});

describe('CSV import', () => {
  it('supports quoted fields and JSON tags', () => {
    const [record] = parseCsvImport(
      'name,latitude,longitude,tags,description\nCafe,40.7,-73.9,"[""coffee""]","Nice, quiet"\n'
    );
    expect(record.name).toBe('Cafe');
    expect(record.description).toBe('Nice, quiet');
  });
});

describe('KML import', () => {
  it('imports Point placemarks, folder tags, and strips HTML', () => {
    const [record] = parseKmlImport(`<?xml version="1.0"?>
      <kml><Document><Folder><name>Weekend</name><Placemark>
      <name>Lookout</name><description><![CDATA[<b>Great</b> view]]></description>
      <Point><coordinates>-71.2,42.3,0</coordinates></Point>
      </Placemark></Folder></Document></kml>`);
    expect(record.name).toBe('Lookout');
    expect(record.tags).toContain('Weekend');
    expect(record.description).toBe('Great view');
    expect(record.latitude).toBe('42.3');
  });

  it('rejects DTD/entity declarations', () => {
    expect(() => parseKmlImport('<!DOCTYPE foo [<!ENTITY x "bad">]><kml/>')).toThrow();
  });
});
