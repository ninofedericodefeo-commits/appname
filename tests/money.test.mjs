import assert from 'node:assert/strict';
import test from 'node:test';
import { formatAmount, formatMoney } from '../src/lib/money.ts';
import { parseDollars } from '../src/features/pocket/logic.ts';

test('displayed amounts round trip without changing cents', () => {
  for (const cents of [0, 1, 99999, 100000, 12345678, 100000000]) {
    assert.equal(parseDollars(formatAmount(cents)), cents);
  }
  assert.equal(formatMoney(12345678), '$123,456.78');
  assert.equal(formatMoney(-123456), '-$1,234.56');
});

test('money inputs accept thousands separators but reject ambiguous grouping', () => {
  assert.equal(parseDollars(' 1,234.56 '), 123456);
  assert.equal(parseDollars('1,000,000'), 100000000);
  for (const input of ['1,00', '1,23.45', '1.234,56', '1,,000', ',100', '100,', '1,000,000.01', '1e3', '-1', '$1,000']) {
    assert.equal(parseDollars(input), null, input);
  }
});
