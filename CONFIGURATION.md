# Oracle Node Configuration

Oracle Node is configured through:

```text
data/on-config.v1.json
```

Default public package configuration:

```json
{
  "version": 1,
  "tenant_id": "",
  "on_registration_id": "",
  "cn_base_url": "",
  "cw_base_url": "",
  "display_name": null,
  "last_validated_at": null
}
```

## Required fields

`tenant_id` identifies the tenant this local Oracle Node is bound to.

`on_registration_id` is the registration secret/id issued for that tenant's Oracle Node.

`cn_base_url` points to the authorized Compliance Node endpoint that exposes ON-safe APIs.

`cw_base_url` is optional display/config context for the related Compliance Wallet host.

## Hosted Token Depot access

This repository does not grant access to Token Depot AWS infrastructure. Hosted access requires paid/authorized tenant registration and server-side validation by Token Depot-controlled infrastructure.
