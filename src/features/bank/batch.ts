import type { BankFile } from './bankFileTypes';
import type { StatementBalance } from './accountImport';
export type BatchItem = { token: string; file: BankFile; balance?: StatementBalance; accountIdentifier?: string | null; summary: string; error?: string; saved?: boolean };
// Pending originals are kept in memory, never in URLs. Closing/restarting safely
// discards unsaved drafts; successfully reviewed files remain in Saved imports.
let items: BatchItem[] = [], chosen: string | null = null;
export function getBatch() { return items; }
export function startBatch(files: BankFile[]) { chosen = null; items = files.map((file,index) => ({ token: `batch-${Date.now()}-${index}`, file, summary: 'Waiting to read' })); return items; }
export function updateBatch(token: string, change: Partial<BatchItem>) { items = items.map(item => item.token === token ? { ...item, ...change } : item); }
export function chooseBatchBalance(token: string | null) { if (!items.some(item => item.saved)) chosen = token; }
export function batchBalanceAllowed(token: string) { return chosen === token; }
export function findBatchItem(token: string) { return items.find(item => item.token === token); }
export function clearBatch() { items = []; chosen = null; }
