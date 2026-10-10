export type IncomingBankFile = { uri: string; name: string; mimeType?: string; shareCopy?: boolean };
const pending = new Map<string, { file: IncomingBankFile; expires: number }>();

// File paths and statement names stay out of navigation URLs and persistence.
export function registerBankFile(uri: string, mimeType?: string, now = Date.now(), shareCopy = false): string | null {
  if (!/^(?:file|content):\/\//i.test(uri)) return null;
  let name: string;
  try { name = decodeURIComponent(uri.split(/[?#]/, 1)[0].split('/').at(-1) ?? ''); } catch { return null; }
  const pdf = /\.pdf$/i.test(name) || mimeType === 'application/pdf';
  const csv = /\.(?:csv|tsv|txt)$/i.test(name) || ['text/csv', 'text/tab-separated-values'].includes(mimeType ?? '');
  if (!pdf && !csv) return null;
  for (const [token, entry] of pending) if (entry.expires < now) pending.delete(token);
  if (pending.size >= 4) pending.delete(pending.keys().next().value!);
  const token = `${now.toString(36)}-${Math.random().toString(36).slice(2)}`;
  pending.set(token, { file: { uri, name: /\.(?:pdf|csv|tsv|txt)$/i.test(name) ? name : pdf ? 'Citizens statement.pdf' : 'Bank transactions.csv', mimeType, shareCopy }, expires: now + 5 * 60_000 });
  return token;
}

export function takeBankFile(token: string, now = Date.now()): IncomingBankFile | null {
  const entry = pending.get(token);
  pending.delete(token);
  return entry && entry.expires >= now ? entry.file : null;
}
