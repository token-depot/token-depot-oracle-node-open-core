(() => {
  'use strict';

  let config = null;
  let cache = { tenant: null, users: [] };
  let selectedUser = null;
  let showOnRegistrationId = false;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const msg = (text) => { const el = $('pageMsg'); if (el) el.textContent = text; };
  const display = (value) => {
    const text = String(value ?? '').trim();
    return text || '—';
  };
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = display(value);
  };
  const setHtml = (id, value) => {
    const el = $(id);
    if (el) el.innerHTML = value;
  };
  const maskSecret = (value) => {
    const text = String(value || '').trim();
    if (!text) return '—';
    if (text.length <= 12) return '••••';
    return text.slice(0, 8) + '••••' + text.slice(-6);
  };

  const tenantMsg = (text) => { const el = $('tenantMsg'); if (el) el.textContent = text; };
  const onRegistrationId = () => String((cache.tenant && cache.tenant.on_registration_id) || (config && config.on_registration_id) || '').trim();

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, { ...options, headers: { Accept: 'application/json', ...(options.headers || {}) } });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (_) {}
    if (!res.ok || !json || json.ok !== true) {
      const err = new Error(json && json.reason ? json.reason : 'request_failed');
      err.status = res.status;
      err.body = json || text;
      throw err;
    }
    return json;
  }

  function download(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function statusPill(frozen) {
    return frozen
      ? '<span class="pill pill-bad">Frozen</span>'
      : '<span class="pill pill-ok">Active</span>';
  }

  function resultClass(result) {
    const r = String(result || '').trim().toUpperCase();
    if (r === 'OK' || r === 'SUCCESS') return 'pill pill-ok';
    if (r === 'ERROR' || r === 'FAILED') return 'pill pill-bad';
    return 'pill pill-warn';
  }

  function renderOnRegistrationId() {
    const value = onRegistrationId();
    const rendered = showOnRegistrationId ? display(value) : maskSecret(value);
    setText('bindingOnRegistrationIdDisplay', rendered);
    setText('tenantOnRegistrationIdDisplay', rendered);

    ['btnToggleBindingOnRegistrationId', 'btnToggleTenantOnRegistrationId'].forEach((id) => {
      const btn = $(id);
      if (btn) btn.textContent = showOnRegistrationId ? 'Hide' : 'Show';
    });
  }

  function renderBinding(readiness) {
    setText('bindingTenantId', config?.tenant_id);
    renderOnRegistrationId();
    setText('bindingCnBaseUrl', config?.cn_base_url);
    setText('bindingCwBaseUrl', config?.cw_base_url);
    if (readiness) {
      $('statusText').textContent = readiness.ready ? 'Config is ready.' : 'Config missing: ' + readiness.missing.join(', ');
    }
  }

  function renderStatusFromHealth(health) {
    const ready = !!health.configReady;
    $('statusHealthText').textContent = ready ? 'OK' : 'Config incomplete';
    $('statusHealthText').className = ready ? 'on-status-value on-ok' : 'on-status-value on-warn';
    $('statusHealthMeta').textContent = ready ? 'Local ON service is running.' : 'Missing: ' + (health.missingConfig || []).join(', ');
    setText('statusVersion', health.version);
    setText('statusBoundTenant', health.boundTenantId);
    setText('statusCachedUserCount', health.cachedUserCount);
    setText('statusCacheUpdatedAt', health.cacheUpdatedAt);
  }

  function renderTenant() {
    const t = cache.tenant || {};
    setText('tenantId', t.tenant_id);
    setText('tenantSlug', t.tenant_slug);
    setText('tenantDisplayName', t.display_name);
    setText('tenantStatus', t.status);
    setText('tenantPrimaryDomain', t.primary_domain);
    setText('tenantBrandingId', t.branding_id);
    const signupInput = $('tenantSignupEmailInput');
    if (signupInput && document.activeElement !== signupInput) signupInput.value = String(t.signup_notify_email || '');
    renderOnRegistrationId();
  }

  function renderSelectedUser() {
    const u = selectedUser || {};
    setText('selectedUserId', u.id);
    setText('selectedUserLabel', u.label);
    setText('selectedUserEmail', u.email);
    setText('selectedUserTenantId', u.tenant_id);
    setHtml('selectedUserFrozen', u.id ? statusPill(!!u.account_frozen) : '—');
    setText('selectedUserFreezeUpdated', u.freeze_updated_at);
    setText('selectedUserFreezeReason', u.freeze_reason);
    setText('selectedUserFreezeNotes', u.freeze_notes);
    setText('selectedUserActionText', u.id ? ('selected user is currently ' + (u.account_frozen ? 'frozen' : 'active')) : 'no user selected');
  }

  function tenantScopedUsers() {
    const tenantId = config?.tenant_id || '';
    return (cache.users || []).filter((u) => u && String(u.tenant_id || '') === tenantId);
  }

  function renderUsers() {
    const rows = $('usersRows');
    const users = tenantScopedUsers();
    rows.innerHTML = users.map((u) => {
      const frozen = !!u.account_frozen;
      return '<tr data-user-id="' + esc(u.id) + '">' +
        '<td>' + statusPill(frozen) + '</td>' +
        '<td><button class="secondary btn-select-user" type="button" data-user-id="' + esc(u.id) + '">Select</button></td>' +
        '<td>' + esc(u.label || '') + '</td>' +
        '<td class="mono">' + esc(u.id || '') + '</td>' +
        '<td class="mono">' + esc(u.tenant_id || '') + '</td>' +
        '<td>' + esc(u.email || '') + '</td>' +
        '<td>' + esc(u.phone || '') + '</td>' +
        '<td>' + esc(u.freeze_updated_at || '') + '</td>' +
        '<td>' + esc(u.freeze_reason || '') + '</td>' +
        '</tr>';
    }).join('');

    $('usersCount').textContent = users.length + (users.length === 1 ? ' user' : ' users');

    rows.querySelectorAll('.btn-select-user').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-user-id') || '';
        selectedUser = users.find((u) => u.id === id) || null;
        rows.querySelectorAll('tr').forEach((tr) => tr.classList.toggle('row-selected', tr.getAttribute('data-user-id') === id));
        renderSelectedUser();
      });
    });
  }

  function renderAudit(audit) {
    const items = audit && Array.isArray(audit.items) ? audit.items.slice().reverse() : [];
    $('auditCount').textContent = items.length + (items.length === 1 ? ' event' : ' events');
    $('auditRows').innerHTML = items.map((item) => {
      const details = item && item.details ? JSON.stringify(item.details, null, 2) : '';
      return '<tr>' +
        '<td>' + esc(item.at || '') + '</td>' +
        '<td>' + esc(item.event || '') + '</td>' +
        '<td><span class="' + resultClass(item.result) + '">' + esc(item.result || 'UNKNOWN') + '</span></td>' +
        '<td><code class="on-audit-details">' + esc(details) + '</code></td>' +
        '</tr>';
    }).join('');
  }

  function clearAuditView() {
    $('auditRows').innerHTML = '';
    $('auditCount').textContent = '0 visible events';
    msg('audit view cleared');
  }

  function renderAll() {
    renderTenant();
    renderSelectedUser();
    renderUsers();
  }

  async function loadConfig() {
    const j = await fetchJson('/api/on/config');
    config = j.config;
    renderBinding(j.readiness);
  }

  async function loadCache() {
    const j = await fetchJson('/api/on/cache');
    cache = j.cache || { tenant: null, users: [] };
    renderAll();
  }

  async function reloadUsers() {
    msg('reloading users...');
    const j = await fetchJson('/api/on/reload-users', { method: 'POST' });
    cache = j.cache;
    selectedUser = null;
    renderAll();
    await refreshHealth();
    await refreshAudit();
    msg('reload complete');
  }

  async function freezeSelected() {
    if (!selectedUser) { msg('select a user first'); return; }
    if (String(selectedUser.tenant_id || '') !== String(config?.tenant_id || '')) { msg('selected user tenant mismatch'); return; }
    const reason = $('freezeReason').value.trim();
    if (!reason) { msg('freeze reason required'); return; }
    msg('freezing user...');
    await fetchJson('/api/on/user-freeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: selectedUser.id,
        freeze_reason: reason,
        freeze_note: $('freezeNote').value.trim()
      })
    });
    await reloadUsers();
    msg('freeze complete');
  }

  async function unfreezeSelected() {
    if (!selectedUser) { msg('select a user first'); return; }
    if (String(selectedUser.tenant_id || '') !== String(config?.tenant_id || '')) { msg('selected user tenant mismatch'); return; }
    msg('unfreezing user...');
    await fetchJson('/api/on/user-unfreeze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedUser.id, resolution_note: $('resolutionNote').value.trim() })
    });
    await reloadUsers();
    msg('unfreeze complete');
  }


  async function saveSignupEmail() {
    const input = $('tenantSignupEmailInput');
    const signupNotifyEmail = input ? input.value.trim() : '';
    if (!signupNotifyEmail) { tenantMsg('signup email required'); return; }
    tenantMsg('saving signup email...');
    msg('saving signup email...');
    const j = await fetchJson('/api/on/tenant-signup-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signup_notify_email: signupNotifyEmail })
    });
    cache = j.cache || cache;
    renderAll();
    await refreshAudit();
    tenantMsg('signup email saved');
    msg('signup email saved');
  }

  function copyTextToClipboard(value) {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'readonly');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }

    if (!copied) {
      throw new Error('copy_unavailable');
    }
  }

  async function copyOnRegistrationId() {
    const value = onRegistrationId();
    if (!value) { msg('ON Registration ID unavailable'); return; }
    copyTextToClipboard(value);
    msg('ON Registration ID copied');
  }

  function toggleOnRegistrationId() {
    showOnRegistrationId = !showOnRegistrationId;
    renderOnRegistrationId();
    msg(showOnRegistrationId ? 'ON Registration ID visible' : 'ON Registration ID hidden');
  }

  async function refreshHealth() {
    const j = await fetchJson('/api/on/health');
    renderStatusFromHealth(j);
  }

  async function refreshAudit() {
    const j = await fetchJson('/api/on/audit');
    renderAudit(j.audit);
  }

  function wire() {
    $('btnReloadUsers').addEventListener('click', () => reloadUsers().catch((err) => { msg('reload failed: ' + err.message); refreshHealth().catch(() => {}); }));
    $('btnSaveSignupEmail').addEventListener('click', () => saveSignupEmail().catch((err) => { tenantMsg('save failed: ' + err.message); msg('signup email save failed: ' + err.message); }));
    $('btnToggleBindingOnRegistrationId').addEventListener('click', () => toggleOnRegistrationId());
    $('btnToggleTenantOnRegistrationId').addEventListener('click', () => toggleOnRegistrationId());
    $('btnCopyBindingOnRegistrationId').addEventListener('click', () => copyOnRegistrationId().catch((err) => msg('copy failed: ' + err.message)));
    $('btnCopyTenantOnRegistrationId').addEventListener('click', () => copyOnRegistrationId().catch((err) => msg('copy failed: ' + err.message)));
    $('btnFreezeSelected').addEventListener('click', () => freezeSelected().catch((err) => msg('freeze failed: ' + err.message)));
    $('btnUnfreezeSelected').addEventListener('click', () => unfreezeSelected().catch((err) => msg('unfreeze failed: ' + err.message)));
    $('btnRefreshHealth').addEventListener('click', () => refreshHealth().catch((err) => { $('statusHealthText').textContent = 'Error'; $('statusHealthText').className = 'on-status-value on-bad'; $('statusHealthMeta').textContent = String(err); }));
    $('btnRefreshAudit').addEventListener('click', () => refreshAudit().catch((err) => { $('auditRows').innerHTML = '<tr><td colspan="4">' + esc(String(err)) + '</td></tr>'; }));
    $('btnClearAuditView').addEventListener('click', () => clearAuditView());
    $('btnExportUsersCsv').addEventListener('click', () => download('/api/on/export/users.csv'));
    $('btnExportUsersJson').addEventListener('click', () => download('/api/on/export/users.json'));
    $('btnExportTenantJson').addEventListener('click', () => download('/api/on/export/tenant.json'));
  }

  document.addEventListener('DOMContentLoaded', async () => {
    wire();
    try {
      await loadConfig();
      await loadCache();
      await refreshHealth();
      await refreshAudit();
      msg('ready');
    } catch (err) {
      msg('startup failed: ' + err.message);
    }
  });
})();
