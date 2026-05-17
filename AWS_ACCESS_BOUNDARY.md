# AWS Access Boundary

The public Oracle Node package does not include AWS credentials and does not have direct AWS access.

Oracle Node talks only to configured HTTP(S) Compliance Node endpoints. The relevant local code path posts tenant binding data to ON-safe CN routes such as:

```text
/api/cn/on/tenant-snapshot
/api/cn/on/user-freeze
/api/cn/on/user-unfreeze
/api/cn/on/tenant-signup-email
```

The public Oracle Node cannot authorize itself into Token Depot AWS. Authorization must be enforced by the hosted Compliance Node using the configured `tenant_id` and `on_registration_id`.

The public package intentionally ships with blank `cn_base_url`, blank `tenant_id`, and blank `on_registration_id` defaults.
