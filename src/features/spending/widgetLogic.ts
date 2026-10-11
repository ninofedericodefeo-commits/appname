import type { PurchasePauseItem } from '../../types/investing.ts';

export type PauseActivityProps = { itemId: string; name: string; createdAt: number; reviewAt: number; reviewLabel: string };
export function pauseActivityProps(item: PurchasePauseItem): PauseActivityProps {
  return { itemId: item.id, name: 'Purchase waiting list', createdAt: item.createdAt, reviewAt: item.reviewAt,
    reviewLabel: new Date(item.reviewAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) };
}

// Reconcile only activities a person started. App relaunch never starts one automatically.
export async function reconcilePauseActivities<T extends { end: (policy: 'immediate') => Promise<void>; update: (props: PauseActivityProps, staleDate?: Date) => Promise<void> }>(
  activities: T[], trackedPurchaseId: string | null, items: PurchasePauseItem[], now = Date.now(),
) {
  const item = items.find(item => item.id === trackedPurchaseId && item.status === 'waiting' && item.reviewAt > now);
  for (const [index, activity] of activities.entries()) {
    if (!item || index > 0) await activity.end('immediate');
    else await activity.update(pauseActivityProps(item), new Date(item.reviewAt));
  }
}
