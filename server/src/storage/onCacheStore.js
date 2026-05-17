import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CACHE_FILENAME = 'on-cache.v1.json';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function cachePath(repoRoot) {
  return path.join(repoRoot, 'data', CACHE_FILENAME);
}

export function defaultOnCache() {
  return { version: 1, updated_at: null, tenant: null, users: [], serverNow: null };
}

export function normalizeOnCache(input) {
  const src = input && typeof input === 'object' ? input : {};
  return {
    version: 1,
    updated_at: typeof src.updated_at === 'string' ? src.updated_at : null,
    tenant: src.tenant && typeof src.tenant === 'object' ? src.tenant : null,
    users: Array.isArray(src.users) ? src.users : [],
    serverNow: typeof src.serverNow === 'string' ? src.serverNow : null
  };
}

export function readOnCache(repoRoot) {
  const p = cachePath(repoRoot);
  if (!fs.existsSync(p)) return defaultOnCache();
  try {
    return normalizeOnCache(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch (_) {
    return defaultOnCache();
  }
}

export function writeOnCache(repoRoot, data) {
  const normalized = normalizeOnCache({ ...data, updated_at: new Date().toISOString() });
  atomicWriteJson(cachePath(repoRoot), normalized);
  return normalized;
}
