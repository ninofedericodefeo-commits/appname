import { completeErasure } from './erasure';
import { clearDrafts } from '@/features/drafts/persistence';
import { clearPurchaseInbox } from '@/features/goals/purchaseInboxBridge';
import { Platform } from 'react-native';
import { clearBatch } from '@/features/bank/batch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { strToU8, strFromU8 } from 'fflate';
import { archiveStorage } from '@/features/bank/archiveStorage';
import { parseSavedImport } from '@/features/bank/archiveLogic';
import type { SavedBankImport } from '@/features/bank/archiveLogic';
import { flushBankArchive } from '@/features/bank/importArchive';
import { flushAppStorage } from '@/lib/appStorage';
import { queryClient } from '@/lib/queryClient';
import { captureStores, prepareStores, applyStores, managedStores, rehydrateStores, resetStores } from './registry';
import { canonicalJson, recoverableCommit } from './recovery.ts';
import { setDataWritesBlocked } from './writeBarrier';
import { BACKUP_LIMIT, decryptBackup, digestBytes, encryptBackup, validateBackup } from './backupFormat';
import type { BackupAttachment, BackupPayload, StoreRecord } from './backupFormat';
import { updateDataStatus, markDataReplacement } from './operationStatus';
import { decodeBase64, encodeBase64 } from './encoding';
import { exportDataFile, readBackupPhoto, writeBackupPhoto, eraseAppPhotosAndExports } from './fileIO';

async function secureRandom(count: number) { if (Platform.OS === 'web') { if (!globalThis.crypto?.getRandomValues) throw Error('Secure random generation is unavailable in this browser.'); return globalThis.crypto.getRandomValues(new Uint8Array(count)); } try { return await (await import('expo-crypto')).getRandomBytesAsync(count); } catch { throw new Error('Secure backups need the updated Tally app build.'); } }
const journalKey = 'gasfinder-data-restore-journal-v1';
const eraseKey = 'gasfinder-erasure-in-progress-v1';
const importJournalKey = 'gasfinder-bank-import-journal-v1';
type Journal = { version: 1; phase: 'prepared' | 'committed'; createdAt: string; before: readonly (readonly [string, string | null])[]; archives: SavedBankImport[] };
let running = false;
async function exclusively<T>(operation: () => Promise<T>) {
  if (running) throw new Error('Another data operation is in progress.');
  running = true; setDataWritesBlocked(true); updateDataStatus({ busy: true, recoveryError: '' });
  try { await queryClient.cancelQueries(); await flushBankArchive(); await flushAppStorage(); return await operation(); }
  finally { let unfinished = false;
    try { const journals = await AsyncStorage.multiGet([journalKey, importJournalKey]); unfinished = !!await AsyncStorage.getItem(eraseKey) || journals.some(([, value]) => value ? parseJournal(value).phase === 'prepared' : false); } catch { unfinished = true; }
    setDataWritesBlocked(unfinished); running = false; updateDataStatus({ busy: false, recoveryError: unfinished ? 'Recovery is unfinished. Retry the saved recovery before continuing.' : '' }); }
}
function photoReferences(stores: Record<string, StoreRecord>) {
  return ['gasfinder-receipt-reports', 'gasfinder-local-price-reports'].flatMap((name, index) =>
    (stores[name]?.state.reports as Record<string, unknown>[] ?? []).filter(row => !!row.photoUri).map(row => ({ row, id: `${index === 0 ? 'receipt' : 'price'}:${String(row.id)}`, legacyId: index === 0 ? String(row.id) : null })));
}
function photoAttachment(data: BackupPayload, reference: ReturnType<typeof photoReferences>[number]) {
  return data.attachments.find(item => item.kind === 'photo' && (item.id === reference.id || item.id === reference.legacyId));
}
export async function makeBackup(password: string, choice: boolean | 'available') {
  const includesFiles = choice !== false;
  const payload = await exclusively(async () => {
    const stores = captureStores(); await prepareStores(stores);
    const archives = JSON.parse(JSON.stringify(await archiveStorage.list())) as SavedBankImport[], attachments: BackupAttachment[] = [];
    let attachmentBytes = 0;
    const append = (item: Omit<BackupAttachment, 'sha256'>) => {
      const bytes = decodeBase64(item.base64, BACKUP_LIMIT); attachmentBytes += bytes.length;
      if (attachmentBytes > 30 * 1024 * 1024) throw new Error('Attachments exceed 30 MB. Export records only and share originals separately.');
      attachments.push({ ...item, sha256: digestBytes(bytes) });
    };
    if (includesFiles) {
      for (const entry of archives) {
        let file;
        try { file = await archiveStorage.read(entry); } catch (error) { if (choice !== 'available') throw error; entry.missingOriginal = true; continue; }
        append({ kind: 'bank', id: entry.id, name: entry.name, base64: file.base64 ?? encodeBase64(strToU8(file.kind === 'csv' ? file.text : '')) });
      }
      for (const reference of photoReferences(stores)) {
        let base64;
        try { base64 = await readBackupPhoto(String(reference.row.photoUri)); } catch (error) { if (choice !== 'available') throw error; reference.row.photoUri = ''; reference.row.photoMissing = true; continue; }
        append({ kind: 'photo', id: reference.id, name: `receipt.${/\.(png|heic|webp)$/i.exec(String(reference.row.photoUri))?.[1]?.toLowerCase() ?? 'jpg'}`, base64 });
      }
    }
    return validateBackup({ format: 'gasfinder-data', version: 1, createdAt: new Date().toISOString(), appVersion: Constants.expoConfig?.version ?? '1', stores, archives, attachments, includesFiles, attachmentScope: choice === 'available' ? 'available' : includesFiles ? 'all' : 'none' });
  });
  const encrypted = await encryptBackup(payload, password, secureRandom);
  const result = await exportDataFile(strToU8(encrypted), `GasFinder-${new Date().toISOString().replace(/[:.]/g, '-')}.gasbackup`);
  await AsyncStorage.setItem('gasfinder-last-backup-created', new Date().toISOString());
  return result;
}
export async function inspectBackup(text: string, password: string) {
  return preparePayload(await decryptBackup(text, password));
}
async function preparePayload(data: BackupPayload) {
  data.stores = await prepareStores(data.stores);
  for (const entry of data.archives) if (!parseSavedImport(entry) || !String(entry.id).startsWith('import-')) throw new Error('Backup has invalid source-file metadata.');
  if (new Set(data.archives.map(entry => entry.id)).size !== data.archives.length) throw new Error('Backup has duplicate file IDs.');
  const bankIds = new Set(data.archives.map(entry => entry.id));
  const references = photoReferences(data.stores), assigned = new Set<string>();
  for (const attachment of data.attachments) {
    if (attachment.kind === 'bank') { if (!bankIds.has(attachment.id)) throw new Error('Backup has a file without metadata.'); }
    else {
      const matching = references.filter(reference => attachment.id === reference.id || attachment.id === reference.legacyId);
      if (matching.length !== 1 || assigned.has(matching[0].id)) throw new Error('Backup photo references are missing, duplicated or ambiguous.');
      assigned.add(matching[0].id);
    }
  }
  if (data.includesFiles) {
    for (const entry of data.archives) if (!entry.missingOriginal && !data.attachments.some(file => file.kind === 'bank' && file.id === entry.id)) throw new Error('Backup is missing a statement attachment.');
    for (const reference of references) if (!photoAttachment(data, reference)) throw new Error('Backup is missing a receipt photo.');
  }
  return data;
}
function parseJournal(text: string): Journal {
  const value = JSON.parse(text) as Journal, names = managedStores.map(store => store.persist.getOptions().name);
  if (value.version !== 1 || !['prepared', 'committed'].includes(value.phase) || !Array.isArray(value.before) || value.before.length !== names.length || new Set(value.before.map(pair => pair[0])).size !== names.length || !value.before.every(pair => names.includes(pair[0]) && (pair[1] === null || typeof pair[1] === 'string')) || !Array.isArray(value.archives) || value.archives.some(entry => !parseSavedImport(entry))) throw new Error('The local recovery copy is damaged. Keep your backup and retry recovery.');
  return value;
}
async function rollBack(journal: Journal, key = journalKey) {
  resetStores(); await flushAppStorage();
  for (const [name, value] of journal.before) { if (value === null) await AsyncStorage.removeItem(name); else await AsyncStorage.setItem(name, value); }
  await archiveStorage.setMetadata!(journal.archives);
  await rehydrateStores(); await flushAppStorage();
  await AsyncStorage.removeItem(key);
}
export async function recoverInterruptedRestore() {
  if (await AsyncStorage.getItem(eraseKey)) { await exclusively(finishErasure); markDataReplacement('Interrupted erasure completed. App records, originals and drafts erased. External backups and device privacy settings remain.'); return; }
  for (const key of [importJournalKey, journalKey]) {
    const stored = await AsyncStorage.getItem(key);
    if (stored) { const journal = parseJournal(stored); if (journal.phase === 'prepared') await exclusively(() => rollBack(journal, key)); }
  }
  const completed = await AsyncStorage.getItem('gasfinder-erasure-complete');
  if (completed) { updateDataStatus({ notice: completed }); await AsyncStorage.removeItem('gasfinder-erasure-complete'); }
  await rehydrateStores();
}
async function verifyPersistedRecords() {
  const expected = captureStores(), initial = captureStores(true);
  for (const [name, text] of await AsyncStorage.multiGet(Object.keys(expected))) if (text ? canonicalJson(JSON.parse(text)) !== canonicalJson(expected[name]) : canonicalJson(expected[name]) !== canonicalJson(initial[name])) throw new Error('Saved records could not be verified.');
}
export async function recoverableBankOperation<T>(operation: (permit: <R>(action: () => R) => R) => Promise<T>): Promise<T> {
  return exclusively(async () => {
    const journal: Journal = { version: 1, phase: 'prepared', createdAt: new Date().toISOString(), before: await AsyncStorage.multiGet(managedStores.map(store => store.persist.getOptions().name)), archives: await archiveStorage.list() };
    let result: T;
    await recoverableCommit(journal, {
      saveJournal: async copy => { await AsyncStorage.setItem(importJournalKey, JSON.stringify(copy)); },
      apply: async () => {
        result = await operation(action => { setDataWritesBlocked(false); try { return action(); } finally { setDataWritesBlocked(true); } });
        await flushBankArchive(); await flushAppStorage();
      },
      verify: async () => { await prepareStores(captureStores()); await verifyPersistedRecords(); },
      rollback: async copy => { await flushBankArchive(); await flushAppStorage().catch(() => undefined); await rollBack(copy, importJournalKey); },
    });
    await AsyncStorage.removeItem(importJournalKey);
    return result!;
  });
}
export async function hasRestoreRollback() { return !!await AsyncStorage.getItem(journalKey); }
export async function undoRestore() {
  const text = await AsyncStorage.getItem(journalKey); if (!text) throw new Error('No previous restore is available.');
  await exclusively(async () => { await clearDrafts(); await rollBack(parseJournal(text)); }); clearBatch(); markDataReplacement('Previous records recovered.');
}
export async function restoreBackup(payload: BackupPayload) {
  const data = await preparePayload(validateBackup(payload)), records = data.stores;
  return exclusively(async () => {
    await clearDrafts();
    const names = managedStores.map(store => store.persist.getOptions().name);
    const before = await AsyncStorage.multiGet(names);
    const oldArchives = await archiveStorage.list();
    const journal: Journal = { version: 1, phase: 'prepared', createdAt: new Date().toISOString(), before, archives: oldArchives };
    let recordsToVerify = records;
    await recoverableCommit(journal, {
      saveJournal: async (copy, committed) => { copy.phase = committed ? 'committed' : 'prepared'; await AsyncStorage.setItem(journalKey, JSON.stringify(copy)); },
      apply: async () => {
      const runId = Array.from(await secureRandom(12), byte => byte.toString(16).padStart(2, '0')).join('');
      const restored: SavedBankImport[] = [];
      for (let index = 0; index < data.archives.length; index++) {
        const metadata = parseSavedImport(data.archives[index]); if (!metadata) throw new Error('Invalid archived original.');
        const source = data.attachments.find(item => item.kind === 'bank' && item.id === metadata.id);
        const entry = { ...metadata, storageName: `restore-${runId}-${index}.${metadata.kind}`, missingOriginal: !source };
        if (source) await archiveStorage.write(entry, entry.kind === 'pdf' ? { name: entry.name, kind: 'pdf', base64: source.base64 } : { name: entry.name, kind: 'csv', text: strFromU8(decodeBase64(source.base64)), base64: source.base64 });
        restored.push(entry);
      }
      const ids = new Set(restored.map(entry => entry.id));
      await archiveStorage.setMetadata!([...restored, ...oldArchives.filter(entry => !ids.has(entry.id)).map(entry => ({ ...entry, trashedAt: entry.trashedAt ?? new Date().toISOString() }))]);
      const references = photoReferences(records);
      for (let index = 0; index < references.length; index++) {
        const photo = photoAttachment(data, references[index]);
        references[index].row.photoUri = photo ? await writeBackupPhoto(photo.base64, `${runId}-${index}`, photo.name) : ''; references[index].row.photoMissing = !photo;
      }
      applyStores(records); await flushAppStorage(); recordsToVerify = records;
      },
      verify: async () => { await verifyPersistedRecords(); if (canonicalJson(captureStores()) !== canonicalJson(recordsToVerify)) throw new Error('Restored records did not validate.'); },
      rollback: async copy => { await flushAppStorage().catch(() => undefined); await rollBack(copy); },
    });
    queryClient.clear();
  }).then(async () => { clearBatch(); markDataReplacement('Restore complete. Review Account and reminder status in Settings.'); });
}
export function backupSummary(stores: Record<string, StoreRecord>) {
  const pocket = stores['gasfinder-savings-pocket']?.state ?? {};
  return { transactions: Array.isArray(pocket.accountTransactions) ? pocket.accountTransactions.length : 0, purchases: Array.isArray(pocket.purchases) ? pocket.purchases.length : 0,
    subscriptions: Array.isArray(stores['gasfinder-subscriptions']?.state.subscriptions) ? (stores['gasfinder-subscriptions'].state.subscriptions as unknown[]).length : 0,
    reservedCents: typeof pocket.reservedCents === 'number' ? pocket.reservedCents : 0 };
}

// A reset uses the same durable Undo journal as restore, preserving originals.
export async function resetAccountData(nickname = '') {
  if (nickname && (!nickname.trim() || nickname.length > 60)) throw Error('Choose an account name up to 60 characters.');
  return exclusively(async () => {
    await clearDrafts();
    const before = await AsyncStorage.multiGet(managedStores.map(store => store.persist.getOptions().name));
    const archives = await archiveStorage.list(), records = captureStores(), defaults = captureStores(true);
    records['gasfinder-savings-pocket'] = defaults['gasfinder-savings-pocket'];
    if (nickname) records['gasfinder-savings-pocket'].state.bankImportAccountLabel = nickname.trim();
    records['gasfinder-statement-automation-v1'] = defaults['gasfinder-statement-automation-v1'];
    for (const name of ['gasfinder-receipt-reports', 'gasfinder-local-price-reports']) {
      const reports = records[name].state.reports as Record<string, unknown>[];
      reports.forEach(report => { delete report.accountLink; });
    }
    const prepared = await prepareStores(records);
    const journal: Journal = { version: 1, phase: 'prepared', createdAt: new Date().toISOString(), before, archives };
    await recoverableCommit(journal, {
      saveJournal: async (copy, committed) => { copy.phase = committed ? 'committed' : 'prepared'; await AsyncStorage.setItem(journalKey, JSON.stringify(copy)); },
      apply: async () => { await archiveStorage.setMetadata!(archives.map(entry => ({ ...entry, trashedAt: entry.trashedAt ?? new Date().toISOString() }))); applyStores(prepared); await flushAppStorage(); },
      verify: async () => { await verifyPersistedRecords(); if (canonicalJson(captureStores()) !== canonicalJson(prepared)) throw Error('Account reset verification failed.'); },
      rollback: rollBack,
    });
    queryClient.clear();
  }).then(async () => { clearBatch(); markDataReplacement('Account reset complete. Undo is available in Backup & restore.'); });
}

async function finishErasure() {
  await completeErasure({
    resetRecords: async () => { await rehydrateStores(); resetStores(); await flushAppStorage(); },
    eraseOriginals: async () => { await archiveStorage.erase!(); },
    eraseAttachments: eraseAppPhotosAndExports,
    eraseDrafts: async () => { await clearDrafts(); await clearPurchaseInbox(); },
    clearRecovery: async () => { await AsyncStorage.multiRemove([journalKey, importJournalKey, 'gasfinder-last-backup-created']); },
    clearCache: () => { clearBatch(); queryClient.clear(); },
    recordCompletion: async () => { await AsyncStorage.setItem('gasfinder-erasure-complete','App records, saved originals and drafts erased. There is no Undo. External backups and device privacy settings remain.'); },
    clearMarker: async () => { await AsyncStorage.removeItem(eraseKey); },
  });
}
export async function eraseAllAppRecords() {
  await exclusively(async () => { await AsyncStorage.setItem(eraseKey, new Date().toISOString()); await finishErasure(); });
  markDataReplacement('App records, saved originals and drafts erased. There is no Undo. External backups and device privacy settings remain.');
}

export async function dataHealth() {
  const archives = await archiveStorage.list(), stores = captureStores();
  let originalsAvailable = 0, originalsMissing = 0, photosAvailable = 0, photosMissing = ['gasfinder-receipt-reports','gasfinder-local-price-reports'].reduce((sum,name) => sum + (stores[name]?.state.reports as Record<string,unknown>[] ?? []).filter(row => row.photoMissing && !row.photoUri).length,0), bytes = 0;
  // Sequential reads bound transient memory to one original/photo at a time.
  for (const entry of archives) { try { const file = await archiveStorage.read(entry); bytes += file.base64 ? Math.floor(file.base64.length*3/4) : file.kind === 'csv' ? strToU8(file.text).length : 0; originalsAvailable++; } catch { originalsMissing++; } }
  for (const reference of photoReferences(stores)) { try { const photo = await readBackupPhoto(String(reference.row.photoUri)); bytes += Math.floor(photo.length*3/4); photosAvailable++; } catch { photosMissing++; } }
  const recordsBytes = strToU8(JSON.stringify(stores)).length;
  return { ...backupSummary(stores), originalsAvailable, originalsMissing, photosAvailable, photosMissing, bytes, recordsBytes, lastCreatedAt: await AsyncStorage.getItem('gasfinder-last-backup-created') };
}
