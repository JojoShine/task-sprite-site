import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { validateManifest } from '../release-manifest.js';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function verifyUpdaterSignature(bytes, signature, publicKey) {
  const key = Buffer.from(Buffer.from(publicKey,'base64').toString().trim().split('\n')[1] || '', 'base64');
  const lines = Buffer.from(signature,'base64').toString().trim().split('\n');
  const sig = Buffer.from(lines[1] || '', 'base64');
  if (key.length !== 42 || sig.length !== 74 || !key.subarray(2,10).equals(sig.subarray(2,10)) || !lines[2]?.startsWith('trusted comment: ')) throw new Error('Updater signing identity mismatch');
  const algorithm = sig.subarray(0,2).toString();
  if (!['Ed','ED'].includes(algorithm)) throw new Error('Unsupported updater signature');
  const pub = createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),key.subarray(10)]),format:'der',type:'spki'});
  const message = algorithm === 'ED' ? createHash('blake2b512').update(bytes).digest() : bytes;
  if (!verify(null,message,pub,sig.subarray(10)) || !verify(null,Buffer.concat([sig.subarray(10),Buffer.from(lines[2].slice(17))]),pub,Buffer.from(lines[3] || '', 'base64'))) throw new Error('Updater signature verification failed');
}
export function makeManifest(input, directory, origin) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('OSS HTTPS origin required');
  const manifest = {schemaVersion:1,version:input.version,publishedAt:input.publishedAt || new Date().toISOString(),notes:input.notes,assets:input.assets.map(asset => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(dmg|zip|exe|msi)$/.test(asset.filename)) throw new Error('Invalid package filename');
    const bytes = readFileSync(join(directory, asset.filename));
    return {platform:asset.platform,arch:asset.arch,...(asset.variant === undefined ? {} : {variant:asset.variant}),filename:asset.filename,url:new URL(`task-sprite/releases/${input.version}/${asset.filename}`,base).href,size:bytes.length,sha256:digest(bytes)};
  })};
  validateManifest(manifest);
  if (!manifest.assets.length) throw new Error('No verified packages');
  if (input.updates) {
   manifest.updaterPublicKey = input.updaterPublicKey;
   manifest.updates = input.updates.map(asset => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:app\.tar\.gz|exe)$/.test(asset.filename) || !['macos','windows'].includes(asset.platform) || !['aarch64','x86_64'].includes(asset.arch)) throw new Error('Invalid updater package');
    const bytes = readFileSync(join(directory, asset.filename));
    const signature = readFileSync(join(directory, asset.filename+'.sig'),'utf8').trim();
    if (!/^[A-Za-z0-9+/=]+$/.test(signature) || !Buffer.from(signature,'base64').toString().startsWith('untrusted comment:')) throw new Error('Invalid updater signature');
    verifyUpdaterSignature(bytes,signature,input.updaterPublicKey);
    return {platform:asset.platform,arch:asset.arch,filename:asset.filename,url:new URL(`task-sprite/releases/${input.version}/${asset.filename}`,base).href,size:bytes.length,sha256:digest(bytes),signature};
   });
  }
  return manifest;
}
export function updaterManifest(manifest) {
  const platforms = {};
  for (const asset of manifest.updates || []) {
    const target = `${asset.platform === 'macos' ? 'darwin' : 'windows'}-${asset.arch}`;
    if (platforms[target]) throw new Error('Duplicate updater target');
    platforms[target] = {url:asset.url,signature:asset.signature};
  }
  return {version:manifest.version,notes:manifest.notes,pub_date:manifest.publishedAt,platforms};
}
async function immutable(client, key, bytes, contentType, publicRead) {
  let exists = false;
  try { await client.head(key); exists = true; } catch (error) { if (error.status !== 404) throw error; }
  if (exists) {
    if (!Buffer.from((await client.get(key)).content).equals(bytes)) throw new Error(`Versioned object differs: ${key}`);
    return;
  }
  await client.put(key, bytes, {headers:{'x-oss-forbid-overwrite':'true',...(publicRead ? {'x-oss-object-acl':'public-read'} : {}),'Cache-Control':'public,max-age=31536000,immutable','Content-Type':contentType}});
  if (!Buffer.from((await client.get(key)).content).equals(bytes)) throw new Error(`Uploaded object verification failed: ${key}`);
}
export async function publishRelease(client, manifest, directory, {publicRead = true} = {}) {
  validateManifest(manifest);
  const uploaded = new Set();
  for (const asset of [...manifest.assets,...(manifest.updates || [])]) {
    const bytes = readFileSync(join(directory,asset.filename));
    if (bytes.length !== asset.size || digest(bytes) !== asset.sha256) throw new Error('Package changed after validation');
    if (asset.signature) verifyUpdaterSignature(bytes,asset.signature,manifest.updaterPublicKey);
    if (!uploaded.has(asset.filename)) {
      await immutable(client,`task-sprite/releases/${manifest.version}/${asset.filename}`,bytes,'application/octet-stream',publicRead);
      uploaded.add(asset.filename);
    }
  }
  const bytes = Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  await immutable(client,`task-sprite/releases/${manifest.version}/manifest.json`,bytes,'application/json; charset=utf-8',publicRead);
  const updater = manifest.updates?.length ? Buffer.from(JSON.stringify(updaterManifest(manifest),null,2)+'\n') : null;
  if (updater) await immutable(client,`task-sprite/releases/${manifest.version}/updater.json`,updater,'application/json; charset=utf-8',publicRead);
  await client.put('task-sprite/releases/latest.json',bytes,{headers:{...(publicRead ? {'x-oss-object-acl':'public-read'} : {}),'Cache-Control':'public,max-age=60','Content-Type':'application/json; charset=utf-8'}});
  if (!Buffer.from((await client.get('task-sprite/releases/latest.json')).content).equals(bytes)) throw new Error('Latest pointer verification failed');
  if (updater) {
    await client.put('task-sprite/releases/updater.json',updater,{headers:{...(publicRead ? {'x-oss-object-acl':'public-read'} : {}),'Cache-Control':'no-cache','Content-Type':'application/json; charset=utf-8'}});
    if (!Buffer.from((await client.get('task-sprite/releases/updater.json')).content).equals(updater)) throw new Error('Updater pointer verification failed');
  }
}
async function main() {
  const [inputFile,directory,envFile] = process.argv.slice(2);
  if (!inputFile || !directory || !envFile) throw new Error('Usage: node scripts/publish-release.mjs <release-input.json|--rollback=version> <artifact-directory> <private-env-file>');
  const {parse} = await import('dotenv');
  const {default:OSS} = await import('ali-oss');
  const env = envFile === '--env' ? process.env : parse(readFileSync(envFile));
  const publicRead = env.OSS_PUBLIC_READ !== 'false';
  const endpoint = new URL(env.OSS_ENDPOINT);endpoint.hostname = endpoint.hostname.slice(env.OSS_BUCKET.length+1);
  const client = new OSS({region:env.OSS_REGION,bucket:env.OSS_BUCKET,endpoint:endpoint.origin,accessKeyId:env.OSS_ACCESS_KEY_ID,accessKeySecret:env.OSS_ACCESS_KEY_SECRET,secure:true,authorizationV4:true,timeout:300000});
  if (inputFile.startsWith('--rollback=')) {
    const version=inputFile.slice(11);
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid rollback version');
    const manifest=validateManifest(JSON.parse((await client.get(`task-sprite/releases/${version}/manifest.json`)).content.toString()));
    for (const asset of manifest.assets) {const bytes=Buffer.from((await client.get(`task-sprite/releases/${version}/${asset.filename}`)).content);if(bytes.length!==asset.size||digest(bytes)!==asset.sha256)throw new Error('Rollback package verification failed');}
    await client.put('task-sprite/releases/latest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'),{headers:{...(publicRead ? {'x-oss-object-acl':'public-read'} : {}),'Cache-Control':'public,max-age=60','Content-Type':'application/json; charset=utf-8'}});
    console.log(`Latest version restored to ${version}`);return;
  }
  const manifest=makeManifest(JSON.parse(readFileSync(inputFile)),resolve(directory),env.DOWNLOAD_ORIGIN || env.OSS_ENDPOINT);
  await publishRelease(client,manifest,resolve(directory),{publicRead});
  console.log(`Published ${manifest.version}: ${manifest.assets.length} verified packages; latest updated last.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {console.error(error.code || error.message);process.exitCode=1;});
