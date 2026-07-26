import type { DatabaseSync } from 'node:sqlite';
import type { AttachmentDTO } from '$lib/types';
import { getDatabase } from '../driver';

export interface AttachmentRow {
  id: string;
  place_id: string;
  storage_name: string;
  thumbnail_storage_name: string;
  original_name: string;
  media_type: string;
  size_bytes: number;
  width: number;
  height: number;
  sha256: string;
  sort_order: number;
  created_at: string;
}

export function mapAttachment(row: AttachmentRow): AttachmentDTO {
  return {
    id: row.id,
    originalName: row.original_name,
    mediaType: row.media_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    thumbnailUrl: `/api/attachments/${row.id}/thumbnail`,
    originalUrl: `/api/attachments/${row.id}/original`
  };
}

export function attachmentsForPlace(
  placeId: string,
  database: DatabaseSync = getDatabase()
): AttachmentDTO[] {
  const rows = database
    .prepare(
      `SELECT *
       FROM attachments
       WHERE place_id = ?
       ORDER BY sort_order, created_at`
    )
    .all(placeId) as unknown as AttachmentRow[];
  return rows.map(mapAttachment);
}

export function allAttachmentsByPlace(
  database: DatabaseSync = getDatabase()
): Map<string, AttachmentDTO[]> {
  const rows = database
    .prepare('SELECT * FROM attachments ORDER BY place_id, sort_order, created_at')
    .all() as unknown as AttachmentRow[];
  const attachments = new Map<string, AttachmentDTO[]>();
  for (const row of rows) {
    const values = attachments.get(row.place_id) ?? [];
    values.push(mapAttachment(row));
    attachments.set(row.place_id, values);
  }
  return attachments;
}

export function attachmentById(
  id: string,
  database: DatabaseSync = getDatabase()
): AttachmentRow | undefined {
  return database.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
    AttachmentRow | undefined;
}
