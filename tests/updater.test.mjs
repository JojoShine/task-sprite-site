import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {verifyUpdaterSignature,makeManifest,publishRelease,updaterManifest} from '../scripts/publish-release.mjs';
function fixture(bytes) {
  const {publicKey,privateKey} = generateKeyPairSync('ed25519');
  const id = Buffer.from('0102030405060708','hex');
  const key = Buffer.concat([Buffer.from('Ed'),id,publicKey.export({format:'der',type:'spki'}).subarray(-32)]);
  const sig = sign(null,createHash('blake2b512').update(bytes).digest(),privateKey);
  const comment = 'timestamp:1\tversion:0.2.2';
  return {
    publicKey:Buffer.from('untrusted comment: public key\n'+key.toString('base64')+'\n').toString('base64'),
    signature:Buffer.from('untrusted comment: signature\n'+Buffer.concat([Buffer.from('ED'),id,sig]).toString('base64')+'\ntrusted comment: '+comment+'\n'+sign(null,Buffer.concat([sig,Buffer.from(comment)]),privateKey).toString('base64')+'\n').toString('base64'),
  };
}
test('checks payload and trusted comment against the pinned updater key',()=>{
  const bytes=Buffer.from('signed release'),key=fixture(bytes);
  verifyUpdaterSignature(bytes,key.signature,key.publicKey);
  assert.throws(()=>verifyUpdaterSignature(Buffer.from('tampered'),key.signature,key.publicKey));
  assert.throws(()=>verifyUpdaterSignature(bytes,key.signature,fixture(bytes).publicKey));
  const changed=Buffer.from(Buffer.from(key.signature,'base64').toString().replace('version:0.2.2','version:9.9.9')).toString('base64');
  assert.throws(()=>verifyUpdaterSignature(bytes,changed,key.publicKey));
});
test('publishes signed updater metadata last and rejects packages changed after signing',async()=>{
  const d=mkdtempSync(join(tmpdir(),'sprite-update-'));
  try {
    const bytes=Buffer.from('signed release'),key=fixture(bytes),filename='Task-Sprite-0.2.2-windows-x86_64.exe';
    writeFileSync(join(d,filename),bytes);writeFileSync(join(d,filename+'.sig'),key.signature);
    const input={version:'0.2.2',notes:'update',updaterPublicKey:key.publicKey,assets:[{platform:'windows',arch:'x86_64',filename}],updates:[{platform:'windows',arch:'x86_64',filename}]};
    const manifest=makeManifest(input,d,'https://bucket.oss-cn-hangzhou.aliyuncs.com/');
    assert.equal(updaterManifest(manifest).platforms['windows-x86_64'].signature,key.signature);
    const objects=new Map(),writes=[],reads=[];
    const client={async head(k){if(!objects.has(k))throw{status:404};},async get(k){reads.push(k);return{content:objects.get(k)};},async put(k,v){writes.push(k);objects.set(k,Buffer.from(v));}};
    await publishRelease(client,manifest,d);
    assert.equal(writes.at(-1),'task-sprite/releases/updater.json');
    assert.equal(reads.filter(key=>key.endsWith('/'+filename)).length,1);
    writeFileSync(join(d,filename),'tampered');
    assert.throws(()=>makeManifest(input,d,'https://example.com/'));
    await assert.rejects(publishRelease(client,manifest,d));
  }finally{rmSync(d,{recursive:true,force:true});}
});
