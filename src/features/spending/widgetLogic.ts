// End every legacy activity even if iOS refuses to end one of them.
export async function endRetiredActivities(activities: { end: (policy: 'immediate') => Promise<void> }[]) {
  const results = await Promise.allSettled(activities.map(async activity => await activity.end('immediate')));
  if (results.some(result => result.status === 'rejected')) throw Error('Could not dismiss all retired purchase activities.');
}
