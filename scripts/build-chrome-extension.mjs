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
await writeFile(`${output}/popup.html`, popup.replace('<a href="gasfinder://spending">Open Savemage</a>', '<p class="note">This companion keeps its pause in this browser.</p>'));
console.log(`Chrome extension built: ${output}\nIn desktop Chrome: Extensions → Manage extensions → Developer mode → Load unpacked → choose this folder.`);

// Reproducible private handoff; no Chrome Web Store or account is required.
const { readdir } = await import('node:fs/promises');
const { zipSync, strToU8 } = await import('fflate');
const files = {};
for (const name of (await readdir(output)).sort()) if (!name.endsWith('.zip')) files[`GasFinder-Spending-Pause/${name}`] = new Uint8Array(await readFile(`${output}/${name}`));
files['GasFinder-Spending-Pause/INSTALL.txt'] = strToU8(`Savemage Spending Pause ${manifest.version}\nUnzip this package. In desktop Chrome open chrome://extensions, enable Developer mode, select Load unpacked and choose this folder. Pin the extension and open its controls to start a pause.\nUpdate: replace this folder with the new package and press Reload on chrome://extensions. The same installation retains its settings. Removing the extension deletes its browser-local pause.\nThis package is for desktop Chrome. It cannot install an extension into iPhone Chrome. Each browser keeps its own pause.\nTemporary access allows one selected shop for 10 minutes; blocking resumes using an extension alarm. Browser suspension or disabled extensions can delay enforcement.\n`);
await mkdir('public/downloads', { recursive: true });
await writeFile('public/downloads/GasFinder-Chrome.zip', zipSync(files));
await writeFile('public/downloads/chrome-version.json', JSON.stringify({ version: manifest.version }) + '\n');
console.log(`Downloadable ZIP: public/downloads/GasFinder-Chrome.zip (${manifest.version})`);
