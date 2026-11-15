import { cpSync, mkdirSync, rmSync } from 'node:fs';
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
for (const file of ['index.html', 'terms.html', 'privacy.html', 'styles.css', 'app.js', 'release-manifest.js', 'assets']) cpSync(file, `dist/${file}`, { recursive: true });
console.log('Built static site in dist/');
