export function isFinancialRoute(pathname: string) {
  return ['/pocket', '/investment', '/subscriptions', '/insights', '/account-transactions', '/account-review', '/bank-import', '/bank-batch', '/backup', '/import-purchase', '/settings/savings', '/settings/widgets'].includes(pathname);
}
