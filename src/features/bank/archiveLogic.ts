import type { BankFile } from './bankFileTypes';

export type ImportDetails = {
  accountLabel: string;
  transactionCount: number;
  purchaseCount: number;
  balanceCents?: number;
  balanceAsOf?: string;
};
export type SavedBankImport = ImportDetails & {
  id: string;
  name: string;
  kind: BankFile['kind'];
  fingerprint: string;
  importedAt: string;
  lastImportedAt: string;
};
export type ImportArchiveStorage = {
  list: () => Promise<SavedBankImport[]>;
  read: (entry: SavedBankImport) => Promise<BankFile>;
  write: (entry: SavedBankImport, file: BankFile) => Promise<void>;
  share: (entry: SavedBankImport) => Promise<void | { url: string; name: string }>;
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
    (item.balanceCents === undefined || Number.isSafeInteger(item.balanceCents)) ? item : null;
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
  const entry: SavedBankImport = { ...details,
    id: existing?.id ?? `import-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
    name: existing?.name ?? file.name, kind: file.kind, fingerprint,
    importedAt: existing?.importedAt ?? now.toISOString(), lastImportedAt: now.toISOString(),
  };
  await storage.write(entry, file);
  return entry;
}
