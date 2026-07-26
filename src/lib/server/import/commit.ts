import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { placeInputSchema } from '$lib/schemas/place';
import { transaction } from '$lib/server/db/transaction';
import { insertPlace } from '$lib/server/services/places';
import { buildImportPreview, readStagedImport } from './common';

export interface ImportSelection {
  include: number[];
  copyDuplicates: number[];
}

export async function commitStagedImport(
  token: string,
  selection: ImportSelection
): Promise<{ imported: number; skipped: number }> {
  const staged = await readStagedImport(token);
  const preview = buildImportPreview(staged.parsed, token);
  const include = new Set(selection.include);
  const copies = new Set(selection.copyDuplicates);
  let imported = 0;
  const skipped = preview.records.length - include.size;

  transaction((database) => {
    for (const record of preview.records) {
      if (!include.has(record.index) || !record.valid || !record.place) continue;
      if (record.duplicateOf && !copies.has(record.index)) continue;
      const place = structuredClone(record.place);
      if (
        record.duplicateOf ||
        (place.id && database.prepare('SELECT 1 FROM places WHERE id = ?').get(place.id))
      ) {
        place.id = randomUUID();
      }
      const validated = placeInputSchema.parse(place);
      insertPlace(database, validated, validated.id ?? randomUUID());
      imported++;
    }
  });

  await rm(staged.directory, { recursive: true, force: true });
  return { imported, skipped: Math.max(skipped, preview.records.length - imported) };
}
