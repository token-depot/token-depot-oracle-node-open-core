import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CONFIG_FILENAME = 'on-config.v1.json';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNullableString(value) {
  const s = asString(value);
  return s ? s : null;
}

export function defaultOnConfig() {
  return {
    version: 1,
    tenant_id: '',
    on_registration_id: '',
    cn_base_url: '',
    cw_base_url: '',
    display_name: null,
    last_validated_at: null
  };
}

export function onConfigPath(repoRoot) {
  return path.join(repoRoot, 'data', CONFIG_FILENAME);
}

export function normalizeOnConfig(input) {
  const src = input && typeof input === 'object' ? input : {};
  const defaults = defaultOnConfig();
  return {
    version: 1,
    tenant_id: asString(src.tenant_id || src.tenantId || defaults.tenant_id),
    on_registration_id: asString(src.on_registration_id || src.onRegistrationId || defaults.on_registration_id),
    cn_base_url: asString(src.cn_base_url || src.cnBaseUrl || defaults.cn_base_url).replace(/\/+$/, ''),
    cw_base_url: asString(src.cw_base_url || src.cwBaseUrl || defaults.cw_base_url).replace(/\/+$/, ''),
    display_name: asNullableString(src.display_name || src.displayName),
    last_validated_at: asNullableString(src.last_validated_at || src.lastValidatedAt)
  };
}

export function readOnConfig(repoRoot) {
  const p = onConfigPath(repoRoot);
  if (!fs.existsSync(p)) return defaultOnConfig();
  try {
    return normalizeOnConfig(JSON.parse(fs.readFileSync(p, 'utf8')));
  } catch (_) {
    return defaultOnConfig();
  }
}

export function writeOnConfig(repoRoot, config) {
  const normalized = normalizeOnConfig(config);
  atomicWriteJson(onConfigPath(repoRoot), normalized);
  return normalized;
}

export function configReadiness(config) {
  const missing = [];
  if (!config.tenant_id) missing.push('tenant_id');
  if (!config.on_registration_id) missing.push('on_registration_id');
  if (!config.cn_base_url) missing.push('cn_base_url');
  return { ready: missing.length === 0, missing };
}
