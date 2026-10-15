export type ReminderStatus = { permission: 'granted' | 'quiet' | 'denied' | 'undetermined' | 'unavailable'; scheduledCount: number; expectedCount: number };

export function describeReminderStatus(enabled: boolean, status: ReminderStatus) {
  if (status.permission === 'unavailable') return { label: 'Phone reminders are available in the phone app.', needsRefresh: false };
  if (!enabled) return { label: status.scheduledCount ? 'Reminders are off, but some scheduled entries still need clearing.' : 'Phone reminders are off.', needsRefresh: status.scheduledCount > 0 };
  if (status.permission === 'denied') return { label: 'Blocked by your phone’s notification settings. Your reminder preference is saved.', needsRefresh: false };
  if (status.permission === 'undetermined') return { label: 'Phone permission has not been granted. Reminders cannot be delivered yet.', needsRefresh: false };
  if (status.scheduledCount !== status.expectedCount) return { label: 'Your reminder schedule needs a refresh.', needsRefresh: true };
  return { label: `${status.permission === 'quiet' ? 'Allowed quietly. ' : ''}${status.scheduledCount ? `${status.scheduledCount} subscription reminder${status.scheduledCount === 1 ? '' : 's'} scheduled.` : 'No upcoming subscription reminders to schedule.'}`, needsRefresh: false };
}
