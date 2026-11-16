import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {spawnSync} from 'node:child_process';
const [directory,configFile] = process.argv.slice(2);
if (!directory || !configFile) throw Error('Expected artifact directory and native configuration');
const config = JSON.parse(readFileSync(configFile));
const assets = [
  {platform:'macos',arch:'aarch64',ext:'dmg'},
  {platform:'macos',arch:'x86_64',ext:'dmg'},
  {platform:'windows',arch:'x86_64',ext:'exe'},
].map(({ext,...asset})=>({...asset,filename:`Task-Sprite-${config.version}-${asset.platform}-${asset.arch}.${ext}`}));
const updates = assets.map(asset=>({...asset,filename:asset.platform === 'macos' ? asset.filename.replace(/\.dmg$/,'.app.tar.gz') : asset.filename}));
// Reading all three smoke markers prevents partial or untested artifacts from becoming latest.
for (const asset of assets) {
  const marker = JSON.parse(readFileSync(join(directory,`${asset.platform}-${asset.arch}-verified.json`)));
  if (marker.version !== config.version || marker.startup !== 'passed') throw Error('Unverified release target');
}
const input = {version:config.version,notes:'支持多任务并行与跟进记录；新增在线更新和 Intel Mac 版；Windows 内含离线 WebView2 安装程序。',updaterPublicKey:config.plugins.updater.pubkey,assets,updates};
const filename = resolve(directory,'release-input.json');writeFileSync(filename,JSON.stringify(input,null,2)+'\n');
const result = spawnSync(process.execPath,[new URL('./publish-release.mjs',import.meta.url).pathname,filename,resolve(directory),'--env'],{stdio:'inherit'});
if (result.status !== 0) process.exit(result.status || 1);
