import type { FuelReport } from './logic.ts';
import { reportAccountTransaction } from './logic.ts';
import type { PocketTransaction } from '../pocket/transactions.ts';
export function distinctFuelPurchases(reports: FuelReport[], account: PocketTransaction[] = []) {
  const seen = new Set<string>();
  return [...reports].filter(report => !report.trashedAt && (report.gallons !== undefined || report.totalCents !== undefined)).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).filter(report => {
    const linked = reportAccountTransaction(report, account), key = linked ? `account:${linked.id}` : report.accountLink ? `${report.accountLink.kind}:${report.accountLink.id}` : `${report.storage}:${report.id}`;
    if (seen.has(key)) return false; seen.add(key); return true;
  });
}
export function fuelStatistics(reports: FuelReport[], account: PocketTransaction[] = [], carId?: string) {
  const distinct = distinctFuelPurchases(reports, account), fills = carId ? distinct.filter(report => report.carId === carId) : distinct;
  const gallons = fills.reduce((sum, fill) => sum + (fill.gallons ?? 0), 0), spentCents = fills.reduce((sum, fill) => sum + (fill.totalCents ?? 0), 0);
  const costsWithVolume = fills.filter(fill => fill.gallons !== undefined && fill.totalCents !== undefined);
  const pricedGallons = costsWithVolume.reduce((sum, fill) => sum + fill.gallons!, 0);
  const segments: { from: string; through: string; miles: number; gallons: number; mpg: number }[] = [];
  if (carId) {
    const ordered = [...fills].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
    let prior = -1;
    for (let index = 0; index < ordered.length; index++) {
      const fill = ordered[index];
      if (!fill.fullFill || fill.odometerMiles === undefined) continue;
      if (prior >= 0 && fill.completeFillInterval) {
        const start = ordered[prior], between = ordered.slice(prior + 1, index + 1), miles = fill.odometerMiles - start.odometerMiles!;
        const volume = between.reduce((sum, item) => sum + (item.gallons ?? 0), 0);
        if (miles > 0 && volume > 0 && between.every(item => item.gallons !== undefined && (item.odometerMiles === undefined || item.odometerMiles >= start.odometerMiles! && item.odometerMiles <= fill.odometerMiles!))) {
          const mpg = miles / volume; if (mpg >= 3 && mpg <= 150) segments.push({ from: start.observedAt, through: fill.observedAt, miles, gallons: volume, mpg });
        }
      }
      prior = index;
    }
  }
  const measuredMiles = segments.reduce((sum, segment) => sum + segment.miles, 0), measuredGallons = segments.reduce((sum, segment) => sum + segment.gallons, 0);
  return { fillCount: fills.length, spentCents, gallons, weightedUnitPrice: pricedGallons ? costsWithVolume.reduce((sum, fill) => sum + fill.totalCents!, 0) / 100 / pricedGallons : null,
    missingTotals: fills.filter(fill => fill.totalCents === undefined).length, missingGallons: fills.filter(fill => fill.gallons === undefined).length,
    unlinkedCount: fills.filter(fill => !fill.accountLink).length, duplicateLinkedReports: reports.filter(report => !report.trashedAt && (report.gallons !== undefined || report.totalCents !== undefined)).length - distinct.length,
    measuredMpg: measuredGallons ? measuredMiles / measuredGallons : null, measuredMiles, segments };
}
