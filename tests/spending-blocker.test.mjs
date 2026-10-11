import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';
import pause from '../extensions/spending-pause/pause.js';

const { shoppingDomain, defaultPause, readPause, changePause, blockingRules, pauseController } = pause;
const startTime = 1_800_000_000_000;

function browserMemory() {
  let saved = {}, current = [];
  const calls = [];
  const memory = { failRules: false, failStorage: false, calls,
    get saved() { return structuredClone(saved); }, get rules() { return structuredClone(current); } };
  memory.api = {
    storage: { local: {
      get: async () => structuredClone(saved),
      set: async value => { calls.push('save'); if (memory.failStorage) throw Error('Disk full'); saved = structuredClone(value); },
    } },
    declarativeNetRequest: {
      getDynamicRules: async () => structuredClone(current),
      updateDynamicRules: async ({ removeRuleIds, addRules }) => {
        calls.push('rules'); if (memory.failRules) throw Error('Safari rejected the rules');
        current = [...current.filter(rule => !removeRuleIds.includes(rule.id)), ...structuredClone(addRules)];
      },
    },
  };
  return memory;
}

test('Shopping addresses normalize safely without storing paths, logins or tracking parameters', () => {
  for (const [input, output] of [
    ['https://www.amazon.com/cart?secret=ignored', 'amazon.com'], ['m.ebay.com/item/12', 'ebay.com'],
    ['https://a.co/xyz', 'amazon.com'], [' STORE.example/path ', 'store.example'], ['https://amazon.com.evil.example', 'amazon.com.evil.example'],
  ]) assert.equal(shoppingDomain(input), output);
  for (const input of ['', null, 'localhost', '127.0.0.1', 'https://[::1]', 'https://user:password@store.com',
    'https://store.com:8080', '*.amazon.com', 'https://store.com\\@other.com', 'ftp://store.com', 'store .com', 'store.com.']) {
    assert.throws(() => shoppingDomain(input), Error, String(input));
  }
});

test('Pause locks the chosen duration and websites; repeated start and reload cannot shorten the wait', () => {
  const configured = changePause(defaultPause(), { type: 'configure', delayHours: 48, sites: ['a.co', 'amazon.com', 'store.example'] }, startTime);
  assert.deepEqual(configured.sites, ['amazon.com', 'store.example']);
  const active = changePause(configured, { type: 'start' }, startTime);
  assert.equal(active.reviewAt, startTime + 48 * 3_600_000);
  assert.deepEqual(readPause(JSON.parse(JSON.stringify(active))), active);
  assert.equal(changePause(active, { type: 'start' }, startTime + 1000), active);
  assert.throws(() => changePause(active, { type: 'configure', delayHours: 24, sites: [] }, startTime + 1000), /Finish/);
  assert.throws(() => changePause(active, { type: 'resume' }, active.reviewAt - 1), /still running/);
  assert.equal(blockingRules(active).length, 3); // Due pauses stay blocked until an explicit resume.
  const resumed = changePause(active, { type: 'resume' }, active.reviewAt);
  assert.equal(resumed.enabled, false); assert.equal(resumed.pausedAt, null); assert.deepEqual(blockingRules(resumed), []);
});

test('Empty selections, excessive websites, unknown commands and corrupt storage cannot create a pause', () => {
  assert.throws(() => changePause({ ...defaultPause(), sites: [] }, { type: 'start' }, startTime), /at least one/);
  for (const command of [null, {}, { type: 'configure', delayHours: 1, sites: ['store.com'] },
    { type: 'configure', delayHours: 24, sites: Array(31).fill('store.com') }]) {
    assert.throws(() => changePause(defaultPause(), command, startTime), Error);
  }
  const active = changePause(defaultPause(), { type: 'start' }, startTime);
  for (const raw of [null, {}, { ...active, sites: ['bad input'] }, { ...active, reviewAt: startTime },
    { ...active, pausedAt: 'yesterday' }, { ...active, sites: [] }]) assert.equal(readPause(raw).enabled, false);
});

test('Checkout rules block payment routes while allowing browsing, carts, unrelated hosts and query text', () => {
  const active = changePause(defaultPause(), { type: 'start' }, startTime);
  const rules = blockingRules(active);
  const blocked = input => {
    const url = new URL(input);
    return rules.some(rule => rule.condition.requestDomains.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) && new RegExp(rule.condition.regexFilter, 'i').test(input));
  };
  for (const url of ['https://www.amazon.com/gp/buy/spc/handlers/display.html', 'https://www.amazon.com/buy/checkout',
    'https://www.ebay.com/ck/start', 'https://pay.ebay.com/', 'https://www.ebay.com/api/checkout/submit', 'https://www.amazon.com/payment']) assert.equal(blocked(url), true, url);
  for (const url of ['https://www.amazon.com/dp/123', 'https://www.amazon.com/gp/cart/view.html', 'https://www.ebay.com/itm/123',
    'https://a.co/product', 'https://www.amazon.com/search?q=checkout', 'https://www.ebay.com/checkout-tips', 'https://amazon.com.evil.example/checkout',
    'https://bank.example/payments', 'https://paypal.com/checkout']) assert.equal(blocked(url), false, url);
  assert.equal(new Set(rules.map(rule => rule.id)).size, rules.length);
  for (const rule of rules) {
    assert.equal(rule.action.type, 'block');
    assert.deepEqual(rule.condition.resourceTypes, ['main_frame', 'sub_frame', 'xmlhttprequest']);
  }
  const manifest = JSON.parse(readFileSync(new URL('../extensions/spending-pause/manifest.json', import.meta.url)));
  assert.deepEqual(manifest.permissions, ['declarativeNetRequest', 'storage']);
  assert.equal(manifest.host_permissions, undefined); assert.equal(manifest.content_scripts, undefined);
});

test('Controller serializes simultaneous taps and restores persisted blocking after background restart', async () => {
  const memory = browserMemory();
  let now = startTime;
  const action = pauseController(memory.api, () => now);
  const [first, repeated] = await Promise.all([action({ type: 'start' }), action({ type: 'start' })]);
  assert.deepEqual(first, repeated); assert.equal(memory.rules.length, 4);
  assert.deepEqual(memory.calls, ['rules', 'save', 'rules', 'save']);
  now = first.reviewAt;
  const restarted = pauseController(memory.api, () => now);
  assert.equal((await restarted({ type: 'get' })).enabled, true); assert.equal(memory.rules.length, 4);
  assert.equal((await restarted({ type: 'resume' })).enabled, false); assert.equal(memory.rules.length, 0);
  assert.equal(memory.saved.shoppingPause.enabled, false);
});

test('A failed Safari rule update or storage write never reports a successful pause; queue recovers', async () => {
  const memory = browserMemory(), action = pauseController(memory.api, () => startTime);
  memory.failRules = true;
  await assert.rejects(action({ type: 'start' }), /rejected/);
  assert.deepEqual(memory.saved, {}); assert.equal(memory.rules.length, 0);
  memory.failRules = false; memory.failStorage = true;
  await assert.rejects(action({ type: 'start' }), /save/);
  assert.deepEqual(memory.saved, {}); assert.equal(memory.rules.length, 0);
  memory.failStorage = false;
  const active = await action({ type: 'start' });
  memory.failStorage = true;
  const later = pauseController(memory.api, () => active.reviewAt);
  await assert.rejects(later({ type: 'resume' }), /save/);
  assert.equal(memory.saved.shoppingPause.enabled, true); assert.equal(memory.rules.length, 4);
  await assert.rejects(action(null), /not supported/);
  assert.equal((await action({ type: 'get' })).enabled, true);
});

for (const namespace of ['browser', 'chrome']) test(`Actual ${namespace} classic worker registers callback messages and rejects unrelated senders`, async () => {
  const memory = browserMemory(), listeners = {};
  memory.api.runtime = { id: 'test-extension', onMessage: { addListener: callback => { listeners.message = callback; } },
    onStartup: { addListener: callback => { listeners.startup = callback; } }, onInstalled: { addListener: callback => { listeners.install = callback; } } };
  const context = createContext({ [namespace]: memory.api, URL });
  context.importScripts = (...files) => files.forEach(file => runInContext(readFileSync(new URL(`../extensions/spending-pause/${file}`, import.meta.url), 'utf8'), context));
  runInContext(readFileSync(new URL('../extensions/spending-pause/worker.js', import.meta.url), 'utf8'), context);
  const message = command => ({ kind: 'shopping-pause', command });
  assert.equal(listeners.message(message({ type: 'start' }), { id: 'other-extension' }), undefined);
  const invoke = command => new Promise(resolve => {
    assert.equal(listeners.message(message(command), { id: memory.api.runtime.id }, resolve), true);
  });
  const active = await invoke({ type: 'start' });
  assert.equal(active.state.enabled, true); assert.equal(memory.rules.length, 4);
  const rejected = await invoke({ type: 'resume' });
  assert.match(rejected.error, /still running/);
  assert.equal(typeof listeners.startup, 'function'); assert.equal(typeof listeners.install, 'function');
});
