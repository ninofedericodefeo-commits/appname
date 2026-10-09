export function parseDollars(input: string): number | null {
  const value = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value.replace(/,/g, '')) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 && cents <= 100_000_000 ? cents : null;
}

export function availableCents(balanceCents: number | null, reservedCents: number) {
  return balanceCents === null ? null : balanceCents - reservedCents;
}

export function canReserve(amountCents: number, balanceCents: number | null, reservedCents: number) {
  return amountCents > 0 && Number.isSafeInteger(amountCents) &&
    (balanceCents === null || amountCents <= balanceCents - reservedCents);
}
