import { Directory, File, Paths } from 'expo-file-system';

import { assertDataWritesAllowed } from '@/features/data/writeBarrier';

const receiptDirectory = () => new Directory(Paths.document, 'receipts');

let nextPhotoVersion = 0;
export async function saveReceiptPhoto(uri: string, id: string, mimeType?: string | null) {
  assertDataWritesAllowed();
  id = `${id}-${Date.now()}-${nextPhotoVersion++}`;
  const directory = receiptDirectory();
  directory.create({ idempotent: true });
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/heic' ? 'heic' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const destination = new File(directory, `${id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-160)}.${extension}`);
  const source = new File(uri); if (!source.exists || source.size > 10 * 1024 * 1024) throw new Error('Choose a receipt photo under 10 MB.');
  await source.copy(destination);
  return destination.uri;
}

export function deleteReceiptPhoto(uri: string) {
  assertDataWritesAllowed();
  if (!uri.startsWith(`${receiptDirectory().uri.replace(/\/$/, '')}/`)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}

export async function resolveReceiptPhoto(uri: string) { return uri; }
