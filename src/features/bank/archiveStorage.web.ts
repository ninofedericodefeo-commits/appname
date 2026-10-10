import { parseSavedImport } from './archiveLogic';
import type { ImportArchiveStorage, SavedBankImport } from './archiveLogic';
import type { BankFile } from './bankFileTypes';

function openArchive(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Saved imports are unavailable in this browser.')); return; }
    const request = indexedDB.open('gasfinder-imports', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('imports', { keyPath: 'id' }); request.result.createObjectStore('files'); };
    request.onerror = () => reject(new Error('Could not open the Imports folder in this browser.'));
    request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onblocked = () => reject(new Error('Close other GasFinder tabs, then try opening Imports again.'));
  });
}
async function readStore<T>(store: string, id?: string): Promise<T> {
  const db = await openArchive();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(store, 'readonly');
      const request = id ? transaction.objectStore(store).get(id) : transaction.objectStore(store).getAll();
      transaction.oncomplete = () => resolve(request.result as T);
      transaction.onabort = () => reject(new Error('Could not read the saved import.'));
      transaction.onerror = () => reject(new Error('Could not read the saved import.'));
    });
  } finally { db.close(); }
}
function fileBlob(file: BankFile) {
  if (file.kind === 'csv' && file.base64 === undefined) return new Blob([file.text], { type: 'text/csv' });
  const binary = atob(file.base64!);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes.buffer], { type: file.kind === 'pdf' ? 'application/pdf' : 'text/csv' });
}
function base64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 16384) binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return btoa(binary);
}

export const archiveStorage: ImportArchiveStorage = {
  async list() { return (await readStore<unknown[]>('imports')).map(parseSavedImport).filter((entry): entry is SavedBankImport => !!entry); },
  async read(entry) {
    const blob = await readStore<Blob | undefined>('files', entry.id);
    if (!blob) throw new Error('This saved file is missing. Choose the original statement again.');
    return entry.kind === 'pdf' ? { name: entry.name, kind: 'pdf', base64: base64(new Uint8Array(await blob.arrayBuffer())) } :
      { name: entry.name, kind: 'csv', text: await blob.text(), base64: base64(new Uint8Array(await blob.arrayBuffer())) };
  },
  async write(entry, file) {
    const blob = fileBlob(file);
    const db = await openArchive();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['imports', 'files'], 'readwrite');
        transaction.objectStore('imports').put(entry);
        transaction.objectStore('files').put(blob, entry.id);
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(new Error('Could not save this file. Check available browser storage, then try again.'));
        transaction.onerror = () => reject(new Error('Could not save this file. Check available browser storage, then try again.'));
      });
    } finally { db.close(); }
  },
  async share(entry) {
    const blob = await readStore<Blob | undefined>('files', entry.id);
    if (!blob) throw new Error('This saved file is missing.');
    const url = URL.createObjectURL(blob);
    // The screen renders a real link after reading local storage so Safari can
    // start the download from a fresh user gesture.
    return { url, name: entry.name };
  },
};
