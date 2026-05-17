# Token Depot Oracle Node Open-Core

Local tenant-bound Oracle Node dashboard for Token Depot tenant operations.

Oracle Node is free to download, inspect, run, and adapt under the MIT License. It does not grant access to Token Depot-hosted AWS infrastructure. Hosted Token Depot tenant access requires a valid tenant registration and server-side authorization.

## What this is

This is a local Oracle Node operator dashboard. It is intentionally narrow:

- validates by `tenant_id` + `on_registration_id`
- displays exactly one bound tenant
- displays only users whose `tenant_id` matches the bound tenant
- allows `RELOAD USERS`
- allows tenant-scoped freeze/unfreeze through ON-safe CN endpoints
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
- not a grant of access to Token Depot AWS infrastructure

## Install

```bash
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

Edit `data/on-config.v1.json` directly or use the dashboard config form.

Required fields:

```json
{
  "version": 1,
  "tenant_id": "PASTE_AUTHORIZED_TENANT_ID",
  "on_registration_id": "PASTE_AUTHORIZED_ON_REGISTRATION_ID",
  "cn_base_url": "https://authorized-cn-host.example.com",
  "cw_base_url": "https://authorized-wallet-host.example.com",
  "display_name": null,
  "last_validated_at": null
}
```

The ON registration ID must already be stored and authorized by the tenant's Compliance Node. This public repo does not provide Token Depot AWS credentials or bypass hosted tenant authorization.

## Security boundary

See:

```text
SECURITY.md
CONFIGURATION.md
AWS_ACCESS_BOUNDARY.md
```

## Test flow

1. Confirm your authorized CN tenant has:
   - active tenant status
   - `tenant_id`
   - `on_registration_id`
2. Start Oracle Node.
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
