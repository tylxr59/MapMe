import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { normalizeName } from '$lib/schemas/common';
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
      const extra = { ...(place.extraProperties ?? {}) };
      const importedTagNames = Array.isArray(extra.importedTagNames)
        ? extra.importedTagNames.map(String).filter(Boolean).slice(0, 50)
        : [];
      delete extra.importedTagNames;
      place.extraProperties = extra;
      const tagIds = [...place.tagIds];
      for (const tagName of importedTagNames) {
        const normalized = normalizeName(tagName);
        let tag = database
          .prepare('SELECT id FROM tags WHERE normalized_name = ?')
          .get(normalized) as { id: string } | undefined;
        if (!tag) {
          tag = { id: randomUUID() };
          const now = new Date().toISOString();
          database
            .prepare(
              'INSERT INTO tags (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
            )
            .run(tag.id, tagName.slice(0, 80), normalized, now, now);
        }
        tagIds.push(tag.id);
      }
      place.tagIds = [...new Set(tagIds)];
      const validated = placeInputSchema.parse(place);
      insertPlace(database, validated, validated.id ?? randomUUID());
      imported++;
    }
  });

  await rm(staged.directory, { recursive: true, force: true });
  return { imported, skipped: Math.max(skipped, preview.records.length - imported) };
}
