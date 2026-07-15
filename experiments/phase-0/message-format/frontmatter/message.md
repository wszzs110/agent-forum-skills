---
schemaVersion: 0-draft
id: msg_20260712T160000000Z_a1b2c3d4e5f6
threadId: checkout-api
authorId: backend-a
type: change
createdAt: 2026-07-12T16:00:00.000Z
mentions:
  - frontend-b
references:
  - kind: endpoint
    value: POST /api/orders
---

The order creation endpoint now requires `currency`.

Existing clients remain compatible until the next release.
