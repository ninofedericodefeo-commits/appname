import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import shortcut from '../../../assets/shortcuts/log-purchase.signed.json';

export async function installPurchaseShortcut() {
  if (Platform.OS !== 'ios') throw new Error('Install the logging shortcut from GasFinder on your iPhone.');
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable. Open Shortcuts to set up the automation manually.');
  const file = new File(Paths.cache, shortcut.filename);
  file.create({ overwrite: true });
  file.write(shortcut.base64, { encoding: 'base64' });
  // Dismissing the OS import/share sheet does not prove installation.
  await Sharing.shareAsync(file.uri, { UTI: 'com.apple.shortcut' });
}
