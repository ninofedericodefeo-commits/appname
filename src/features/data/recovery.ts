// Stable comparison ignores key insertion order while retaining every array item and ID.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export type RecoveryAdapter<T> = {
  saveJournal: (before: T, committed: boolean) => Promise<void>;
  apply: () => Promise<void>;
  verify: () => Promise<void>;
  rollback: (before: T) => Promise<void>;
};
// The journal must be durable before the first destructive operation.
export async function recoverableCommit<T>(before: T, adapter: RecoveryAdapter<T>) {
  await adapter.saveJournal(before, false);
  try {
    await adapter.apply();
    await adapter.verify();
    await adapter.saveJournal(before, true);
  } catch (error) {
    try { await adapter.rollback(before); }
    catch { throw new Error('Recovery is unfinished. Reopen the app to retry the saved rollback before making changes.'); }
    throw error;
  }
}
