import { Directory, File, Paths } from 'expo-file-system';

const receiptDirectory = () => new Directory(Paths.document, 'receipts');

export async function saveReceiptPhoto(uri: string, id: string, mimeType?: string | null) {
  const directory = receiptDirectory();
  directory.create({ idempotent: true });
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/heic' ? 'heic' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const destination = new File(directory, `${id}.${extension}`);
  await new File(uri).copy(destination);
  return destination.uri;
}

export function deleteReceiptPhoto(uri: string) {
  if (!uri.startsWith(`${receiptDirectory().uri.replace(/\/$/, '')}/`)) return;
  const file = new File(uri);
  if (file.exists) file.delete();
}
