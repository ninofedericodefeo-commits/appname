import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sampleTransactions, withSampleTransactions, withSampleSubscriptions, sampleAccount, sampleGoal, SAMPLE_OPENING_BALANCE_CENTS, SAMPLE_CLOSING_BALANCE_CENTS } from '../src/features/samples/fixtures.ts';
import { extractPDFText } from '../src/features/bank/extractPDFText.ts';
import { parseCitizensStatement } from '../src/features/bank/citizensStatement.ts';
import { guessMapping, previewAccountTransactions } from '../src/features/bank/importLogic.ts';

test('hide and repeat show preserve real records without changing or duplicating them', () => {
  const record = { id: 'real-purchase', title: 'Real record', amountCents: -1800, occurredAt: '2026-10-18T12:00:00Z', source: 'manual', status: 'logged', accountLabel: 'My real account' };
  const real = [record];
  const shown = withSampleTransactions(real, true);
  assert.equal(shown.length, 10);
  assert.equal(new Set(shown.map(row => row.id)).size, 10);
  assert.deepEqual(withSampleTransactions(shown, true), shown);
  const hidden = withSampleTransactions(shown, false);
  assert.deepEqual(hidden, real);
  assert.equal(hidden[0], record);
  assert.deepEqual(real, [record]);
  assert.ok(shown.filter(row => row.isSample).every(row => row.id.startsWith('sample-') && row.accountLabel === 'Sample Citizens account'));
});

test('sample balance reconciles and goal remains separate from the real ledger', () => {
  assert.equal(SAMPLE_OPENING_BALANCE_CENTS + sampleTransactions().reduce((sum, row) => sum + row.amountCents, 0), SAMPLE_CLOSING_BALANCE_CENTS);
  assert.equal(sampleAccount().balanceCents, SAMPLE_CLOSING_BALANCE_CENTS);
  assert.equal(sampleAccount().isSample, true);
  assert.equal(sampleGoal().isSample, true);
  assert.equal(sampleGoal().savedCents, 18500);
});

test('subscriptions reuse existing samples with no duplicate service and preserve real entries', () => {
  const real = { id: 'real-music', name: 'Real service', amountCents: 1299, cadence: 'monthly', day: 5, active: true };
  const now = new Date('2026-10-18T12:00:00Z');
  const shown = withSampleSubscriptions([real], true, now);
  assert.equal(shown.length, 4);
  assert.deepEqual(withSampleSubscriptions(shown, true, now), shown);
  assert.deepEqual(withSampleSubscriptions(shown, false, now), [real]);
  assert.equal(shown[0], real);
});

test('bundled Citizens PDF is visibly synthetic, locally parseable and matches the demo ledger', async () => {
  const fixture = JSON.parse(await readFile(new URL('../assets/samples/sample-citizens-statement.json', import.meta.url), 'utf8'));
  assert.match(fixture.name, /SAMPLE-NOT-REAL/);
  const bytes = await readFile(new URL('../assets/samples/sample-citizens-statement.pdf', import.meta.url));
  assert.equal(bytes.toString('base64'), fixture.base64);
  const pages = await extractPDFText(fixture.base64);
  const text = pages.flatMap(page => page.items.map(item => item.text)).join(' ');
  assert.match(text, /SAMPLE - NOT REAL/);
  assert.match(text, /Not issued by Citizens/);
  const parsed = parseCitizensStatement(pages, new Date('2026-10-18T12:00:00Z'));
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.balance.amountCents, SAMPLE_CLOSING_BALANCE_CENTS);
  assert.equal(parsed.balance.asOf, '2026-09-30');
  const preview = previewAccountTransactions(parsed.csv, guessMapping(parsed.csv), 'Sample Citizens account', new Date('2026-10-18T12:00:00Z'));
  assert.equal(preview.rows.length, 9);
  assert.deepEqual(preview.rows.map(row => row.amountCents).sort((a,b) => a-b), sampleTransactions().map(row => row.amountCents).sort((a,b) => a-b));
});
