import { parseDollars } from '../pocket/logic.ts';

type QueryValue = string | string[] | undefined;
const first = (value: QueryValue) => Array.isArray(value) ? value[0] : value;

function shortHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

export function parseImportedPurchase(params: { amount?: QueryValue; merchant?: QueryValue; id?: QueryValue; currency?: QueryValue }, now = new Date()) {
  // Older hand-built links omit currency. The bundled shortcut always supplies it.
  if (params.currency !== undefined && first(params.currency)?.trim().toUpperCase() !== 'USD') return null;
  const rawAmount = first(params.amount)?.trim().replace(/^(?:US\$|\$|USD\s*)/i, '').replace(/\s*USD$/i, '');
  const amountCents = rawAmount ? parseDollars(rawAmount) : null;
  const merchant = first(params.merchant)?.trim() ?? '';
  if (amountCents === null || amountCents <= 0 || !merchant || merchant.length > 80 || /[\x00-\x1f]/.test(merchant)) return null;
  const sourceId = first(params.id)?.trim();
  if (sourceId && (sourceId.length > 150 || /[\x00-\x1f]/.test(sourceId))) return null;
  // Without a transaction ID, repeat opens in the same minute are treated as one purchase.
  const fallbackMinute = Math.floor(now.getTime() / 60_000);
  return { id: `shortcut-${shortHash(sourceId || `${merchant}|${amountCents}|${fallbackMinute}`)}`, title: merchant, amountCents };
}
