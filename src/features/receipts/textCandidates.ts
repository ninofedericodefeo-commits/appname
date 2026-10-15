import { dateFromKey, localDateKey } from '../subscriptions/logic.ts';
export type ReceiptTextLine = { text: string; confidence: number };
export type ReceiptCandidates = Partial<Record<'stationName' | 'price' | 'gallons' | 'total' | 'observedOn' | 'fuelType', { value: string; uncertain: boolean }>>;
export function receiptTextCandidates(lines: ReceiptTextLine[], today = new Date()): ReceiptCandidates {
  const cleaned = lines.slice(0, 400).filter(line => line.text.length <= 200).map(line => ({ ...line, text: line.text.replace(/[\u0000-\u001f]/g, ' ').trim() }));
  const found: Record<string, { value: string; confidence: number }[]> = {};
  const add = (key: string, value: string, confidence: number) => { (found[key] ??= []).push({ value, confidence }); };
  for (let index = 0; index < cleaned.length; index++) {
    const line = cleaned[index], next = cleaned[index + 1];
    const text = `${line.text} ${next && /^\$?\d+(?:\.\d+)?$/.test(next.text) ? next.text : ''}`;
    if (/\b(?:price\s*(?:per|\/)?\s*(?:gal(?:lon)?|unit)|unit\s*price|\$\s*\/\s*gal|price\s*\/\s*gal)\b/i.test(text)) {
      const value = text.match(/\b\d{1,2}\.\d{3}\b/); if (value && Number(value[0]) > 0 && Number(value[0]) <= 30) add('price', value[0], line.confidence);
    }
    const gallons = /\b(?:gallons?|volume)\b\s*[:=]?\s*(\d{1,3}\.\d{1,3})\b/i.exec(text) ?? /\b(\d{1,3}\.\d{1,3})\s*(?:gal|gallons)\b/i.exec(text);
    if (gallons && Number(gallons[1]) > 0 && Number(gallons[1]) <= 100) add('gallons', gallons[1], line.confidence);
    if (/^(?:grand\s+)?total(?:\s+(?:sale|amount|paid))?\b|^fuel\s+(?:sale|total)\b|^amount\s+paid\b/i.test(text) && !/subtotal|tax|gallons|volume/i.test(text)) {
      const value = text.match(/\$?\s*(\d{1,4}\.\d{2})(?!\d)/); if (value && Number(value[1]) > 0 && Number(value[1]) <= 3000) add('total', value[1], line.confidence);
    }
    const date = /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/.exec(text);
    if (date) { const key = `${date[3]}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}`; if (dateFromKey(key) && key <= localDateKey(today)) add('observedOn', key, line.confidence); }
    for (const fuel of ['regular', 'midgrade', 'premium', 'diesel']) if (new RegExp(`\\b${fuel}\\b`, 'i').test(text)) add('fuelType', fuel, line.confidence);
  }
  const result: ReceiptCandidates = {};
  const first = cleaned.slice(0, 4).find(line => /^[A-Za-z][A-Za-z &'.-]{2,60}$/.test(line.text) && !/thank|welcome|receipt|customer|copy|merchant|sale|total|visa|mastercard|regular|premium|diesel|gallons/i.test(line.text));
  if (first) result.stationName = { value: first.text, uncertain: true };
  for (const key of ['price', 'gallons', 'total', 'observedOn', 'fuelType'] as const) {
    const values = found[key] ?? [], unique = [...new Set(values.map(item => item.value))];
    // Conflicting fields stay empty for manual review; never guess which total applies.
    if (unique.length === 1) result[key] = { value: unique[0], uncertain: values.some(item => item.confidence < .85) };
  }
  return result;
}
