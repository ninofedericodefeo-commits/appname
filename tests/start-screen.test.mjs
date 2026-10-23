import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { initialStartPath } from '../src/features/preferences/startScreen.ts';
import { mergePersistedState } from '../src/lib/persistedState.ts';
import { accessibilityDefaults, validAccessibilityPreferences } from '../src/features/accessibility/preferences.ts';
import { validateRefillPercent } from '../src/features/stations/preferences.ts';
import { guardedSet } from '../src/features/data/writeBarrier.ts';

const require = createRequire(import.meta.url);
async function settingsFixture(startScreen, version = 6) {
  const data = new Map();
  const storage = { getItem: async name => data.get(name) ?? null, setItem: async (name, value) => { data.set(name, value); }, removeItem: async name => { data.delete(name); } };
  const imports = {
    '@/lib/persistedState': { mergePersistedState },
    '@/features/accessibility/preferences': { accessibilityDefaults, validAccessibilityPreferences },
    '@/lib/appStorage': { appStorage: storage }, '@/features/data/writeBarrier': { guardedSet },
    '@/features/stations/preferences': { validateRefillPercent },
  };
  const code = ts.transpileModule(readFileSync(new URL('../src/stores/settingsStore.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: false } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', code)(id => imports[id] ?? require(id), module, module.exports);
  const store = module.exports.useSettingsStore;
  await store.persist.rehydrate();
  if (startScreen !== undefined) {
    const state = JSON.parse(JSON.stringify(store.getInitialState()));
    Object.assign(state, { startScreen, appearance: 'dark', selectedRadius: 25, hideUnnamedStations: true, budgets: { Groceries: 30000 } });
    data.set('gasfinder-settings', JSON.stringify({ version, state }));
    await store.persist.rehydrate();
  }
  return { store, data };
}

test('new Tally installs start at Account; old Gas defaults migrate durably without changing preferences', async () => {
  assert.equal((await settingsFixture()).store.getState().startScreen, 'pocket');
  const h = await settingsFixture('index');
  const state = h.store.getState(), saved = JSON.parse(h.data.get('gasfinder-settings'));
  assert.equal(state.startScreen, 'pocket');
  assert.equal(saved.version, 7); assert.equal(saved.state.startScreen, 'pocket');
  assert.equal(state.appearance, 'dark'); assert.equal(state.selectedRadius, 25);
  assert.equal(state.hideUnnamedStations, true); assert.deepEqual(state.budgets, { Groceries: 30000 });
});
test('migration keeps existing non-Gas start preferences and current-version explicit Gas choices', async () => {
  for (const start of ['pocket', 'investment', 'subscriptions']) assert.equal((await settingsFixture(start)).store.getState().startScreen, start);
  assert.equal((await settingsFixture('index', 7)).store.getState().startScreen, 'index');
});
test('normal launches follow the chosen start screen while explicit incoming routes keep their destinations', () => {
  assert.equal(initialStartPath('/', 'pocket', null), '/pocket');
  assert.equal(initialStartPath('/', 'investment', 'https://example.test/'), '/investment');
  assert.equal(initialStartPath('/', 'subscriptions', 'http://localhost:8091'), '/subscriptions');
  for (const url of ['exp://192.168.1.10:8081', 'exp://192.168.1.10:8081/', 'exp://192.168.1.10:8081/--/', 'exp+gasfinder://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081']) assert.equal(initialStartPath('/', 'pocket', url), '/pocket');
  assert.equal(initialStartPath('/', 'index', null), null);
  for (const url of ['gasfinder://', 'gasfinder://on-route', 'gasfinder://bank-import', 'exp://192.168.1.10:8081/--/bank-import', 'https://example.test/pocket', 'https://example.test/?shared=1']) assert.equal(initialStartPath('/', 'pocket', url), null);
  for (const path of ['/pocket', '/investment', '/subscriptions', '/import-purchase', '/bank-import']) assert.equal(initialStartPath(path, 'pocket', null), null);
});
