export function validateManifest(value) {
  if (!value || value.schemaVersion !== 1 || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value.version) || !/^\d{4}-\d{2}-\d{2}T/.test(value.publishedAt) || !Number.isFinite(Date.parse(value.publishedAt)) || typeof value.notes !== 'string' || !Array.isArray(value.assets)) throw new Error('版本清单格式无效');
  const targets = new Set();
  for (const asset of value.assets) {
    if (!asset || !['macos', 'windows'].includes(asset.platform) || !['aarch64', 'x86_64'].includes(asset.arch) || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:dmg|zip|exe|msi)$/.test(asset.filename) || !Number.isSafeInteger(asset.size) || asset.size <= 0 || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('安装包信息无效');
    const url = new URL(asset.url);
    if (url.protocol !== 'https:' || url.username || url.password || decodeURIComponent(url.pathname.split('/').at(-1)) !== asset.filename) throw new Error('下载地址无效');
    if (asset.variant !== undefined && (asset.platform !== 'windows' || asset.variant !== 'offline')) throw new Error('安装包类型无效');
    const key = `${asset.platform}/${asset.arch}/${asset.variant ?? 'default'}`;
    if (targets.has(key)) throw new Error('安装包平台重复');
    targets.add(key);
  }
  return value;
}
export function downloadFor(manifest, platform, arch, variant) {
  return manifest.assets.find(asset => asset.platform === platform && (!arch || asset.arch === arch) && asset.variant === variant);
}
