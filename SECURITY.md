# Security Notes

## Access boundary

Oracle Node is a local dashboard. It does not include Token Depot AWS credentials, admin tokens, private keys, mnemonics, wallet keys, or tenant secrets.

The local node can only request ON-safe CN endpoints using configured values:

```text
tenant_id
on_registration_id
cn_base_url
```

The public package ships with these fields blank. A user must intentionally configure them. Token Depot-hosted CN infrastructure must still validate the tenant binding server-side.

## What Oracle Node should never contain

```text
TD_ADMIN_TOKEN
AWS access keys
AWS secret keys
private keys
mnemonics
customer wallet keyfiles
broker custody signer material
production deployment secrets
```

## Responsible disclosure

Please report suspected security issues privately to Token Depot Corp before public disclosure.

## Local deployment warning

Bind Oracle Node to `127.0.0.1` by default. Do not expose it publicly unless you understand and accept the risks.
