export type PendingWalletPurchase = { id: string; merchant: string; amountCents: number; currency: 'USD'; capturedAt: string };
export const MAX_PENDING_WALLET_PURCHASES = 200;
export const pendingWalletId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-58][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function parsePendingWalletPurchase(value: unknown, now = Date.now()): PendingWalletPurchase | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (!pendingWalletId(row.id) || typeof row.merchant !== 'string' || !row.merchant.trim() || row.merchant.length > 80 || /[\x00-\x1f\x7f]/.test(row.merchant) || row.currency !== 'USD' || typeof row.amountCents !== 'number' || !Number.isSafeInteger(row.amountCents) || row.amountCents <= 0 || row.amountCents > 100_000_000 || typeof row.capturedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(row.capturedAt)) return null;
  const captured = Date.parse(row.capturedAt);
  if (!Number.isFinite(now) || !Number.isFinite(captured) || captured > now + 300_000 || captured < now - 30 * 24 * 60 * 60_000) return null;
  return { id: row.id.toLowerCase(), merchant: row.merchant.trim(), amountCents: row.amountCents, currency: 'USD', capturedAt: new Date(captured).toISOString() };
}

export function parsePendingWalletPurchases(value: unknown, now = Date.now()): PendingWalletPurchase[] {
  if (!Array.isArray(value) || value.length > MAX_PENDING_WALLET_PURCHASES) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    const row = parsePendingWalletPurchase(item, now);
    if (!row || seen.has(row.id)) return [];
    seen.add(row.id);
    return [row];
  }).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
export const walletPurchaseId = (row: PendingWalletPurchase) => `wallet-${row.id}`;
