import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

const e2eDataPath = resolve('data/e2e');

rmSync(e2eDataPath, { recursive: true, force: true });
