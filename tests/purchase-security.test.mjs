import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { pendingWalletId, walletPurchaseId } from '../src/features/goals/purchaseInbox.ts';
import { parseImportedPurchase } from '../src/features/goals/importPurchase.ts';
import { formatMoney } from '../src/lib/money.ts';
import { validateJson } from '../src/features/data/backupFormat.ts';
import { getMerchantAlias } from '../src/features/pocket/merchantAliases.ts';
import { isFinancialRoute } from '../src/features/privacy/financialRoutes.ts';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../', import.meta.url));
function load(file, imports) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(id => {
    assert.ok(Object.hasOwn(imports, id), `Unexpected dependency: ${id}`);
    return imports[id];
  }, module, module.exports);
  return module.exports;
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const text = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(text).join('') : text(tree?.props?.children ?? '');

function purchaseHarness(walletDraft) {
  const control = { ready: true, privacyReady: true, privacy: { enabled: true }, session: { unlocked: true }, app: { currentState: 'active' }, data: { busy: false, recoveryError: '' } };
  const writes = [], captures = [], effects = [], slots = [], acknowledgements = [];
  control.flushError = false; control.ackError = false;
  control.params = walletDraft ? { pendingWalletId: walletDraft.id } : { amount: '12.30', merchant: 'Corner Shop', id: 'security-synthetic' };
  let cursor = 0;
  const state = { purchases: [], activeGoal: null, addPurchase: (...args) => {
    if (state.purchases.some(item => item.id === args[0])) return false;
    writes.push(args); state.purchases.push({ id: args[0], title: args[1], amountCents: args[2], decision: 'pending' }); return true;
  } };
  const pocket = selector => selector(state);
  pocket.getState = () => state;
  pocket.setState = change => Object.assign(state, change);
  pocket.persist = { hasHydrated: () => control.ready, onFinishHydration: () => () => {} };
  const privacy = selector => selector ? selector(control.privacy) : control.privacy;
  privacy.getState = () => control.privacy;
  privacy.persist = { hasHydrated: () => control.privacyReady, onFinishHydration: () => () => {} };
  const session = selector => selector ? selector(control.session) : control.session;
  session.getState = () => control.session;
  const jsx = (type, props) => ({ type, props });
  const imports = {
    'react': {
      useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = value; }]; },
      useRef: value => { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; },
      useMemo: fn => fn(), useEffect: fn => effects.push(fn), useSyncExternalStore: (_subscribe, snapshot) => snapshot(),
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { AppState: { get currentState() { return control.app.currentState; }, addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'ios' }, Pressable: 'Pressable', Text: 'Text', View: 'View', ScrollView: 'ScrollView' },
    'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
    'expo-router': { useLocalSearchParams: () => control.params, Link: 'Link' },
    '@/theme': { useThemeRevision() {}, colors: {}, themedStyles: fn => fn() },
    '@/features/preferences/amountVisibility': { useAmountsHidden: () => !!control.privacy.hideAmounts, useAmountVisibility: { getState: () => ({ revealed: false }) } },
    '@/features/data/operationStatus': { useDataStatus: () => control.data, getDataStatus: () => control.data },
    '@/features/privacy/deviceStore': { useDevicePrivacy: privacy, usePrivacySession: session },
    '@/stores/pocketStore': { usePocketStore: pocket },
    '@/stores/shortcutSetupStore': { useShortcutSetupStore: { getState: () => ({ recordCapture: outcome => captures.push(outcome) }) } },
    '@/features/goals/purchaseInbox': { pendingWalletId, walletPurchaseId },
    '@/features/goals/purchaseInboxBridge': { usePendingWalletPurchases: () => ({ items: walletDraft ? [walletDraft] : [], loading: false, error: '' }), removePendingWalletPurchase: async id => { if (control.ackError) throw new Error('Synthetic acknowledgement failed'); acknowledgements.push(id); } },
    '@/lib/appStorage': { flushAppStorage: async () => { if (control.flushError) throw new Error('Synthetic durable storage failure'); } },
    '@/lib/money': { formatMoney }, '@/features/goals/importPurchase': { parseImportedPurchase },
  };
  const component = load('src/app/import-purchase.tsx', imports).default;
  function render() { cursor = 0; const content = component(); const tree = content.type(content.props); effects.splice(0).forEach(fn => fn()); return tree; }
  const save = tree => nodes(tree).find(node => node.type === 'Pressable' && text(node) === 'Save purchase');
  return { control, writes, captures, state, render, save, acknowledgements };
}

test('opening, rerendering or leaving a purchase draft never changes financial records', () => {
  const h = purchaseHarness();
  for (let n = 0; n < 4; n++) {
    const tree = h.render(); assert.ok(h.save(tree));
    assert.ok(nodes(tree).some(node => node.type === 'Link' && text(node) === 'Cancel'));
  }
  assert.deepEqual(h.writes, []); assert.deepEqual(h.state.purchases, []); assert.deepEqual(h.captures, []);
});
test('explicit authorized confirmation saves the parsed purchase once and keeps duplicate protection', () => {
  const h = purchaseHarness(), button = h.save(h.render());
  assert.equal(button.props.disabled, false);
  button.props.onPress(); button.props.onPress();
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0][1], 'Corner Shop'); assert.equal(h.writes[0][2], 1230); assert.equal(h.writes[0][4], 'shortcut');
  assert.deepEqual(h.captures, ['received']); assert.equal(h.save(h.render()), undefined);
});
test('a duplicate arriving after render is not recorded again', () => {
  const h = purchaseHarness(), button = h.save(h.render());
  const purchase = parseImportedPurchase({ amount: '12.30', merchant: 'Corner Shop', id: 'security-synthetic' });
  h.state.purchases.push({ ...purchase, decision: 'pending' }); button.props.onPress();
  assert.equal(h.writes.length, 0); assert.deepEqual(h.captures, ['repeated']);
});
for (const [name, revoke] of [
  ['hidden financial amounts', h => { h.control.privacy.hideAmounts = true; }],
  ['relocked session', h => { h.control.session.unlocked = false; }],
  ['background transition', h => { h.control.app.currentState = 'background'; }],
  ['inactive transition', h => { h.control.app.currentState = 'inactive'; }],
  ['unhydrated account', h => { h.control.ready = false; }],
  ['unhydrated privacy preference', h => { h.control.privacyReady = false; }],
  ['restore operation', h => { h.control.data.busy = true; }],
  ['recovery failure', h => { h.control.data.recoveryError = 'synthetic recovery required'; }],
]) test(`a previously rendered Save callback cannot bypass ${name}`, () => {
  const h = purchaseHarness(), button = h.save(h.render()); revoke(h); button.props.onPress();
  assert.equal(h.writes.length, 0); assert.deepEqual(h.captures, []);
});


const inboxDraft = { id: '7b42b069-6921-4793-811f-3451856ce000', merchant: 'Wallet Shop', amountCents: 1234, currency: 'USD', capturedAt: '2026-10-18T10:00:00.000Z' };
test('pending Wallet drafts only save after confirmation and acknowledge durable records with the capture timestamp', async () => {
  const h = purchaseHarness(inboxDraft), button = h.save(h.render());
  assert.equal(h.writes.length, 0); assert.deepEqual(h.acknowledgements, []);
  await button.props.onPress();
  assert.equal(h.writes.length, 1); assert.equal(h.writes[0][0], `wallet-${inboxDraft.id}`); assert.equal(h.writes[0][5], inboxDraft.capturedAt);
  assert.deepEqual(h.acknowledgements, [inboxDraft.id]);
});
test('failed persistence retains the Wallet draft and retry does not duplicate the purchase', async () => {
  const h = purchaseHarness(inboxDraft); h.control.flushError = true;
  await h.save(h.render()).props.onPress();
  assert.equal(h.writes.length, 1); assert.deepEqual(h.acknowledgements, []);
  h.control.flushError = false;
  const retry = nodes(h.render()).find(node => node.type === 'Pressable' && text(node) === 'Remove saved draft');
  await retry.props.onPress();
  assert.equal(h.writes.length, 1); assert.deepEqual(h.acknowledgements, [inboxDraft.id]);
});
test('failed queue acknowledgement leaves the saved purchase deduplicated on retry', async () => {
  const h = purchaseHarness(inboxDraft); h.control.ackError = true;
  await h.save(h.render()).props.onPress();
  assert.equal(h.writes.length, 1); assert.deepEqual(h.acknowledgements, []);
  h.control.ackError = false;
  await nodes(h.render()).find(node => node.type === 'Pressable' && text(node) === 'Remove saved draft').props.onPress();
  assert.equal(h.writes.length, 1); assert.deepEqual(h.acknowledgements, [inboxDraft.id]);
});
for (const revoke of [h => { h.control.session.unlocked = false; }, h => { h.control.app.currentState = 'background'; }, h => { h.control.data.busy = true; }]) test('pending Wallet Save rechecks live authorization before writing or acknowledging', async () => {
  const h = purchaseHarness(inboxDraft), button = h.save(h.render()); revoke(h);
  await button.props.onPress(); assert.equal(h.writes.length, 0); assert.deepEqual(h.acknowledgements, []);
});

function gateTree({ locked = false, active = true, hidden = false, hydrated = true, os = 'ios' } = {}) {
  const jsx = (type, props) => ({ type, props }), sentinel = { type: 'ProtectedModal' };
  const privacy = () => ({ enabled: true, hidePreview: true, relockSeconds: 60 });
  privacy.persist = { hasHydrated: () => hydrated, onFinishHydration: () => () => {} };
  const imports = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react': { useEffect() {}, useRef: current => ({ current }), useState: v => [v, () => {}], useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    'react-native': { AppState: { currentState: active ? 'active' : 'background' }, Platform: { OS: os }, View: 'View', Modal: 'Modal', Text: 'Text', Pressable: 'Pressable' },
    'expo-router': { usePathname: () => '/import-purchase', router: {} },
    '@/theme': { useThemeRevision() {}, colors: {} }, '@/features/data/styles': { dataStyles: {} },
    './deviceStore': { useDevicePrivacy: privacy, usePrivacySession: () => ({ unlocked: !locked }) },
    './authenticate': { authenticateDevice() {}, deviceAuthenticationInProgress: () => false },
    './financialRoutes': { isFinancialRoute },
    '@/features/preferences/amountVisibility': { useAmountsHidden: () => hidden, useAmountVisibility: {} },
  };
  return { tree: load('src/features/privacy/PrivacyGate.tsx', imports).PrivacyGate({ children: sentinel }), sentinel };
}
test('privacy cover preserves navigation and draft state while hiding its content', () => {
  for (const options of [{ hydrated: false }]) {
    const { tree, sentinel } = gateTree(options); assert.equal(nodes(tree).includes(sentinel), false);
  }
  // Keep the navigator, picker callbacks and drafts alive under every cover.
  for (const options of [{}, { locked: true }, { hidden: true }, { active: false }, { os: 'web', locked: true }]) {
    const { tree, sentinel } = gateTree(options); assert.equal(nodes(tree).includes(sentinel), true);
  }
});

test('protected native modals close at their own boundary during lock/background/amount cover', () => {
  for (const options of [{ locked: true }, { active: false }, { hidden: true }, { hydrated: false }, {}]) {
    const jsx = (type, props) => ({ type, props });
    const privacy = selector => selector({ enabled: true });
    privacy.persist = { hasHydrated: () => options.hydrated !== false, onFinishHydration() {} };
    const imports = {
      'react/jsx-runtime': { jsx, jsxs: jsx },
      'react': { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
      'react-native': { AppState: { currentState: options.active === false ? 'background' : 'active' }, Modal: 'Modal', Platform: { OS: 'ios' } },
      'expo-router': { usePathname: () => '/bank-import' },
      '@/features/preferences/amountVisibility': { useAmountsHidden: () => options.hidden === true },
      './deviceStore': { useDevicePrivacy: privacy, usePrivacySession: selector => selector({ unlocked: options.locked !== true }) },
      './financialRoutes': { isFinancialRoute },
    };
    const component = load('src/features/privacy/PrivacyModal.tsx', imports).PrivacyModal;
    const blocked = options.locked || options.active === false || options.hidden || options.hydrated === false;
    assert.equal(component({ visible: true, children: 'Synthetic private balance' }).props.visible, !blocked);
    assert.equal(component({ visible: false }).props.visible, false);
  }
});

function loadPocket(saved) {
  const data = new Map(saved ? [['gasfinder-savings-pocket', JSON.stringify(saved)]] : []);
  const source = readFileSync(new URL('../src/stores/pocketStore.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const storage = { getItem: async key => data.get(key) ?? null, setItem: async (key, value) => { data.set(key, value); }, removeItem: async key => { data.delete(key); } };
  new Function('require', 'module', 'exports', compiled)(id => id === '@/lib/appStorage' ? { appStorage: storage } : id.startsWith('@/') ? require(`${root}src/${id.slice(2)}.ts`) : require(id), module, module.exports);
  return module.exports.usePocketStore;
}
test('real pocket hydration repairs old reserved aliases and preserves edit/undo/backup behavior', async () => {
  const store = loadPocket({ version: 15, state: { merchantAliases: Object.fromEntries([['__proto__', 'Old prototype'], ['constructor', 'Old constructor'], ['~gasfinder-alias:constructor', 'Literal prefix']]), addPurchase: null } });
  await store.persist.rehydrate();
  assert.equal(typeof store.getState().addPurchase, 'function');
  assert.equal(getMerchantAlias(store.getState().merchantAliases, 'constructor'), 'Old constructor');
  assert.equal(getMerchantAlias(store.getState().merchantAliases, '~gasfinder-alias:constructor'), 'Literal prefix');
  assert.equal(store.getState().addPurchase('shortcut-security', '__proto__', 1230), true);
  store.getState().editTransactionDetails('shortcut-security', { merchant: 'Edited merchant', category: 'Shopping', classification: 'ordinary', note: '' }, true);
  assert.equal(getMerchantAlias(store.getState().merchantAliases, '__proto__'), 'Edited merchant');
  assert.equal(store.getState().undoCorrection(store.getState().correctionHistory.at(-1).id), true);
  assert.equal(getMerchantAlias(store.getState().merchantAliases, '__proto__'), 'Old prototype');
  assert.doesNotThrow(() => validateJson(JSON.parse(JSON.stringify(store.getState()))));
});

function inboxBridgeHarness() {
  const control = { active: true, ready: true, privacyReady: true, enabled: true, unlocked: true, busy: false, recoveryError: '', reads: 0, version: 1, wait: null, clears: 0, clearError: false };
  const inbox = load('src/features/goals/purchaseInboxBridge.ts', {
    'expo': { requireOptionalNativeModule: () => ({ getVersion: () => control.version, listPending: async () => { control.reads++; if (control.wait) await control.wait; return [inboxDraft]; }, removePending: async () => true, clearPending: async () => { if (control.clearError) throw Error('Storage unavailable'); control.clears++; } }) },
    'react-native': { Platform: { OS: 'ios' }, AppState: { get currentState() { return control.active ? 'active' : 'background'; } } },
    'react': {},
    '@/features/data/operationStatus': { getDataStatus: () => control },
    '@/features/preferences/amountVisibility': { useAmountVisibility: { getState: () => ({ revealed: false }) } },
    '@/features/privacy/deviceStore': { useDevicePrivacy: { persist: { hasHydrated: () => control.privacyReady }, getState: () => ({ enabled: control.enabled }) }, usePrivacySession: { getState: () => ({ unlocked: control.unlocked }) } },
    '@/stores/pocketStore': { usePocketStore: { persist: { hasHydrated: () => control.ready } } },
    './purchaseInbox': { parsePendingWalletPurchases: values => values, pendingWalletId },
  });
  return { control, inbox };
}
test('native Wallet inbox never reads while private, backgrounded, unhydrated or during account operations', async () => {
  for (const revoke of [h => { h.control.unlocked = false; }, h => { h.control.active = false; }, h => { h.control.ready = false; }, h => { h.control.privacyReady = false; }, h => { h.control.busy = true; }, h => { h.control.recoveryError = 'Recovery'; }, h => { h.control.version = 2; }]) {
    const h = inboxBridgeHarness(); revoke(h);
    assert.deepEqual(await h.inbox.listPendingWalletPurchases(), []); assert.equal(h.control.reads, 0);
  }
});
test('native Wallet inbox discards an in-flight response if privacy locks before it resolves', async () => {
  const h = inboxBridgeHarness(); let release;
  h.control.wait = new Promise(resolve => { release = resolve; });
  const pending = h.inbox.listPendingWalletPurchases();
  assert.equal(h.control.reads, 1); h.control.unlocked = false; release();
  assert.deepEqual(await pending, []);
});
test('erase-all clears Wallet drafts during the data barrier without reading them and propagates failures', async () => {
  const h = inboxBridgeHarness(); h.control.busy = true;
  await h.inbox.clearPurchaseInbox();
  assert.equal(h.control.clears, 1); assert.equal(h.control.reads, 0);
  h.control.clearError = true;
  await assert.rejects(h.inbox.clearPurchaseInbox(), /Storage unavailable/);
});
