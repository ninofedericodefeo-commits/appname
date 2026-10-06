export function parseReceiptDetails({
  stationName,
  stationAddress,
  priceInput,
  gallonsInput,
  totalInput,
  purchasedOn,
  hasCoordinates,
}: {
  stationName: string;
  stationAddress: string;
  priceInput: string;
  gallonsInput: string;
  totalInput: string;
  purchasedOn: string;
  hasCoordinates: boolean;
}) {
  const price = Number(priceInput);
  const gallons = gallonsInput.trim() ? Number(gallonsInput) : undefined;
  const total = totalInput.trim() ? Number(totalInput) : undefined;
  if (!stationName.trim()) return { error: 'Enter the station name shown on the receipt.' };
  if (!hasCoordinates && !stationAddress.trim()) return { error: 'Add the station address, or use your location while at the station.' };
  if (!/^\d+(?:\.\d{1,3})?$/.test(priceInput.trim()) || price <= 0 || price > 30) {
    return { error: 'Enter a price per gallon from $0.001 to $30 with up to three decimal places.' };
  }
  if (gallons !== undefined && (!/^\d+(?:\.\d{1,3})?$/.test(gallonsInput.trim()) || gallons <= 0 || gallons > 100)) {
    return { error: 'Gallons must be between 0 and 100.' };
  }
  if (total !== undefined && (!/^\d+(?:\.\d{1,2})?$/.test(totalInput.trim()) || total <= 0 || total > 3000)) {
    return { error: 'Total must be between $0.01 and $3,000.' };
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(purchasedOn);
  const purchaseDate = match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
  if (!match || !purchaseDate || purchaseDate.getFullYear() !== Number(match[1]) ||
    purchaseDate.getMonth() !== Number(match[2]) - 1 || purchaseDate.getDate() !== Number(match[3]) ||
    purchaseDate.getTime() > Date.now()) {
    return { error: 'Choose a valid purchase date from the calendar.' };
  }
  if (gallons !== undefined && total !== undefined && Math.abs(price * gallons - total) > Math.max(0.1, total * 0.03)) {
    return { error: 'The price, gallons, and total differ. Check the receipt values.' };
  }
  return { value: { stationName: stationName.trim(), stationAddress: stationAddress.trim(), pricePerGallon: price, gallons, total, purchasedOn } };
}
