import { dateFromKey, localDateKey } from '../../lib/calendarDate.ts';
import type { AccountTransaction } from './transactions.ts';
export function manualMovementDate(day: string, now = new Date()) {
  const date = dateFromKey(day);
  if (!date || day > localDateKey(now)) throw Error('Choose a valid date, today or earlier.');
  return day === localDateKey(now) ? now.toISOString() : date.toISOString();
}
export function manualCredit(id: string, title: string, cents: number, day: string, kind: 'deposit' | 'refund', account: { id?: string; nickname: string }, now = new Date()): AccountTransaction {
  if (!/^account-[a-f0-9]{16}$/.test(id) || !title.trim() || title.trim().length > 80 || !Number.isSafeInteger(cents) || cents <= 0 || cents > 100_000_000 || !['deposit','refund'].includes(kind)) throw Error('Enter a name and a positive amount up to $1,000,000.');
  return { id, title: title.trim(), amountCents: cents, sourceDate: day, occurredAt: manualMovementDate(day,now), source: 'manual', status: 'recorded', ...(account.id ? { accountId: account.id } : {}), accountLabel: account.nickname, transactionType: kind };
}
