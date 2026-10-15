import type { LocalPriceReport } from '../../types/priceReports.ts';
import type { ReceiptReport } from '../../types/receipts.ts';
import type { FuelPurchaseDetails, PriceQualifier } from '../../types/fuelReports.ts';
import type { PocketTransaction } from '../pocket/transactions.ts';
import { dateFromKey, localDateKey } from '../subscriptions/logic.ts';
import { parseDollars } from '../pocket/logic.ts';
export const priceQualifiers: { id: PriceQualifier; label: string }[] = [{ id: 'standard', label: 'Standard' }, { id: 'cash', label: 'Cash' }, { id: 'card', label: 'Card' }, { id: 'member', label: 'Member' }];
export type FuelReport = FuelPurchaseDetails & { id: string; storage: 'receipt' | 'price'; stationId?: string; stationName: string; stationAddress: string; price: number; fuelType: ReceiptReport['fuelType']; observedAt: string; photoUri: string; coordinates?: { latitude: number; longitude: number }; savedAt: string };
export function fuelReports(receipts: ReceiptReport[], prices: LocalPriceReport[], includeTrash = false): FuelReport[] {
  return [...receipts.map(report => ({ ...report, storage: 'receipt' as const, price: report.pricePerGallon, observedAt: report.observedAt ?? `${report.purchasedOn}T12:00:00`, totalCents: report.totalCents ?? (report.total !== undefined ? Math.round(report.total * 100) : undefined) })),
    ...prices.map(report => ({ ...report, storage: 'price' as const, observedAt: report.observedAt ?? report.reportedAt, photoUri: report.photoUri ?? '', coordinates: { latitude: report.latitude, longitude: report.longitude }, savedAt: report.reportedAt }))]
    .filter(report => includeTrash || !report.trashedAt).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
}
export function parseFuelDetails(input: { stationName: string; stationAddress: string; latitude: string; longitude: string; price: string; gallons: string; total: string; observedOn: string; observedTime: string; qualifier: PriceQualifier; odometer: string; fullFill: boolean; completeFillInterval: boolean; acknowledgeAdjustment: boolean }, now = new Date()) {
  if (!input.stationName.trim() || input.stationName.length > 120) throw new Error('Enter or choose the station name.');
  const hasCoordinates = !!input.latitude.trim() || !!input.longitude.trim(), latitude = Number(input.latitude), longitude = Number(input.longitude);
  if (hasCoordinates && (!input.latitude.trim() || !input.longitude.trim() || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180)) throw new Error('Choose a station or enter valid coordinates.');
  if (!hasCoordinates && !input.stationAddress.trim()) throw new Error('Choose a mapped station or enter its address.');
  const price = Number(input.price), gallons = input.gallons.trim() ? Number(input.gallons) : undefined;
  if (!/^\d+(?:\.\d{1,3})?$/.test(input.price.trim()) || price <= 0 || price > 30) throw new Error('Enter a unit price above $0 and at most $30, with up to three decimals.');
  if (gallons !== undefined && (!/^\d+(?:\.\d{1,3})?$/.test(input.gallons.trim()) || gallons <= 0 || gallons > 100)) throw new Error('Enter gallons above 0 and at most 100.');
  const totalCents = input.total.trim() ? parseDollars(input.total.trim()) : undefined;
  if (totalCents === null || totalCents !== undefined && (totalCents <= 0 || totalCents > 300_000)) throw new Error('Enter a refill total from $0.01 to $3,000.');
  const date = dateFromKey(input.observedOn), time = /^(\d{2}):(\d{2})$/.exec(input.observedTime);
  if (!date || !time || Number(time[1]) > 23 || Number(time[2]) > 59) throw new Error('Choose a valid observation date and 24-hour time.');
  date.setHours(Number(time[1]), Number(time[2]), 0, 0);
  if (date.getHours() !== Number(time[1]) || date.getMinutes() !== Number(time[2])) throw new Error('This local time does not exist on that date. Check the observation time.');
  if (date.getTime() > now.getTime() + 5 * 60_000) throw new Error('Observation time cannot be in the future.');
  const expectedCents = gallons === undefined ? undefined : Math.round(Math.round(price * 1000) * Math.round(gallons * 1000) / 10000);
  const adjustmentCents = totalCents !== undefined && expectedCents !== undefined ? totalCents - expectedCents : undefined;
  if (adjustmentCents !== undefined && Math.abs(adjustmentCents) > 10 && !input.acknowledgeAdjustment) throw new Error('The total differs from gallons × price. Check the values, then confirm any fees or discounts.');
  const odometerMiles = input.odometer.trim() ? Number(input.odometer) : undefined;
  if (odometerMiles !== undefined && (!/^\d+(?:\.\d)?$/.test(input.odometer.trim()) || odometerMiles < 0 || odometerMiles > 2_000_000)) throw new Error('Enter a valid odometer in miles, with at most one decimal.');
  if (input.fullFill && gallons === undefined) throw new Error('Add gallons before marking a full fill.');
  if (input.completeFillInterval && (!input.fullFill || odometerMiles === undefined)) throw new Error('A complete fill interval needs a full fill and odometer reading.');
  if (!priceQualifiers.some(item => item.id === input.qualifier)) throw new Error('Choose a price type.');
  return { stationName: input.stationName.trim(), stationAddress: input.stationAddress.trim().slice(0, 180), pricePerGallon: price, purchasedOn: localDateKey(date), observedAt: date.toISOString(), priceQualifier: input.qualifier,
    gallons, totalCents, total: totalCents === undefined ? undefined : totalCents / 100, adjustmentCents, odometerMiles, fullFill: input.fullFill, completeFillInterval: input.completeFillInterval,
    coordinates: hasCoordinates ? { latitude, longitude } : undefined };
}
export function receiptAccountCandidates(rows: PocketTransaction[], totalCents: number | undefined, observedAt: string) {
  if (!totalCents) return [];
  const parsed = new Date(observedAt); if (!Number.isFinite(parsed.getTime())) return [];
  const date = dateFromKey(localDateKey(parsed))!.getTime();
  return rows.filter(row => row.source !== 'savings' && row.status !== 'pending' && row.amountCents < 0 && Math.abs(-row.amountCents - totalCents) <= 200 && Math.abs(new Date(row.occurredAt).getTime() - date) <= 7 * 86400000).slice(0, 15);
}
export function reportAccountTransaction(report: Pick<FuelReport, 'accountLink'>, rows: PocketTransaction[]) {
  return report.accountLink ? rows.find(row => row.id === report.accountLink!.id || report.accountLink!.kind === 'purchase' && (row.linkedPurchaseId === report.accountLink!.id || row.purchase?.id === report.accountLink!.id)) : undefined;
}
