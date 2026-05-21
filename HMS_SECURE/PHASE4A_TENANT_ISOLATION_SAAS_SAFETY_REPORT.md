# Phase 4A — Tenant Isolation & SaaS Safety Report

## Baseline
Started from: `V48_phase3D_compliance_center_hardening.zip`

Previous completed phase: Phase 3D — Compliance Center Hardening.

## Goal
Improve tenant isolation and SaaS safety without harming existing hospital workflows, compliance flows, or production build stability.

## Inspection Summary
Reviewed tenant middleware, tenant-aware model wiring, SaaS/platform routes, tenant database routes, route loading, and existing tenant audit script.

### Key Tenant Isolation Risks Found
1. `x-hospital-id` / `x-tenant-hospital-id` headers could influence tenant context before strict role validation.
2. Client-supplied `hospital_id` inside create payloads could override tenant-scoped creation data.
3. Platform-level SaaS and tenant-management endpoints were permission-gated, but not consistently role-gated to `super_admin`.
4. Regression coverage existed for route wiring and tenant route usage, but not for tenant-spoofing safety behavior.

## Implemented Safely

### 1. Locked tenant context for non-super-admin users
Updated `backend/src/middleware/tenant.js`:
- Added `isSuperAdmin(req)` helper.
- Added `validPositiveId(value)` helper.
- Regular users are now pinned to the `hospital_id` in their JWT/user context.
- `x-hospital-id` / `x-tenant-hospital-id` tenant switching remains available only for `super_admin`.
- Token tenant DB is trusted only when it matches the token hospital.

### 2. Prevented create-payload tenant override
Updated `tenantCreateData(req, data)`:
- Client-provided `hospital_id` no longer overrides tenant-scoped create data.
- Created records now use the resolved safe `req.hospital_id`.
- Existing default-hospital compatibility remains preserved.

### 3. Platform-only protection for SaaS master routes
Added `allowRoles('super_admin')` to platform-wide tenant/SaaS endpoints, including:
- Tenant management routes
- Tenant database provisioning/backup routes
- SaaS overview/export routes
- SaaS billing routes
- SaaS business/onboarding routes
- Sales admin routes
- Cross-tenant subscription management routes

Public sales/marketing routes and normal tenant self-route `/tenant/me` were preserved.

### 4. Added tenant safety regression check
Added new script:
- `backend/scripts/tenant-safety-check.js`

Added npm command:
- `npm run tenant:safety-check`

This validates:
- Non-super-admin users cannot spoof tenant via headers.
- Super admin intentional tenant switching still works.
- Client `hospital_id` is ignored during tenant-scoped create payload generation.
- Platform permission assumption is safe.
- Tenant DB name sanitization is working.

## Files Changed
- `backend/src/middleware/tenant.js`
- `backend/src/routes/tenant.routes.js`
- `backend/src/routes/tenant-database.routes.js`
- `backend/src/routes/saas.routes.js`
- `backend/src/routes/saas-billing.routes.js`
- `backend/src/routes/saas-business.routes.js`
- `backend/src/routes/sales.routes.js`
- `backend/src/routes/subscription.routes.js`
- `backend/scripts/tenant-safety-check.js`
- `backend/package.json`

## Regression Checks Run

### Backend
- `npm install --no-audit --no-fund` — Passed
- `npm run check-routes` — Passed
- `npm run tenant:audit` — Passed
- `npm run tenant:safety-check` — Passed

### Frontend
- `npm install --no-audit --no-fund` — Passed
- `npm run build` — Passed

## Notes
- Frontend production build still shows the known Vite bundle-size warning. This was already noted for a later code-splitting optimization phase.
- React Hot Toast `use client` warning remains non-blocking.
- No broad model/schema rewrites were done in this phase to avoid disturbing base functionality.
- Database-per-tenant and shared-database compatibility were preserved.

## Recommended Next Phase
Phase 4B — Subscription Enforcement & Plan Limit Guardrails.
