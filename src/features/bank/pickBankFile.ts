import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { MAX_CSV_BYTES } from './importLogic';
import { MAX_PDF_BYTES } from './pdfTypes';

export type BankFile = { name: string; kind: 'csv'; text: string } | { name: string; kind: 'pdf'; base64: string };

export async function pickBankFile(): Promise<BankFile | null> {
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  let copied: File | undefined;
  try {
    if (Platform.OS !== 'web') copied = new File(asset.uri);
    const pdf = /\.pdf$/i.test(asset.name);
    if (!pdf && !/\.(csv|tsv|txt)$/i.test(asset.name)) throw new Error('Choose a Citizens statement PDF or a transaction CSV.');
    const size = asset.size ?? copied?.size ?? 0;
    if (size > (pdf ? MAX_PDF_BYTES : MAX_CSV_BYTES)) throw new Error(pdf ? 'Choose a PDF under 10 MB.' : 'Choose a CSV under 2 MB.');
    if (!pdf) {
      const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await copied!.text();
      return { name: asset.name, kind: 'csv', text };
    }
    let base64: string;
    if (Platform.OS === 'web' && asset.file) {
      const bytes = new Uint8Array(await asset.file.arrayBuffer());
      if (bytes.byteLength > MAX_PDF_BYTES) throw new Error('Choose a PDF under 10 MB.');
      // Chunk conversion avoids argument/stack limits on phone browsers.
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
      base64 = btoa(binary);
    } else base64 = await copied!.base64();
    if (base64.length > Math.ceil(MAX_PDF_BYTES / 3) * 4) throw new Error('Choose a PDF under 10 MB.');
    return { name: asset.name, kind: 'pdf', base64 };
  } finally {
    if (copied?.uri.startsWith(Paths.cache.uri) && copied.exists) {
      try { copied.delete(); } catch { /* Remove only our cache copy. */ }
    }
  }
}
