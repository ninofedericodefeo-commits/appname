import { readFile, writeFile } from 'node:fs/promises';
const policy = JSON.parse(await readFile(new URL('../src/features/privacy/policy.json', import.meta.url), 'utf8'));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${escape(policy.appName)} privacy policy — draft</title>
<style>:root{color-scheme:light dark;--paper:#f4f0e7;--ink:#122b2a;--muted:#52675d;--line:#7a8c7d}@media(prefers-color-scheme:dark){:root{--paper:#101e1a;--ink:#ecf3e9;--muted:#b1c4b7;--line:#81988b}}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:1rem/1.65 system-ui,sans-serif}main{max-width:48rem;margin:auto;padding:2rem 1.25rem 4rem;overflow-wrap:anywhere}h1{font-size:2rem;line-height:1.2}h2{font-size:1.25rem;line-height:1.4;margin-top:2rem}.status{border:1px solid var(--line);padding:.75rem 1rem;border-radius:.5rem}.date{color:var(--muted)}</style></head>
<body><main><h1>${escape(policy.appName)} privacy policy</h1><p class="status">${escape(policy.status)}</p><p class="date">Updated ${escape(policy.updated)}</p><p>${escape(policy.intro)}</p>
${policy.sections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('\n')}</section>`).join('\n')}
</main></body></html>\n`;
await writeFile(new URL('../public/privacy.html', import.meta.url), html);
console.log('Built public/privacy.html from the in-app draft policy. Not published.');
