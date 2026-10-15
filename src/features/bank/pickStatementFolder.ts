import { Directory, File } from 'expo-file-system';
import { Platform } from 'react-native';
import type { BankFile } from './bankFileTypes';
import { listBankImports } from './importArchive';
import { archiveStorage } from './archiveStorage';
import { archiveContent, importFingerprint } from './archiveLogic';
export async function pickStatementFolder(): Promise<{ files: BankFile[]; known: number }> {
  if (Platform.OS === 'web') throw Error('Folder selection is available in the native app. Use Choose PDFs or CSVs here.');
  const directory = await Directory.pickDirectoryAsync();
  const entries = directory.list().filter((item): item is File => item instanceof File && /\.(pdf|csv|tsv|txt)$/i.test(item.name));
  // Read no more than a bounded folder. Date/name order is never a balance choice.
  if (entries.length > 12 || entries.reduce((sum,file) => sum+file.size,0) > 30 * 1024 * 1024) throw Error('Use a folder with up to 12 statements and 30 MB. Split older statements into another folder.');
  const archived = await listBankImports(true), fingerprints = new Set(archived.map(item => item.fingerprint));
  const files: BankFile[] = []; let known = 0;
  for (const item of entries) {
    const pdf = /\.pdf$/i.test(item.name);
    if (item.size > (pdf ? 10_000_000 : 2_000_000)) throw Error('Each PDF must be under 10 MB; CSV under 2 MB.');
    const file: BankFile = pdf ? {kind:'pdf',name:item.name,base64:await item.base64()} : {kind:'csv',name:item.name,text:await item.text(),base64:await item.base64()};
    let identical = false;
    if (fingerprints.has(importFingerprint(file))) for (const entry of archived.filter(entry => entry.fingerprint === importFingerprint(file))) { try { if (archiveContent(await archiveStorage.read(entry)) === archiveContent(file)) { identical = true; break; } } catch { /* Missing originals stay candidates for review/relink. */ } }
    if (identical) known++; else files.push(file);
  }
  return {files,known};
}
