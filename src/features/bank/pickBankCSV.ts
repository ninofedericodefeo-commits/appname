import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';

import { MAX_CSV_BYTES } from './importLogic';

export async function pickBankCSV(): Promise<{ name: string; text: string } | null> {
  // Delay loading the new native module so existing development builds can still
  // open this screen and use the paste fallback until they are rebuilt.
  const DocumentPicker = await import('expo-document-picker');
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  let copied: File | undefined;
  try {
    if (Platform.OS !== 'web') copied = new File(asset.uri);
    if (!/\.(csv|tsv|txt)$/i.test(asset.name)) throw new Error('Export your bank transactions as CSV. PDF and Excel statements are not supported here.');
    const size = asset.size ?? copied?.size ?? 0;
    if (size > MAX_CSV_BYTES) throw new Error('Choose a CSV under 2 MB.');
    const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await copied!.text();
    return { name: asset.name, text };
  } finally {
    // Remove only our cache copy, never the user's original statement.
    if (copied?.uri.startsWith(Paths.cache.uri) && copied.exists) {
      try { copied.delete(); } catch { /* OS cache cleanup can retry later. */ }
    }
  }
}
