export function isFinancialRoute(pathname: string) {
  return ['/pocket', '/investment', '/subscriptions', '/insights', '/account-transactions', '/account-review', '/bank-import', '/bank-batch', '/backup', '/import-purchase', '/purchase-inbox', '/settings/savings', '/settings/widgets'].includes(pathname);
}
