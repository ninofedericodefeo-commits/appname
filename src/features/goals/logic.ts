export type GoalKind = 'item' | 'money';

export type Goal = {
  id: string;
  title: string;
  kind: GoalKind;
  targetCents: number;
  deadline: string | null;
  savedCents: number;
  createdAt: string;
};

export type ArchivedGoal = Goal & { endedAt: string; result: 'reached' | 'stopped' };

export type LoggedPurchase = {
  id: string;
  title: string;
  amountCents: number;
  purchasedAt: string;
  sourcePauseId?: string;
  decision: 'pending' | 'skipped' | 'saved';
  savedCents?: number;
};

export type GoalSettings = {
  suggestionsEnabled: boolean;
  maxSuggestionCents: number;
  maxPurchasePercent: number;
  widgetEnabled: boolean;
  widgetShowAmounts: boolean;
};

export const DEFAULT_GOAL_SETTINGS: GoalSettings = {
  suggestionsEnabled: true,
  maxSuggestionCents: 500,
  maxPurchasePercent: 10,
  widgetEnabled: false,
  widgetShowAmounts: false,
};

export function startingGoalCents(reservedCents: number, assignAll: boolean) {
  return assignAll ? reservedCents : 0;
}

export function unassignedPocketCents(reservedCents: number, goal: Goal | null) {
  return reservedCents - (goal?.savedCents ?? 0);
}

export function canReleaseUnassigned(cents: number, reservedCents: number, goal: Goal | null) {
  return Number.isSafeInteger(cents) && cents > 0 && cents <= unassignedPocketCents(reservedCents, goal);
}

export function canSetAsideForGoal(cents: number, goal: Goal | null, reportedBalanceCents: number | null, reservedCents: number) {
  return !!goal && Number.isSafeInteger(cents) && cents > 0 && cents <= goal.targetCents - goal.savedCents &&
    (reportedBalanceCents === null || cents <= reportedBalanceCents - reservedCents);
}

export function canReleaseFromGoal(cents: number, goal: Goal | null) {
  return !!goal && Number.isSafeInteger(cents) && cents > 0 && cents <= goal.savedCents;
}

export function canLogPurchase(id: string, title: string, amountCents: number, sourcePauseId: string | undefined, history: LoggedPurchase[]) {
  return !!id && !!title.trim() && title.trim().length <= 80 && Number.isSafeInteger(amountCents) && amountCents > 0 &&
    !history.some((item) => item.id === id || (sourcePauseId && item.sourcePauseId === sourcePauseId));
}

export function validDeadline(value: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateKey === value && value > todayKey;
}

export function progressPercent(goal: Goal | null) {
  if (!goal || goal.targetCents <= 0) return 0;
  return Math.min(100, Math.floor(goal.savedCents * 100 / goal.targetCents));
}

export function suggestAmounts({
  purchase,
  history,
  goal,
  settings,
  now = new Date(),
}: {
  purchase: LoggedPurchase;
  history: LoggedPurchase[];
  goal: Goal;
  settings: GoalSettings;
  now?: Date;
}) {
  const remaining = Math.max(0, goal.targetCents - goal.savedCents);
  const limit = Math.min(
    remaining,
    settings.maxSuggestionCents,
    Math.floor(purchase.amountCents * settings.maxPurchasePercent / 100),
  );
  if (!settings.suggestionsEnabled || limit < 1) return { amounts: [] as number[], sparse: true, paceLimited: false };

  const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const recent = history.filter((item) =>
    item.id !== purchase.id && Date.parse(item.purchasedAt) >= cutoff && Date.parse(item.purchasedAt) <= now.getTime(),
  );
  const sparse = recent.length < 3;
  let base = Math.max(1, Math.round(purchase.amountCents * 0.05));
  if (!sparse) {
    if (goal.deadline) {
      const days = Math.max(1, Math.ceil((Date.parse(`${goal.deadline}T23:59:59`) - now.getTime()) / 86_400_000));
      const expectedPurchases = Math.max(1, Math.round(recent.length * days / 30));
      base = Math.max(1, Math.ceil(remaining / expectedPurchases));
    } else {
      const sorted = recent.map((item) => item.amountCents).sort((a, b) => a - b);
      base = Math.max(1, Math.round(sorted[Math.floor(sorted.length / 2)] * 0.05));
    }
  }
  const amounts = [0.5, 1, 1.5]
    .map((scale) => Math.min(limit, Math.max(1, Math.round(base * scale))))
    .filter((amount, index, values) => values.indexOf(amount) === index);
  return { amounts, sparse, paceLimited: !sparse && !!goal.deadline && base > limit };
}
