import type { LoggedPurchase } from './logic';

export const PURCHASE_SHORTCUT_NAME = 'GasFinder Log Purchase';
export type ShortcutSetupStage = 'install' | 'automation' | 'verify';

// Apple documents opening a named shortcut. There is no documented URL that
// chooses a Wallet card or enables its Transaction trigger on the user's behalf.
export function automationSetupURL(unifiedAutomations: boolean) {
  return unifiedAutomations
    ? `shortcuts://open-shortcut?name=${encodeURIComponent(PURCHASE_SHORTCUT_NAME)}`
    : 'shortcuts://';
}

export function firstSetupPurchase(purchases: LoggedPurchase[], startedAt: string | null) {
  if (!startedAt) return undefined;
  const start = Date.parse(startedAt);
  if (!Number.isFinite(start)) return undefined;
  return purchases.find((purchase) => purchase.source === 'shortcut' &&
    Date.parse(purchase.purchasedAt) >= start);
}
