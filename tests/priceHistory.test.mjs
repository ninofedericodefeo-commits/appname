import assert from 'node:assert/strict';
import test from 'node:test';

import { graphCoordinates, parsePriceHistory } from '../src/features/stations/historyLogic.ts';

test('history rejects invalid prices and orders reports by timestamp', () => {
  const reports = parsePriceHistory({ reports: [
    { id: 2, price: 3.42, reported_at: '2026-10-01T12:00:00Z' },
    { id: 1, price: 3.51, reported_at: '2026-09-30T12:00:00Z' },
  ] });
  assert.deepEqual(reports.map((report) => report.price), [3.51, 3.42]);
  assert.throws(() => parsePriceHistory({ reports: [{ id: 3, price: -1, reported_at: '2026-10-01T12:00:00Z' }] }), /invalid data/);
});

test('chart positions reports within the requested time range', () => {
  const now = Date.parse('2026-10-01T12:00:00Z');
  const reports = [
    { id: 1, price: 3.5, reportedAt: '2026-09-24T12:00:00Z' },
    { id: 2, price: 3.4, reportedAt: '2026-09-30T12:00:00Z' },
  ];
  const points = graphCoordinates(reports, 7, now);
  assert.equal(points[0].x, 0);
  assert.ok(points[1].x > 250 && points[1].x < 300);
  assert.ok(points[0].y < points[1].y);
});
