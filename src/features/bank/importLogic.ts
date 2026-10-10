import { automaticSetAsideCents } from '../goals/logic.ts';
import type { Goal, LoggedPurchase } from '../goals/logic.ts';
import type { AccountTransaction } from '../pocket/transactions.ts';
import { parseDollars } from '../pocket/logic.ts';

export const MAX_CSV_BYTES = 2_000_000;
export const MAX_CSV_ROWS = 5000;
export type BankCSV = { headers: string[]; rows: string[][]; headerRow?: number; source?: 'citizens-pdf'; locations?: { page: number; line: number }[] };
export type BankMapping = {
  date: number; description: number; amount: number; debit: number; credit: number;
  currency: number; type: number; status: number; transactionId: number;
  mode: 'signed' | 'debit-credit'; spendingSign: 'negative' | 'positive'; dateOrder: 'mdy' | 'dmy';
};
export type BankPurchase = { id: string; title: string; amountCents: number; purchasedAt: string; bankSource?: 'csv' | 'citizens-pdf'; bankAccountLabel?: string; recurringHint?: boolean };
export type BankPreviewRow = BankPurchase & { rowNumber: number; pageNumber?: number; lineNumber?: number; duplicate: 'known' | 'possible' | null; matchTitle?: string; matchId?: string };
export type ImportEntry = { id: string; amountCents: number; createdAt: string; kind: 'reserve' | 'release' | 'assign'; goalId?: string; purchaseId?: string };
export type BankImportState = {
  activeGoal: Goal | null; reservedCents: number; reportedBalanceCents: number | null;
  purchases: LoggedPurchase[]; entries: ImportEntry[]; bankImportKeys: string[];
};

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
const aliases = {
  date: ['transactiondate', 'date', 'posteddate', 'postingdate', 'postdate'],
  description: ['description', 'transactiondescription', 'merchant', 'payee', 'memo', 'name'],
  amount: ['amount', 'transactionamount', 'usdamount'],
  debit: ['debit', 'debitamount', 'withdrawal', 'withdrawals', 'moneyout'],
  credit: ['credit', 'creditamount', 'deposit', 'deposits', 'moneyin'],
  currency: ['currency', 'currencycode'],
  type: ['type', 'transactiontype', 'debitcredit'],
  status: ['status', 'transactionstatus'],
  transactionId: ['transactionid', 'referenceid', 'reference', 'id'],
};

function detectColumn(headers: string[], names: string[]) {
  const keys = headers.map(headerKey);
  for (const name of names) { const index = keys.indexOf(name); if (index >= 0) return index; }
  return -1;
}

export function guessMapping(csv: BankCSV): BankMapping {
  const columns = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, detectColumn(csv.headers, names)])) as Pick<BankMapping, keyof typeof aliases>;
  const amounts = csv.rows.slice(0, 50).map((row) => parseBankAmount(row[columns.amount] ?? '')).filter((value) => value !== null && value !== 0);
  return { ...columns, mode: columns.debit >= 0 ? 'debit-credit' : 'signed',
    spendingSign: amounts.some((amount) => amount! < 0) ? 'negative' : 'positive', dateOrder: 'mdy' };
}

// RFC-style quoted fields, escaped quotes and embedded newlines. No CSV cell is
// executed. The bounds keep a large statement from monopolizing the mobile JS thread.
export function parseBankCSV(text: string): BankCSV {
  if (text.length > MAX_CSV_BYTES || text.includes('\0')) throw new Error('Choose a UTF-8 CSV under 2 MB.');
  const input = text.replace(/^\uFEFF/, '');
  const firstLine = input.split(/\r?\n/, 1)[0];
  const outside = firstLine.replace(/"(?:[^"]|"")*"/g, '');
  const count = (separator: string) => outside.split(separator).length - 1;
  const separator = count('\t') > count(',') && count('\t') >= count(';') ? '\t' : count(';') > count(',') ? ';' : ',';
  const records: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  function finishField() { row.push(field.trim()); field = ''; closed = false; }
  function finishRow() {
    finishField();
    if (row.some((cell) => cell.length > 0)) records.push(row);
    row = [];
    if (records.length > MAX_CSV_ROWS + 21) throw new Error('Import at most 5,000 transactions at a time.');
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else field += char;
    } else if (char === separator) finishField();
    else if (char === '\n' || char === '\r') { if (char === '\r' && input[i + 1] === '\n') i++; finishRow(); }
    else if (char === '"' && field.trim() === '' && !closed) { quoted = true; field = ''; }
    else if (closed && char.trim()) throw new Error('A CSV field has text after its closing quote. Export the statement as CSV again.');
    else if (!closed) field += char;
    if (row.length > 100 || field.length > 20_000) throw new Error('This CSV has unusually large fields. Export a smaller transaction CSV.');
  }
  if (quoted) throw new Error('A CSV quote is unfinished. Export the statement as CSV again.');
  if (field.length || row.length) finishRow();
  if (records.length < 2) throw new Error('The CSV needs a header row and at least one transaction.');
  // Some banks put an account summary above the transaction headings.
  const recognized = records.slice(0, 20).findIndex((headers) => detectColumn(headers, aliases.date) >= 0 &&
    detectColumn(headers, aliases.description) >= 0 && (detectColumn(headers, aliases.amount) >= 0 || detectColumn(headers, aliases.debit) >= 0));
  const headerIndex = recognized >= 0 ? recognized : 0;
  const headers = records[headerIndex];
  const rows = records.slice(headerIndex + 1);
  if (headers.length < 3 || rows.length > MAX_CSV_ROWS) throw new Error('Use a CSV with date, description and amount columns, and at most 5,000 transactions.');
  return { headers: headers.map((header, index) => header || `Column ${index + 1}`), rows, headerRow: headerIndex };
}

export function parseBankAmount(raw: string): number | null {
  let value = raw.trim();
  let sign = 1;
  if (/^\(.*\)$/.test(value)) { sign = -1; value = value.slice(1, -1).trim(); }
  if (value.startsWith('-')) { if (sign < 0) return null; sign = -1; value = value.slice(1); }
  else if (value.startsWith('+')) value = value.slice(1);
  value = value.replace(/^(?:USD\s*|US\$\s*|\$\s*)/i, '').replace(/\s*USD$/i, '').trim();
  const cents = parseDollars(value);
  return cents === null ? null : sign * cents;
}

export function parseBankDate(raw: string, order: BankMapping['dateOrder'], now = new Date()): string | null {
  const value = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value);
  if (!iso && !slash) return null;
  const year = Number(iso ? iso[1] : slash![3]);
  const month = Number(iso ? iso[2] : order === 'mdy' ? slash![1] : slash![2]);
  const day = Number(iso ? iso[3] : order === 'mdy' ? slash![2] : slash![1]);
  const date = new Date(year, month - 1, day, 12);
  const latest = new Date(now); latest.setHours(23, 59, 59, 999);
  if (year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date > latest) return null;
  return date.toISOString();
}

function dayKey(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

// Two 32-bit hashes form a stable local identity. The original bank file and account
// number are not persisted. Repeated equal purchases use an occurrence index.
function identity(value: string) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i); }
  return `bank-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

function validateBankMapping(csv: BankCSV, mapping: BankMapping, accountLabel: string) {
  const validColumn = (index: number) => Number.isInteger(index) && index >= 0 && index < csv.headers.length;
  if (!accountLabel.trim() || accountLabel.trim().length > 60) throw new Error('Give this account a nickname up to 60 characters. Use the same nickname for later imports.');
  const required = [mapping.date, mapping.description, mapping.mode === 'signed' ? mapping.amount : mapping.debit];
  if (!required.every(validColumn) || new Set(required).size !== required.length) throw new Error('Choose separate date, description and spending amount columns.');
  if (mapping.mode === 'debit-credit' && mapping.credit >= 0 && (mapping.credit === mapping.debit || required.includes(mapping.credit))) throw new Error('Debit and credit need separate columns.');
}

export function previewBankCSV(csv: BankCSV, mapping: BankMapping, accountLabel: string, history: LoggedPurchase[], importedKeys: string[], now = new Date()) {
  validateBankMapping(csv, mapping, accountLabel);
  const known = new Set([...importedKeys, ...history.map((purchase) => purchase.id)]);
  const matching = new Map<string, LoggedPurchase>();
  for (const purchase of history) matching.set(`${dayKey(purchase.purchasedAt)}|${purchase.amountCents}`, purchase);
  const occurrences = new Map<string, number>();
  const rows: BankPreviewRow[] = [], excluded: { rowNumber: number; reason: string }[] = [];
  csv.rows.forEach((row, index) => {
    const rowNumber = index + (csv.headerRow ?? 0) + 2;
    const get = (column: number) => column >= 0 ? (row[column] ?? '').trim() : '';
    function exclude(reason: string) { excluded.push({ rowNumber, reason }); }
    if (get(mapping.status).toLowerCase().includes('pending')) { exclude('Pending transaction'); return; }
    if (mapping.currency >= 0 && !['USD', 'US DOLLAR', 'US DOLLARS'].includes(get(mapping.currency).toUpperCase())) { exclude('Currency is not USD'); return; }
    const type = normalize(get(mapping.type));
    if (/^(credit|deposit|refund|transfer|payment|payment received|credit card payment|card payment|balance payment|fee)$/.test(type)) { exclude('Credit, refund, payment, transfer or fee'); return; }
    let amountCents: number | null;
    if (mapping.mode === 'debit-credit') {
      const raw = get(mapping.debit);
      const credit = get(mapping.credit) ? parseBankAmount(get(mapping.credit)) : 0;
      if (credit === null) { exclude('Invalid credit amount'); return; }
      if (!raw || parseBankAmount(raw) === 0) { exclude('No spending debit'); return; }
      if (credit !== 0) { exclude('Both debit and credit are filled'); return; }
      amountCents = parseBankAmount(raw);
      if (amountCents !== null) amountCents = Math.abs(amountCents);
    } else {
      const signed = parseBankAmount(get(mapping.amount));
      amountCents = signed === null ? null : mapping.spendingSign === 'negative' ? -signed : signed;
    }
    if (amountCents === null) { exclude('Invalid amount'); return; }
    if (amountCents <= 0) { exclude('Credit or zero amount'); return; }
    const purchasedAt = parseBankDate(get(mapping.date), mapping.dateOrder, now);
    if (!purchasedAt) { exclude('Invalid or future date'); return; }
    const description = get(mapping.description).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!description) { exclude('Missing description'); return; }
    const sourceId = get(mapping.transactionId);
    const base = JSON.stringify([normalize(accountLabel), dayKey(purchasedAt), amountCents, normalize(description)]);
    const occurrence = (occurrences.get(base) ?? 0) + 1; occurrences.set(base, occurrence);
    const id = identity(sourceId ? JSON.stringify([normalize(accountLabel), 'id', sourceId]) : `${base}|${occurrence}`);
    const match = matching.get(`${dayKey(purchasedAt)}|${amountCents}`);
    const duplicate = known.has(id) ? 'known' : match ? 'possible' : null;
    // Duplicate bank IDs in one file are never selected twice.
    known.add(id);
    rows.push({ id, title: description.slice(0, 80), amountCents, purchasedAt, rowNumber, duplicate, matchTitle: match?.title, matchId: match?.id,
      bankSource: csv.source ?? 'csv', bankAccountLabel: accountLabel.trim(), recurringHint: /\brecurring\b/i.test(description),
      ...(csv.locations?.[index] ? { pageNumber: csv.locations[index].page, lineNumber: csv.locations[index].line } : {}),
    });
  });
  return { rows, excluded };
}

// Keep account movements separately from savings purchases. This lets Pocket
// show deposits/transfers/fees without applying the goal rule to those rows.
export function previewAccountTransactions(csv: BankCSV, mapping: BankMapping, accountLabel: string, now = new Date()) {
  validateBankMapping(csv, mapping, accountLabel);
  const rows: (AccountTransaction & { rowNumber: number })[] = [];
  const excluded: { rowNumber: number; reason: string }[] = [];
  const occurrences = new Map<string, number>();
  csv.rows.forEach((row, index) => {
    const rowNumber = index + (csv.headerRow ?? 0) + 2;
    const get = (column: number) => column >= 0 ? (row[column] ?? '').trim() : '';
    const reject = (reason: string) => excluded.push({ rowNumber, reason });
    if (mapping.currency >= 0 && !['USD', 'US DOLLAR', 'US DOLLARS'].includes(get(mapping.currency).toUpperCase())) { reject('Currency is not USD'); return; }
    let delta: number | null;
    if (mapping.mode === 'debit-credit') {
      const debit = get(mapping.debit) ? parseBankAmount(get(mapping.debit)) : 0;
      const credit = get(mapping.credit) ? parseBankAmount(get(mapping.credit)) : 0;
      if (debit === null || credit === null || (debit !== 0 && credit !== 0)) { reject('Invalid or ambiguous debit/credit'); return; }
      delta = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
    } else {
      const amount = parseBankAmount(get(mapping.amount));
      delta = amount === null ? null : mapping.spendingSign === 'negative' ? amount : -amount;
      if (delta !== null && /^(?:credit|deposit|refund|payment received)$/.test(normalize(get(mapping.type)))) delta = Math.abs(delta);
    }
    const occurredAt = parseBankDate(get(mapping.date), mapping.dateOrder, now);
    const description = get(mapping.description).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (delta === null || delta === 0) { reject('Invalid or zero amount'); return; }
    if (!occurredAt || !description) { reject(!occurredAt ? 'Invalid or future date' : 'Missing description'); return; }
    const base = JSON.stringify([normalize(accountLabel), dayKey(occurredAt), delta, normalize(description)]);
    const occurrence = (occurrences.get(base) ?? 0) + 1; occurrences.set(base, occurrence);
    const sourceId = get(mapping.transactionId);
    const key = sourceId ? JSON.stringify([normalize(accountLabel), 'id', sourceId]) : `${base}|${occurrence}`;
    const statusText = normalize(get(mapping.status));
    rows.push({ id: `account-${identity(key).slice(5)}`, title: description.slice(0, 80), amountCents: delta, occurredAt,
      source: csv.source ?? 'csv', accountLabel: accountLabel.trim(), rowNumber,
      status: statusText.includes('pending') ? 'pending' : csv.source === 'citizens-pdf' || /^(?:posted|completed?|cleared|settled)$/.test(statusText) ? 'posted' : 'recorded' });
  });
  return { rows, excluded };
}

export function applyBankImport(state: BankImportState, candidates: BankPurchase[], applyRule: boolean, now = new Date()) {
  const next: BankImportState = { ...state, purchases: [...state.purchases], entries: [...state.entries], bankImportKeys: [...state.bankImportKeys] };
  const known = new Set([...state.bankImportKeys, ...state.purchases.map((purchase) => purchase.id)]);
  let imported = 0, skipped = 0, savedCents = 0;
  const ordered = [...candidates].sort((a, b) => Date.parse(a.purchasedAt) - Date.parse(b.purchasedAt));
  for (const item of ordered) {
    const date = new Date(item.purchasedAt);
    const latest = new Date(now); latest.setHours(23, 59, 59, 999);
    if (known.has(item.id) || !/^bank-[a-f0-9]{16}$/.test(item.id) || !item.title.trim() || item.title.trim().length > 80 ||
      !Number.isSafeInteger(item.amountCents) || item.amountCents <= 0 || item.amountCents > 100_000_000 ||
      !Number.isFinite(date.getTime()) || date > latest) { skipped++; continue; }
    const reserve = applyRule ? automaticSetAsideCents(item.amountCents, next.activeGoal, next.reportedBalanceCents, next.reservedCents) : 0;
    next.purchases.unshift({ ...item, title: item.title.trim(), source: 'bank-import',
      decision: reserve > 0 ? 'saved' : applyRule ? 'pending' : 'skipped', ...(reserve > 0 ? { savedCents: reserve } : {}) });
    if (reserve > 0 && next.activeGoal) {
      next.reservedCents += reserve;
      next.activeGoal = { ...next.activeGoal, savedCents: next.activeGoal.savedCents + reserve };
      next.entries.unshift({ id: `${item.id}-set-aside`, amountCents: reserve, kind: 'reserve',
        createdAt: now.toISOString(), goalId: next.activeGoal.id, purchaseId: item.id });
      savedCents += reserve;
    }
    next.bankImportKeys.push(item.id); known.add(item.id); imported++;
  }
  return { state: next, imported, skipped, savedCents };
}
