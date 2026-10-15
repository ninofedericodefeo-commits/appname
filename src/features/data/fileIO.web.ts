import { photoStore } from '@/features/receipts/webPhotoStore';
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
export async function readBackupPhoto(uri: string) {
  if (uri.startsWith('gas-photo:')) { const blob = await photoStore<Blob | undefined>(store => store.get(uri)); if (!blob || blob.size > 30 * 1024 * 1024) throw new Error('A receipt photo is missing. Export records only.'); return encodeBase64(new Uint8Array(await blob.arrayBuffer())); }
  if (/^(blob:|data:image\/)/.test(uri)) { const blob = await (await fetch(uri)).blob(); if (blob.size > 30 * 1024 * 1024) throw new Error('Photo is too large.'); return encodeBase64(new Uint8Array(await blob.arrayBuffer())); }
  throw new Error('A receipt photo is unavailable. Export records only.');
}
export async function writeBackupPhoto(base64: string, id: string, name = 'receipt.jpg') {
  const uri = `gas-photo:${id}.${/\.(png|heic|webp)$/i.exec(name)?.[1]?.toLowerCase() ?? 'jpg'}`, bytes = decodeBase64(base64);
  await photoStore(store => store.put(new Blob([new Uint8Array(bytes).buffer], { type: /\.png$/i.test(name) ? 'image/png' : /\.heic$/i.test(name) ? 'image/heic' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg' }), uri), true); return uri;
}

export async function eraseAppPhotosAndExports() { await photoStore(store => store.clear(), true); }
