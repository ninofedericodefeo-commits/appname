export type BankTransaction = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
};

export type RecurringCharge = {
  key: string;
  merchant: string;
  amountCents: number;
  cadence: 'monthly' | 'yearly';
  day: number;
  month: number;
  occurrences: number;
  latestDate: string;
  averageIntervalDays: number;
  minAmountCents: number;
  maxAmountCents: number;
  confidence: 'early' | 'repeated';
};

export function createSampleBankTransactions(now = new Date()): BankTransaction[] {
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyTransactions = (merchant: string, amountCents: number) =>
    [-2, -1, 0].map((offset) => {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
      return {
        id: `sample-${merchant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dateKey}`,
        date: dateKey,
        description: merchant,
        amountCents: -amountCents,
      };
    });
  const annualDay = Math.min(now.getDate(), 28);
  const annualDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(annualDay).padStart(2, '0')}`;
  const previousAnnualDate = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(annualDay).padStart(2, '0')}`;

  return [
    ...monthlyTransactions('Sample Video Stream', 1599),
    ...monthlyTransactions('Sample Music Plan', 1099),
    {
      id: `sample-cloud-storage-${previousAnnualDate}`,
      date: previousAnnualDate,
      description: 'Sample Cloud Storage',
      amountCents: -4999,
    },
    {
      id: `sample-cloud-storage-${annualDate}`,
      date: annualDate,
      description: 'Sample Cloud Storage',
      amountCents: -4999,
    },
    ...monthlyTransactions('Sample Payroll', -250000),
    {
      id: `sample-coffee-${annualDate}`,
      date: annualDate,
      description: 'Sample Coffee Shop',
      amountCents: -575,
    },
  ];
}

type ParsedCsv = {
  transactions: BankTransaction[];
  skippedRows: number;
};

const MAX_CSV_CHARACTERS = 5_000_000;
const MAX_TRANSACTION_ROWS = 20_000;

function splitCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field.trim());
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index += 1;
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('The CSV has an unclosed quoted field.');
  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function columnIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => aliases.includes(header.replace(/[^a-z]/g, '')));
}

function parseDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value);
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  let year: number;
  let month: number;
  let day: number;

  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (us) {
    month = Number(us[1]);
    day = Number(us[2]);
    year = Number(us[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
  } else {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  const parenthesized = /^\(\s*\$?\s*[\d,]+(?:\.\d{1,2})?\s*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const cents = Math.round(Number(normalized) * 100);
  if (!Number.isSafeInteger(cents) || cents === 0) return null;
  return parenthesized ? -Math.abs(cents) : cents;
}

function stableTransactionId(date: string, description: string, amountCents: number): string {
  const merchantKey = encodeURIComponent(description.toLowerCase().replace(/\s+/g, ' ').trim());
  return `bank-${date}-${amountCents}-${merchantKey}`;
}

export function parseBankCsv(input: string): ParsedCsv {
  if (input.length === 0) throw new Error('The selected file is empty.');
  if (input.length > MAX_CSV_CHARACTERS) throw new Error('Choose a CSV file smaller than 5 MB.');

  const rows = splitCsvRows(input.replace(/^\uFEFF/, ''));
  if (rows.length < 2) throw new Error('The CSV must contain a header and at least one transaction.');
  if (rows.length > MAX_TRANSACTION_ROWS + 1) throw new Error('The CSV contains more than 20,000 transactions.');

  const headers = rows[0].map((header) => header.toLowerCase().replace(/[^a-z]/g, ''));
  const dateColumn = columnIndex(headers, ['date', 'posteddate', 'transactiondate', 'postingdate']);
  const descriptionColumn = columnIndex(headers, ['description', 'transactiondescription', 'transactiondetails', 'transactionname', 'merchant', 'merchantname', 'payee', 'name', 'details']);
  const amountColumn = columnIndex(headers, ['amount', 'transactionamount', 'amountusd', 'amountincad']);
  const debitColumn = columnIndex(headers, ['debit', 'debitamount', 'withdrawal', 'withdrawals', 'withdrawalamount', 'charge', 'charges']);
  const creditColumn = columnIndex(headers, ['credit', 'creditamount', 'deposit', 'deposits', 'depositamount']);
  if (dateColumn < 0 || descriptionColumn < 0 || (amountColumn < 0 && debitColumn < 0 && creditColumn < 0)) {
    throw new Error('CSV needs date, description, and amount columns (or separate debit/credit columns).');
  }

  const transactions: BankTransaction[] = [];
  let skippedRows = 0;
  const seen = new Set<string>();

  for (const row of rows.slice(1)) {
    if (row.length !== headers.length) {
      skippedRows += 1;
      continue;
    }
    const date = parseDate(row[dateColumn]);
    const description = row[descriptionColumn].replace(/\s+/g, ' ').trim().slice(0, 120);
    let amountCents: number | null = null;

    if (amountColumn >= 0) {
      amountCents = parseAmount(row[amountColumn]);
    } else {
      const debit = debitColumn >= 0 && row[debitColumn] ? parseAmount(row[debitColumn]) : 0;
      const credit = creditColumn >= 0 && row[creditColumn] ? parseAmount(row[creditColumn]) : 0;
      if (debit !== null && credit !== null && (debit !== 0 || credit !== 0)) {
        amountCents = debit !== 0 ? -Math.abs(debit) : Math.abs(credit);
      }
    }

    if (!date || !description || amountCents === null) {
      skippedRows += 1;
      continue;
    }
    const id = stableTransactionId(date, description, amountCents);
    if (seen.has(id)) continue;
    seen.add(id);
    transactions.push({ id, date, description, amountCents });
  }

  if (transactions.length === 0) throw new Error('No valid transactions were found. Check the CSV columns and date/amount formats.');
  return { transactions, skippedRows };
}

function normalizeMerchant(description: string): string {
  return description.toLowerCase()
    .replace(/^(?:pos|debit card|card purchase|purchase|payment|recurring payment)\s+/i, '')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/\b(?:com|net|org)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function daysBetween(first: string, second: string): number {
  const [firstYear, firstMonth, firstDay] = first.split('-').map(Number);
  const [secondYear, secondMonth, secondDay] = second.split('-').map(Number);
  return Math.round((Date.UTC(secondYear, secondMonth - 1, secondDay) - Date.UTC(firstYear, firstMonth - 1, firstDay)) / 86_400_000);
}

export function detectRecurringCharges(transactions: BankTransaction[]): RecurringCharge[] {
  const grouped = new Map<string, BankTransaction[]>();
  for (const transaction of transactions) {
    if (transaction.amountCents >= 0) continue;
    const key = normalizeMerchant(transaction.description);
    if (key.length < 3) continue;
    const group = grouped.get(key) ?? [];
    group.push(transaction);
    grouped.set(key, group);
  }

  const candidates: RecurringCharge[] = [];
  for (const [key, group] of grouped) {
    const ordered = group.sort((left, right) => left.date.localeCompare(right.date));
    if (ordered.length < 2) continue;
    const cadence = ordered.length >= 2 && ordered.slice(1).every((transaction, index) => {
      const previous = ordered[index];
      const interval = daysBetween(previous.date, transaction.date);
      const cadenceMatches = interval >= 25 && interval <= 35 || interval >= 300 && interval <= 430;
      const priorAmount = Math.abs(previous.amountCents);
      const amount = Math.abs(transaction.amountCents);
      return cadenceMatches && Math.abs(amount - priorAmount) <= Math.max(100, priorAmount * 0.1);
    });
    if (!cadence) continue;

    const intervals = ordered.slice(1).map((transaction, index) => daysBetween(ordered[index].date, transaction.date));
    const yearlyCount = intervals.filter((interval) => interval >= 300 && interval <= 430).length;
    const selectedCadence = yearlyCount > 0 ? 'yearly' : 'monthly';
    const latest = ordered[ordered.length - 1];
    const totalCents = ordered.reduce((sum, transaction) => sum + Math.abs(transaction.amountCents), 0);
    const average = Math.round(totalCents / ordered.length);
    const amounts = ordered.map((transaction) => Math.abs(transaction.amountCents));
    const [, month, day] = latest.date.split('-').map(Number);
    candidates.push({
      key,
      merchant: latest.description,
      amountCents: average,
      cadence: selectedCadence,
      day,
      month,
      occurrences: ordered.length,
      latestDate: latest.date,
      averageIntervalDays: Math.round(intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length),
      minAmountCents: Math.min(...amounts),
      maxAmountCents: Math.max(...amounts),
      confidence: ordered.length >= 3 ? 'repeated' : 'early',
    });
  }

  return candidates.sort((left, right) => right.occurrences - left.occurrences || left.merchant.localeCompare(right.merchant));
}

export function isRecurringChargeTracked(merchant: string, subscriptionNames: string[]): boolean {
  const merchantKey = normalizeMerchant(merchant);
  return subscriptionNames.some((name) => normalizeMerchant(name) === merchantKey);
}
