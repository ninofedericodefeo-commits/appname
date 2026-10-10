import { parseBankAmount, parseBankDate, MAX_CSV_ROWS } from './importLogic.ts';
import type { BankCSV } from './importLogic.ts';
import { MAX_PDF_PAGES, MAX_PDF_TEXT } from './pdfTypes.ts';
import type { PDFTextItem, PDFTextPage } from './pdfTypes.ts';

type Line = { text: string; items: PDFTextItem[]; number: number };
export type StatementWarning = { page: number; line: number; reason: string };
export type CitizensStatement = { csv: BankCSV; pages: number; periods: string[]; warnings: StatementWarning[] };

export function pdfLines(items: PDFTextItem[]): Line[] {
  const groups: { y: number; items: PDFTextItem[] }[] = [];
  for (const item of [...items].filter((item) => item.text.trim() && Number.isFinite(item.x) && Number.isFinite(item.y)).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = groups.at(-1);
    if (last && Math.abs(last.y - item.y) <= Math.max(2, Math.min(item.height * 0.25, 3))) last.items.push(item);
    else groups.push({ y: item.y, items: [item] });
  }
  return groups.map((group, index) => {
    const cells = group.items.sort((a, b) => a.x - b.x);
    return { items: cells, text: cells.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim(), number: index + 1 };
  });
}

function periodIn(text: string): { from: string; to: string } | null {
  const numeric = '(\\d{1,2}/\\d{1,2}/\\d{4})';
  const match = text.match(new RegExp(`${numeric}\\s*(?:-|–|—|through|to)\\s*${numeric}`, 'i'));
  if (match) return { from: match[1], to: match[2] };
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const named = text.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s*(?:-|–|—|through|to)\s*([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (!named) return null;
  const first = months.indexOf(named[1].toLowerCase()), last = months.indexOf(named[4].toLowerCase());
  return first >= 0 && last >= 0 ? { from: `${first + 1}/${named[2]}/${named[3]}`, to: `${last + 1}/${named[5]}/${named[6]}` } : null;
}

function dated(raw: string, period: { from: string; to: string }, now: Date): string | null {
  const start = parseBankDate(period.from, 'mdy', now), end = parseBankDate(period.to, 'mdy', now);
  if (!start || !end || start > end || Date.parse(end) - Date.parse(start) > 370 * 86400000) return null;
  const parts = raw.split('/');
  const years = parts.length === 3 ? [parts[2].length === 2 ? `20${parts[2]}` : parts[2]] :
    [...new Set([String(new Date(start).getFullYear()), String(new Date(end).getFullYear())])];
  const candidates = years.map((year) => `${parts[0]}/${parts[1]}/${year}`).filter((date) => {
    const parsed = parseBankDate(date, 'mdy', now);
    return parsed && parsed >= start && parsed <= end;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export function parseCitizensStatement(pages: PDFTextPage[], now = new Date()): CitizensStatement {
  if (!pages.length || pages.length > MAX_PDF_PAGES) throw new Error('Choose a statement with 1–40 pages.');
  const allText = pages.map((page) => page.items.map((item) => item.text).join(' ')).join('\n');
  if (allText.length > MAX_PDF_TEXT) throw new Error('Choose a smaller statement PDF.');
  if (allText.trim().length < 40) throw new Error('This PDF has no readable text. Download the original statement PDF from Citizens; scanned pages and photos are not supported yet.');
  const bankHeader = pdfLines(pages[0].items).slice(0, 3).map((line) => line.text).join(' ');
  if ((!/\bcitizens(?:\s*bank)?\b/i.test(bankHeader) && !/citizensbank\.com/i.test(allText)) || /\bfirst\s*citizens\b/i.test(bankHeader)) throw new Error('Choose a Citizens Bank statement. Other banks and First Citizens are not supported by this PDF importer yet.');
  const headingText = pdfLines(pages[0].items).slice(0, 12).map((line) => line.text).join(' ');
  if (/\bcredit card statement\b/i.test(headingText) || (!/\b(?:checking|savings)\b/i.test(bankHeader) && /\b(?:minimum payment|payment due date)\b/i.test(headingText))) throw new Error('This looks like a credit card statement. Citizens checking and savings PDFs are supported first.');
  if (/\b(?:currency|amounts? in)\s*:?\s*(?:CAD|EUR|GBP|AUD|Canadian|Euros|Pounds)\b/i.test(allText)) throw new Error('Only USD Citizens statements are supported.');
  const accountNumbers = [...allText.matchAll(/\baccount\s+(?:number|no\.?)\s*[:#]?\s*([*xX\d -]{4,})/gi)].map((match) => match[1].replace(/[^*xX\d]/g, ''));
  if (new Set(accountNumbers).size > 1) throw new Error('This PDF contains multiple accounts. Choose one checking or savings account statement at a time.');
  const csv: BankCSV = { headers: ['Date', 'Description', 'Debit', 'Credit', 'Type', 'Currency'], rows: [], source: 'citizens-pdf', locations: [] };
  const warnings: StatementWarning[] = [];
  const periods: string[] = [];
  let period: { from: string; to: string } | null = null;
  let section: 'debit' | 'credit' | 'skip' | null = null;
  let amountX: number | null = null, amountRight = Infinity, nextX = Infinity;
  let balanceX = Infinity;
  let inTable = false;
  let pending: { date: string; description: string; amount: string; kind: 'debit' | 'credit'; page: number; line: number } | null = null;
  function flush() {
    if (!pending) return;
    const description = pending.description.replace(/\s+/g, ' ').trim();
    if (!description) warnings.push({ page: pending.page, line: pending.line, reason: 'Missing transaction description' });
    else {
      const type = pending.kind === 'credit' ? 'credit' : /\b(?:transfer|xfer|zelle|venmo|cash app)\b|payment to (?:.*card|.*visa|.*mastercard)|(?:credit card|cardmember|card services|autopay|online) payment|\b(?:ATM withdrawal|cash withdrawal)\b/i.test(description) ? 'transfer' : /\brefund\b|reversal/i.test(description) ? 'refund' : /\b(?:fee|fees|service charge)\b/i.test(description) ? 'fee' : 'purchase';
      csv.rows.push([pending.date, description, pending.kind === 'debit' ? pending.amount : '', pending.kind === 'credit' ? pending.amount : '', type, 'USD']);
      csv.locations!.push({ page: pending.page, line: pending.line });
    }
    pending = null;
  }
  for (const page of pages) {
    // Keep the transaction pending across pages, but ignore the new page's
    // address/account header until a transaction table resumes.
    inTable = false;
    const lines = pdfLines(page.items);
    const found = periodIn(lines.slice(0, 25).map((line) => line.text).join(' '));
    if (found && (!period || found.from !== period.from || found.to !== period.to)) {
      flush(); period = found; section = null; amountX = null; inTable = false;
      const label = `${found.from} – ${found.to}`;
      if (!periods.includes(label)) periods.push(label);
    }
    for (const line of lines) {
      const text = line.text;
      if (/^(?:deposits?\s*(?:&|and)\s*(?:credits?|other (?:additions|credits))|deposits?|other credits)(?:\s*\(continued\))?$/i.test(text)) { if (section !== 'credit' || !/continued/i.test(text)) flush(); section = 'credit'; amountX = null; balanceX = Infinity; inTable = false; continue; }
      if (/^(?:withdrawals?\s*(?:&|and)\s*(?:debits?|other subtractions)|other withdrawals?(?:[ ,]*(?:and|&)\s*debits?)?|ATM (?:and|&) debit card transactions|electronic (?:withdrawals?|payments?)|debit card(?:\/ATM)? (?:transactions|purchases))(?:\s*\(continued\))?$/i.test(text)) { if (section !== 'debit' || !/continued/i.test(text)) flush(); section = 'debit'; amountX = null; balanceX = Infinity; inTable = false; continue; }
      if (/^(?:checks(?: paid)?|service charges?(?:\s*\/\s*fees)?|fees|daily (?:balance|balances)|balance summary|account summary|interest summary|overdraft|year.to.date|important information)\b/i.test(text)) { flush(); section = 'skip'; inTable = false; continue; }
      if (/^(?:total\b|subtotal\b)/i.test(text)) { flush(); inTable = false; continue; }
      if (/^(?:continued\b|page\s+\d|citizens\b|statement period\b|account (?:number|ending)\b)/i.test(text)) continue;
      if (/\bdate\b/i.test(text) && /\b(?:amount|withdrawal|debit|credit)\b/i.test(text) && /\bdescription\b/i.test(text)) {
        inTable = true;
        const moneyHeader = line.items.find((item) => /^(?:amount|withdrawal|debit|credit)$/i.test(item.text.trim()));
        amountX = moneyHeader?.x ?? null;
        amountRight = moneyHeader ? moneyHeader.x + moneyHeader.width : Infinity;
        nextX = moneyHeader ? Math.min(...line.items.filter((item) => item.x > moneyHeader.x).map((item) => item.x)) : Infinity;
        balanceX = line.items.find((item) => /^balance$/i.test(item.text.trim()))?.x ?? Infinity;
        continue;
      }
      if (section !== 'debit' && section !== 'credit') continue;
      if (/\b(?:beginning|ending|available|closing) balance\b/i.test(text)) { flush(); continue; }
      if (/^\d{1,2}\/\d{1,2}/.test(text) && !/^\d{1,2}\/\d{1,2}(?:\/(?:\d{4}|\d{2}))?\s/.test(text)) { flush(); warnings.push({ page: page.page, line: line.number, reason: 'Unreadable transaction date' }); continue; }
      const date = text.match(/^(\d{1,2}\/\d{1,2}(?:\/(?:\d{4}|\d{2}))?)\s+/);
      if (date) {
        flush();
        if (!period) throw new Error('Could not identify the statement date range. Use a Citizens PDF that shows the full statement period.');
        const dateText = dated(date[1], period, now);
        const monies: { amount: string; x: number; right: number; index: number }[] = [];
        // Find amounts with exactly two decimals; account/reference numbers and
        // summary balances must not become purchase amounts.
        const pattern = /(?:^|\s)(\(?-?\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?-?)(?=\s|$)/g;
        for (const cell of line.items) {
          for (const match of cell.text.matchAll(pattern)) monies.push({ amount: match[1].trim(), x: cell.x + cell.width * ((match.index + match[0].indexOf(match[1])) / Math.max(1, cell.text.length)), right: cell.x + cell.width * ((match.index + match[0].indexOf(match[1]) + match[1].length) / Math.max(1, cell.text.length)), index: line.items.indexOf(cell) });
        }
        const candidates = amountX === null ? monies.filter((money) => line.items[money.index].text.trim() === money.amount) : monies.filter((money) => (money.x >= amountX! - 18 || Math.abs(money.right - amountRight) <= 18) && money.x < nextX - 12 && money.right < nextX);
        if (!dateText || candidates.length !== 1) { warnings.push({ page: page.page, line: line.number, reason: !dateText ? 'Date outside the statement period or unreadable' : 'Could not identify one transaction amount' }); continue; }
        const chosen = candidates[0];
        const rawAmount = chosen.amount;
        const cents = parseBankAmount(rawAmount);
        if (cents === null || cents <= 0 || cents > 100_000_000 || /-$/.test(rawAmount) || /\bCR\s*$/i.test(text)) { warnings.push({ page: page.page, line: line.number, reason: 'Invalid, zero or negative transaction amount' }); continue; }
        const description = line.items.map((item, index) => item.x >= balanceX - 18 ? '' : index === chosen.index ? item.text.replace(chosen.amount, '') : item.text).join(' ').replace(date[0].trim(), '').trim();
        pending = { date: dateText, description, amount: (cents / 100).toFixed(2), kind: section, page: page.page, line: line.number };
      } else if (pending && !/\b(?:beginning|ending|available|closing) balance\b|^date\b|^www\.|^member fdic|^equal housing|^SYNTHETIC|^NO REAL ACCOUNT/i.test(text)) {
        // A new page header is never appended to a transaction description.
        if (inTable || page.page === pending.page) pending.description += ' ' + text;
      }
      if (csv.rows.length > MAX_CSV_ROWS) throw new Error('Import at most 5,000 transactions at a time.');
    }
  }
  flush();
  if (csv.rows.length > MAX_CSV_ROWS) throw new Error('Import at most 5,000 transactions at a time.');
  if (!csv.rows.length) throw new Error('No supported transaction table was found. Choose a downloaded Citizens checking/savings statement with dated deposits and withdrawals.');
  return { csv, pages: pages.length, periods, warnings };
}
