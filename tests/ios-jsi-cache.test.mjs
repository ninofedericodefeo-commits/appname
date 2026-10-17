import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/check-ios-jsi-cache.sh');
function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'gasfinder-jsi-test-')), bin=join(root,'bin'), pkg=join(root,'package with spaces');
  t.after(()=>rmSync(root,{recursive:true,force:true})); mkdirSync(bin);
  writeFileSync(join(bin,'xcodebuild'),'#!/bin/bash\nprintf "%s\\n" "$GASFINDER_TEST_XCODE"\n',{mode:0o755});
  writeFileSync(join(bin,'xcrun'),`#!/bin/bash
case "$*" in
  'swiftc --version') echo 'Swift same-compiler' ;;
  *--show-sdk-path) echo '/mock/iPhoneOS.sdk' ;;
  *--show-sdk-build-version) if [[ "\${GASFINDER_TEST_FAIL:-}" == 1 ]]; then exit 1; fi; echo "$GASFINDER_TEST_SDK" ;;
  *) exit 2 ;;
esac
`,{mode:0o755});
  const stamp=platform=>join(pkg,'Products/ExpoModulesJSI.xcframework',platform==='iphoneos'?'ios-arm64':'ios-arm64_x86_64-simulator','.build-hash');
  const seed=platform=>{ const file=stamp(platform); mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,'upstream-cache'); };
  const run=(platform='iphoneos',extra={})=>spawnSync('bash',[script,pkg,platform],{encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,SDKROOT:'',GASFINDER_TEST_XCODE:'Xcode 27.0\nBuild 27A266a',GASFINDER_TEST_SDK:'24A335',...extra}});
  return {root,pkg,stamp,seed,run};
}
test('first integration invalidates only the selected generated slice, then retains the upstream fast path',t=>{
  const f=fixture(t); f.seed('iphoneos'); f.seed('iphonesimulator');
  assert.equal(f.run().status,0); assert.equal(existsSync(f.stamp('iphoneos')),false); assert.equal(existsSync(f.stamp('iphonesimulator')),true);
  f.seed('iphoneos'); assert.equal(f.run().status,0); assert.equal(existsSync(f.stamp('iphoneos')),true);
});
test('SDK/Xcode changes invalidate the device slice even when the Swift version does not change',t=>{
  const f=fixture(t); assert.equal(f.run().status,0); f.seed('iphoneos');
  assert.equal(f.run('iphoneos',{GASFINDER_TEST_SDK:'24A94232'}).status,0); assert.equal(existsSync(f.stamp('iphoneos')),false);
  f.seed('iphoneos'); assert.equal(f.run('iphoneos',{GASFINDER_TEST_SDK:'24A94232',GASFINDER_TEST_XCODE:'Xcode 27.1\nBuild 27A9275'}).status,0); assert.equal(existsSync(f.stamp('iphoneos')),false);
});
test('a failed SDK lookup cannot bless an old slice or replace its recorded fingerprint',t=>{
  const f=fixture(t); assert.equal(f.run().status,0); f.seed('iphoneos');
  const marker=join(f.pkg,'Products/.gasfinder-ios-arm64-sdk'), before=readFileSync(marker,'utf8');
  assert.notEqual(f.run('iphoneos',{GASFINDER_TEST_FAIL:'1'}).status,0);
  assert.equal(readFileSync(marker,'utf8'),before); assert.equal(existsSync(f.stamp('iphoneos')),true);
});
test('simulator invalidation is independent and unrelated platforms are left alone',t=>{
  const f=fixture(t); f.seed('iphoneos'); f.seed('iphonesimulator');
  assert.equal(f.run('iphonesimulator').status,0); assert.equal(existsSync(f.stamp('iphoneos')),true); assert.equal(existsSync(f.stamp('iphonesimulator')),false);
  assert.equal(f.run('macosx').status,0); assert.equal(existsSync(f.stamp('iphoneos')),true);
});
