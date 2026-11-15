import test from 'node:test';import assert from 'node:assert/strict';import{mkdtempSync,writeFileSync,rmSync}from'node:fs';import{tmpdir}from'node:os';import{join}from'node:path';
async function api(){try{return await import('../scripts/publish-release.mjs')}catch{assert.fail('Verified OSS publishing not implemented')}}
const input=()=>({version:'0.2.0',notes:'公开测试版',assets:[{platform:'windows',arch:'x86_64',filename:'Task-Sprite-0.2.0-windows-x86_64.exe'}]});
test('derives checksum/size and uploads latest only after immutable assets and manifest verify',async()=>{const {makeManifest,publishRelease}=await api();const d=mkdtempSync(join(tmpdir(),'sprite-release-'));try{writeFileSync(join(d,input().assets[0].filename),'fixture');const m=makeManifest(input(),d,'https://bucket.oss-cn-hangzhou.aliyuncs.com');assert.equal(m.assets[0].size,7);assert.match(m.assets[0].sha256,/^[a-f0-9]{64}$/);const objects=new Map(),writes=[];const client={async head(k){if(!objects.has(k))throw{status:404};return{res:{headers:{'content-length':String(objects.get(k).length)}}}},async get(k){if(!objects.has(k))throw{status:404};return{content:objects.get(k)}},async put(k,v){writes.push(k);objects.set(k,Buffer.from(v));}};await publishRelease(client,m,d);assert.equal(writes.at(-1),'task-sprite/releases/latest.json');assert.ok(writes.indexOf('task-sprite/releases/0.2.0/manifest.json')<writes.length-1);const first=writes.length;await publishRelease(client,m,d);assert.deepEqual(writes.slice(first),['task-sprite/releases/latest.json']);}finally{rmSync(d,{recursive:true,force:true})}});
test('failed upload never publishes a partial latest release',async()=>{const {makeManifest,publishRelease}=await api();const d=mkdtempSync(join(tmpdir(),'sprite-release-'));try{writeFileSync(join(d,input().assets[0].filename),'fixture');const m=makeManifest(input(),d,'https://bucket.oss-cn-hangzhou.aliyuncs.com'),writes=[];const c={async head(){throw{status:404}},async get(){throw{status:404}},async put(k){writes.push(k);throw Error('network unavailable')}};await assert.rejects(publishRelease(c,m,d));assert.ok(!writes.includes('task-sprite/releases/latest.json'))}finally{rmSync(d,{recursive:true,force:true})}});
test('archives privately while preserving a stable public download origin',async()=>{
 const {makeManifest,publishRelease}=await api(),d=mkdtempSync(join(tmpdir(),'sprite-private-'));
 try{
  writeFileSync(join(d,input().assets[0].filename),'fixture');
  const m=makeManifest(input(),d,'https://tbtparent.me/'),objects=new Map(),writes=[];
  assert.equal(new URL(m.assets[0].url).origin,'https://tbtparent.me');
  const client={async head(k){if(!objects.has(k))throw{status:404}},async get(k){return{content:objects.get(k)}},async put(k,v,options){assert.equal(options.headers['x-oss-object-acl'],undefined);objects.set(k,Buffer.from(v));writes.push(k)}};
  await publishRelease(client,m,d,{publicRead:false});
  assert.equal(writes.at(-1),'task-sprite/releases/latest.json');
 }finally{rmSync(d,{recursive:true,force:true})}
});
