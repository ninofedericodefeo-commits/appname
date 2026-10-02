import { validatedSampleApiUrl } from '@/features/stations/data';
import { parsePriceHistory, type HistoryRange } from '@/features/stations/historyLogic';
import type { FuelType } from '@/types/stations';

export { graphCoordinates } from '@/features/stations/historyLogic';
export type { HistoryRange, PriceReportPoint } from '@/features/stations/historyLogic';

export async function fetchPriceHistory(stationId: string, fuelType: FuelType, range: HistoryRange, signal: AbortSignal) {
  const params = new URLSearchParams({ fuel_type: fuelType });
  if (range !== 'all') params.set('days', String(range));
  const url = `${validatedSampleApiUrl()}/v1/stations/${encodeURIComponent(stationId)}/prices/history?${params}`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Could not load price history (${response.status}).`);
  return parsePriceHistory(await response.json());
}
