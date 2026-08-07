---
name: OpenAPI integer compatibility
description: Compatibility constraint between the workspace's Orval Zod output and its pinned Zod version.
---

When extending the OpenAPI contract in this workspace, avoid relying on generated
`z.int()` because the pinned Zod version does not expose that helper. Use a
number-shaped client contract when necessary and enforce integer validation at
the backend boundary (for example with Pydantic).

**Why:** Orval code generation succeeded but the workspace library typecheck
failed whenever an OpenAPI `integer` schema produced `z.int()`.

**How to apply:** After changing the OpenAPI spec, run codegen and the library
typecheck before wiring new routes or frontend hooks. Keep domain-level integer
validation in the server if the client contract uses `number`.