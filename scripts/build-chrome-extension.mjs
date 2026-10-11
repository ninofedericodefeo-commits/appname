import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve(process.argv[2] ?? 'dist/chrome-extension');
if (output === resolve('.') || output === resolve('extensions/spending-pause')) throw Error('Choose a separate output folder.');
await mkdir(output, { recursive: true });
await cp('extensions/spending-pause', output, { recursive: true });
const manifest = JSON.parse(await readFile(`${output}/manifest.json`, 'utf8'));
delete manifest.browser_specific_settings;
manifest.minimum_chrome_version = '111';
await writeFile(`${output}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n');
await rm(`${output}/icon.svg`, { force: true });
await rm(`${output}/icon.png`, { force: true }); // Remove the former full-size generated icon on rebuild.
const popup = await readFile(`${output}/popup.html`, 'utf8');
await writeFile(`${output}/popup.html`, popup.replace('<a href="gasfinder://spending">Open GasFinder</a>', '<p class="note">This companion keeps its pause in this browser.</p>'));
console.log(`Chrome extension built: ${output}\nIn desktop Chrome: Extensions → Manage extensions → Developer mode → Load unpacked → choose this folder.`);
