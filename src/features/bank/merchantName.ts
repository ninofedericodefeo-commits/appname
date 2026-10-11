// Presentation only: keep the original description for matching and details.
const merchants: [RegExp, string][] = [
  [/\bebay(?:\.com)?\b/i, 'eBay'],
  [/\bwawa\b/i, 'Wawa'],
  [/\bdunkin(?:['’]?s)?\b/i, "Dunkin'"],
  [/\b(?:amazon|amzn)(?:\.com)?\b/i, 'Amazon'],
  [/\bnetflix\b/i, 'Netflix'],
  [/\bspotify\b/i, 'Spotify'],
];

export function bankTransactionName(description: string): string {
  const original = description.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  // Keep the kind of non-purchase movements visible, including fees/refunds.
  if (/\b(?:fee|overdraft|transfer|xfer|payroll|withdrawal|deposit|refund|reversal)\b/i.test(original)) return original;
  const merchant = merchants.find(([pattern]) => pattern.test(original));
  if (merchant) return merchant[1];
  const withoutPrefix = original.replace(/^(?:\d{2,}\s+)?(?:(?:dbt\s+purchase|debit\s+card\s+purchase|debit\s+purchase|card\s+purchase|pos\s+(?:purchase|debit)|pos|checkcard|recurring(?:\s+(?:payment|purchase))?|purchase)\b\s*[-:*#]?\s*)+/i, '');
  const cleaned = (withoutPrefix !== original ? withoutPrefix.replace(/^(?:\d{3,}[\s\-:#]+)+/, '') : original)
    .replace(/^(?:sq|tst|paypal)\s*\*\s*/i, '')
    .replace(/\b(?:ref(?:erence)?|trace|auth(?:orization)?|confirmation|card ending)\s*[:#-]?\s*[\w-]+/gi, '')
    .replace(/\s+\d{3}[-.]\d{3}[-.]\d{4}\b.*$/, '')
    .replace(/\s+\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b.*$/, '')
    .replace(/\s+\d{6,}\b.*$/, '')
    .replace(/^[\s\-:*#]+|[\s\-:*#]+$/g, '')
    .replace(/\s+/g, ' ').trim();
  return /[a-z]/i.test(cleaned) ? cleaned : original;
}
