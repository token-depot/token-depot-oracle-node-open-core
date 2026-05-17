import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'package.json',
  'server/src/server.js',
  'server/src/config.js',
  'server/src/storage/onConfigStore.js',
  'server/src/storage/onCacheStore.js',
  'server/src/storage/onAuditStore.js',
  'static/index.html',
  'static/js/on-users-ui.js',
  'static/css/style.css',
  'static/css/on.css',
  'static/icon/logo.png',
  'data/on-config.v1.json',
  'data/on-cache.v1.json',
  'data/on-audit.v1.json'
];

let failed = false;
for (const rel of required) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    console.error('missing', rel);
    failed = true;
  } else {
    console.log('ok', rel);
  }
}
if (failed) process.exit(1);
console.log('Oracle_Node local file verification passed.');
