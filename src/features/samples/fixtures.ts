import type { PocketTransaction } from '../pocket/transactions.ts';
import type { Goal } from '../goals/logic.ts';
import type { Subscription } from '../subscriptions/logic.ts';
import { sampleSubscriptions } from '../subscriptions/samples.ts';

export type SampleTransaction = PocketTransaction & { isSample: true };
export const SAMPLE_ACCOUNT_ID = 'sample-citizens-account';
export const SAMPLE_ACCOUNT_LABEL = 'Sample Citizens account';
export const SAMPLE_BALANCE_AS_OF = '2026-09-30';
export const SAMPLE_OPENING_BALANCE_CENTS = 120000;
export const SAMPLE_CLOSING_BALANCE_CENTS = 328054;

export function sampleAccount() {
  return { id: SAMPLE_ACCOUNT_ID, label: SAMPLE_ACCOUNT_LABEL, isSample: true as const,
    balanceCents: SAMPLE_CLOSING_BALANCE_CENTS, asOf: SAMPLE_BALANCE_AS_OF, lastFour: '0000' };
}

// This ledger reconciles exactly to the bundled synthetic PDF. Never write it to
// pocketStore: it is a display overlay, excluded from real accounting and exports.
export function sampleTransactions(): SampleTransaction[] {
  const rows: [string, string, number][] = [
    ['02', 'Sample payroll deposit', 250000], ['04', 'Sample Harbor Fuel', -4299],
    ['06', 'Sample Market Basket', -6850], ['08', 'Sample Music Plus', -799],
    ['10', 'Sample Movie Night', -1299], ['13', 'Sample Corner Cafe', -3200],
    ['16', 'Sample reimbursement', 3500], ['20', 'Online transfer to savings - SAMPLE', -25000],
    ['24', 'Sample Auto Supplies', -3999],
  ];
  return rows.map(([day, title, amountCents]): SampleTransaction => ({ id: `sample-citizens-2026-09-${day}`, title,
    amountCents, occurredAt: `2026-09-${day}T12:00:00.000Z`, sourceDate: `2026-09-${day}`,
    source: 'citizens-pdf', status: 'posted', accountId: SAMPLE_ACCOUNT_ID,
    accountLabel: SAMPLE_ACCOUNT_LABEL, isSample: true })).reverse();
}

export function isSampleRecord(record: { id: string; isSample?: boolean }) {
  return record.isSample === true || record.id.startsWith('sample-');
}

/** Idempotent overlay; retains real object identities and never mutates input. */
export function withSampleTransactions(realRows: PocketTransaction[], visible: boolean): (PocketTransaction | SampleTransaction)[] {
  const real = realRows.filter(row => !isSampleRecord(row));
  return visible ? [...real, ...sampleTransactions()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) : real;
}

/** Reuse existing invented services, replacing legacy samples rather than doubling them. */
export function withSampleSubscriptions(subscriptions: Subscription[], visible: boolean, now = new Date()): Subscription[] {
  const real = subscriptions.filter(item => !isSampleRecord(item));
  return visible ? [...real, ...sampleSubscriptions(now)] : real;
}

export function sampleGoal(): Goal & { isSample: true } {
  return { id: 'sample-weekend-away', title: 'Sample weekend away', kind: 'money', targetCents: 60000,
    savedCents: 18500, createdAt: '2026-09-01T12:00:00.000Z', deadline: null,
    setAsideRule: { mode: 'fixed', cents: 200 }, isSample: true };
}
