import assert from 'node:assert/strict';
import test from 'node:test';
import { openSubscriptionApp, subscriptionApp, subscriptionAppURL, SUBSCRIPTION_APPS } from '../src/features/subscriptions/providerApps.ts';

test('Associated apps accept supported links and reject dangerous schemes, invalid URLs and credentials', () => {
  for (const app of SUBSCRIPTION_APPS) assert.deepEqual(subscriptionApp(app), app);
  assert.equal(subscriptionAppURL(' HTTPS://provider.example/account '), 'https://provider.example/account');
  assert.deepEqual(subscriptionApp({ name: ' My provider ', url: 'myprovider://settings', fallbackUrl: '' }), { name: 'My provider', url: 'myprovider://settings' });
  for (const url of ['javascript:alert(1)', 'data:text/plain,Hello', 'file:///private/file', 'http://provider.example', 'tel:123', 'intent://provider',
    'gasfinder://subscriptions', 'https://user:password@provider.example', 'https://provider.example:8080', 'https://localhost', 'bad link']) assert.throws(() => subscriptionAppURL(url), Error);
  assert.throws(() => subscriptionApp({ name: '', url: 'spotify:' }), /name/);
  assert.throws(() => subscriptionApp({ name: 'App', url: 'spotify:', fallbackUrl: 'otherapp:' }), Error);
});

test('Cancellation opens the associated app on a phone and its website on web', async () => {
  const calls = [], app = SUBSCRIPTION_APPS[0];
  const open = async url => { calls.push(url); return true; };
  const native = await openSubscriptionApp(app, open, 'ios');
  assert.equal(native.opened, true); assert.equal(calls[0], 'spotify:'); assert.match(native.message, /still active/);
  const web = await openSubscriptionApp(app, open, 'web');
  assert.equal(web.opened, true); assert.equal(calls[1], app.fallbackUrl);
});

test('Unavailable provider apps fall back to HTTPS and failed links remain a cancellation plan', async () => {
  const calls = [], app = SUBSCRIPTION_APPS[0];
  const result = await openSubscriptionApp(app, async url => { calls.push(url); if (url === app.url) throw Error('App unavailable'); return true; }, 'android');
  assert.deepEqual(calls, [app.url, app.fallbackUrl]); assert.match(result.message, /website/);
  const failed = await openSubscriptionApp(app, async () => false, 'ios');
  assert.equal(failed.opened, false); assert.match(failed.message, /plan saved/);
  assert.equal(failed.message.includes(app.url), false);
  let attempts = 0;
  for (const input of [undefined, { name: 'Bad', url: 'javascript:alert(1)' }]) {
    assert.equal((await openSubscriptionApp(input, async () => { attempts++; }, 'ios')).opened, false);
  }
  assert.equal(attempts, 0);
});
