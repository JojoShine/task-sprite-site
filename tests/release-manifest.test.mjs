import test from 'node:test';
import assert from 'node:assert/strict';
const asset = {platform:'macos',arch:'aarch64',filename:'Task-Sprite-0.2.0-macos-aarch64.dmg',url:'https://custom-wechat-app.oss-cn-hangzhou.aliyuncs.com/task-sprite/releases/0.2.0/Task-Sprite-0.2.0-macos-aarch64.dmg',size:2048,sha256:'a'.repeat(64)};
const manifest = () => ({schemaVersion:1,version:'0.2.0',publishedAt:'2026-11-15T05:00:00Z',notes:'工作时段计时与授权装扮',assets:[{...asset}]});
async function api(){try{return await import('../release-manifest.js')}catch{assert.fail('Release manifest validation is not implemented')}}
test('accepts verified release metadata and selects only available platform',async()=>{const {validateManifest,downloadFor}=await api();const m=validateManifest(manifest());assert.equal(m.version,'0.2.0');assert.equal(downloadFor(m,'macos').sha256,asset.sha256);assert.equal(downloadFor(m,'windows'),undefined)});
test('rejects unsafe URLs, missing checksum and invalid file size',async()=>{const {validateManifest}=await api();for(const change of [{url:'javascript:alert(1)'},{url:'http://example.com/app.dmg'},{url:'https://user:pass@example.com/app.dmg'},{sha256:'bad'},{size:0},{size:Infinity},{filename:'../app.dmg'}]){const m=manifest();m.assets[0]={...asset,...change};assert.throws(()=>validateManifest(m))}});
test('rejects duplicate platform architecture and invalid version or timestamp',async()=>{const {validateManifest}=await api();const m=manifest();m.assets.push({...asset});assert.throws(()=>validateManifest(m));assert.throws(()=>validateManifest({...manifest(),version:'latest'}));assert.throws(()=>validateManifest({...manifest(),publishedAt:'yesterday'}));assert.throws(()=>validateManifest({...manifest(),schemaVersion:2}))});
test('handles empty platform list without advertising placeholder downloads',async()=>{const {validateManifest,downloadFor}=await api();const m=validateManifest({...manifest(),assets:[]});assert.equal(downloadFor(m,'macos'),undefined)});
test('selects Intel and Apple Silicon independently',async()=>{const {validateManifest,downloadFor}=await api();const m=manifest();m.assets.push({...asset,arch:'x86_64',filename:asset.filename.replace('aarch64','x86_64'),url:asset.url.replace('aarch64','x86_64')});validateManifest(m);assert.equal(downloadFor(m,'macos','x86_64').arch,'x86_64');assert.equal(downloadFor(m,'macos','aarch64').arch,'aarch64')});

test('selects the default Windows package and the offline fallback independently', async () => {
  const {validateManifest, downloadFor} = await api();
  const online = {...asset, platform:'windows', arch:'x86_64', filename:'windows.exe', url:'https://example.com/windows.exe'};
  const offline = {...online, variant:'offline', filename:'windows-offline.exe', url:'https://example.com/windows-offline.exe'};
  const release = validateManifest({...manifest(), assets:[offline, online]});
  assert.equal(downloadFor(release, 'windows', 'x86_64'), online);
  assert.equal(downloadFor(release, 'windows', 'x86_64', 'offline'), offline);
  assert.equal(downloadFor(validateManifest({...manifest(), assets:[online]}), 'windows'), online);
  assert.throws(() => validateManifest({...release, assets:[online, offline, offline]}));
  assert.throws(() => validateManifest({...manifest(), assets:[{...asset, variant:'offline'}]}));
});
