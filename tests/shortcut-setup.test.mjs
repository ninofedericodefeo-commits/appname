import assert from 'node:assert/strict';
import test from 'node:test';

import { automationSetupURL, firstSetupPurchase } from '../src/features/goals/shortcutSetup.ts';

test('Automation setup opens the named shortcut on unified iOS and the app on earlier iOS', () => {
  const modern = new URL(automationSetupURL(true));
  assert.equal(modern.protocol, 'shortcuts:');
  assert.equal(modern.hostname, 'open-shortcut');
  assert.equal(modern.searchParams.get('name'), 'GasFinder Log Purchase');
  assert.equal(automationSetupURL(false), 'shortcuts://');
});

test('Setup verification ignores earlier shortcut imports and manual purchases', () => {
  const start = '2026-10-09T14:00:00Z';
  const old = { source: 'shortcut', purchasedAt: '2026-10-09T13:59:59Z' };
  const manual = { source: 'manual', purchasedAt: '2026-10-09T14:01:00Z' };
  const missingSource = { purchasedAt: '2026-10-09T14:01:00Z' };
  const invalid = { source: 'shortcut', purchasedAt: 'invalid' };
  const recent = { source: 'shortcut', purchasedAt: '2026-10-09T14:02:00Z' };
  assert.equal(firstSetupPurchase([old, manual, missingSource, invalid], start), undefined);
  assert.equal(firstSetupPurchase([old, recent, manual], start), recent);
  assert.equal(firstSetupPurchase([recent], null), undefined);
  assert.equal(firstSetupPurchase([recent], 'invalid'), undefined);
});
