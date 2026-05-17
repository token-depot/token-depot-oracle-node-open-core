import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST, PORT, ON_VERSION } from './config.js';
import { readOnConfig, writeOnConfig, configReadiness } from './storage/onConfigStore.js';
import { readOnCache, writeOnCache } from './storage/onCacheStore.js';
import { appendOnAudit, readOnAudit } from './storage/onAuditStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const staticRoot = path.join(repoRoot, 'static');

const JSON_LIMIT_BYTES = 256 * 1024;
const TEXT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.ico', 'image/x-icon'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8']
]);

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2) + '\n';
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(body);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

function badRequest(res, reason, extra = {}) {
  return sendJson(res, 400, { ok: false, reason, ...extra });
}

function normalizePathname(url) {
  try {
    return new URL(url, 'http://127.0.0.1').pathname;
  } catch (_) {
    return '/';
  }
}

function safeStaticPath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const clean = decoded.replace(/^\/+/, '');
  const p = path.normalize(path.join(root, clean));
  if (!p.startsWith(root + path.sep) && p !== root) return null;
  return p;
}

function serveFile(res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return sendText(res, 404, 'not found\n');
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = TEXT_TYPES.get(ext) || 'application/octet-stream';
  res.writeHead(200, { 'content-type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

async function readJsonBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > JSON_LIMIT_BYTES) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function asString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function verifyConfigured(config) {
  const readiness = configReadiness(config);
  if (!readiness.ready) {
    const err = new Error('on_config_incomplete');
    err.missing = readiness.missing;
    throw err;
  }
}

function cnEndpoint(config, route) {
  return `${config.cn_base_url.replace(/\/+$/, '')}${route}`;
}

async function postCn(config, route, body) {
  verifyConfigured(config);
  const url = cnEndpoint(config, route);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  if (!response.ok || !json || json.ok !== true) {
    const err = new Error('cn_request_failed');
    err.status = response.status;
    err.body = json || text;
    err.url = url;
    throw err;
  }
  return json;
}

function bindingBody(config) {
  return {
    tenant_id: config.tenant_id,
    on_registration_id: config.on_registration_id
  };
}

function normalizeSignupEmail(value) {
  const email = asString(value).toLowerCase();
  if (!email) {
    throw new Error('signup_notify_email_required');
  }
  if (email.includes(',') || email.includes(';') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('signup_notify_email_invalid');
  }
  return email;
}

function sanitizeUsersForTenant(users, tenantId) {
  const list = Array.isArray(users) ? users : [];
  return list.filter((row) => row && String(row.tenant_id || '') === tenantId);
}

async function reloadSnapshot() {
  const config = readOnConfig(repoRoot);
  const json = await postCn(config, '/api/cn/on/tenant-snapshot', bindingBody(config));
  const users = sanitizeUsersForTenant(json.users, config.tenant_id);
  const cache = writeOnCache(repoRoot, {
    tenant: json.tenant || null,
    users,
    serverNow: typeof json.serverNow === 'string' ? json.serverNow : null
  });
  writeOnConfig(repoRoot, { ...config, last_validated_at: new Date().toISOString() });
  appendOnAudit(repoRoot, 'RELOAD_USERS', 'OK', { tenant_id: config.tenant_id, users: users.length });
  return cache;
}

function findCachedUser(userId) {
  const config = readOnConfig(repoRoot);
  const cache = readOnCache(repoRoot);
  const id = asString(userId);
  if (!id) return null;
  return (Array.isArray(cache.users) ? cache.users : []).find((row) => row && row.id === id && row.tenant_id === config.tenant_id) || null;
}

function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function visibleUsersCsv() {
  const cache = readOnCache(repoRoot);
  const users = Array.isArray(cache.users) ? cache.users : [];
  const headers = ['id', 'label', 'email', 'phone', 'tenant_id', 'active_wallet_id', 'account_frozen', 'freeze_reason', 'freeze_notes', 'freeze_order_ref', 'freeze_updated_at'];
  const rows = [headers.join(',')];
  for (const user of users) {
    rows.push(headers.map((key) => csvEscape(user ? user[key] : '')).join(','));
  }
  return rows.join('\n') + '\n';
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/on/health') {
    const config = readOnConfig(repoRoot);
    const readiness = configReadiness(config);
    const cache = readOnCache(repoRoot);
    return sendJson(res, 200, {
      ok: true,
      version: ON_VERSION,
      localTime: new Date().toISOString(),
      configReady: readiness.ready,
      missingConfig: readiness.missing,
      boundTenantId: config.tenant_id || null,
      cnBaseUrl: config.cn_base_url || null,
      cwBaseUrl: config.cw_base_url || null,
      cacheUpdatedAt: cache.updated_at,
      cachedUserCount: Array.isArray(cache.users) ? cache.users.length : 0
    });
  }

  if (req.method === 'GET' && pathname === '/api/on/config') {
    const config = readOnConfig(repoRoot);
    return sendJson(res, 200, { ok: true, config, readiness: configReadiness(config) });
  }

  if (req.method === 'POST' && pathname === '/api/on/config') {
    try {
      const body = await readJsonBody(req);
      const saved = writeOnConfig(repoRoot, body);
      appendOnAudit(repoRoot, 'SAVE_CONFIG', 'OK', { tenant_id: saved.tenant_id, cn_base_url: saved.cn_base_url });
      return sendJson(res, 200, { ok: true, config: saved, readiness: configReadiness(saved) });
    } catch (err) {
      appendOnAudit(repoRoot, 'SAVE_CONFIG', 'ERROR', { error: String(err) });
      return sendJson(res, 500, { ok: false, reason: 'save_config_failed', error: String(err) });
    }
  }

  if (req.method === 'GET' && pathname === '/api/on/cache') {
    return sendJson(res, 200, { ok: true, cache: readOnCache(repoRoot) });
  }

  if (req.method === 'POST' && pathname === '/api/on/reload-users') {
    try {
      const cache = await reloadSnapshot();
      return sendJson(res, 200, { ok: true, cache });
    } catch (err) {
      appendOnAudit(repoRoot, 'RELOAD_USERS', 'ERROR', { error: String(err), status: err.status || null, body: err.body || null });
      return sendJson(res, 502, { ok: false, reason: 'reload_users_failed', error: String(err), status: err.status || null, body: err.body || null });
    }
  }

  if (req.method === 'POST' && pathname === '/api/on/tenant-signup-email') {
    try {
      const body = await readJsonBody(req);
      const config = readOnConfig(repoRoot);
      const signupNotifyEmail = normalizeSignupEmail(body.signup_notify_email);
      const json = await postCn(config, '/api/cn/on/tenant-signup-email', {
        ...bindingBody(config),
        signup_notify_email: signupNotifyEmail
      });

      const currentCache = readOnCache(repoRoot);
      const cache = writeOnCache(repoRoot, {
        tenant: json.tenant || currentCache.tenant || null,
        users: Array.isArray(currentCache.users) ? currentCache.users : [],
        serverNow: typeof json.serverNow === 'string' ? json.serverNow : null
      });

      appendOnAudit(repoRoot, 'UPDATE_SIGNUP_EMAIL', 'OK', {
        tenant_id: config.tenant_id,
        signup_notify_email: signupNotifyEmail
      });

      return sendJson(res, 200, { ok: true, cache });
    } catch (err) {
      appendOnAudit(repoRoot, 'UPDATE_SIGNUP_EMAIL', 'ERROR', {
        error: String(err),
        status: err.status || null,
        body: err.body || null
      });
      return sendJson(res, 502, {
        ok: false,
        reason: 'update_signup_email_failed',
        error: String(err),
        status: err.status || null,
        body: err.body || null
      });
    }
  }

  if (req.method === 'POST' && pathname === '/api/on/user-freeze') {
    try {
      const body = await readJsonBody(req);
      const config = readOnConfig(repoRoot);
      const userId = asString(body.user_id);
      const user = findCachedUser(userId);
      if (!user) return badRequest(res, 'selected_user_not_in_bound_tenant');
      const json = await postCn(config, '/api/cn/on/user-freeze', {
        ...bindingBody(config),
        user_id: userId,
        freeze_reason: asString(body.freeze_reason || body.reason) || 'ON tenant freeze',
        freeze_note: asString(body.freeze_note || body.notes),
        freeze_order_ref: asString(body.freeze_order_ref || body.order_ref)
      });
      appendOnAudit(repoRoot, 'FREEZE_USER', 'OK', { tenant_id: config.tenant_id, user_id: userId });
      return sendJson(res, 200, { ok: true, result: json });
    } catch (err) {
      appendOnAudit(repoRoot, 'FREEZE_USER', 'ERROR', { error: String(err), status: err.status || null, body: err.body || null });
      return sendJson(res, 502, { ok: false, reason: 'freeze_user_failed', error: String(err), status: err.status || null, body: err.body || null });
    }
  }

  if (req.method === 'POST' && pathname === '/api/on/user-unfreeze') {
    try {
      const body = await readJsonBody(req);
      const config = readOnConfig(repoRoot);
      const userId = asString(body.user_id);
      const user = findCachedUser(userId);
      if (!user) return badRequest(res, 'selected_user_not_in_bound_tenant');
      const json = await postCn(config, '/api/cn/on/user-unfreeze', {
        ...bindingBody(config),
        user_id: userId,
        resolution_note: asString(body.resolution_note || body.freeze_resolution_note) || 'ON tenant unfreeze'
      });
      appendOnAudit(repoRoot, 'UNFREEZE_USER', 'OK', { tenant_id: config.tenant_id, user_id: userId });
      return sendJson(res, 200, { ok: true, result: json });
    } catch (err) {
      appendOnAudit(repoRoot, 'UNFREEZE_USER', 'ERROR', { error: String(err), status: err.status || null, body: err.body || null });
      return sendJson(res, 502, { ok: false, reason: 'unfreeze_user_failed', error: String(err), status: err.status || null, body: err.body || null });
    }
  }

  if (req.method === 'GET' && pathname === '/api/on/audit') {
    return sendJson(res, 200, { ok: true, audit: readOnAudit(repoRoot) });
  }

  if (req.method === 'GET' && pathname === '/api/on/export/users.json') {
    appendOnAudit(repoRoot, 'EXPORT_USERS_JSON', 'OK', {});
    return sendJson(res, 200, { ok: true, tenant: readOnCache(repoRoot).tenant, users: readOnCache(repoRoot).users, exportedAt: new Date().toISOString() });
  }

  if (req.method === 'GET' && pathname === '/api/on/export/tenant.json') {
    appendOnAudit(repoRoot, 'EXPORT_TENANT_JSON', 'OK', {});
    return sendJson(res, 200, { ok: true, tenant: readOnCache(repoRoot).tenant, exportedAt: new Date().toISOString() });
  }

  if (req.method === 'GET' && pathname === '/api/on/export/users.csv') {
    appendOnAudit(repoRoot, 'EXPORT_USERS_CSV', 'OK', {});
    return sendText(res, 200, visibleUsersCsv(), 'text/csv; charset=utf-8');
  }

  return sendJson(res, 404, { ok: false, reason: 'api_not_found' });
}

const server = http.createServer(async (req, res) => {
  const pathname = normalizePathname(req.url || '/');

  try {
    if (pathname.startsWith('/api/on/')) {
      return await handleApi(req, res, pathname);
    }

    if (pathname === '/' || pathname === '/index.html') {
      return serveFile(res, path.join(staticRoot, 'index.html'));
    }

    if (pathname.startsWith('/static/')) {
      const filePath = safeStaticPath(staticRoot, pathname.slice('/static/'.length));
      return serveFile(res, filePath);
    }

    return sendText(res, 404, 'not found\n');
  } catch (err) {
    appendOnAudit(repoRoot, 'SERVER_ERROR', 'ERROR', { error: String(err), path: pathname });
    return sendJson(res, 500, { ok: false, reason: 'server_error', error: String(err) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[Oracle_Node] ${ON_VERSION} listening on http://${HOST}:${PORT}`);
});
