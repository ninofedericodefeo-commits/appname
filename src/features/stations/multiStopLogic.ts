import type { RouteStation } from './routeLogic.ts';
import { validateRefillPercent } from './preferences.ts';

export type StopWindow = { fromMiles: number; targetMiles: number; searchStartMiles: number; searchEndMiles: number; rangeMiles: number };
export type PlannedStop = { station: RouteStation; legMiles: number; window: StopWindow };
export type DriveStopPlan = { stops: PlannedStop[]; complete: boolean; needsFuel: boolean; gap: StopWindow | null; reason: string | null };

export function safeRange(range: number, fullRange = range, refillPercent = 10) {
  if (!Number.isFinite(range) || range < 0 || !Number.isFinite(fullRange) || fullRange <= 0) throw new Error('Fuel range must be above zero.');
  validateRefillPercent(refillPercent);
  return Math.max(0, range - fullRange * refillPercent / 100);
}

export function nextStopWindow(routeMiles: number, fromMiles: number, rangeMiles: number, fullRange = rangeMiles, refillPercent = 10): StopWindow {
  const available = safeRange(rangeMiles, fullRange, refillPercent);
  const targetMiles = Math.min(routeMiles, fromMiles + available);
  // At/below the chosen level, look nearby using remaining fuel with a small emergency reserve.
  const searchEndMiles = available > 0 ? targetMiles : Math.min(routeMiles, fromMiles + Math.min(10, rangeMiles * .8));
  return { fromMiles, targetMiles, searchStartMiles: Math.max(fromMiles, targetMiles - 60), searchEndMiles, rangeMiles };
}

export function chooseStop(stations: RouteStation[], window: StopWindow, fuelType: string, usedIds: string[]) {
  const candidates = stations.filter((station) => !usedIds.includes(station.id) &&
    (window.fromMiles === 0 ? station.milesAhead >= 0 : station.milesAhead > window.fromMiles + 0.1) &&
    station.milesAhead >= window.searchStartMiles && station.milesAhead + station.milesOffRoute * 2 <= window.searchEndMiles);
  if (window.targetMiles <= window.fromMiles) return [...candidates].sort((a, b) => a.milesAhead + a.milesOffRoute * 2 - b.milesAhead - b.milesOffRoute * 2)[0] ?? null;
  const near = candidates.filter((station) => station.milesAhead >= window.targetMiles - 25);
  return [...(near.length ? near : candidates)].sort((a, b) => {
    const price = (station: RouteStation) => station.prices.find((item) => item.fuelType === fuelType && item.source !== 'sample' && item.price > 0)?.price;
    const pa = price(a), pb = price(b);
    if (pa === undefined && pb !== undefined) return 1;
    if (pb === undefined && pa !== undefined) return -1;
    return (pa ?? 0) * 100 + Math.abs(window.targetMiles - a.milesAhead) + a.milesOffRoute * 10 -
      ((pb ?? 0) * 100 + Math.abs(window.targetMiles - b.milesAhead) + b.milesOffRoute * 10);
  })[0] ?? null;
}

// Query each next stop from the station actually chosen, rather than from an idealized refill point.
export async function planDriveStops({ routeMiles, initialRange, fullRange, fuelType, lookup, onProgress, forceSearch = false, refillPercent = 10 }: {
  routeMiles: number; initialRange: number; fullRange: number; fuelType: string;
  lookup: (window: StopWindow) => Promise<RouteStation[]>;
  onProgress?: (stops: PlannedStop[]) => void;
  forceSearch?: boolean;
  refillPercent?: number;
}): Promise<DriveStopPlan> {
  if (!Number.isFinite(routeMiles) || routeMiles < 0) throw new Error('Invalid route length.');
  safeRange(fullRange, fullRange, refillPercent);
  const needsFuel = routeMiles > safeRange(initialRange, fullRange, refillPercent);
  const stops: PlannedStop[] = [];
  let fromMiles = 0, range = initialRange;
  for (let index = 0; fromMiles + safeRange(range, fullRange, refillPercent) < routeMiles || (forceSearch && index === 0); index++) {
    const window = nextStopWindow(routeMiles, fromMiles, range, fullRange, refillPercent);
    if (!needsFuel && index === 0) {
      window.searchStartMiles = 0;
      window.searchEndMiles = Math.min(routeMiles, safeRange(range, fullRange, refillPercent), 120);
      window.targetMiles = window.searchEndMiles / 2;
    }
    if (index >= 24) return { stops, needsFuel, complete: false, gap: window, reason: 'This trip needs more than 24 fuel stops. Plan the remaining legs separately.' };
    const usedIds = stops.map((stop) => stop.station.id);
    let station = chooseStop(await lookup(window), window, fuelType, usedIds);
    // If the ideal refill area has no station, work backward through reachable sections.
    while (!station && window.searchStartMiles > fromMiles) {
      const earlierEnd = window.searchStartMiles;
      window.searchStartMiles = Math.max(fromMiles, earlierEnd - 60);
      station = chooseStop(await lookup({ ...window, searchEndMiles: earlierEnd }), window, fuelType, usedIds);
    }
    if (!station) return { stops, needsFuel, complete: false, gap: window, reason: `No reachable stop found before mile ${Math.floor(window.searchEndMiles)}. The remaining trip is not covered.` };
    stops.push({ station, legMiles: station.milesAhead - fromMiles + 2 * station.milesOffRoute, window });
    onProgress?.([...stops]);
    fromMiles = station.milesAhead;
    // Returning from an off-route station consumes some of the full refill.
    range = fullRange - station.milesOffRoute;
    if (!needsFuel) break;
  }
  return { stops, needsFuel, complete: true, gap: null, reason: null };
}
