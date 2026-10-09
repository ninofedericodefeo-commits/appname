import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { progressPercent } from '@/features/goals/logic';
import type { Goal, GoalSettings } from '@/features/goals/logic';
import { formatMoney } from '@/lib/money';

let latestUpdate = 0;

export const goalWidgetAvailable = Platform.OS === 'ios' && Constants.expoConfig?.extra?.goalWidgetAvailable === true;

export async function syncGoalWidget(goal: Goal | null, settings: GoalSettings) {
  if (!goalWidgetAvailable) return;
  const update = ++latestUpdate;
  const { default: GoalProgressWidget } = await import('@/widgets/GoalProgressWidget');
  if (update !== latestUpdate) return;
  const enabled = settings.widgetEnabled && goal !== null;
  GoalProgressWidget.updateSnapshot({
    enabled,
    title: enabled && settings.widgetShowAmounts ? goal.title : 'Savings goal',
    percent: enabled ? progressPercent(goal) : 0,
    savedCents: enabled ? goal.savedCents : 0,
    targetCents: enabled ? goal.targetCents : 0,
    amountSummary: enabled && settings.widgetShowAmounts ? `${formatMoney(goal.savedCents)} of ${formatMoney(goal.targetCents)}` : '',
    showAmounts: enabled && settings.widgetShowAmounts,
  });
}
