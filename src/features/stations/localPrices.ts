import type { LocalPriceReport } from '@/types/priceReports';
import type { ReceiptReport } from '@/types/receipts';
import type { GasPrice, GasStation } from '@/types/stations';
import type { HistoryRange, PriceReportPoint } from '@/features/stations/historyLogic';

export function stationsFromSavedLocations(receipts: ReceiptReport[], reports: LocalPriceReport[]): GasStation[] {
  const stations = new Map<string, GasStation>();
  for (const report of reports) {
    const id = report.stationId ?? `saved-price-${report.id}`;
    if (stations.has(id)) continue;
    stations.set(id, {
      id, name: report.stationName, latitude: report.latitude, longitude: report.longitude,
      address: report.stationAddress || 'Address not listed', city: '', state: '',
      prices: [{ fuelType: report.fuelType, price: report.price, currency: 'USD', reportedAt: report.reportedAt, source: 'my price report' }],
      attributions: [{ provider: 'Saved on this device' }],
    });
  }
  for (const receipt of receipts) {
    if (!receipt.coordinates) continue;
    const id = receipt.stationId ?? `saved-receipt-${receipt.id}`;
    if (stations.has(id)) continue;
    stations.set(id, {
      id, name: receipt.stationName, latitude: receipt.coordinates.latitude, longitude: receipt.coordinates.longitude,
      address: receipt.stationAddress || 'Address not listed', city: '', state: '',
      prices: [{ fuelType: receipt.fuelType, price: receipt.pricePerGallon, currency: 'USD', reportedAt: `${receipt.purchasedOn}T12:00:00`, source: 'my receipt' }],
      attributions: [{ provider: 'Saved on this device' }],
    });
  }
  return [...stations.values()];
}

export function withLocalPrices(stations: GasStation[], receipts: ReceiptReport[], reports: LocalPriceReport[]): GasStation[] {
  const latest = new Map<string, Map<GasPrice['fuelType'], GasPrice>>();
  function add(stationId: string | undefined, price: GasPrice) {
    if (!stationId) return;
    let byFuel = latest.get(stationId);
    if (!byFuel) {
      byFuel = new Map();
      latest.set(stationId, byFuel);
    }
    const previous = byFuel.get(price.fuelType);
    if (!previous || Date.parse(price.reportedAt) >= Date.parse(previous.reportedAt)) byFuel.set(price.fuelType, price);
  }
  for (const receipt of receipts) add(receipt.stationId, {
    fuelType: receipt.fuelType,
    price: receipt.pricePerGallon,
    currency: 'USD',
    reportedAt: `${receipt.purchasedOn}T12:00:00`,
    source: 'my receipt',
  });
  for (const report of reports) add(report.stationId, {
    fuelType: report.fuelType,
    price: report.price,
    currency: 'USD',
    reportedAt: report.reportedAt,
    source: 'my price report',
  });
  return stations.map((station) => {
    const local = latest.get(station.id);
    if (!local) return station;
    return { ...station, prices: [...local.values(), ...station.prices.filter((price) => !local.has(price.fuelType))] };
  });
}

export function localPriceHistory(
  stationId: string,
  fuelType: GasPrice['fuelType'],
  range: HistoryRange,
  receipts: ReceiptReport[],
  reports: LocalPriceReport[],
  now = Date.now(),
): PriceReportPoint[] {
  const cutoff = range === 'all' ? Number.NEGATIVE_INFINITY : now - range * 24 * 60 * 60 * 1000;
  const points = [
    ...receipts.filter((receipt) => receipt.stationId === stationId && receipt.fuelType === fuelType).map((receipt) => ({
      price: receipt.pricePerGallon,
      reportedAt: `${receipt.purchasedOn}T12:00:00`,
    })),
    ...reports.filter((report) => report.stationId === stationId && report.fuelType === fuelType).map((report) => ({
      price: report.price,
      reportedAt: report.reportedAt,
    })),
  ];
  return points.filter((point) => {
    const timestamp = Date.parse(point.reportedAt);
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now;
  }).sort((a, b) => Date.parse(a.reportedAt) - Date.parse(b.reportedAt))
    .map((point, index) => ({ ...point, id: index + 1 }));
}
