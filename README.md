# Oracle_Node — Module 17 v1

Local tenant-bound Oracle Node dashboard for the Compliance Wallet / Compliance Node stack.

## What this is

This is a local ON operator dashboard. It is intentionally narrow:

- validates by `tenant_id` + `on_registration_id`
- displays exactly one bound tenant
- displays only users whose `tenant_id` matches the bound tenant
- allows `RELOAD USERS`
- allows tenant-scoped freeze/unfreeze only
- supports tenant/user JSON and CSV export
- shows local health/status/audit

## What this is not

- not a wallet host
- not a local trade executor
- not a swap/offers dashboard
- not a CN admin panel
- not a tenant creation tool
- not a tenant reassignment/absorb tool
- not a website editor

## Install on Mac or ON computer

The intended repo root is:

```bash
~/Projects/Oracle_Node
```

Unzip the delivered bundle and copy the `Oracle_Node` folder there.

```bash
mkdir -p ~/Projects
cp -R Oracle_Node ~/Projects/Oracle_Node
cd ~/Projects/Oracle_Node
npm run verify
npm start
```

Open:

```text
http://127.0.0.1:8090/
```

Optional port override:

```bash
HOST=127.0.0.1 PORT=8090 npm start
```

## Configure binding

You can edit `data/on-config.v1.json` directly or use the dashboard config form.

Required fields:

```json
{
  "version": 1,
  "tenant_id": "TEN_99c98c4b0aaa5283",
  "on_registration_id": "PASTE_THE_CN_TENANT_ON_REGISTRATION_ID",
  "cn_base_url": "https://admin-or-cn-host.example.com",
  "cw_base_url": "https://tokens.ncsolarelectric.com",
  "display_name": null,
  "last_validated_at": null
}
```

The ON registration ID must already be stored in the CN Tenant Registry for the bound tenant.

## CN requirement

Current `Compliance_Node_60.zip` does not contain ON-safe tenant endpoints yet. Apply the companion patch included in this bundle:

```text
Compliance_Node_M17_ON_Endpoints_companion/Compliance_Node_60_M17_ON_Endpoints.patch
```

The patch adds only:

```text
POST /api/cn/on/tenant-snapshot
POST /api/cn/on/user-freeze
POST /api/cn/on/user-unfreeze
```

ON does not use `TD_ADMIN_TOKEN`. CN uses its server-side `TD_ADMIN_TOKEN` only to proxy the existing CW admin list/freeze/unfreeze calls after validating `tenant_id + on_registration_id`.

## NGINX note

If your CN host is behind Basic Auth for the broker UI, you may need an NGINX exception for `/api/cn/on/` so the ON computer can reach the ON-safe endpoints. Keep `/api/cn/users`, `/api/cn/tenants`, and other admin endpoints protected.

See:

```text
Compliance_Node_M17_ON_Endpoints_companion/nginx_on_api_location_example.conf
```

## Test flow

1. Confirm CN tenant has:
   - `status = active`
   - `tenant_id`
   - `on_registration_id`
2. Start Oracle_Node.
3. Save local config.
4. Click `RELOAD USERS`.
5. Confirm Tenant Registry shows one tenant only.
6. Confirm All Users shows only matching tenant users.
7. Select a test user.
8. Freeze selected user.
9. Reload.
10. Unfreeze selected user.
11. Export CSV/JSON.

## Data files

```text
data/on-config.v1.json
data/on-cache.v1.json
data/on-audit.v1.json
```

The ON cache is a mirror only. CN/CW remain canonical.
