import { activatePendingRestore } from './activate-restore.mjs';

const command = process.argv[2];
if (command === 'hash-password') {
  await import('./hash-password.mjs');
} else if (command === 'restore-backup') {
  await import('./offline-restore.mjs');
} else {
  await activatePendingRestore();
  await import('../build/index.js');
}
