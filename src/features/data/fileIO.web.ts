import * as DocumentPicker from 'expo-document-picker';
import { BACKUP_FILE_LIMIT } from './backupFormat';
import { encodeBase64, decodeBase64 } from './encoding';
export type ExportLink = { url: string; name: string };
export async function exportDataFile(bytes: Uint8Array, name: string, mime = 'application/octet-stream'): Promise<ExportLink | void> {
  return { url: URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer], { type: mime })), name };
}
export async function pickBackupText() {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: false, base64: false });
  if (result.canceled) return null;
  const file = result.assets[0].file;
  if (!file || file.size > BACKUP_FILE_LIMIT) throw new Error('Choose a backup under 68 MB.');
  return file.text();
}
async function photoStore<T>(operation: (store: IDBObjectStore) => IDBRequest<T>, write = false) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('gasfinder-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Photo storage is unavailable.'));
  });
  try { return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('photos', write ? 'readwrite' : 'readonly'), request = operation(transaction.objectStore('photos'));
    transaction.oncomplete = () => resolve(request.result); transaction.onerror = transaction.onabort = () => reject(new Error('Could not read or save a photo.'));
  }); } finally { db.close(); }
}
export async function readBackupPhoto(uri: string) {
  if (uri.startsWith('gas-photo:')) { const blob = await photoStore<Blob | undefined>(store => store.get(uri)); if (!blob) throw new Error('A receipt photo is missing. Export records only.'); return encodeBase64(new Uint8Array(await blob.arrayBuffer())); }
  if (/^(blob:|data:image\/)/.test(uri)) { const response = await fetch(uri); return encodeBase64(new Uint8Array(await response.arrayBuffer())); }
  throw new Error('A receipt photo is unavailable. Export records only.');
}
export async function writeBackupPhoto(base64: string, id: string, name = 'receipt.jpg') {
  const uri = `gas-photo:${id}`, bytes = decodeBase64(base64);
  await photoStore(store => store.put(new Blob([new Uint8Array(bytes).buffer], { type: /\.png$/i.test(name) ? 'image/png' : /\.heic$/i.test(name) ? 'image/heic' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg' }), uri), true); return uri;
}
