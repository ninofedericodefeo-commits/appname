import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { BACKUP_FILE_LIMIT, BACKUP_LIMIT } from './backupFormat';
export type ExportLink = { url: string; name: string };
export async function exportDataFile(bytes: Uint8Array, name: string, mime = 'application/octet-stream'): Promise<ExportLink | void> {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
  const folder = new Directory(Paths.cache, 'Exports'); folder.create({ idempotent: true });
  const file = new File(folder, name.replace(/[^a-zA-Z0-9._-]/g, '_'));
  file.write(bytes);
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
}
export async function pickBackupText() {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0], file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size) > BACKUP_FILE_LIMIT) throw new Error('Choose a backup under 68 MB.');
    const text = await file.text(); if (text.length > BACKUP_FILE_LIMIT) throw new Error('Backup is too large.'); return text;
  } finally { if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete(); }
}
export async function readBackupPhoto(uri: string) {
  const directory = new Directory(Paths.document, 'receipts');
  if (!uri.startsWith(`${directory.uri.replace(/\/$/, '')}/`)) throw new Error('A receipt photo is missing or outside app storage. Export records only.');
  const file = new File(uri);
  if (!file.exists || file.size > BACKUP_LIMIT) throw new Error('A receipt photo is missing or too large. Export records only.');
  return file.base64();
}
export async function writeBackupPhoto(base64: string, id: string, name = 'receipt.jpg') {
  const directory = new Directory(Paths.document, 'receipts'); directory.create({ idempotent: true });
  const file = new File(directory, `restored-${id}.${/\.(png|heic|webp)$/i.exec(name)?.[1]?.toLowerCase() ?? 'jpg'}`); file.write(base64, { encoding: 'base64' }); return file.uri;
}

export async function eraseAppPhotosAndExports() { for (const folder of [new Directory(Paths.document, 'receipts'), new Directory(Paths.cache, 'Exports')]) if (folder.exists) folder.delete(); }
