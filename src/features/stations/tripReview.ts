export function reviewRoutedLegs(legs: number[], initialRange: number, fullRange: number, reservePercent: number, refillTargetPercent = 100) {
  if (!legs.length || legs.some(miles => !Number.isFinite(miles) || miles < 0)) throw Error('The route service did not supply valid leg distances.');
  const reserve = fullRange * reservePercent / 100;
  const rows = legs.map((miles,index) => ({ miles, available: (index ? fullRange * refillTargetPercent / 100 : initialRange) - reserve, marginMiles: (index ? fullRange * refillTargetPercent / 100 : initialRange) - reserve - miles }));
  return { rows, complete: rows.every(row => row.marginMiles >= 0) };
}
export function detourEconomics(extraMiles: number, mpg: number, unitPrice: number, gallons: number, alternativePrice: number) {
  if (![extraMiles,mpg,unitPrice,gallons,alternativePrice].every(Number.isFinite) || extraMiles < 0 || mpg <= 0 || unitPrice <= 0 || gallons <= 0 || alternativePrice <= 0) return null;
  const detourCents = Math.round(extraMiles / (mpg * .85) * unitPrice * 100), priceSavingsCents = Math.round((alternativePrice - unitPrice) * gallons * 100);
  return { detourCents, priceSavingsCents, netCents: priceSavingsCents - detourCents };
}
