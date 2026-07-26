import Busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { privateConfig } from '$lib/server/config/private';
import { storagePaths } from '$lib/server/storage/paths';

export interface StagedRestoreUpload {
  path: string;
  bytes: number;
}

export function streamRestoreUpload(request: Request): Promise<StagedRestoreUpload> {
  if (!request.body) return Promise.reject(new Error('Restore upload body is empty'));

  return new Promise((resolve, reject) => {
    let received = false;
    let settled = false;
    let uploadPromise: Promise<void> | null = null;
    let staged: StagedRestoreUpload | null = null;
    const busboy = Busboy({
      headers: Object.fromEntries(request.headers),
      limits: {
        files: 1,
        fileSize: privateConfig.restoreMaxSizeMb * 1024 * 1024,
        fields: 1,
        parts: 2
      }
    });

    const fail = async (error: Error) => {
      if (settled) return;
      settled = true;
      if (staged) await rm(staged.path, { force: true }).catch(() => undefined);
      reject(error);
    };

    busboy.on('file', (field, stream) => {
      if (field !== 'file' || received) {
        stream.resume();
        return;
      }
      received = true;
      staged = {
        path: join(storagePaths.backupStaging, `${randomUUID()}.restore-upload`),
        bytes: 0
      };
      stream.on('data', (chunk: Buffer) => {
        if (staged) staged.bytes += chunk.length;
      });
      stream.on('limit', () => {
        stream.resume();
        void fail(new Error(`Backup exceeds ${privateConfig.restoreMaxSizeMb} MiB`));
      });
      uploadPromise = pipeline(stream, createWriteStream(staged.path, { mode: 0o600 }));
      uploadPromise.catch(
        (error) => void fail(error instanceof Error ? error : new Error('Restore upload failed'))
      );
    });

    busboy.on(
      'error',
      (error) => void fail(error instanceof Error ? error : new Error('Restore upload failed'))
    );
    busboy.on('finish', async () => {
      if (settled) return;
      if (!staged || !uploadPromise) return void fail(new Error('No backup file was supplied'));
      try {
        await uploadPromise;
        if (staged.bytes === 0) return void fail(new Error('Backup file is empty'));
        settled = true;
        resolve(staged);
      } catch (error) {
        void fail(error instanceof Error ? error : new Error('Restore upload failed'));
      }
    });

    const stream = Readable.fromWeb(request.body as unknown as NodeReadableStream);
    stream.on(
      'error',
      (error) => void fail(error instanceof Error ? error : new Error('Restore upload failed'))
    );
    stream.pipe(busboy);
  });
}
