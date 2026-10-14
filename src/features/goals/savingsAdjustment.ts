import { canReleaseFromGoal, canReleaseUnassigned, canSetAsideForGoal } from './logic.ts';
import type { Goal } from './logic.ts';
import { canReserve } from '../pocket/logic.ts';

export type SavingsDestination = 'goal' | 'unassigned';
export type SavingsAction = 'add' | 'lower';
export type SavingsState = { activeGoal: Goal | null; reservedCents: number; estimatedBalanceCents: number | null };

export function previewSavingsAdjustment(state: SavingsState, destination: SavingsDestination, action: SavingsAction, cents: number, expectedGoalId?: string | null) {
  const goal = state.activeGoal;
  const unassignedCents = state.reservedCents - (goal?.savedCents ?? 0);
  if (!Number.isSafeInteger(cents) || cents <= 0) return { error: 'Enter an amount greater than $0.' } as const;
  if (destination === 'goal' && (!goal || expectedGoalId !== undefined && expectedGoalId !== goal.id)) return { error: 'This goal changed. Close this form and try again.' } as const;
  const allowed = destination === 'goal'
    ? action === 'add' ? canSetAsideForGoal(cents, goal!, state.estimatedBalanceCents, state.reservedCents) : canReleaseFromGoal(cents, goal!)
    : action === 'add' ? canReserve(cents, state.estimatedBalanceCents, state.reservedCents) : canReleaseUnassigned(cents, state.reservedCents, goal);
  if (!allowed) return { error: action === 'add'
    ? 'That amount exceeds your available money or the remaining goal.'
    : destination === 'goal' ? 'That amount exceeds the savings assigned to this goal.' : 'That amount exceeds your unassigned savings.' } as const;
  const delta = action === 'add' ? cents : -cents;
  const reservedAfterCents = state.reservedCents + delta;
  const assignedAfterCents = (goal?.savedCents ?? 0) + (destination === 'goal' ? delta : 0);
  return { error: null, reservedAfterCents, assignedAfterCents,
    destinationBeforeCents: destination === 'goal' ? goal!.savedCents : unassignedCents,
    destinationAfterCents: destination === 'goal' ? assignedAfterCents : unassignedCents + delta,
    availableAfterCents: state.estimatedBalanceCents === null ? null : state.estimatedBalanceCents - reservedAfterCents } as const;
}
