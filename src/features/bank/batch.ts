import type { BankFile } from './bankFileTypes';
import type { StatementBalance } from './accountImport';
export type BatchItem = { token: string; file: BankFile; balance?: StatementBalance; accountIdentifier?: string | null; summary: string; error?: string; saved?: boolean };
let items: BatchItem[] = [], chosen: string | null = null, decided = false;
let persistence: Promise<unknown> = Promise.resolve();
type DraftAdapter = { read: (key: string) => Promise<unknown>; save: (key: string, value: unknown) => Promise<unknown> };
let storage: DraftAdapter | null = null;
export function configureBatchStorage(adapter: DraftAdapter) { storage = adapter; }
let storageError = '', storageStatus = '';
const listeners = new Set<() => void>();
export function subscribeBatchStorage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function batchStorageStatus() { return storageStatus; }
function status(message: string) { storageStatus = message; listeners.forEach(listener => listener()); }
function persist() {
  if (!storage) return;
  status('Saving batch draft on this device…');
  const pending = storage.save('bank-batch',{ items, chosen, decided }); persistence = pending;
  void pending.then(() => { if (persistence === pending) { storageError = ''; status('Batch draft saved on this device.'); } }).catch(() => { if (persistence === pending) { storageError = 'Draft could not be saved. Keep this app open and retain your original files.'; status(storageError); } });
}
export async function resumeBatch() {
  await persistence.catch(() => undefined);
  if (items.length) return items;
  const raw = await storage?.read('bank-batch') as { version: number; value: { items: BatchItem[]; chosen: string | null; decided: boolean } } | null;
  if (raw?.version === 1 && Array.isArray(raw.value.items) && raw.value.items.length <= 12 && raw.value.items.every(item => item.file && ['pdf','csv'].includes(item.file.kind))) { items = raw.value.items; chosen = raw.value.chosen; decided = raw.value.decided; }
  return items;
}
export function batchStorageError() { return storageError; }
export function batchDecisionMade() { return decided; }
export function getBatch() { return items; }
export function startBatch(files: BankFile[]) { chosen = null; decided = false; items = files.map((file,index) => ({ token: `batch-${Date.now()}-${index}`, file, summary: 'Waiting to read' })); persist(); return items; }
export function updateBatch(token: string, change: Partial<BatchItem>) { items = items.map(item => item.token === token ? { ...item, ...change } : item); persist(); }
export function chooseBatchBalance(token: string | null) {
  if (items.some(item => item.saved)) return;
  if (token !== null && !items.some(item => item.token === token && item.balance && !item.error)) throw Error('Choose a dated readable statement.');
  chosen = token; decided = true; persist();
}
export function batchBalanceAllowed(token: string) { return decided && chosen === token; }
export function findBatchItem(token: string) { return items.find(item => item.token === token); }
export function clearBatch() { items = []; chosen = null; decided = false; void storage?.save('bank-batch',null).then(() => status('Batch draft closed. Saved imports remain archived.')).catch(() => { storageError = 'Could not remove the old batch draft.'; status(storageError); }); }
