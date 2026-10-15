import { dateFromKey, localDateKey } from '../subscriptions/logic.ts';
import type { SavedBankImport } from './archiveLogic.ts';
function day(value: string) {
  if (dateFromKey(value)) return value;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const key = `${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  return dateFromKey(key) ? key : null;
}
export function statementPeriods(files: SavedBankImport[]) {
  return files.flatMap(file => {
    const ranges = file.periodStart && file.periodEnd ? [{from:file.periodStart,to:file.periodEnd}] : (file.periods ?? []).flatMap(value => { const pair = value.split(/\s+[–—-]\s+/), from = day(pair[0] ?? ''), to = day(pair[1] ?? ''); return from && to ? [{from,to}] : []; });
    return ranges.filter(range => dateFromKey(range.from) && dateFromKey(range.to) && range.from <= range.to);
  }).sort((a,b) => a.from.localeCompare(b.from));
}
export function latestStatementDay(files: SavedBankImport[]) { return [...statementPeriods(files).map(range => range.to),...files.map(file => file.balanceAsOf ?? '').filter(value => dateFromKey(value))].sort().at(-1) ?? null; }
export function rangeCoverage(files: SavedBankImport[], from: string, to: string) {
  let through = from;
  for (const range of statementPeriods(files)) if (range.from <= through && range.to >= through) { const next = dateFromKey(range.to)!; next.setDate(next.getDate()+1); through = localDateKey(next); }
  return { complete: through > to, firstUncoveredDay: through > to ? null : through };
}
