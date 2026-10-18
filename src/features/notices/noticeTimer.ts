/** Cancelable scheduling also ignores accessibility responses from an older notice. */
export function scheduleNoticeDismissal(
  dismiss: () => void,
  duration: number,
  recommendation: Promise<number> = Promise.resolve(duration),
  clock = {
    setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    clearTimeout: (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
  },
) {
  let canceled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  void recommendation.catch(() => duration).then(recommended => {
    if (canceled) return;
    const delay = Number.isFinite(recommended) ? Math.max(duration, recommended) : duration;
    timer = clock.setTimeout(() => { if (!canceled) dismiss(); }, delay);
  });
  return () => { canceled = true; if (timer !== undefined) clock.clearTimeout(timer); };
}
