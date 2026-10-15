import { photoStore } from './webPhotoStore';
import { assertDataWritesAllowed } from '@/features/data/writeBarrier';
let nextPhotoVersion = 0;
export async function saveReceiptPhoto(uri: string, id: string, mimeType?: string | null) {
  assertDataWritesAllowed();
  id = `${id}-${Date.now()}-${nextPhotoVersion++}`;
  if (!/^(blob:|data:image\/)/.test(uri)) throw new Error('Choose a local receipt photo.');
  const blob = await (await fetch(uri)).blob();
  if (!blob.type.startsWith('image/') || blob.size > 10 * 1024 * 1024) throw new Error('Choose a receipt image under 10 MB.');
  const ext = /png/i.test(mimeType ?? blob.type) ? 'png' : /webp/i.test(mimeType ?? blob.type) ? 'webp' : /heic/i.test(mimeType ?? blob.type) ? 'heic' : 'jpg';
  const stored = `gas-photo:${id}.${ext}`;
  await photoStore(store => store.put(blob, stored), true); return stored;
}
export async function deleteReceiptPhoto(uri: string) { assertDataWritesAllowed(); if (uri.startsWith('gas-photo:')) await photoStore(store => store.delete(uri), true); }
export async function resolveReceiptPhoto(uri: string) {
  if (!uri.startsWith('gas-photo:')) return uri;
  const blob = await photoStore<Blob | undefined>(store => store.get(uri));
  if (!blob) throw new Error('Receipt photo is missing.');
  return URL.createObjectURL(blob);
}
