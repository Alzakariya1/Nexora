# Phase 4D — SaaS Billing UI & Tenant Usage Dashboard Report

## Baseline
Started from: `V48_phase4C_2_vercel_root_flatten_deployment_fix.zip`

## Goal
Improve SaaS billing visibility and tenant usage monitoring without harming existing hospital workflows, tenant isolation, RBAC, or billing/pharmacy/lab/patient/doctor base flows.

## Implemented
- Added SaaS Control Center commercial operations dashboard cards:
  - Collection rate
  - Total collected
  - Outstanding subscription dues
  - Subscription invoice status summary
- Added high-usage tenant panel to surface tenants near plan limits or with subscription warnings.
- Improved tenant usage visibility in the Configuration page by labeling it as a Tenant Usage Dashboard and showing guardrail warnings when usage is close to/exceeds plan limits.
- Fixed frontend lifecycle API call to use the canonical Phase 4B lifecycle endpoint:
  - `POST /api/tenants/:id/lifecycle/:action`
- Hardened the older compatibility lifecycle route so only `super_admin` can use it.
- Added default hospital protection to the compatibility lifecycle route so it cannot be suspended or cancelled.
- Added `npm run check:saas-ui` backend safety check for SaaS UI/API wiring.

## Preserved
- Existing tenant isolation protections from Phase 4A.
- Tenant lifecycle and subscription foundation from Phase 4B.
- Plan limit guardrails from Phase 4C.
- Vercel flattened root structure from Phase 4C.2.
- Existing patient, doctor, appointment, pharmacy, lab, radiology, billing, compliance and audit flows.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- Frontend production build passed.

## Known Notes
- Frontend build still shows the existing Vite bundle-size warning. This is expected and should be handled in a later code-splitting optimization phase.
- `react-hot-toast` module directive warning remains non-blocking.

## Next Recommended Phase
Phase 4E — SaaS Invoice Automation & Dunning Readiness.
