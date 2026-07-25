import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCsvImport } from '$lib/server/import/csv';
import { parseGeoJsonImport } from '$lib/server/import/geojson';
import { parseGpxImport } from '$lib/server/import/gpx';
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

describe('GPX import', () => {
  it('imports OsmAnd Favorites waypoints and preserves their folder and metadata', () => {
    const [record] = parseGpxImport(
      readFileSync(new URL('../fixtures/osmand-favorites.gpx', import.meta.url), 'utf8')
    );

    expect(record.name).toBe('OsmAnd test place');
    expect(record.latitude).toBe('37.5460870');
    expect(record.longitude).toBe('-77.4532843');
    expect(record.address).toBe('123 Floyd Avenue');
    expect(record.description).toBe('Great view');
    expect(record.tags).toContain('Sightseeing');
    expect(record.favorite).toBe(true);
    expect(record.status).toBe('saved');
    expect(record.extraProperties).toMatchObject({
      'gpx.time': '2023-06-07T12:31:35Z',
      'gpx.type': 'Sightseeing',
      'osmand.icon': 'place_town',
      'osmand.background': 'circle',
      'osmand.color': '#ff4e4eff'
    });
  });

  it('reports skipped tracks while retaining waypoints', () => {
    const [record] = parseGpxImport(
      '<gpx><wpt lat="42" lon="-71"><name>Point</name></wpt><trk><name>Walk</name></trk></gpx>'
    );
    expect(record.warnings).toContain('Skipped 1 track; only waypoints are imported.');
  });

  it('rejects route-only files and DTD/entity declarations', () => {
    expect(() => parseGpxImport('<gpx><rte><name>Trip</name></rte></gpx>')).toThrow(
      'GPX contains no waypoints'
    );
    expect(() => parseGpxImport('<!DOCTYPE foo [<!ENTITY x "bad">]><gpx/>')).toThrow(
      'GPX DTDs and entities are not allowed'
    );
  });
});
