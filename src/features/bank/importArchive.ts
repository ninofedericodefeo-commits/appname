import { saveImportToArchive, updateArchivedFile, relinkArchivedFile } from './archiveLogic';
import type { ImportDetails, SavedBankImport } from './archiveLogic';
import type { BankFile } from './bankFileTypes';
import { archiveStorage } from './archiveStorage';
import { assertDataWritesAllowed } from '@/features/data/writeBarrier';

let pending: Promise<unknown> = Promise.resolve();
export function saveBankImport(file: BankFile, details: ImportDetails) {
  assertDataWritesAllowed();
  const saving = pending.catch(() => {}).then(() => saveImportToArchive(archiveStorage, file, details));
  pending = saving;
  return saving;
}
export async function flushBankArchive() { await pending.catch(() => undefined); }
export async function listBankImports(includeTrash = false) { return (await archiveStorage.list()).filter(entry => includeTrash || !entry.trashedAt).sort((a, b) => b.lastImportedAt.localeCompare(a.lastImportedAt)); }
export async function readBankImport(id: string) {
  const entry = (await listBankImports()).find((item) => item.id === id);
  if (!entry) throw new Error('This import could not be found. Choose the original statement again.');
  return { file: await archiveStorage.read(entry), entry };
}
export function shareBankImport(entry: SavedBankImport) { return archiveStorage.share(entry); }

function archiveAction<T>(operation: () => Promise<T>) {
  assertDataWritesAllowed();
  const action = pending.catch(() => undefined).then(operation); pending = action; return action;
}
export function updateBankImport(id: string, change: { name?: string; trash?: boolean }) { return archiveAction(() => updateArchivedFile(archiveStorage, id, change)); }
export function relinkBankImport(id: string, file: BankFile) { return archiveAction(() => relinkArchivedFile(archiveStorage, id, file)); }
export async function exportBankImports(ids: string[]) {
  const { zipSync, strToU8 } = await import('fflate');
  const { decodeBase64 } = await import('../data/encoding');
  const { exportDataFile } = await import('../data/fileIO');
  const chosen = (await listBankImports(true)).filter(entry => ids.includes(entry.id));
  if (!chosen.length) throw new Error('Select at least one saved import.');
  const contents: Record<string, Uint8Array> = {}; let size = 0;
  for (const entry of chosen) {
    const file = await archiveStorage.read(entry), bytes = file.base64 !== undefined ? decodeBase64(file.base64) : strToU8(file.kind === 'csv' ? file.text : '');
    size += bytes.length; if (size > 30 * 1024 * 1024) throw new Error('Export up to 30 MB at a time.');
    contents[`${entry.id}-${entry.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120)}`] = bytes;
  }
  contents['imports.json'] = strToU8(JSON.stringify(chosen, null, 2));
  return exportDataFile(zipSync(contents, { level: 0 }), 'GasFinder-imports.zip', 'application/zip');
}

export function saveImportOutcome(id: string, details: Partial<ImportDetails>) {
  return archiveAction(async () => {
    const entries = await archiveStorage.list();
    if (!entries.some(entry => entry.id === id)) throw new Error('The imported file could not be found.');
    await archiveStorage.setMetadata!(entries.map(entry => entry.id === id ? { ...entry, ...details } : entry));
  });
}
