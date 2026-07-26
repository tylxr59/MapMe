import Busboy from 'busboy';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { privateConfig } from '$lib/server/config/private';
import { storagePaths } from './paths';

export interface StagedUpload {
  path: string;
  originalName: string;
  declaredMime: string;
  bytes: number;
}

function safeOriginalName(value: string): string {
  const name = value
    .split(/[\\/]/)
    .at(-1)!
    .split('')
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, 255);
  return name || 'photo';
}

export function streamSinglePhoto(request: Request): Promise<StagedUpload> {
  if (!request.body) return Promise.reject(new Error('Upload body is empty'));
  return new Promise((resolve, reject) => {
    let received = false;
    let resolved = false;
    let uploadPromise: Promise<void> | null = null;
    let staged: StagedUpload | null = null;
    const busboy = Busboy({
      headers: Object.fromEntries(request.headers),
      limits: {
        files: 1,
        fileSize: privateConfig.uploadMaxFileSizeMb * 1024 * 1024,
        fields: 5,
        parts: 6
      }
    });
    const fail = async (error: Error) => {
      if (resolved) return;
      resolved = true;
      if (staged) await rm(staged.path, { force: true }).catch(() => undefined);
      reject(error);
    };
    busboy.on('file', (field, stream, info) => {
      if (field !== 'photo' || received) {
        stream.resume();
        return;
      }
      received = true;
      const path = join(storagePaths.uploadStaging, `${randomUUID()}.upload`);
      staged = {
        path,
        originalName: safeOriginalName(info.filename),
        declaredMime: info.mimeType,
        bytes: 0
      };
      stream.on('data', (chunk: Buffer) => {
        if (staged) staged.bytes += chunk.length;
      });
      stream.on('limit', () => void fail(new Error('Photo exceeds the configured size limit')));
      uploadPromise = pipeline(stream, createWriteStream(path, { mode: 0o600 }));
      uploadPromise.catch((error) => void fail(error));
    });
    busboy.on(
      'error',
      (error) => void fail(error instanceof Error ? error : new Error('Multipart upload failed'))
    );
    busboy.on('finish', async () => {
      if (resolved) return;
      if (!staged || !uploadPromise) return void fail(new Error('No photo file was supplied'));
      try {
        await uploadPromise;
        if (staged.bytes === 0) return void fail(new Error('Photo is empty'));
        resolved = true;
        resolve(staged);
      } catch (error) {
        void fail(error instanceof Error ? error : new Error('Upload failed'));
      }
    });
    const stream = Readable.fromWeb(request.body as unknown as NodeReadableStream);
    stream.on('error', (error) => void fail(error));
    stream.pipe(busboy);
  });
}
