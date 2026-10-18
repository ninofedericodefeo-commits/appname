import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { detectInstalledApps } from '../src/features/subscriptions/installedAppLogic.ts';

const catalog = JSON.parse(readFileSync(new URL('../src/features/subscriptions/appCatalog.json', import.meta.url), 'utf8'));
const schemes = catalog.map(app => app.url.split(':')[0]);

test('Only installed, launchable apps appear, alphabetically, without querying websites', async () => {
  const seen = [];
  const result = await detectInstalledApps('ios', catalog, schemes, async url => { seen.push(url); return ['spotify:', 'youtube://'].includes(url); });
  assert.equal(result.status, 'ready');
  assert.deepEqual(result.apps.map(app => app.name), ['Spotify', 'YouTube']);
  assert.equal(seen.some(url => url.startsWith('https:')), false);
  assert.equal((await detectInstalledApps('android', catalog, schemes, async () => false)).apps.length, 0);
});

test('Browser and stale native builds cannot pretend that apps are installed or missing', async () => {
  let queries = 0;
  const open = async () => { queries++; return true; };
  assert.deepEqual(await detectInstalledApps('web', catalog, schemes, open), { status: 'web', apps: [] });
  assert.deepEqual(await detectInstalledApps('ios', catalog, null, open), { status: 'update-required', apps: [] });
  assert.equal((await detectInstalledApps('ios', catalog, schemes.slice(1), open)).status, 'update-required');
  assert.equal(queries, 0);
});

test('A rejected app query preserves other installed apps and reports a partial failure', async () => {
  const result = await detectInstalledApps('android', catalog, schemes, async url => { if (url === 'youtube://') throw Error('Query failed'); return url === 'spotify:'; });
  assert.equal(result.status, 'error');
  assert.deepEqual(result.apps.map(app => app.name), ['Spotify']);
});

test('App queries are unique custom schemes within iPhone limits', () => {
  assert.ok(schemes.length <= 50);
  assert.equal(new Set(schemes).size, schemes.length);
  assert.equal(schemes.some(scheme => ['http', 'https'].includes(scheme)), false);
});

test('Android launcher inventory includes uncatalogued apps, filters malformed entries and deduplicates packages', async () => {
  const { launchableSubscriptionApps } = await import('../src/features/subscriptions/installedAppLogic.ts');
  const result = launchableSubscriptionApps([
    { name: ' My local app ', packageName: 'org.example.local' },
    { name: 'Amazon', packageName: 'com.amazon.mShop.android.shopping' },
    { name: 'My local app', packageName: 'org.example.local' },
    { name: 'Unsafe', packageName: 'org.example/path?intent=x' },
    { name: 'Bad\nlabel', packageName: 'org.example.bad' },
    null,
  ]);
  assert.deepEqual(result, [
    { name: 'Amazon', url: 'gasfinder-app://com.amazon.mShop.android.shopping' },
    { name: 'My local app', url: 'gasfinder-app://org.example.local' },
  ]);
  assert.throws(() => launchableSubscriptionApps(null), /Invalid/);
});
