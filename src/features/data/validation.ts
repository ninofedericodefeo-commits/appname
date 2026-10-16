import { effectiveBankTransaction } from '../pocket/transactions.ts';
import type { AccountTransaction, TransactionDirections } from '../pocket/transactions.ts';
import { validateDetails } from '../pocket/repository.ts';
import type { TransactionDetails } from '../pocket/repository.ts';
import { dateFromKey, validateSubscription } from '../subscriptions/logic.ts';
import type { Subscription } from '../subscriptions/logic.ts';
import { validSetAsideRule } from '../goals/logic.ts';
import type { SetAsideRule } from '../goals/logic.ts';
import { validateJson } from './backupFormat.ts';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function requireValue(test: unknown, message: string): asserts test { if (!test) throw new Error(`Backup validation failed: ${message}.`); }
function shape(value: Record<string, unknown>, template: Record<string, unknown>, path: string) {
  for (const [key, expected] of Object.entries(template)) {
    const item = value[key];
    if (expected === null) continue;
    requireValue(Array.isArray(expected) ? Array.isArray(item) : typeof item === typeof expected && item !== null, `${path}.${key}`);
    if (object(expected) && Object.keys(expected).length) { requireValue(object(item), path); shape(item, expected, `${path}.${key}`); }
  }
}
function rows(state: Record<string, unknown>, key: string) {
  requireValue(Array.isArray(state[key]), key);
  const result = state[key] as unknown[];
  requireValue(result.every(row => object(row) && typeof row.id === 'string' && !!row.id), key);
  const records = result as Record<string, unknown>[];
  requireValue(new Set(records.map(item => item.id)).size === records.length, `duplicate IDs in ${key}`);
  return records;
}
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export function validateStoreState(name: string, state: Record<string, unknown>, defaults: Record<string, unknown>) {
  validateJson(state); shape(state, defaults, name);
  if (name === 'gasfinder-savings-pocket') {
    requireValue(nonnegative(state.reservedCents), 'set-aside amount');
    requireValue(state.reportedBalanceCents === null || Number.isSafeInteger(state.reportedBalanceCents), 'bank balance');
    const goal = state.activeGoal;
    if (goal !== null) requireValue(object(goal) && typeof goal.id === 'string' && typeof goal.title === 'string' && nonnegative(goal.savedCents) && nonnegative(goal.targetCents) && goal.targetCents > 0 && goal.savedCents <= (state.reservedCents as number) && object(goal.setAsideRule) && validSetAsideRule(goal.setAsideRule as SetAsideRule), 'active goal');
    for (const purchase of rows(state, 'purchases')) requireValue(typeof purchase.title === 'string' && nonnegative(purchase.amountCents) && Number.isFinite(Date.parse(String(purchase.purchasedAt))), 'purchase');
    for (const row of rows(state, 'accountTransactions')) requireValue(typeof row.title === 'string' && Number.isSafeInteger(row.amountCents) && Number.isFinite(Date.parse(String(row.occurredAt))) && ['posted', 'pending', 'recorded'].includes(String(row.status)), 'bank movement');
    for (const row of rows(state, 'entries')) requireValue(nonnegative(row.amountCents) && ['reserve', 'release', 'assign'].includes(String(row.kind)), 'savings entry');
    rows(state, 'archivedGoals');
    for (const key of ['matchHistory','bankDuplicateHistory']) if (state[key]) for (const revision of rows(state,key)) requireValue(typeof revision.bankId === 'string' && Number.isFinite(Date.parse(String(revision.createdAt))), 'reconciliation history');
    const bankRows = new Map((state.accountTransactions as Record<string, unknown>[]).map(row => [row.id,row]));
    const checkedDuplicates = new Set<unknown>();
    for (const row of bankRows.values()) if (row.duplicateOf && !checkedDuplicates.has(row.id)) {
      const seen = new Set([row.id]); let pointer: unknown = row.duplicateOf;
      while (pointer) {
        requireValue(typeof pointer === 'string' && bankRows.has(pointer) && !seen.has(pointer), 'duplicate relationship');
        const target = bankRows.get(pointer)!; requireValue(effectiveBankTransaction(target as AccountTransaction, state.transactionDirections as TransactionDirections).amountCents === effectiveBankTransaction(row as AccountTransaction, state.transactionDirections as TransactionDirections).amountCents, 'duplicate amount');
        if (checkedDuplicates.has(pointer)) break;
        seen.add(pointer); pointer = target.duplicateOf;
      }
      seen.forEach(id => checkedDuplicates.add(id));
    }
    if (state.separatePurchaseDecisions) for (const decision of rows(state, 'separatePurchaseDecisions')) {
      requireValue(['bank-bank', 'bank-purchase'].includes(String(decision.kind)) && typeof decision.bankId === 'string' && !!decision.bankId &&
        typeof decision.otherId === 'string' && !!decision.otherId && decision.bankId !== decision.otherId && typeof decision.evidence === 'string' && decision.evidence.length > 0 && decision.evidence.length <= 10000 &&
        Number.isFinite(Date.parse(String(decision.createdAt))) && (!decision.undoneAt || Number.isFinite(Date.parse(String(decision.undoneAt)))), 'separate purchase decision');
    }
    if (state.transactionDirections) requireValue(object(state.transactionDirections) && Object.values(state.transactionDirections).every(value => value === 'in' || value === 'out'), 'direction corrections');
    if (state.transactionDetails) { requireValue(object(state.transactionDetails), 'transaction details'); Object.values(state.transactionDetails).forEach(value => validateDetails(value as TransactionDetails)); }
    if (state.merchantAliases) requireValue(object(state.merchantAliases) && Object.values(state.merchantAliases).every(value => typeof value === 'string' && value.length <= 80), 'merchant aliases');
    if (state.correctionHistory) for (const revision of rows(state, 'correctionHistory')) {
      requireValue(typeof revision.transactionId === 'string' && Number.isFinite(Date.parse(String(revision.createdAt))) && object(revision.before) && object(revision.after), 'correction history');
      for (const change of [revision.before, revision.after]) {
        if ('details' in change && change.details !== null) validateDetails(change.details as TransactionDetails);
        if ('direction' in change) requireValue(change.direction === null || change.direction === 'in' || change.direction === 'out', 'correction direction');
        if (change.alias) requireValue(object(change.alias) && typeof change.alias.key === 'string' && (change.alias.value === null || typeof change.alias.value === 'string'), 'alias correction');
      }
    }
  }
  if (name === 'gasfinder-subscriptions') for (const sub of rows(state, 'subscriptions')) { validateSubscription(sub as Subscription); requireValue(typeof sub.name === 'string' && nonnegative(sub.amountCents) && typeof sub.active === 'boolean' && ['monthly', 'yearly'].includes(String(sub.cadence)) && Number.isInteger(sub.day) && Number(sub.day) >= 1 && Number(sub.day) <= 31 && Number.isInteger(sub.month) && Number(sub.month) >= 1 && Number(sub.month) <= 12, 'subscription');
    requireValue(!sub.cancelBy || typeof sub.cancelBy === 'string' && dateFromKey(sub.cancelBy), 'cancellation follow-up date');
    requireValue(!sub.canceledAt || Number.isFinite(Date.parse(String(sub.canceledAt))), 'cancellation date');
    if (sub.lastReview) requireValue(object(sub.lastReview) && ['keep', 'plan-to-cancel'].includes(String(sub.lastReview.decision)) && typeof sub.lastReview.renewalDate === 'string' && dateFromKey(sub.lastReview.renewalDate), 'renewal review');
    if (sub.cancellationHistory) requireValue(Array.isArray(sub.cancellationHistory) && sub.cancellationHistory.every(item => object(item) && Number.isFinite(Date.parse(String(item.canceledAt))) && (!item.reactivatedAt || Number.isFinite(Date.parse(String(item.reactivatedAt))))), 'cancellation history');
  }
  if (name === 'gasfinder-drive-profile') for (const car of rows(state, 'cars')) requireValue(typeof car.name === 'string' && typeof car.mpg === 'number' && car.mpg > 0 && typeof car.tankGallons === 'number' && car.tankGallons > 0, 'car');
  if (name === 'gasfinder-receipt-reports' || name === 'gasfinder-local-price-reports') for (const report of rows(state, 'reports')) { requireValue(typeof report.stationName === 'string' && ['regular', 'midgrade', 'premium', 'diesel'].includes(String(report.fuelType)) && (name === 'gasfinder-local-price-reports' ? typeof report.price === 'number' && report.price > 0 : typeof report.photoUri === 'string' && typeof report.pricePerGallon === 'number' && report.pricePerGallon > 0), 'fuel report');
    requireValue(!report.priceQualifier || ['standard', 'cash', 'card', 'member'].includes(String(report.priceQualifier)), 'price type');
    requireValue(report.totalCents === undefined || nonnegative(report.totalCents), 'refill total');
    requireValue(report.gallons === undefined || typeof report.gallons === 'number' && report.gallons > 0 && report.gallons <= 100, 'refill gallons');
    requireValue(!report.observedAt || Number.isFinite(Date.parse(String(report.observedAt))), 'observation time');
    requireValue(!report.accountLink || object(report.accountLink) && ['transaction', 'purchase'].includes(String(report.accountLink.kind)) && typeof report.accountLink.id === 'string', 'fuel account link');
    if (name === 'gasfinder-local-price-reports') requireValue(typeof report.latitude === 'number' && Math.abs(report.latitude) <= 90 && typeof report.longitude === 'number' && Math.abs(report.longitude) <= 180, 'station location');
  }
  if (name === 'gasfinder-settings' && state.budgets !== undefined) { requireValue(object(state.budgets) && Object.values(state.budgets).every(nonnegative), 'budgets'); requireValue([0, 30, 45, 60, 90].includes(Number(state.statementReminderDays)), 'statement cadence'); }
  if (name === 'gasfinder-savings-pocket') for (const row of state.accountTransactions as Record<string, unknown>[]) { requireValue(!row.sourceDate || typeof row.sourceDate === 'string' && dateFromKey(row.sourceDate), 'source calendar date'); requireValue(row.shadowPurchaseIds === undefined || Array.isArray(row.shadowPurchaseIds) && row.shadowPurchaseIds.every(id => typeof id === 'string'), 'linked purchase evidence'); requireValue(row.rawDescription === undefined || typeof row.rawDescription === 'string' && row.rawDescription.length <= 500, 'original description'); for (const key of ['sourcePage','sourceLine','sourceRow']) requireValue(row[key] === undefined || Number.isInteger(row[key]) && Number(row[key]) > 0, 'source location'); }
  if (name === 'gasfinder-settings') requireValue(!state.priceQualifier || ['standard', 'cash', 'card', 'member'].includes(String(state.priceQualifier)), 'selected price type');
}
