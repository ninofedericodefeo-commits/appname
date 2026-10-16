import { assertDataWritesAllowed } from '@/features/data/writeBarrier';
import { draftStorage } from './storage';
let queue: Promise<unknown> = Promise.resolve();
export function saveDraft(key: string, value: unknown) { const next = queue.catch(() => undefined).then(() => { if (value === null) return draftStorage.remove(key); assertDataWritesAllowed(); return draftStorage.write(key,{ version: 1, savedAt: new Date().toISOString(), value }); }); queue = next; return next; }
export async function clearDrafts() { await queue.catch(() => undefined); await draftStorage.clear(); }
