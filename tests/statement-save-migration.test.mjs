import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { canonicalJson, recoverableCommit } from '../src/features/data/recovery.ts';
import { mergePersistedState } from '../src/lib/persistedState.ts';
import { accessibilityDefaults, validAccessibilityPreferences } from '../src/features/accessibility/preferences.ts';
import { validateRefillPercent } from '../src/features/stations/preferences.ts';
import { guardedSet, setDataWritesBlocked } from '../src/features/data/writeBarrier.ts';
import { extractPDFText } from '../src/features/bank/extractPDFText.ts';
import { parseCitizensStatement } from '../src/features/bank/citizensStatement.ts';
import { guessMapping, previewAccountTransactions } from '../src/features/bank/importLogic.ts';

const require = createRequire(import.meta.url);
function load(file, adapters) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: false } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => {
    if (id in adapters) return adapters[id];
    if (id.startsWith('@/') || id.startsWith('./')) return {};
    return require(id);
  }, module, module.exports);
  return module.exports;
}
const serial = value => JSON.parse(JSON.stringify(value));
async function fixture(savedHideUnnamed, buildVersion = 7) {
  const data = new Map(); let dropNextPocketWrite = false;
  const disk = {
    getItem: async name => data.get(name) ?? null,
    setItem: async (name, value) => {
      if (name === 'test-pocket' && dropNextPocketWrite) { dropNextPocketWrite = false; return; }
      data.set(name, value);
    },
    removeItem: async name => { data.delete(name); },
    multiGet: async names => names.map(name => [name, data.get(name) ?? null]),
  };
  const storage = load('src/lib/appStorage.ts', { '@react-native-async-storage/async-storage': { default: disk } });
  const settings = load('src/stores/settingsStore.ts', {
    '@/lib/persistedState': { mergePersistedState },
    '@/features/accessibility/preferences': { accessibilityDefaults, validAccessibilityPreferences },
    '@/lib/appStorage': storage, '@/features/data/writeBarrier': { guardedSet },
    '@/features/stations/preferences': { validateRefillPercent },
  }).useSettingsStore;
  await settings.persist.rehydrate();
  settings.persist.setOptions({ version: buildVersion });
  const oldState = { ...serial(settings.getInitialState()), selectedRadius: 25, hideUnpricedStations: true };
  delete oldState.hideUnnamedStations;
  if (savedHideUnnamed !== undefined) oldState.hideUnnamedStations = savedHideUnnamed;
  data.set('gasfinder-settings', JSON.stringify({ version: 5, state: oldState }));
  await settings.persist.rehydrate(); await storage.flushAppStorage();

  const pocket = create()(persist(() => ({ accountTransactions: [] }), { name: 'test-pocket', storage: createJSONStorage(() => storage.appStorage), version: 1 }));
  await pocket.persist.rehydrate();
  const stores = [settings, pocket];
  const captureStores = (initial = false) => Object.fromEntries(stores.map(store => [store.persist.getOptions().name, { version: store.persist.getOptions().version, state: serial(initial ? store.getInitialState() : store.getState()) }]));
  const service = load('src/features/data/backupService.ts', {
    '@react-native-async-storage/async-storage': { default: disk }, 'react-native': { Platform: { OS: 'web' } }, 'expo-constants': { default: {} },
    '@/lib/appStorage': storage,
    '@/features/bank/archiveStorage': { archiveStorage: { list: async () => [], setMetadata: async () => {} } },
    '@/features/bank/importArchive': { flushBankArchive: async () => {} },
    '@/lib/queryClient': { queryClient: { cancelQueries: async () => {} } },
    './registry': { managedStores: stores, captureStores, prepareStores: async records => records,
      resetStores: () => stores.forEach(store => store.setState(store.getInitialState(), true)),
      rehydrateStores: async () => { for (const store of stores) await store.persist.rehydrate(); } },
    './recovery.ts': { canonicalJson, recoverableCommit }, './writeBarrier': { setDataWritesBlocked },
    './operationStatus': { updateDataStatus: () => {} },
  });
  return { settings, pocket, data, service, dropNextWrite: () => { dropNextPocketWrite = true; } };
}

test('the previous same-version settings schema reproduces the reported verification failure', async () => {
  const h = await fixture(undefined, 5);
  assert.equal(h.settings.getState().hideUnnamedStations, false);
  assert.equal(JSON.parse(h.data.get('gasfinder-settings')).state.hideUnnamedStations, undefined);
  await assert.rejects(h.service.recoverableBankOperation(async permit => permit(() => h.pocket.setState({ accountTransactions: [] }))), /Saved records could not be verified/);
});

test('upgraded settings are durable before the sample Citizens import verifies and commits', async () => {
  const h = await fixture();
  const saved = JSON.parse(h.data.get('gasfinder-settings'));
  assert.equal(saved.version, 7);
  assert.equal(saved.state.hideUnnamedStations, false);
  assert.equal(saved.state.selectedRadius, 25);
  assert.equal(saved.state.hideUnpricedStations, true);
  const pdf = readFileSync(new URL('../assets/samples/sample-citizens-statement.pdf', import.meta.url));
  const parsed = parseCitizensStatement(await extractPDFText(pdf.toString('base64')), new Date('2026-10-18T12:00:00Z'));
  const preview = previewAccountTransactions(parsed.csv, guessMapping(parsed.csv), 'Sample Citizens account', new Date('2026-10-18T12:00:00Z'));
  assert.ok(preview.rows.length > 0);
  await h.service.recoverableBankOperation(async permit => permit(() => h.pocket.setState({ accountTransactions: preview.rows })));
  assert.deepEqual(JSON.parse(h.data.get('test-pocket')).state.accountTransactions, preview.rows);
  assert.equal(h.data.has('gasfinder-bank-import-journal-v1'), false);
});
test('migration preserves an already selected unnamed-station filter', async () => {
  const h = await fixture(true);
  assert.equal(h.settings.getState().hideUnnamedStations, true);
  assert.equal(JSON.parse(h.data.get('gasfinder-settings')).state.hideUnnamedStations, true);
});
test('real missing writes still fail verification and roll back the import', async () => {
  const h = await fixture(); h.dropNextWrite();
  await assert.rejects(h.service.recoverableBankOperation(async permit => permit(() => h.pocket.setState({ accountTransactions: [{ id: 'lost-write' }] }))), /Saved records could not be verified/);
  assert.deepEqual(h.pocket.getState().accountTransactions, []);
  assert.equal(h.data.has('gasfinder-bank-import-journal-v1'), false);
});
