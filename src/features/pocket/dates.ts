// Imported bank dates are calendar dates, not instants. Older noon timestamps
// retain their stored UTC date as a compatibility fallback; originals stay intact.
export function transactionDay(row: { source: string; occurredAt: string; sourceDate?: string }) {
  if (row.sourceDate) return row.sourceDate;
  if (row.source === 'csv' || row.source === 'citizens-pdf') return row.occurredAt.slice(0, 10);
  const date = new Date(row.occurredAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
