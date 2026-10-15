import type { BankFile } from './bankFileTypes';
import { digestBytes } from '../data/backupFormat.ts';
import { strToU8 } from 'fflate';

export type ImportDetails = {
  accountLabel: string;
  transactionCount: number;
  purchaseCount: number;
  balanceCents?: number;
  balanceAsOf?: string;
  transactionIds?: string[];
  periods?: string[];
  importReport?: { parser: string; excludedRows: number; matched: number; added: number; balanceUpdated: boolean; savedCents: number; checks: string };
};
export type SavedBankImport = ImportDetails & {
  id: string;
  name: string;
  kind: BankFile['kind'];
  fingerprint: string;
  importedAt: string;
  lastImportedAt: string;
  storageName?: string;
  trashedAt?: string;
  missingOriginal?: boolean;
  sizeBytes?: number;
  periodStart?: string;
  periodEnd?: string;
  reconciliation?: 'verified' | 'unverified' | 'acknowledged';
  parserVersion?: string;
  contentHash?: string;
};
export type ImportArchiveStorage = {
  list: () => Promise<SavedBankImport[]>;
  read: (entry: SavedBankImport) => Promise<BankFile>;
  write: (entry: SavedBankImport, file: BankFile) => Promise<void>;
  share: (entry: SavedBankImport) => Promise<void | { url: string; name: string }>;
  setMetadata?: (entries: SavedBankImport[]) => Promise<void>;
};

export function archiveContent(file: BankFile) { return file.kind === 'pdf' ? file.base64 : file.text; }

export function importFingerprint(file: BankFile) {
  // This narrows the archive search. Exact contents are compared before reuse,
  // so a hash collision can never cause a different statement to be discarded.
  const content = `${file.kind}:${archiveContent(file)}`;
  let first = 2166136261, second = 5381;
  for (let i = 0; i < content.length; i++) {
    first = Math.imul(first ^ content.charCodeAt(i), 16777619);
    second = Math.imul(second, 33) ^ content.charCodeAt(i);
  }
  return `${(first >>> 0).toString(16)}-${(second >>> 0).toString(16)}-${content.length}`;
}

export function archiveFilename(entry: SavedBankImport) {
  if (entry.storageName && /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,240}$/.test(entry.storageName)) return entry.storageName;
  const safe = entry.name.replace(/[^a-zA-Z0-9._ -]/g, '_').replace(/^\.+/, '').slice(0, 100);
  return `${entry.id}-${safe || `statement.${entry.kind}`}`;
}

export function parseSavedImport(value: unknown): SavedBankImport | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as SavedBankImport;
  return /^[a-z0-9-]{5,80}$/.test(item.id) && typeof item.name === 'string' &&
    (item.kind === 'csv' || item.kind === 'pdf') && typeof item.fingerprint === 'string' &&
    Number.isFinite(Date.parse(item.importedAt)) && Number.isFinite(Date.parse(item.lastImportedAt)) &&
    typeof item.accountLabel === 'string' && Number.isSafeInteger(item.transactionCount) && item.transactionCount >= 0 &&
    Number.isSafeInteger(item.purchaseCount) && item.purchaseCount >= 0 &&
    (item.balanceCents === undefined || Number.isSafeInteger(item.balanceCents)) &&
    (item.transactionIds === undefined || Array.isArray(item.transactionIds) && item.transactionIds.every(id => typeof id === 'string')) &&
    (item.periods === undefined || Array.isArray(item.periods) && item.periods.every(period => typeof period === 'string')) &&
    (item.sizeBytes === undefined || Number.isFinite(item.sizeBytes) && item.sizeBytes >= 0) &&
    (item.contentHash === undefined || /^[a-f0-9]{64}$/.test(item.contentHash)) &&
    (item.missingOriginal === undefined || typeof item.missingOriginal === 'boolean') &&
    (item.importReport === undefined || typeof item.importReport.parser === 'string' && typeof item.importReport.checks === 'string' && typeof item.importReport.balanceUpdated === 'boolean' && [item.importReport.excludedRows, item.importReport.matched, item.importReport.added, item.importReport.savedCents].every(value => Number.isSafeInteger(value) && value >= 0)) &&
    (item.storageName === undefined || /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,240}$/.test(item.storageName)) &&
    (item.trashedAt === undefined || Number.isFinite(Date.parse(item.trashedAt))) ? item : null;
}

export async function saveImportToArchive(storage: ImportArchiveStorage, file: BankFile, details: ImportDetails, now = new Date()): Promise<SavedBankImport> {
  const fingerprint = importFingerprint(file);
  const entries = await storage.list();
  let existing: SavedBankImport | undefined;
  for (const entry of entries.filter((entry) => entry.kind === file.kind && entry.fingerprint === fingerprint)) {
    try {
      const saved = await storage.read(entry);
      if (archiveContent(saved) === archiveContent(file)) { existing = entry; break; }
    } catch { /* A missing old file must not prevent saving the selected original. */ }
  }
  const retained = { ...existing }; delete retained.trashedAt; delete retained.missingOriginal;
  const entry: SavedBankImport = { ...retained, ...details,
    id: existing?.id ?? `import-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
    name: existing?.name ?? file.name, kind: file.kind, fingerprint, contentHash: digestBytes(strToU8(archiveContent(file))),
    importedAt: existing?.importedAt ?? now.toISOString(), lastImportedAt: now.toISOString(),
    ...(existing?.storageName ? { storageName: existing.storageName } : {}),
    sizeBytes: file.base64 !== undefined ? file.base64.length / 4 * 3 - (file.base64.endsWith('==') ? 2 : file.base64.endsWith('=') ? 1 : 0) : strToU8(file.kind === 'csv' ? file.text : '').length,
  };
  await storage.write(entry, file);
  return entry;
}

export async function updateArchivedFile(storage: ImportArchiveStorage, id: string, change: { name?: string; trash?: boolean }, now = new Date()) {
  const all = await storage.list(), old = all.find(entry => entry.id === id);
  if (!old || !storage.setMetadata) throw new Error('This saved import could not be updated.');
  const name = change.name === undefined ? old.name : change.name.trim();
  if (!name || name.length > 120 || /[\/\\\u0000-\u001f]/.test(name)) throw new Error('Use a filename up to 120 characters, without slashes.');
  const next = { ...old, name, storageName: old.storageName ?? archiveFilename(old), ...(change.trash === true ? { trashedAt: now.toISOString() } : {}) };
  if (change.trash === false) delete next.trashedAt;
  await storage.setMetadata(all.map(entry => entry.id === id ? next : entry));
  return next;
}

export async function relinkArchivedFile(storage: ImportArchiveStorage, id: string, file: BankFile) {
  const all = await storage.list(), old = all.find(entry => entry.id === id);
  if (!old || old.kind !== file.kind || old.fingerprint !== importFingerprint(file) || old.contentHash && old.contentHash !== digestBytes(strToU8(archiveContent(file)))) throw new Error('Choose the same original file. A different statement must go through import review.');
  const next = { ...old, missingOriginal: false, contentHash: digestBytes(strToU8(archiveContent(file))), storageName: `relink-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${file.kind}` };
  await storage.write(next, file);
  return next;
}
