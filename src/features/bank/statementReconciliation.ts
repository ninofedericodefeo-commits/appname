import { parseBankAmount } from './importLogic.ts';
import type { BankCSV } from './importLogic.ts';
import type { StatementBalance } from './accountImport.ts';
import type { PDFTextItem } from './pdfTypes.ts';

export type SummaryPage = { page: number; period: string; lines: { text: string; items: PDFTextItem[]; number: number }[] };
export type StatementCheck = { label: string; expectedCents: number; readCents: number; matched: boolean; page: number; line: number };
export type StatementReconciliation = { status: 'matched' | 'partial' | 'mismatch' | 'unavailable'; checks: StatementCheck[]; debitCents: number; creditCents: number };
const money = /\(?-?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d*)\.\d{2}\)?-?/g;
function cents(text: string) {
  const found = [...text.matchAll(money)];
  if (found.length !== 1) return null;
  return parseBankAmount(found[0][0].trim().replace(/^(\(?-?\$?)\./, (_, prefix: string) => `${prefix}0.`));
}
function kind(text: string): 'opening' | 'debit' | 'credit' | 'checks' | null {
  if (/^(?:previous|beginning|opening)(?: account)? balance\b/i.test(text)) return 'opening';
  if (/^(?:total\s+)?withdrawals?(?:\s*(?:&|and)\s*debits?)?\b|^total\s+debits?\b/i.test(text)) return 'debit';
  if (/^(?:total\s+)?deposits?(?:\s*(?:&|and)\s*credits?)?\b|^total\s+credits?\b/i.test(text)) return 'credit';
  if (/^(?:total\s+)?checks(?: paid)?\b/i.test(text)) return 'checks';
  return null;
}

export function reconcileStatement(pages: SummaryPage[], csv: BankCSV, balances: StatementBalance[]): StatementReconciliation {
  const groups = new Map<string, { values: Record<'opening' | 'debit' | 'credit' | 'checks', { cents: number; page: number; line: number }[]>; rows: number[]; end: string }>();
  const byPage = new Map<number, string>();
  for (const page of pages) {
    byPage.set(page.page, page.period);
    const group = groups.get(page.period) ?? { values: { opening: [], debit: [], credit: [], checks: [] }, rows: [], end: page.period.split('|')[1] ?? '' };
    groups.set(page.period, group);
    if (page.lines.some(line => /checking account balance worksheet/i.test(line.text))) continue;
    for (const [index, line] of page.lines.entries()) for (const item of line.items) {
      const category = kind(item.text.trim());
      if (!category) continue;
      let value = cents(item.text);
      if (value === null) {
        const right = line.items.filter(cell => cell.x >= item.x + item.width - 1 && cell !== item).map(cell => cell.text).join(' ');
        value = cents(right);
      }
      // Naked section headings are not summary rows. Sidebar Total labels may
      // wrap, with their amount on the following line beside transaction text.
      if (value === null && (category === 'opening' || /^total\b/i.test(item.text.trim()))) {
        for (const below of page.lines.slice(index + 1, index + 4)) {
          if (below.items[0]?.y - item.y > 55) break;
          const cells = below.items.filter(cell => cell.x >= item.x - 20);
          if (cells.some(cell => kind(cell.text.trim()) || /^(?:current|closing|ending) balance\b/i.test(cell.text.trim()))) break;
          const candidate = cents(cells.map(cell => cell.text).join(' '));
          if (candidate !== null) { value = candidate; break; }
        }
      }
      if (value !== null) group.values[category].push({ cents: category === 'opening' ? value : Math.abs(value), page: page.page, line: line.number });
    }
  }
  let debitCents = 0, creditCents = 0;
  csv.rows.forEach((row, index) => {
    debitCents += Math.abs(parseBankAmount(row[2] || '0') ?? 0); creditCents += Math.abs(parseBankAmount(row[3] || '0') ?? 0);
    const period = byPage.get(csv.locations?.[index]?.page ?? pages[0]?.page);
    if (period) groups.get(period)?.rows.push(index);
  });
  const checks: StatementCheck[] = [];
  let fullyChecked = 0, periodsWithRows = 0;
  for (const group of groups.values()) {
    if (!group.rows.length && !Object.values(group.values).some(values => values.length)) continue;
    periodsWithRows++;
    const totals = { debit: group.rows.reduce((sum, index) => sum + Math.abs(parseBankAmount(csv.rows[index][2] || '0') ?? 0), 0),
      credit: group.rows.reduce((sum, index) => sum + Math.abs(parseBankAmount(csv.rows[index][3] || '0') ?? 0), 0) };
    const checkCents = group.rows.filter(index => /^check\s+(?:#|number)?\s*\d+/i.test(csv.rows[index][1])).reduce((sum, index) => sum + Math.abs(parseBankAmount(csv.rows[index][2] || '0') ?? 0), 0);
    let present = 0;
    for (const category of ['debit', 'credit'] as const) {
      const values = group.values[category], value = values[0];
      if (!value) continue;
      present++;
      const read = totals[category] - (category === 'debit' && group.values.checks.length ? checkCents : 0);
      checks.push({ label: category === 'debit' ? 'Withdrawal total' : 'Deposit total', expectedCents: value.cents, readCents: read,
        matched: values.every(item => item.cents === value.cents) && value.cents === read, page: value.page, line: value.line });
    }
    const declaredChecks = group.values.checks[0];
    if (declaredChecks) checks.push({ label: 'Check total', expectedCents: declaredChecks.cents, readCents: checkCents,
      matched: group.values.checks.every(item => item.cents === declaredChecks.cents) && declaredChecks.cents === checkCents, page: declaredChecks.page, line: declaredChecks.line });
    const opening = group.values.opening[0];
    const closing = balances.find(balance => balance.asOf === group.end);
    if (opening && closing) {
      present++;
      const calculated = opening.cents + totals.credit - totals.debit;
      checks.push({ label: 'Balance calculation', expectedCents: closing.amountCents, readCents: calculated,
        matched: group.values.opening.every(item => item.cents === opening.cents) && calculated === closing.amountCents, page: opening.page, line: opening.line });
    }
    if (present === 3) fullyChecked++;
  }
  const status = checks.some(check => !check.matched) ? 'mismatch' : !checks.length ? 'unavailable' : fullyChecked === periodsWithRows ? 'matched' : 'partial';
  return { status, checks, debitCents, creditCents };
}
