import { Directory, File, Paths } from 'expo-file-system';
const folder = () => { const directory = new Directory(Paths.document, '_Drafts'); directory.create({ idempotent: true, intermediates: true }); return directory; };
const file = (key: string) => { if (!/^[a-z-]+$/.test(key)) throw Error('Invalid draft key.'); return new File(folder(), `${key}.json`); };
export const draftStorage = {
  async read(key: string): Promise<unknown> { const target = file(key); return target.exists ? JSON.parse(await target.text()) : null; },
  async write(key: string, value: unknown) { const target = file(key), temporary = new File(folder(), `${key}-pending.json`); temporary.write(JSON.stringify(value)); if (target.exists) target.delete(); temporary.move(target); },
  async remove(key: string) { const target = file(key); if (target.exists) target.delete(); },
  async clear() { const directory = new Directory(Paths.document, '_Drafts'); if (directory.exists) directory.delete(); },
};
