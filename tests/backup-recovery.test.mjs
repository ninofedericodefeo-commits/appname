import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, pbkdf2Sync, createDecipheriv } from 'node:crypto';
import { encryptBackup, decryptBackup, BACKUP_ITERATIONS, digestBytes, validateBackup } from '../src/features/data/backupFormat.ts';
import { encodeBase64, decodeBase64 } from '../src/features/data/encoding.ts';
import { validateStoreState } from '../src/features/data/validation.ts';
import { recoverableCommit, canonicalJson } from '../src/features/data/recovery.ts';
const password = 'Synthetic backup password 2026';
const payload = () => ({ format: 'gasfinder-data', version: 1, createdAt: '2026-10-14T12:00:00Z', appVersion: '1.0', includesFiles: true,
  stores: { ledger: { version: 9, state: { reservedCents: 123, ids: ['original-id', 'same-charge-second-id'], hidden: ['retained-id'] } } },
  archives: [], attachments: [{ kind: 'bank', id: 'import-test', name: 'synthetic.csv', base64: encodeBase64(new TextEncoder().encode('Café,4.99')), sha256: digestBytes(new TextEncoder().encode('Café,4.99')) }] });
let encrypted;
test('Encrypted backup interoperates with Node AES-GCM and preserves identity/evidence', async () => {
  const data = payload(); encrypted = await encryptBackup(data, password, async count => randomBytes(count));
  assert.ok(!encrypted.includes('original-id'));
  const envelope = JSON.parse(encrypted), key = pbkdf2Sync(password, Buffer.from(envelope.salt, 'base64'), BACKUP_ITERATIONS, 32, 'sha256');
  const packed = Buffer.from(envelope.ciphertext, 'base64'), decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'));
  decipher.setAAD(Buffer.from('gasfinder-encrypted:1:PBKDF2-SHA256:600000:AES-256-GCM')); decipher.setAuthTag(packed.subarray(-16));
  const clear = Buffer.concat([decipher.update(packed.subarray(0, -16)), decipher.final()]);
  assert.deepEqual(JSON.parse(clear), data);
  assert.deepEqual(await decryptBackup(encrypted, password), data);
});
test('Wrong password, modified ciphertext and unsupported work factors cannot restore', async () => {
  encrypted ??= await encryptBackup(payload(), password, async count => randomBytes(count));
  await assert.rejects(decryptBackup(encrypted, 'wrong password'), /Wrong password/);
  const envelope = JSON.parse(encrypted), bytes = decodeBase64(envelope.ciphertext); bytes[0] ^= 1;
  await assert.rejects(decryptBackup(JSON.stringify({ ...envelope, ciphertext: encodeBase64(bytes) }), password), /damaged backup/);
  await assert.rejects(decryptBackup(JSON.stringify({ ...envelope, iterations: 1e12 }), password), /Unsupported/);
});
test('Attachment corruption, invalid money, excessive depth and unsafe object keys reject', () => {
  const data = payload(); data.attachments[0].base64 = encodeBase64(new Uint8Array([1]));
  assert.throws(() => validateBackup(data), /checksum/);
  assert.throws(() => validateBackup({ ...payload(), stores: { ledger: { version: 1, state: { amountCents: .5 } } } }), /money/);
  assert.throws(() => validateBackup(JSON.parse('{"__proto__":{}}')), /unsafe/);
  let deep = {}; for (let i = 0; i < 40; i++) deep = { nested: deep };
  assert.throws(() => validateBackup(deep), /nested/);
});
test('Base64 round trips empty, binary and large attachments and rejects noncanonical data', () => {
  for (const length of [0, 1, 2, 3, 16384, 400000]) { const bytes = randomBytes(length); assert.deepEqual(decodeBase64(encodeBase64(bytes)), new Uint8Array(bytes)); }
  for (const invalid of ['a', 'ab==', 'a===', '====', 'AA=A', 'A A=', '\nAAAA', 'AAA=AAAA']) assert.throws(() => decodeBase64(invalid));
  assert.throws(() => decodeBase64('AAAA', 2));
});
test('Financial backup validation rejects missing arrays, invalid rows and duplicate IDs', () => {
  const defaults = { reservedCents: 0, reportedBalanceCents: null, activeGoal: null, entries: [], purchases: [], accountTransactions: [], archivedGoals: [] };
  validateStoreState('gasfinder-savings-pocket', defaults, defaults);
  assert.throws(() => validateStoreState('gasfinder-savings-pocket', { ...defaults, purchases: undefined }, defaults));
  assert.throws(() => validateStoreState('gasfinder-savings-pocket', { ...defaults, accountTransactions: [{ id: 'x' }, { id: 'x' }] }, defaults), /duplicate/);
  const good = { id: 'bank-1', title: 'Paycheck', amountCents: 50000, occurredAt: '2026-10-01T12:00:00Z', status: 'posted' };
  validateStoreState('gasfinder-savings-pocket', { ...defaults, accountTransactions: [good] }, defaults);
});
test('Restore journals precede mutations and every failure rolls back; failed rollback keeps recovery required', async () => {
  for (const failedStep of ['journal', 'apply', 'verify', 'commit', null]) {
    const events = [], before = { balance: 121252, bankImportKeys: ['keep'], purchases: ['same-item-1', 'same-item-2'] }; let live = structuredClone(before);
    const action = recoverableCommit(before, {
      saveJournal: async (_, committed) => { const step = committed ? 'commit' : 'journal'; events.push(step); if (failedStep === step) throw Error(step); },
      apply: async () => { events.push('apply'); live = { balance: 5 }; if (failedStep === 'apply') throw Error('apply'); },
      verify: async () => { events.push('verify'); if (failedStep === 'verify') throw Error('verify'); },
      rollback: async copy => { events.push('rollback'); live = structuredClone(copy); },
    });
    if (failedStep) { await assert.rejects(action); assert.deepEqual(live, before); } else { await action; assert.deepEqual(live, { balance: 5 }); }
    assert.equal(events[0], 'journal');
    if (failedStep && failedStep !== 'journal') assert.equal(events.at(-1), 'rollback');
  }
  await assert.rejects(recoverableCommit({}, { saveJournal: async () => {}, apply: async () => { throw Error('disk full'); }, verify: async () => {}, rollback: async () => { throw Error('disk still full'); } }), /Recovery is unfinished/);
  assert.equal(canonicalJson({ b: 2, a: [1, 2] }), canonicalJson({ a: [1, 2], b: 2 }));
  assert.notEqual(canonicalJson([1, 2]), canonicalJson([2, 1]));
});
