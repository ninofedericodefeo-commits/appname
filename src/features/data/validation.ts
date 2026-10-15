import { validateDetails } from '../pocket/repository.ts';
import type { TransactionDetails } from '../pocket/repository.ts';
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
    if (state.transactionDirections) requireValue(object(state.transactionDirections) && Object.values(state.transactionDirections).every(value => value === 'in' || value === 'out'), 'direction corrections');
    if (state.transactionDetails) { requireValue(object(state.transactionDetails), 'transaction details'); Object.values(state.transactionDetails).forEach(value => validateDetails(value as TransactionDetails)); }
    if (state.merchantAliases) requireValue(object(state.merchantAliases) && Object.values(state.merchantAliases).every(value => typeof value === 'string' && value.length <= 80), 'merchant aliases');
    if (state.correctionHistory) rows(state, 'correctionHistory');
  }
  if (name === 'gasfinder-subscriptions') for (const sub of rows(state, 'subscriptions')) requireValue(typeof sub.name === 'string' && nonnegative(sub.amountCents) && typeof sub.active === 'boolean' && ['monthly', 'yearly'].includes(String(sub.cadence)) && Number.isInteger(sub.day) && Number(sub.day) >= 1 && Number(sub.day) <= 31 && Number.isInteger(sub.month) && Number(sub.month) >= 1 && Number(sub.month) <= 12, 'subscription');
  if (name === 'gasfinder-drive-profile') for (const car of rows(state, 'cars')) requireValue(typeof car.name === 'string' && typeof car.mpg === 'number' && car.mpg > 0 && typeof car.tankGallons === 'number' && car.tankGallons > 0, 'car');
  if (name === 'gasfinder-receipt-reports' || name === 'gasfinder-local-price-reports') for (const report of rows(state, 'reports')) requireValue(typeof report.stationName === 'string' && ['regular', 'midgrade', 'premium', 'diesel'].includes(String(report.fuelType)) && (name === 'gasfinder-local-price-reports' ? typeof report.price === 'number' && report.price > 0 : typeof report.photoUri === 'string' && typeof report.pricePerGallon === 'number' && report.pricePerGallon > 0), 'fuel report');
}
