export class MapServiceError extends Error {
  status?: number;
  constructor(message: string, status?: number) { super(message); this.name = 'MapServiceError'; this.status = status; }
}

export async function fetchMapJson(url: string, signal: AbortSignal, timeoutMs: number, nativeHeaders: boolean, body?: string) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort);
  if (signal.aborted) abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; abort(); }, timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...(nativeHeaders ? { 'User-Agent': 'GasFinder/1.0 (com.anonymous.gasfinder)' } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
      ...(body ? { method: 'POST', body } : {}),
    });
    if (!response.ok) throw new MapServiceError(`HTTP ${response.status}`, response.status);
    try { return await response.json() as unknown; }
    catch { throw new MapServiceError('The map service returned an unreadable response.'); }
  } catch (error) {
    if (signal.aborted) throw error;
    if (timedOut) throw new MapServiceError('The request timed out.');
    throw error;
  } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
}

export function serviceFailure(service: string, error: unknown) {
  const detail = error instanceof MapServiceError ? error.status ? ` (HTTP ${error.status})` : error.message.includes('timed out') ? ' (request timed out)' : '' : '';
  return new Error(`${service} is temporarily unavailable${detail}. Check your connection and try again. Your entries are kept.`);
}
