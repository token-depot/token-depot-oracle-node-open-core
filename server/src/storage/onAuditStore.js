import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const AUDIT_FILENAME = 'on-audit.v1.json';
const MAX_ITEMS = 500;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function atomicWriteJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${crypto.randomBytes(6).toString('hex')}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
}

function auditPath(repoRoot) {
  return path.join(repoRoot, 'data', AUDIT_FILENAME);
}

export function defaultOnAudit() {
  return { version: 1, items: [] };
}

export function readOnAudit(repoRoot) {
  const p = auditPath(repoRoot);
  if (!fs.existsSync(p)) return defaultOnAudit();
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      version: 1,
      items: parsed && Array.isArray(parsed.items) ? parsed.items.slice(-MAX_ITEMS) : []
    };
  } catch (_) {
    return defaultOnAudit();
  }
}

export function appendOnAudit(repoRoot, event, result, details = {}) {
  const current = readOnAudit(repoRoot);
  const item = {
    id: `ONA_${crypto.randomBytes(8).toString('hex')}`,
    at: new Date().toISOString(),
    event: String(event || 'UNKNOWN'),
    result: String(result || 'UNKNOWN'),
    details: details && typeof details === 'object' ? details : {}
  };
  const next = { version: 1, items: [...current.items, item].slice(-MAX_ITEMS) };
  atomicWriteJson(auditPath(repoRoot), next);
  return item;
}
