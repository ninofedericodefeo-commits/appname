export type PriceReportPoint = {
  id: number;
  price: number;
  reportedAt: string;
};

export type HistoryRange = 7 | 30 | 90 | 'all';

export function parsePriceHistory(payload: unknown): PriceReportPoint[] {
  if (!payload || typeof payload !== 'object' || !('reports' in payload) || !Array.isArray(payload.reports)) {
    throw new Error('Price history returned invalid data.');
  }
  const reports: PriceReportPoint[] = [];
  for (const value of payload.reports) {
    if (!value || typeof value !== 'object' ||
      typeof value.id !== 'number' || !Number.isSafeInteger(value.id) ||
      typeof value.price !== 'number' || !Number.isFinite(value.price) || value.price <= 0 || value.price > 30 ||
      typeof value.reported_at !== 'string' || !Number.isFinite(Date.parse(value.reported_at))) {
      throw new Error('Price history returned invalid data.');
    }
    reports.push({ id: value.id, price: value.price, reportedAt: value.reported_at });
  }
  return reports.sort((a, b) => Date.parse(a.reportedAt) - Date.parse(b.reportedAt) || a.id - b.id);
}

export function graphCoordinates(reports: PriceReportPoint[], range: HistoryRange, now = Date.now(), width = 300, height = 170) {
  if (reports.length === 0) return [];
  const timestamps = reports.map((report) => Date.parse(report.reportedAt));
  const minTime = range === 'all' ? Math.min(...timestamps) : now - range * 24 * 60 * 60 * 1000;
  const maxTime = range === 'all' ? Math.max(...timestamps) : now;
  const prices = reports.map((report) => report.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const spread = Math.max(high - low, 0.1);
  const margin = spread * 0.15;
  const yMin = low - margin;
  const yMax = high + margin;
  return reports.map((report, index) => ({
    x: minTime === maxTime ? width / 2 :
      Math.max(0, Math.min(width, ((timestamps[index] - minTime) / (maxTime - minTime)) * width)),
    y: height - ((report.price - yMin) / (yMax - yMin)) * height,
  }));
}
