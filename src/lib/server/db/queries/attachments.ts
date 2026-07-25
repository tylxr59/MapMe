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

export function attachmentById(
  id: string,
  database: DatabaseSync = getDatabase()
): AttachmentRow | undefined {
  return database.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as
    AttachmentRow | undefined;
}
