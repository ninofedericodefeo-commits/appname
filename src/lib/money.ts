// USD throughout the local pocket; store amounts as integer cents.
export function formatAmount(cents: number) {
  const [whole, fraction] = (Math.abs(cents) / 100).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${cents < 0 ? '-' : ''}${grouped}.${fraction}`;
}

export function formatMoney(cents: number) {
  const amount = formatAmount(cents);
  return cents < 0 ? `-$${amount.slice(1)}` : `$${amount}`;
}

export function formatCompactMoney(cents: number) {
  return formatMoney(cents).replace(/\.00$/, '');
}
