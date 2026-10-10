import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { archiveFilename, parseSavedImport } from './archiveLogic';
import type { ImportArchiveStorage, SavedBankImport } from './archiveLogic';

function importsFolder() {
  const folder = new Directory(Paths.document, 'Imports');
  folder.create({ idempotent: true, intermediates: true });
  return folder;
}
function savedFile(entry: SavedBankImport) { return new File(importsFolder(), archiveFilename(entry)); }

export const archiveStorage: ImportArchiveStorage = {
  async list() {
    const metadata = importsFolder().list().filter((file): file is File => file instanceof File && /^import-[a-z0-9-]+\.json$/.test(file.name));
    const entries = await Promise.all(metadata.map(async (file) => {
      try { return parseSavedImport(JSON.parse(await file.text())); } catch { return null; }
    }));
    return entries.filter((entry): entry is SavedBankImport => !!entry && savedFile(entry).exists);
  },
  async read(entry) {
    const file = savedFile(entry);
    if (!file.exists) throw new Error('This saved file is missing. Choose the original statement from Files.');
    return entry.kind === 'pdf' ? { name: entry.name, kind: 'pdf', base64: await file.base64() } :
      { name: entry.name, kind: 'csv', text: await file.text(), base64: await file.base64() };
  },
  async write(entry, source) {
    const folder = importsFolder();
    const destination = new File(folder, archiveFilename(entry));
    const metadata = new File(folder, `${entry.id}.json`);
    const temporary = new File(Paths.cache, `${entry.id}-${Math.random().toString(36).slice(2)}.tmp`);
    const temporaryMetadata = new File(Paths.cache, `${entry.id}-${Math.random().toString(36).slice(2)}.json`);
    const alreadySaved = destination.exists;
    try {
      if (!alreadySaved) {
        if (source.base64 !== undefined) temporary.write(source.base64, { encoding: 'base64' });
        else if (source.kind === 'csv') temporary.write(source.text);
        await temporary.move(destination);
      }
      temporaryMetadata.write(JSON.stringify(entry));
      await temporaryMetadata.move(metadata, { overwrite: true });
    } catch (error) {
      if (!alreadySaved && destination.exists) destination.delete();
      throw error;
    } finally {
      for (const file of [temporary, temporaryMetadata]) if (file.exists && file.uri.startsWith(Paths.cache.uri)) file.delete();
    }
  },
  async share(entry) {
    if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
    const file = savedFile(entry);
    if (!file.exists) throw new Error('This saved file is missing.');
    await Sharing.shareAsync(file.uri, { mimeType: entry.kind === 'pdf' ? 'application/pdf' : 'text/csv', UTI: entry.kind === 'pdf' ? 'com.adobe.pdf' : 'public.comma-separated-values-text', dialogTitle: entry.name });
  },
};
