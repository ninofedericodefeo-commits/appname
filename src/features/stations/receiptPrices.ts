import type { ReceiptReport } from '@/types/receipts';
import type { GasStation, GasPrice } from '@/types/stations';

export function withReceiptPrices(stations: GasStation[], reports: ReceiptReport[]): GasStation[] {
  const byStation = new Map<string, Map<GasPrice['fuelType'], ReceiptReport>>();
  for (const report of reports) {
    if (!report.stationId) continue;
    let fuelReports = byStation.get(report.stationId);
    if (!fuelReports) {
      fuelReports = new Map();
      byStation.set(report.stationId, fuelReports);
    }
    const previous = fuelReports.get(report.fuelType);
    if (!previous || report.purchasedOn > previous.purchasedOn ||
      (report.purchasedOn === previous.purchasedOn && report.savedAt > previous.savedAt)) {
      fuelReports.set(report.fuelType, report);
    }
  }
  return stations.map((station) => {
    const reportsForStation = byStation.get(station.id);
    if (!reportsForStation) return station;
    const receiptPrices = [...reportsForStation.values()].map((report): GasPrice => ({
      fuelType: report.fuelType,
      price: report.pricePerGallon,
      currency: 'USD',
      reportedAt: `${report.purchasedOn}T12:00:00`,
      source: 'my receipt',
    }));
    return { ...station, prices: [...receiptPrices, ...station.prices.filter((price) => !reportsForStation.has(price.fuelType))] };
  });
}
