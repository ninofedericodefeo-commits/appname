import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const xcode = require('xcode');
const { addIntent, writeIntent } = require('../plugins/withPurchaseInbox.js');
const relativeSource = 'PurchaseInboxIntent/QueueWalletPurchaseIntent.swift';
function projectFixture() {
  const project = xcode.project('Fixture.xcodeproj/project.pbxproj');
  project.hash = { project: { archiveVersion: 1, objectVersion: 54, rootObject: 'PROJECT', objects: {
    PBXProject: { PROJECT: { isa: 'PBXProject', mainGroup: 'ROOT', targets: [{ value: 'APP' }] } },
    PBXNativeTarget: { APP: { isa: 'PBXNativeTarget', name: 'Tally', buildPhases: [{ value: 'SOURCES', comment: 'Sources' }] } },
    PBXGroup: { ROOT: { isa: 'PBXGroup', children: [], sourceTree: '"<group>"' } },
    PBXBuildFile: {}, PBXFileReference: {},
    PBXSourcesBuildPhase: { SOURCES: { isa: 'PBXSourcesBuildPhase', files: [] }, SOURCES_comment: 'Sources' },
  } } };
  return project;
}
test('Wallet intent source resolves from the iOS root with no undefined group path', () => {
  const project = projectFixture();
  addIntent(project);
  const group = project.getPBXGroupByKey(project.findPBXGroupKey({ name: 'PurchaseInboxIntent' }));
  assert.equal(Object.hasOwn(group, 'path'), false);
  assert.equal(project.pbxFileReferenceSection()[group.children[0].value].path.replaceAll('"', ''), relativeSource);
  const output = project.writeSync();
  assert.doesNotMatch(output, /path = undefined;/);
  assert.match(output, /path = "?PurchaseInboxIntent\/QueueWalletPurchaseIntent.swift"?;/);
});
test('prebuild repairs previously generated bad groups without duplicating the source', () => {
  const project = projectFixture(); addIntent(project);
  const group = project.getPBXGroupByKey(project.findPBXGroupKey({ name: 'PurchaseInboxIntent' }));
  group.path = 'undefined';
  addIntent(project); addIntent(project);
  assert.equal(Object.hasOwn(group, 'path'), false);
  assert.equal(group.children.length, 1);
  assert.equal(project.hash.project.objects.PBXSourcesBuildPhase.SOURCES.files.length, 1);
  assert.doesNotMatch(project.writeSync(), /path = undefined;/);
});
test('the source copied by prebuild matches the registered Xcode path', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'tally-intent-plugin-'));
  try {
    const repository = path.resolve(import.meta.dirname, '..');
    writeIntent(repository, root);
    assert.equal(readFileSync(path.join(root, relativeSource), 'utf8'), readFileSync(path.join(repository, 'modules/purchase-inbox/app-target/QueueWalletPurchaseIntent.swift'), 'utf8'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
