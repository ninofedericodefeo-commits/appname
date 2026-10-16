import { dateFromKey, localDateKey } from '../../lib/calendarDate.ts';
export function historyDateRange(preset: 'this-month' | 'last-month' | 'last-30', now = new Date()) {
  const end = new Date(now), start = new Date(now);
  if (preset === 'this-month') start.setDate(1);
  if (preset === 'last-month') { start.setDate(1); start.setMonth(start.getMonth()-1); end.setDate(0); }
  if (preset === 'last-30') start.setDate(start.getDate()-29);
  return { from: localDateKey(start), to: localDateKey(end) };
}
export function monthlyBudgetPeriod(from: string, to: string, today = new Date()) {
  const first = dateFromKey(from), last = dateFromKey(to);
  if (!first || !last || from > to || first.getDate() !== 1 || from.slice(0,7) !== to.slice(0,7)) return false;
  return last.getDate() === new Date(last.getFullYear(),last.getMonth()+1,0).getDate() || to === localDateKey(today);
}
