import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveFilename, importFingerprint, parseSavedImport, saveImportToArchive } from '../src/features/bank/archiveLogic.ts';

const details = { accountLabel: 'Checking', transactionCount: 21, purchaseCount: 9, balanceCents: 121252, balanceAsOf: '2026-09-30' };
const now = new Date('2026-10-10T12:00:00Z');
function memoryArchive() {
  const entries = new Map(), files = new Map();
  return { entries, files, storage: {
    list: async () => [...entries.values()], read: async (entry) => files.get(entry.id),
    write: async (entry, file) => { entries.set(entry.id, entry); files.set(entry.id, file); }, share: async () => {},
  } };
}
test('Reimporting identical file contents keeps one original and refreshes its review metadata', async () => {
  const archive = memoryArchive();
  const file = { name: 'September.pdf', kind: 'pdf', base64: 'JVBERi0xLjcK' };
  const saved = await saveImportToArchive(archive.storage, file, details, now);
  const repeated = await saveImportToArchive(archive.storage, { ...file, name: 'September (1).pdf' }, { ...details, transactionCount: 22 }, new Date(now.getTime() + 1000));
  assert.equal(repeated.id, saved.id); assert.equal(repeated.importedAt, now.toISOString());
  assert.equal(repeated.name, 'September.pdf'); assert.equal(repeated.transactionCount, 22);
  assert.equal(archive.entries.size, 1); assert.equal(archive.files.size, 1);
  assert.equal(archive.files.get(saved.id).base64, file.base64);
});
test('Different contents with the same filename remain separate files', async () => {
  const archive = memoryArchive();
  const file = { name: 'statement.pdf', kind: 'pdf', base64: 'first' };
  const first = await saveImportToArchive(archive.storage, file, details, now);
  const second = await saveImportToArchive(archive.storage, { ...file, base64: 'second' }, details, now);
  assert.notEqual(first.id, second.id); assert.equal(archive.entries.size, 2);
});
test('Fingerprint collisions are checked against exact content before reusing a file', async () => {
  const archive = memoryArchive();
  const file = { name: 'statement.pdf', kind: 'pdf', base64: 'first' };
  const first = await saveImportToArchive(archive.storage, file, details, now);
  const incoming = { ...file, base64: 'second' };
  archive.entries.set(first.id, { ...first, fingerprint: importFingerprint(incoming) });
  const second = await saveImportToArchive(archive.storage, incoming, details, now);
  assert.notEqual(first.id, second.id); assert.equal(archive.files.get(first.id).base64, 'first');
});
test('CSV archive preserves original bytes while matching repeated decoded contents', async () => {
  const archive = memoryArchive();
  const file = { name: 'purchases.csv', kind: 'csv', text: 'Date,Description,Amount\n09/01/2026,Café,-4.00', base64: 'b3JpZ2luYWw=' };
  const entry = await saveImportToArchive(archive.storage, file, details, now);
  assert.equal(archive.files.get(entry.id).base64, file.base64);
  assert.equal((await saveImportToArchive(archive.storage, file, details, now)).id, entry.id);
});
test('Archive write failure propagates so the caller can keep its draft before applying the bank import', async () => {
  const archive = memoryArchive();
  archive.storage.write = async () => { throw new Error('Storage full'); };
  await assert.rejects(saveImportToArchive(archive.storage, { name: 'statement.pdf', kind: 'pdf', base64: 'data' }, details, now), /Storage full/);
  assert.equal(archive.entries.size, 0);
});
test('Stored metadata rejects unsafe identifiers and filenames stay inside Imports', async () => {
  const archive = memoryArchive();
  const entry = await saveImportToArchive(archive.storage, { name: '../../September: checking.pdf', kind: 'pdf', base64: 'data' }, details, now);
  assert.equal(parseSavedImport(entry), entry);
  assert.equal(parseSavedImport({ ...entry, id: '../escape' }), null);
  assert.equal(parseSavedImport({ ...entry, transactionCount: -1 }), null);
  assert.equal(parseSavedImport({ ...entry, kind: 'exe' }), null);
  assert.equal(archiveFilename(entry).includes('/'), false);
});
