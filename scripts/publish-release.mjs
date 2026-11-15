import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { validateManifest } from '../release-manifest.js';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function makeManifest(input, directory, origin) {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password) throw new Error('OSS HTTPS origin required');
  const manifest = {schemaVersion:1,version:input.version,publishedAt:input.publishedAt || new Date().toISOString(),notes:input.notes,assets:input.assets.map(asset => {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.(dmg|zip|exe|msi)$/.test(asset.filename)) throw new Error('Invalid package filename');
    const bytes = readFileSync(join(directory, asset.filename));
    return {platform:asset.platform,arch:asset.arch,filename:asset.filename,url:new URL(`task-sprite/releases/${input.version}/${asset.filename}`,base).href,size:bytes.length,sha256:digest(bytes)};
  })};
  validateManifest(manifest);
  if (!manifest.assets.length) throw new Error('No verified packages');
  return manifest;
}
async function immutable(client, key, bytes, contentType) {
  let exists = false;
  try { await client.head(key); exists = true; } catch (error) { if (error.status !== 404) throw error; }
  if (exists) {
    if (!Buffer.from((await client.get(key)).content).equals(bytes)) throw new Error(`Versioned object differs: ${key}`);
    return;
  }
  await client.put(key, bytes, {headers:{'x-oss-forbid-overwrite':'true','x-oss-object-acl':'public-read','Cache-Control':'public,max-age=31536000,immutable','Content-Type':contentType}});
  if (!Buffer.from((await client.get(key)).content).equals(bytes)) throw new Error(`Uploaded object verification failed: ${key}`);
}
export async function publishRelease(client, manifest, directory) {
  validateManifest(manifest);
  for (const asset of manifest.assets) {
    const bytes = readFileSync(join(directory,asset.filename));
    if (bytes.length !== asset.size || digest(bytes) !== asset.sha256) throw new Error('Package changed after validation');
    await immutable(client,`task-sprite/releases/${manifest.version}/${asset.filename}`,bytes,'application/octet-stream');
  }
  const bytes = Buffer.from(JSON.stringify(manifest,null,2)+'\n');
  await immutable(client,`task-sprite/releases/${manifest.version}/manifest.json`,bytes,'application/json; charset=utf-8');
  await client.put('task-sprite/releases/latest.json',bytes,{headers:{'x-oss-object-acl':'public-read','Cache-Control':'public,max-age=60','Content-Type':'application/json; charset=utf-8'}});
  if (!Buffer.from((await client.get('task-sprite/releases/latest.json')).content).equals(bytes)) throw new Error('Latest pointer verification failed');
}
async function main() {
  const [inputFile,directory,envFile] = process.argv.slice(2);
  if (!inputFile || !directory || !envFile) throw new Error('Usage: node scripts/publish-release.mjs <release-input.json|--rollback=version> <artifact-directory> <private-env-file>');
  const {parse} = await import('dotenv');
  const {default:OSS} = await import('ali-oss');
  const env = parse(readFileSync(envFile));
  const endpoint = new URL(env.OSS_ENDPOINT);endpoint.hostname = endpoint.hostname.slice(env.OSS_BUCKET.length+1);
  const client = new OSS({region:env.OSS_REGION,bucket:env.OSS_BUCKET,endpoint:endpoint.origin,accessKeyId:env.OSS_ACCESS_KEY_ID,accessKeySecret:env.OSS_ACCESS_KEY_SECRET,secure:true,authorizationV4:true});
  if (inputFile.startsWith('--rollback=')) {
    const version=inputFile.slice(11);
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw new Error('Invalid rollback version');
    const manifest=validateManifest(JSON.parse((await client.get(`task-sprite/releases/${version}/manifest.json`)).content.toString()));
    for (const asset of manifest.assets) {const bytes=Buffer.from((await client.get(`task-sprite/releases/${version}/${asset.filename}`)).content);if(bytes.length!==asset.size||digest(bytes)!==asset.sha256)throw new Error('Rollback package verification failed');}
    await client.put('task-sprite/releases/latest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'),{headers:{'x-oss-object-acl':'public-read','Cache-Control':'public,max-age=60','Content-Type':'application/json; charset=utf-8'}});
    console.log(`Latest version restored to ${version}`);return;
  }
  const manifest=makeManifest(JSON.parse(readFileSync(inputFile)),resolve(directory),env.OSS_ENDPOINT);
  await publishRelease(client,manifest,resolve(directory));
  console.log(`Published ${manifest.version}: ${manifest.assets.length} verified packages; latest updated last.`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {console.error(error.code || error.message);process.exitCode=1;});
