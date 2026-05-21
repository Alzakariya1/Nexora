# Phase 4C — Tenant Billing Guardrails & Plan Limits Report

## Baseline
Started from: `V48_phase4B_tenant_admin_subscription_foundation.zip`

## Goal
Add SaaS-safe plan guardrails without harming existing HMS base functionality. Phase 4B introduced tenant lifecycle and subscription foundation; Phase 4C enforces practical tenant usage limits at high-risk create points.

## Implemented
- Added subscription guardrail output to `getHospitalSubscription()`:
  - per-limit `used`, `limit`, `remaining`, `percent`
  - `warning` when usage reaches 80%+
  - `exceeded` when usage reaches/over limit
  - `guardrails.can_create` and `guardrails.blocked_reason`
- Added current-tenant guardrail endpoint:
  - `GET /api/subscription/guardrails`
- Added super-admin tenant guardrail endpoint:
  - `GET /api/tenants/:id/subscription/guardrails`
- Added safe plan-limit enforcement on create flows:
  - Patient creation checks `patients`
  - Doctor creation checks `doctors`
  - Appointment creation checks `appointments_per_month`
  - Medicine creation checks `medicines`
  - User/admin creation limit from Phase 4B remains preserved
- Suspended/cancelled subscriptions are blocked from create flows through the shared `ensureWithinLimit()` helper.
- Added static regression script:
  - `npm run check:plan-limits`

## Safety Notes
- Existing read/list/edit/delete flows were not changed.
- Default enterprise limits are high, so normal existing usage should not be blocked.
- Limit enforcement returns HTTP `402` with subscription details so the UI can show an upgrade/limit message later.
- Tenant isolation and Phase 4A/4B safeguards remain preserved.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- Frontend production build passed.

## Commands Run
```bash
cd backend
npm install --no-audit --no-fund
npm run check-routes
npm run tenant:audit
npm run tenant:safety-check
npm run check:plan-limits

cd ../frontend
npm install --no-audit --no-fund
npm run build
```

## Known Notes
- Frontend build still shows the existing Vite bundle-size warning. This remains planned for a later code-splitting/performance phase.
- No UI changes were made in this phase to avoid disturbing base functionality; guardrail UI banners can be added in a later SaaS dashboard phase.

## Next Recommended Phase
Phase 4D — SaaS Billing UI & Tenant Usage Dashboard.
