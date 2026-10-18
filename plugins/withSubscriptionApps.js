const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');
const catalog = require('../src/features/subscriptions/appCatalog.json');
const schemes = [...new Set(catalog.map(app => app.url.split(':')[0]))];

module.exports = config => {
  config = withInfoPlist(config, mod => {
    const merged = [...new Set([...(mod.modResults.LSApplicationQueriesSchemes ?? []), ...schemes])];
    if (merged.length > 50) throw Error('iOS supports at most 50 app query schemes.');
    mod.modResults.LSApplicationQueriesSchemes = merged;
    return mod;
  });
  return withAndroidManifest(config, mod => {
    const manifest = mod.modResults.manifest;
    manifest.queries ??= [];
    const query = manifest.queries[0] ?? (manifest.queries[0] = {});
    query.intent ??= [];
    for (const scheme of schemes) {
      if (!query.intent.some(intent => intent.data?.some(data => data.$?.['android:scheme'] === scheme))) {
        query.intent.push({ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': scheme } }] });
      }
    }
    if (!query.intent.some(intent => intent.action?.some(action => action.$?.['android:name'] === 'android.intent.action.MAIN') && intent.category?.some(category => category.$?.['android:name'] === 'android.intent.category.LAUNCHER'))) {
      query.intent.push({ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }], category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }] });
    }
    const app = manifest.application[0];
    app['meta-data'] ??= [];
    app['meta-data'] = app['meta-data'].filter(item => item.$?.['android:name'] !== 'gasfinder.subscriptionAppSchemes');
    app['meta-data'].push({ $: { 'android:name': 'gasfinder.subscriptionAppSchemes', 'android:value': schemes.join(',') } });
    return mod;
  });
};
