<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import {
    ArchiveRestore,
    DatabaseBackup,
    Download,
    FileJson,
    FileSpreadsheet,
    LoaderCircle,
    Trash2,
    Upload
  } from '@lucide/svelte';
  import type { BackupManifest, ImportPreview } from '$lib/types';

  let { data } = $props();
  let importFile: HTMLInputElement;
  let restoreFile: HTMLInputElement;
  let preview = $state<ImportPreview | null>(null);
  let included = $state<number[]>([]);
  let copies = $state<number[]>([]);
  let importMessage = $state('');
  let importBusy = $state(false);
  let backupBusy = $state(false);
  let backupMessage = $state('');
  let restoreInspection = $state<{
    token: string;
    manifest: BackupManifest;
    expiresAt: string;
  } | null>(null);
  let restoreMessage = $state('');
  let restoreBusy = $state(false);

  async function previewImport() {
    const file = importFile.files?.[0];
    if (!file) return;
    importBusy = true;
    importMessage = '';
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/imports/preview', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not preview import');
      preview = result.preview;
      included = preview!.records
        .filter((record) => record.valid && !record.duplicateOf)
        .map((record) => record.index);
      copies = [];
    } catch (error) {
      importMessage = error instanceof Error ? error.message : 'Could not preview import';
    } finally {
      importBusy = false;
    }
  }

  function toggle(array: number[], index: number, checked: boolean): number[] {
    return checked ? [...new Set([...array, index])] : array.filter((value) => value !== index);
  }

  async function commitImport() {
    if (!preview) return;
    importBusy = true;
    try {
      const response = await fetch(`/api/imports/${preview.token}/commit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ include: included, copyDuplicates: copies })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Import failed');
      importMessage = `Imported ${result.imported} places; skipped ${result.skipped}.`;
      preview = null;
      importFile.value = '';
    } catch (error) {
      importMessage = error instanceof Error ? error.message : 'Import failed';
    } finally {
      importBusy = false;
    }
  }

  async function createBackup() {
    backupBusy = true;
    backupMessage = '';
    try {
      const response = await fetch('/api/backups', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Backup failed');
      backupMessage = `Created ${result.backup.filename}`;
      await invalidateAll();
    } catch (error) {
      backupMessage = error instanceof Error ? error.message : 'Backup failed';
    } finally {
      backupBusy = false;
    }
  }

  async function deleteBackup(id: string) {
    if (!confirm(`Delete backup ${id}?`)) return;
    const response = await fetch(`/api/backups/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (response.ok) await invalidateAll();
  }

  async function inspectRestore() {
    const file = restoreFile.files?.[0];
    if (!file) return;
    restoreBusy = true;
    restoreMessage = '';
    try {
      const body = new FormData();
      body.set('file', file);
      const response = await fetch('/api/restore/inspect', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Backup inspection failed');
      restoreInspection = result.inspection;
    } catch (error) {
      restoreMessage = error instanceof Error ? error.message : 'Backup inspection failed';
    } finally {
      restoreBusy = false;
    }
  }

  async function confirmRestore() {
    if (!restoreInspection) return;
    restoreBusy = true;
    try {
      const response = await fetch(`/api/restore/${restoreInspection.token}/confirm`, {
        method: 'POST'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Could not stage restore');
      restoreMessage = `Restore staged. Restart the container once to activate it. A rollback backup was created as ${result.rollbackBackup}.`;
      restoreInspection = null;
    } catch (error) {
      restoreMessage = error instanceof Error ? error.message : 'Could not stage restore';
    } finally {
      restoreBusy = false;
    }
  }
</script>

<svelte:head><title>Data · MapMe</title></svelte:head>
<div class="heading">
  <span>Ownership</span>
  <h1>Data tools</h1>
  <p>Move your places in or out, and keep a complete local backup.</p>
</div>

{#if data.authMode === 'none'}
  <div class="warning">
    Authentication is disabled. Anyone who can reach this instance can export, delete, back up, or
    restore its data.
  </div>
{/if}

<div class="section-grid">
  <section class="card">
    <FileJson size={22} />
    <h2>GeoJSON</h2>
    <p>The canonical point-place interchange format, including MapMe metadata.</p>
    <a href="/api/exports/places.geojson"><Download size={16} /> Export GeoJSON</a>
  </section>
  <section class="card">
    <FileSpreadsheet size={22} />
    <h2>CSV</h2>
    <p>A fixed, editable table. Tags are stored as a JSON array in one cell.</p>
    <a href="/api/exports/places.csv"><Download size={16} /> Export CSV</a>
  </section>
</div>

<section class="card wide">
  <Upload size={22} />
  <h2>Import places</h2>
  <p>Preview GeoJSON, CSV, or Google My Maps KML. Existing places are never overwritten.</p>
  <div class="controls">
    <input bind:this={importFile} type="file" accept=".geojson,.json,.csv,.kml" />
    <button onclick={previewImport} disabled={importBusy}
      >{#if importBusy}<LoaderCircle class="spin" size={16} />{/if} Preview import</button
    >
  </div>
  <small>Maximum {data.importMaxSizeMb} MiB and 10,000 records.</small>
  {#if importMessage}<p class="message">{importMessage}</p>{/if}
  {#if preview}
    <div class="preview-summary">
      <strong>{preview.total} records</strong>
      <span>{preview.valid} valid</span><span>{preview.invalid} invalid</span><span
        >{preview.duplicates} likely duplicates</span
      >
    </div>
    <div class="preview-table">
      {#each preview.records as record}
        <label class:invalid={!record.valid} class:duplicate={Boolean(record.duplicateOf)}>
          <input
            type="checkbox"
            disabled={!record.valid}
            checked={included.includes(record.index)}
            onchange={(event) =>
              (included = toggle(included, record.index, event.currentTarget.checked))}
          />
          <span
            ><strong>{record.place?.name ?? record.sourceLabel}</strong><small
              >{record.errors[0] ??
                record.duplicateOf?.reason ??
                record.warnings[0] ??
                'Ready to import'}</small
            ></span
          >
          {#if record.duplicateOf}
            <span class="copy"
              ><input
                type="checkbox"
                checked={copies.includes(record.index)}
                onchange={(event) => {
                  copies = toggle(copies, record.index, event.currentTarget.checked);
                  if (event.currentTarget.checked) included = toggle(included, record.index, true);
                }}
              /> import copy</span
            >
          {/if}
        </label>
      {/each}
    </div>
    <button class="commit" onclick={commitImport} disabled={importBusy || !included.length}
      >Import {included.length} selected places</button
    >
  {/if}
</section>

<section class="card wide">
  <DatabaseBackup size={22} />
  <h2>Complete backups</h2>
  <p>Creates a consistent SQLite snapshot plus every referenced original and thumbnail.</p>
  <button onclick={createBackup} disabled={backupBusy}
    >{#if backupBusy}<LoaderCircle class="spin" size={16} />{/if} Create backup</button
  >
  {#if backupMessage}<p class="message">{backupMessage}</p>{/if}
  <div class="backup-list">
    {#each data.backups as backup}
      <div>
        <span
          ><strong>{backup.filename}</strong><small
            >{(backup.size / 1024 / 1024).toFixed(1)} MiB · {new Date(
              backup.createdAt
            ).toLocaleString()}</small
          ></span
        >
        <a
          href={`/api/backups/${encodeURIComponent(backup.id)}`}
          aria-label={`Download ${backup.filename}`}><Download size={16} /></a
        >
        <button onclick={() => deleteBackup(backup.id)} aria-label={`Delete ${backup.filename}`}
          ><Trash2 size={16} /></button
        >
      </div>
    {/each}
  </div>
</section>

<section class="card wide danger-zone">
  <ArchiveRestore size={22} />
  <h2>Restore a backup</h2>
  <p>
    Inspection is non-destructive. Confirmation creates a rollback backup and requires one
    deliberate container restart.
  </p>
  <div class="controls">
    <input bind:this={restoreFile} type="file" accept=".zip,application/zip" />
    <button onclick={inspectRestore} disabled={restoreBusy}>Inspect backup</button>
  </div>
  <small>Maximum compressed upload: {data.restoreMaxSizeMb} MiB.</small>
  {#if restoreInspection}
    <div class="restore-confirm">
      <strong>Valid MapMe backup</strong>
      <span
        >Created {new Date(restoreInspection.manifest.createdAt).toLocaleString()} · schema {restoreInspection
          .manifest.schemaVersion} · {restoreInspection.manifest.attachmentCount} attachments</span
      >
      <button onclick={confirmRestore} disabled={restoreBusy}>Stage this restore</button>
    </div>
  {/if}
  {#if restoreMessage}<p class="message">{restoreMessage}</p>{/if}
</section>

<style>
  .heading span {
    color: var(--green-700);
    font-size: 0.75rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  h1 {
    margin: 0.2rem 0;
  }
  .heading p {
    margin: 0 0 1.5rem;
    color: var(--ink-muted);
  }
  .warning {
    margin-bottom: 1rem;
    border: 1px solid var(--warning-border);
    border-radius: 0.65rem;
    background: var(--warning-bg);
    color: var(--warning-text);
    padding: 0.75rem;
    font-size: 0.82rem;
  }
  .section-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }
  .card {
    border: 1px solid var(--line);
    border-radius: 0.85rem;
    background: var(--cream);
    padding: 1rem;
  }
  .card > :global(svg) {
    color: var(--green-700);
  }
  .card h2 {
    margin: 0.45rem 0 0.25rem;
    font-size: 1rem;
  }
  .card p {
    color: var(--ink-muted);
    font-size: 0.84rem;
    line-height: 1.45;
  }
  .card a,
  .card button {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 0;
    border-radius: 0.5rem;
    background: var(--accent-bg);
    color: var(--accent-text);
    padding: 0.58rem 0.7rem;
    text-decoration: none;
    font-weight: 750;
    font-size: 0.78rem;
  }
  .wide {
    margin-bottom: 1rem;
  }
  .controls {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .controls input {
    flex: 1;
    min-width: 15rem;
    border: 1px solid var(--input-border);
    border-radius: 0.5rem;
    padding: 0.5rem;
    background: var(--input-bg);
    color: var(--text);
  }
  small {
    color: var(--ink-muted);
  }
  .message {
    border-radius: 0.5rem;
    background: var(--success-bg);
    padding: 0.65rem;
    color: var(--success-text) !important;
  }
  .preview-summary {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
    margin: 1rem 0 0.5rem;
    font-size: 0.78rem;
  }
  .preview-table {
    max-height: 24rem;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 0.6rem;
  }
  .preview-table > label {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    padding: 0.55rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.78rem;
  }
  .preview-table label.invalid {
    background: var(--danger-bg);
  }
  .preview-table label.duplicate {
    background: var(--warning-bg);
  }
  .preview-table span {
    flex: 1;
    display: grid;
  }
  .preview-table .copy {
    flex: 0 0 auto;
    display: flex;
  }
  .commit {
    margin-top: 0.7rem;
  }
  .backup-list {
    margin-top: 0.7rem;
  }
  .backup-list > div {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 0;
    border-top: 1px solid var(--line);
  }
  .backup-list span {
    flex: 1;
    display: grid;
    min-width: 0;
  }
  .backup-list strong {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .backup-list a,
  .backup-list button {
    width: 2rem;
    height: 2rem;
    justify-content: center;
    padding: 0;
  }
  .backup-list button {
    background: var(--danger-soft);
    color: var(--danger);
  }
  .danger-zone {
    border-color: var(--danger);
  }
  .restore-confirm {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.8rem;
    border: 1px solid var(--danger);
    border-radius: 0.6rem;
    padding: 0.7rem;
  }
  .restore-confirm button {
    justify-self: start;
    background: var(--danger);
  }
  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (max-width: 650px) {
    .section-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
