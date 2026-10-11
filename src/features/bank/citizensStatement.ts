import { parseBankAmount, parseBankDate, MAX_CSV_ROWS } from './importLogic.ts';
import type { BankCSV } from './importLogic.ts';
import type { StatementBalance } from './accountImport.ts';
import { MAX_PDF_PAGES, MAX_PDF_TEXT } from './pdfTypes.ts';
import type { PDFTextItem, PDFTextPage } from './pdfTypes.ts';

type Line = { text: string; items: PDFTextItem[]; number: number };
const closingLabel = /\b(?:(?:ending|closing|new)(?: account)? balance|balance at (?:the )?end of (?:the )?(?:statement )?period)\b/i;
const amountLabel = /^amount(?:\s*\(\$\))?$/i;
const moneyToken = '(\\(?-?\\$?\\s*(?:\\d{1,3}(?:,\\d{3})+|\\d*)\\.\\d{2}\\)?-?)';
function statementAmount(raw: string): number | null {
  // Citizens prints cents below one dollar as .32, including .00 balances.
  return parseBankAmount(raw.replace(/^(\(?-?\$?\s*)\./, (_, prefix: string) => `${prefix}0.`));
}
function sidebarBoundary(lines: Line[]): number {
  const description = lines.flatMap((line) => line.items).find((item) => /^description$/i.test(item.text.trim()));
  if (!description) return Infinity;
  const summaries = lines.flatMap((line) => line.items).filter((item) => item.x > description.x + 150 && /^(?:previous balance|current balance|total (?:withdrawals?|deposits?))\b/i.test(item.text.trim()));
  if (!summaries.length) return Infinity;
  const signs = lines.flatMap((line) => line.items).filter((item) => item.x > description.x + 150 && /^[-+=]$/.test(item.text.trim()));
  return Math.min(...[...summaries, ...signs].map((item) => item.x));
}
function columnKind(text: string): 'credit' | 'debit' | null {
  const label = text.trim().replace(/\s*\(\$\)$/, '');
  if (/^(?:credits?|deposits?|additions?|money in)(?:\s*(?:\/|and|&)\s*(?:credits?|deposits?))?(?:\s+amount)?$/i.test(label)) return 'credit';
  if (/^(?:debits?|withdrawals?|subtractions?|money out)(?:\s*(?:\/|and|&)\s*(?:debits?|withdrawals?))?(?:\s+amount)?$/i.test(label)) return 'debit';
  return null;
}
export type StatementWarning = { page: number; line: number; reason: string };
export type CitizensStatement = { csv: BankCSV; pages: number; periods: string[]; warnings: StatementWarning[]; balance: StatementBalance | null; accountIdentifier: string | null; pageCounts: { page: number; spending: number; credits: number }[] };

export function pdfLines(items: PDFTextItem[]): Line[] {
  const groups: { y: number; items: PDFTextItem[] }[] = [];
  for (const item of [...items].filter((item) => item.text.trim() && Number.isFinite(item.x) && Number.isFinite(item.y)).sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = groups.at(-1);
    if (last && Math.abs(last.y - item.y) <= Math.max(2, Math.min(item.height * 0.25, 3))) last.items.push(item);
    else groups.push({ y: item.y, items: [item] });
  }
  return groups.map((group, index) => {
    // PDF.js can return a word, date or amount as several adjacent glyph runs.
    // Rejoin only runs that touch; spaces between actual table columns remain.
    const cells: PDFTextItem[] = [];
    for (const item of group.items.sort((a, b) => a.x - b.x)) {
      const previous = cells.at(-1);
      const gap = previous ? item.x - (previous.x + previous.width) : Infinity;
      if (previous && gap >= -0.5 && gap <= 1) {
        previous.text += item.text;
        previous.width = item.x + item.width - previous.x;
      } else cells.push({ ...item });
    }
    for (const cell of cells) cell.text = cell.text.replace(/[\u0000-\u001f]/g, ' ');
    return { items: cells, text: cells.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim(), number: index + 1 };
  });
}

function periodIn(text: string): { from: string; to: string } | null {
  const numeric = '(\\d{1,2}[/-]\\d{1,2}[/-](?:\\d{4}|\\d{2}))';
  const separator = '(?:-|–|—|through|thru|to)';
  const match = text.match(new RegExp(`${numeric}\\s*${separator}\\s*${numeric}`, 'i'));
  if (match) {
    const full = (value: string) => { const parts = value.split(/[/-]/); return `${parts[0]}/${parts[1]}/${parts[2].length === 2 ? `20${parts[2]}` : parts[2]}`; };
    return { from: full(match[1]), to: full(match[2]) };
  }
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const named = text.match(new RegExp(`([A-Za-z]+)\\.?\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\s*${separator}\\s*([A-Za-z]+)\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'i'));
  if (!named) return null;
  const first = months.findIndex((month) => month.slice(0, 3) === named[1].toLowerCase().slice(0, 3)), last = months.findIndex((month) => month.slice(0, 3) === named[4].toLowerCase().slice(0, 3));
  const firstYear = named[3] ?? String(Number(named[6]) - (first > last ? 1 : 0));
  return first >= 0 && last >= 0 ? { from: `${first + 1}/${named[2]}/${firstYear}`, to: `${last + 1}/${named[5]}/${named[6]}` } : null;
}

function dated(raw: string, period: { from: string; to: string }, now: Date): string | null {
  const start = parseBankDate(period.from, 'mdy', now), end = parseBankDate(period.to, 'mdy', now);
  if (!start || !end || start > end || Date.parse(end) - Date.parse(start) > 370 * 86400000) return null;
  const parts = raw.split(/[/-]/);
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
  const accountNumbers = [...allText.matchAll(/\baccount\s+(?:number|no\.?)\s*[:#]?\s*([*xX\d -]{4,})/gi)].map((match) => match[1].replace(/[^*xX\d]/g, '').toLowerCase());
  const accountEndings = [...allText.matchAll(/\baccount\s+ending\s*[:#]?\s*((?:[*xX]+-?)?\d{3,}(?:-\d+)?)(?![\d-])/gi)].map((match) => match[1].replace(/\D/g, '')).filter((ending) => ending.length >= 4);
  if (new Set(accountNumbers).size > 1 || new Set(accountEndings).size > 1 || (accountNumbers[0] && accountEndings[0] && !accountNumbers[0].endsWith(accountEndings[0]))) throw new Error('This PDF contains multiple accounts. Choose one checking or savings account statement at a time.');
  const csv: BankCSV = { headers: ['Date', 'Description', 'Debit', 'Credit', 'Type', 'Currency'], rows: [], source: 'citizens-pdf', locations: [] };
  const warnings: StatementWarning[] = [];
  const periods: string[] = [];
  const balances: StatementBalance[] = [];
  let period: { from: string; to: string } | null = null;
  let section: 'debit' | 'credit' | 'skip' | null = null;
  let amountX: number | null = null, amountRight = Infinity, nextX = Infinity;
  let balanceX = Infinity;
  let columns: { kind: 'debit' | 'credit'; x: number; right: number; next: number }[] = [];
  let inTable = false;
  let datedRows = 0;
  let noActivity = false;
  let pending: { date: string; description: string; amount: string; kind: 'debit' | 'credit'; page: number; line: number } | null = null;
  function flush() {
    if (!pending) return;
    const description = pending.description.replace(/\s+/g, ' ').trim();
    if (!description) warnings.push({ page: pending.page, line: pending.line, reason: 'Missing transaction description' });
    else {
      const type = pending.kind === 'credit' ? 'credit' : /\b(?:transfer|xfer|zelle|venmo|cash app)\b|payment to (?:.*card|.*visa|.*mastercard)|(?:credit card|cardmember|card services|autopay|online) payment|\b(?:ATM withdrawal|cash withdrawal)\b/i.test(description) ? 'transfer' : /\brefund\b|reversal/i.test(description) ? 'refund' : /\b(?:fee|fees|service charge)\b/i.test(description) ? 'fee' : /^check\s+(?:#|number)?\s*\d+/i.test(description) ? 'transfer' : 'purchase';
      csv.rows.push([pending.date, description, pending.kind === 'debit' ? pending.amount : '', pending.kind === 'credit' ? pending.amount : '', type, 'USD']);
      csv.locations!.push({ page: pending.page, line: pending.line });
    }
    pending = null;
  }
  for (const page of pages) {
    // Keep the transaction pending across pages, but ignore the new page's
    // address/account header until a transaction table resumes.
    inTable = false;
    if (section === 'skip') { section = null; columns = []; amountX = null; }
    const lines = pdfLines(page.items);
    const sidebarX = sidebarBoundary(lines);
    let currentBalanceAllowed = false;
    let worksheet = false;
    const found = periodIn(lines.slice(0, 25).map((line) => line.text).join(' '));
    if (found && (!period || found.from !== period.from || found.to !== period.to)) {
      flush(); period = found; section = null; amountX = null; inTable = false;
      const label = `${found.from} – ${found.to}`;
      if (!periods.includes(label)) periods.push(label);
    }
    for (let index = 0; index < lines.length; index++) {
      const fullLine = lines[index];
      const mainItems = fullLine.items.filter((item) => item.x < sidebarX);
      const line = { ...fullLine, items: mainItems, text: mainItems.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim() };
      const text = line.text;
      if (worksheet) continue;
      if (/^checking account balance worksheet\b/i.test(text)) {
        flush(); worksheet = true; currentBalanceAllowed = false; section = 'skip'; inTable = false;
        continue;
      }
      if (/^balance calculation\b/i.test(text) || /^transaction details for (?:checking|savings) account\b/i.test(text)) {
        flush(); currentBalanceAllowed = true; section = 'skip'; inTable = false;
        continue;
      }
      if (/^no activity this statement period\.?$/i.test(text)) { noActivity = true; continue; }
      // Citizens' Balance Calculation and transaction-detail footer call the
      // statement's ending amount "Current Balance". Worksheet examples and
      // running balances elsewhere must never replace the account balance.
      const sidebarText = fullLine.items.filter((item) => item.x >= sidebarX).map((item) => item.text).join(' ');
      const sidebarClosing = currentBalanceAllowed && /^current balance\b/i.test(sidebarText);
      const balanceText = sidebarClosing ? sidebarText : fullLine.text;
      const currentClosing = currentBalanceAllowed && /^current balance\b/i.test(balanceText);
      if (closingLabel.test(balanceText) || currentClosing) {
        flush();
        if (period) {
          const suffix = balanceText.split(currentClosing ? /^current balance\b/i : closingLabel)[1].replace(/^\s*[:=]\s*/, '');
          const nextItems = lines[line.number]?.items.filter((item) => !sidebarClosing || item.x >= sidebarX);
          const next = nextItems?.map((item) => item.text).join(' ').trim();
          const values = [...suffix.matchAll(new RegExp(`(?:^|[\\s:])${moneyToken}(?=\\s|$)`, 'g'))].map((match) => match[1]);
          // A date or colon may follow the label while the amount is below it.
          if (!values.length && /^(?:(?:as of|on)\s+)?(?:\d{1,2}[/-]\d{1,2}[/-](?:\d{4}|\d{2}))?\s*:?\s*\$?\s*$/i.test(suffix.trim()) && next) {
            const separate = next.match(new RegExp(`^(?:=\\s*)?${moneyToken}$`));
            if (separate) values.push(separate[1]);
          }
          const amount = values.length === 1 ? statementAmount(values[0]) : null;
          const end = parseBankDate(period.to, 'mdy', now);
          if (amount !== null && Math.abs(amount) <= 100_000_000 && end) {
            const date = new Date(end);
            balances.push({ amountCents: amount, asOf: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, page: page.page, line: line.number });
          }
        }
        currentBalanceAllowed = false;
        if (!sidebarClosing || !text) { section = 'skip'; inTable = false; continue; }
      }
      if (!text) continue;
      // Counts, totals and 'continued' labels vary between Citizens layouts.
      const heading = text.replace(/\*+\s*$/, '').replace(/\(?continued\)?/gi, '').replace(/(?:\s+(?:\d+\s+(?:items?|transactions?)|\(?\d+\)?|[-$\d,.]+))+\s*$/i, '').trim();
      if (/^(?:deposits?\s*(?:&|and)\s*(?:credits?|other (?:additions|credits))|deposits?|credits?|additions?|other credits|electronic deposits?)(?:\s+total)?$/i.test(heading)) { if (section !== 'credit' || !/continued/i.test(text)) flush(); section = 'credit'; amountX = null; balanceX = Infinity; columns = []; inTable = false; continue; }
      if (/^(?:withdrawals?(?:\s*(?:&|and)\s*(?:(?:other )?debits?|other subtractions))?|debits?|subtractions?|other withdrawals?(?:[ ,]*(?:and|&)\s*debits?)?|(?:ATM\s*(?:and|&|\/)\s*debit card|debit card\s*(?:(?:and|&|\/)\s*ATM)?) (?:transactions|purchases|withdrawals|debits)|electronic(?: and other)? (?:withdrawals?|payments?|debits?)|(?:withdrawals|debits) and purchases)(?:\s+total)?$/i.test(heading)) { if (section !== 'debit' || !/continued/i.test(text)) flush(); section = 'debit'; amountX = null; balanceX = Infinity; columns = []; inTable = false; continue; }
      if (/^(?:checks(?: paid)?|service charges?(?:\s*\/\s*fees)?|fees|daily (?:balance|balances)|balance summary|account summary|interest summary|overdraft|year.to.date|important information)\b/i.test(text)) { flush(); section = 'skip'; inTable = false; continue; }
      if (/^(?:total\b|subtotal\b)/i.test(text)) { flush(); inTable = false; continue; }
      if (/^ATM\s*\/\s*purchases(?:\s*\(continued\))?$/i.test(text) || /^\*+\s*may include checks\b|^please see additional information on next page\b/i.test(text)) continue;
      if (/^(?:continued\b|page\s+\d|citizens\b|statement period\b|account (?:number|ending)\b)/i.test(text)) continue;
      let headerItems = line.items;
      const nextFullLine = lines[index + 1];
      const nextLine = nextFullLine ? { ...nextFullLine, items: nextFullLine.items.filter((item) => item.x < sidebarX) } : undefined;
      if (/\bdate\b/i.test(text) && /\b(?:description|details|transaction)\b/i.test(text) && nextLine &&
          nextLine.items.length > 0 &&
          nextLine.items.every((item) => amountLabel.test(item.text.trim()) || columnKind(item.text) || /^(?:running )?balance$/i.test(item.text.trim())) &&
          Math.abs(nextLine.items[0].y - line.items[0].y) <= 18) {
        headerItems = [...line.items, ...nextLine.items];
        index++;
      }
      const headerText = headerItems.map((item) => item.text).join(' ');
      if (/\bdate\b/i.test(headerText) && /\b(?:amount|withdrawals?|debits?|credits?|deposits?|additions?|subtractions?|money (?:in|out))\b/i.test(headerText) && /\b(?:description|details|transaction)\b/i.test(headerText)) {
        inTable = true;
        const moneyHeaders = headerItems.filter((item) => amountLabel.test(item.text.trim()) || columnKind(item.text));
        columns = moneyHeaders.flatMap((item) => { const kind = columnKind(item.text); return kind ? [{ kind, x: item.x, right: item.x + item.width, next: Math.min(...headerItems.filter((next) => next.x > item.x).map((next) => next.x)) }] : []; });
        if (columns.length) section = null;
        if (columns.length || section === 'debit' || section === 'credit') currentBalanceAllowed = true;
        const moneyHeader = moneyHeaders[0];
        amountX = moneyHeader?.x ?? null;
        amountRight = moneyHeader ? moneyHeader.x + moneyHeader.width : Infinity;
        nextX = moneyHeader ? Math.min(...headerItems.filter((item) => item.x > moneyHeader.x).map((item) => item.x)) : Infinity;
        balanceX = headerItems.find((item) => /^(?:running )?balance$/i.test(item.text.trim()))?.x ?? Infinity;
        continue;
      }
      if (section === 'skip') continue;
      if (/\b(?:beginning|previous|ending|available|closing|current) balance\b/i.test(text)) { flush(); continue; }
      if (periodIn(text)) continue;
      if (inTable && /^\d{1,2}[/-]\d{1,2}/.test(text) && !/^\d{1,2}[/-]\d{1,2}(?:[/-](?:\d{4}|\d{2}))?\s/.test(text)) { flush(); warnings.push({ page: page.page, line: line.number, reason: 'Unreadable transaction date' }); continue; }
      const date = text.match(/^(\d{1,2}[/-]\d{1,2}(?:[/-](?:\d{4}|\d{2}))?)\s+/);
      if (date) {
        datedRows++;
        flush();
        if (!period) throw new Error('Could not identify the statement date range. Use a Citizens PDF that shows the full statement period.');
        const dateText = dated(date[1], period, now);
        const monies: { amount: string; x: number; right: number; index: number }[] = [];
        // Find amounts with exactly two decimals; account/reference numbers and
        // summary balances must not become purchase amounts.
        const pattern = new RegExp(`(?:^|\\s)${moneyToken}(?=\\s|$)`, 'g');
        for (const cell of line.items) {
          for (const match of cell.text.matchAll(pattern)) monies.push({ amount: match[1].trim(), x: cell.x + cell.width * ((match.index + match[0].indexOf(match[1])) / Math.max(1, cell.text.length)), right: cell.x + cell.width * ((match.index + match[0].indexOf(match[1]) + match[1].length) / Math.max(1, cell.text.length)), index: line.items.indexOf(cell) });
        }
        const inColumn = (money: typeof monies[number], column: { x: number; right: number; next: number }) => (money.x >= column.x - 18 || Math.abs(money.right - column.right) <= 18) && money.x < column.next - 12 && money.right < column.next;
        const directed = columns.flatMap((column) => monies.filter((money) => inColumn(money, column)).map((money) => ({ ...money, kind: column.kind })));
        const populated = directed.filter((money) => statementAmount(money.amount) !== 0);
        const candidates = columns.length ? populated : amountX === null ? monies.filter((money) => line.items[money.index].text.trim() === money.amount) : monies.filter((money) => inColumn(money, { x: amountX!, right: amountRight, next: nextX }));
        const kind = populated.length === 1 ? populated[0].kind : section;
        if (kind !== 'debit' && kind !== 'credit') { warnings.push({ page: page.page, line: line.number, reason: 'Could not identify whether this transaction is spending or a credit' }); continue; }
        if (!dateText || candidates.length !== 1) { warnings.push({ page: page.page, line: line.number, reason: !dateText ? 'Date outside the statement period or unreadable' : 'Could not identify one transaction amount' }); continue; }
        const chosen = candidates[0];
        const rawAmount = chosen.amount;
        const cents = statementAmount(rawAmount);
        if (cents === null || cents <= 0 || cents > 100_000_000 || /-$/.test(rawAmount) || /\bCR\s*$/i.test(text)) { warnings.push({ page: page.page, line: line.number, reason: 'Invalid, zero or negative transaction amount' }); continue; }
        const description = line.items.map((item, index) => item.x >= balanceX - 18 ? '' : (columns.length ? directed : [chosen]).filter((money) => money.index === index).reduce((text, money) => text.replace(money.amount, ''), item.text)).join(' ').replace(date[0].trim(), '').trim();
        pending = { date: dateText, description, amount: (cents / 100).toFixed(2), kind, page: page.page, line: line.number };
      } else if (pending && !/\b(?:beginning|ending|available|closing) balance\b|^date\b|^www\.|^member fdic|^equal housing|^SYNTHETIC|^NO REAL ACCOUNT/i.test(text)) {
        // A new page header is never appended to a transaction description.
        if (inTable || page.page === pending.page) pending.description += ' ' + text;
      }
      if (csv.rows.length > MAX_CSV_ROWS) throw new Error('Import at most 5,000 transactions at a time.');
    }
  }
  flush();
  if (csv.rows.length > MAX_CSV_ROWS) throw new Error('Import at most 5,000 transactions at a time.');
  const latest = balances.sort((a, b) => b.asOf.localeCompare(a.asOf))[0];
  const conflict = latest && balances.some((balance) => balance.asOf === latest.asOf && balance.amountCents !== latest.amountCents);
  if (conflict) warnings.push({ page: latest.page, line: latest.line, reason: 'Conflicting closing balances; update your balance manually' });
  if (!csv.rows.length && (!latest || conflict)) {
    // Counts and fixed reasons help diagnose the layout without exposing bank
    // names, account numbers, amounts or extracted document text in an error.
    const issue = !period ? 'The statement date range was not recognized.' : warnings[0] ? `Page ${warnings[0].page}: ${warnings[0].reason}.` : 'The transaction headings or closing-balance label were not recognized.';
    throw new Error(`No supported transaction table or clear closing balance was found. Read ${pages.length} page${pages.length === 1 ? '' : 's'} and ${datedRows} dated row${datedRows === 1 ? '' : 's'}. ${issue}`);
  }
  if (!csv.rows.length && !noActivity) warnings.push({ page: latest.page, line: latest.line, reason: 'No transactions could be read; this import updates only the closing balance' });
  const pageCounts = pages.map((page) => ({ page: page.page, spending: csv.rows.filter((row, i) => csv.locations![i].page === page.page && !!row[2]).length, credits: csv.rows.filter((row, i) => csv.locations![i].page === page.page && !!row[3]).length }));
  return { csv, pages: pages.length, periods, warnings, balance: latest && !conflict ? latest : null, accountIdentifier: accountNumbers[0] ?? (accountEndings[0] ? `ending-${accountEndings[0]}` : null), pageCounts };
}
