import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist } from 'zustand/middleware';
import { assertNoPersistedActions, mergePersistedState } from '../src/lib/persistedState.ts';
import { validateStoreState } from '../src/features/data/validation.ts';

const registrySource = readFileSync(new URL('../src/features/data/registry.ts', import.meta.url), 'utf8');
const registryCode = ts.transpileModule(registrySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const storeExports = ['Pocket', 'Subscription', 'Settings', 'Drive', 'Receipt', 'PriceReport', 'WidgetSettings', 'GasSearch', 'Investment', 'ShortcutSetup', 'StatementAutomation'];

// Run the production registry with isolated adapters; the production JSON and
// state validator still checks every record, without loading native modules.
function registryFixture() {
  const adapters = storeExports.map((name, index) => {
    const initial = { count: 0, rows: [], note: null, update: () => `${name} action` };
    const options = { name: `synthetic-${index}`, version: 2, migrate: state => state };
    let current = initial, writes = 0;
    return {
      exportName: `use${name}Store`, initial, options,
      getState: () => current,
      getInitialState: () => initial,
      setState: state => { writes++; current = state; },
      persist: { hasHydrated: () => true, rehydrate: () => {}, getOptions: () => options },
      get writes() { return writes; },
    };
  });
  const exports = {};
  const localRequire = specifier => {
    if (specifier === './validation') return { validateStoreState };
    if (specifier === '@/lib/persistedState') return { assertNoPersistedActions, mergePersistedState };
    const adapter = adapters.find(store => specifier === `@/stores/${store.exportName.slice(3, -5).replace(/^./, letter => letter.toLowerCase())}Store`);
    if (!adapter) throw new Error(`Unexpected registry import: ${specifier}`);
    return { [adapter.exportName]: adapter };
  };
  new Function('require', 'exports', registryCode)(localRequire, exports);
  return { ...exports, adapters };
}

const collisions = [null, 'disabled', [], { supplied: 'data' }];
test('backup preparation rejects every JSON action replacement before migration runs', async () => {
  for (const action of collisions) {
    for (const version of [1, 2]) {
      const registry = registryFixture(), records = registry.captureStores();
      let migrations = 0;
      registry.adapters[0].options.migrate = state => { migrations++; const data = { ...state }; delete data.update; return data; };
      records['synthetic-0'] = { version, state: { ...records['synthetic-0'].state, update: action } };
      await assert.rejects(registry.prepareStores(records), /contains an app action/);
      assert.equal(migrations, 0);
      assert.ok(registry.adapters.every(store => store.writes === 0));
    }
  }
});

test('migration output cannot introduce an action replacement', async () => {
  for (const action of collisions) {
    const registry = registryFixture(), records = registry.captureStores();
    records['synthetic-0'].version = 1;
    registry.adapters[0].options.migrate = state => ({ ...state, update: action });
    await assert.rejects(registry.prepareStores(records), /contains an app action/);
    assert.ok(registry.adapters.every(store => store.writes === 0));
  }
});

test('applying records preflights the final record before changing any store', () => {
  for (const invalid of [{ update: null }, { rows: 'not an array' }]) {
    const registry = registryFixture(), records = registry.captureStores();
    records['synthetic-0'].state.count = 42;
    Object.assign(records['synthetic-10'].state, invalid);
    assert.throws(() => registry.applyStores(records), /Backup validation failed/);
    assert.ok(registry.adapters.every(store => store.writes === 0));
    assert.equal(registry.adapters[0].getState().count, 0);
  }
});

test('valid restores preserve runtime actions and unknown data-only legacy fields', async () => {
  const registry = registryFixture(), records = registry.captureStores();
  for (const record of Object.values(records)) {
    record.state.count = 42;
    record.state.rows = [{ id: 'saved-row', value: 'kept' }];
    record.state.legacyExtension = { enabled: true, values: [1, 2] };
  }
  records['synthetic-0'].version = 1;
  const prepared = await registry.prepareStores(records);
  registry.applyStores(prepared);
  for (const store of registry.adapters) {
    assert.equal(store.getState().update, store.initial.update);
    assert.equal(store.getState().update(), store.initial.update());
    assert.deepEqual(store.getState().legacyExtension, { enabled: true, values: [1, 2] });
    assert.deepEqual(store.getState().rows, [{ id: 'saved-row', value: 'kept' }]);
    assert.equal(store.getState().count, 42);
    assert.equal(store.writes, 1);
  }
});

test('legacy migrations can still omit optional fields with undefined values', async () => {
  const registry = registryFixture(), records = registry.captureStores();
  records['synthetic-0'].version = 1;
  registry.adapters[0].options.migrate = state => ({ ...state, optionalLegacyValue: undefined });
  const prepared = await registry.prepareStores(records);
  assert.equal(Object.hasOwn(prepared['synthetic-0'].state, 'optionalLegacyValue'), false);
  registry.applyStores(prepared);
  assert.equal(typeof registry.adapters[0].getState().update, 'function');
});

test('only own runtime actions are reserved; inherited function names remain valid data', () => {
  const initial = Object.assign(Object.create({ legacyMethod: () => {} }), { count: 0, update: () => {} });
  assert.doesNotThrow(() => assertNoPersistedActions({ legacyMethod: 'legacy data' }, initial, 'synthetic'));
  assert.throws(() => assertNoPersistedActions({ update: null }, initial, 'synthetic'), /app action/);
  const merged = mergePersistedState({ count: 2, update: null, legacyMethod: 'legacy data' }, initial);
  assert.equal(merged.update, initial.update);
  assert.equal(merged.legacyMethod, 'legacy data');
});

test('real Zustand startup, explicit rehydrate and rollback retain actions and saved data', async () => {
  for (const action of collisions) {
    const name = 'security-memory-store', values = new Map();
    const storage = {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => { values.set(key, value); },
      removeItem: key => { values.delete(key); },
    };
    const poison = (count, version = 2) => values.set(name, JSON.stringify({ version, state: {
      count, rows: [{ id: 'original' }], update: action, legacyExtension: { keep: true },
    } }));
    poison(12);
    const store = createStore()(persist(set => ({ count: 0, rows: [], update: count => set({ count }) }), {
      name, storage: createJSONStorage(() => storage), version: 2,
      migrate: state => state, merge: mergePersistedState,
    }));
    const update = store.getInitialState().update;
    assert.equal(store.persist.hasHydrated(), true);
    assert.equal(store.getState().count, 12);
    assert.equal(store.getState().update, update);
    assert.deepEqual(store.getState().legacyExtension, { keep: true });
    store.getState().update(13);
    assert.equal(store.getState().count, 13);

    poison(24, 1); // Existing old-version storage also passes through the safe merge.
    await store.persist.rehydrate();
    assert.equal(store.getState().update, update);
    assert.equal(store.getState().count, 24);

    // Restore recovery and Undo reset state, put the journal's raw bytes back,
    // then rehydrate; a historical poisoned copy must remain recoverable.
    store.setState(store.getInitialState(), true);
    poison(36);
    await store.persist.rehydrate();
    assert.equal(store.getState().update, update);
    assert.equal(store.getState().count, 36);
    assert.deepEqual(store.getState().rows, [{ id: 'original' }]);
    assert.deepEqual(store.getState().legacyExtension, { keep: true });
    store.getState().update(37);
    assert.equal(store.getState().count, 37);
    assert.equal(Object.hasOwn(JSON.parse(values.get(name)).state, 'update'), false);
  }
});
