import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import shortcut from '../../../assets/shortcuts/import-statement.signed.json';

export async function installStatementShortcut() {
  if (Platform.OS !== 'ios') throw new Error('Add the statement shortcut from GasFinder on your iPhone.');
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable. Try again on your iPhone.');
  const file = new File(Paths.cache, shortcut.filename);
  file.create({ overwrite: true });
  file.write(shortcut.base64, { encoding: 'base64' });
  // Returning from this sheet can mean cancellation, never confirmed installation.
  await Sharing.shareAsync(file.uri, { UTI: 'com.apple.shortcut' });
}
