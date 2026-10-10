import { saveImportToArchive } from './archiveLogic';
import type { ImportDetails, SavedBankImport } from './archiveLogic';
import type { BankFile } from './bankFileTypes';
import { archiveStorage } from './archiveStorage';

let pending: Promise<unknown> = Promise.resolve();
export function saveBankImport(file: BankFile, details: ImportDetails) {
  const saving = pending.catch(() => {}).then(() => saveImportToArchive(archiveStorage, file, details));
  pending = saving;
  return saving;
}
export async function listBankImports() { return (await archiveStorage.list()).sort((a, b) => b.lastImportedAt.localeCompare(a.lastImportedAt)); }
export async function readBankImport(id: string) {
  const entry = (await listBankImports()).find((item) => item.id === id);
  if (!entry) throw new Error('This import could not be found. Choose the original statement again.');
  return { file: await archiveStorage.read(entry), entry };
}
export function shareBankImport(entry: SavedBankImport) { return archiveStorage.share(entry); }
