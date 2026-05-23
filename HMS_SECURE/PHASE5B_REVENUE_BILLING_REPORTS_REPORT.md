# Phase 5B — Revenue & Billing Reports Report

## Baseline
Started from: `V48_phase5A_patient_appointment_reports.zip`

## Goal
Add tenant-safe revenue and billing reports without changing core billing CRUD, patient, appointment, pharmacy, lab, IPD or SaaS flows.

## Implemented
- Added tenant-safe revenue and billing analytics endpoint.
- Added report period validation using `from` and `to` query dates.
- Added daily revenue trend metrics.
- Added payment mode report.
- Added service-type revenue report.
- Added doctor-wise revenue report where billing data contains `doctor_id`.
- Added department-wise revenue report through doctor-to-department mapping where available.
- Added payment status mix.
- Added outstanding dues metrics:
  - selected period outstanding
  - lifetime outstanding from open bills
  - insurance outstanding from open insurance claims
- Added discount and refund monitoring metrics.
- Added risk flags for high outstanding, high discounts and high refunds.
- Extended Reports UI with a new `Revenue & Billing` tab.
- Preserved Phase 5A Patient & Appointment Reports tab.
- Added regression check: `npm run check:phase5b-reports`.

## New/Improved API Endpoint
- `GET /api/reports/revenue-billing?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Files Changed
- `backend/src/routes/reports.routes.js`
- `backend/scripts/phase5b-revenue-billing-reports-check.js`
- `backend/package.json`
- `frontend/src/api/reportApi.js`
- `frontend/src/pages/Reports.jsx`
- `docs/LATEST_PHASE_REPORT.md`

## Safety Notes
- Report endpoint is read-only.
- Endpoint uses existing `verifyToken`, `attachTenant`, `tenantFilter(req, ...)` and `requirePermission('analytics.view')`.
- Existing billing create/update/payment/refund/cancel flows were not changed.
- Department-wise revenue is derived through doctor mapping when a bill has doctor linkage; otherwise values remain grouped as unassigned.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- Tenant backup/restore/export hardening check passed.
- Phase 4N continuation backup/restore/export safety check passed.
- Phase 5A patient and appointment reports check passed.
- Phase 5B revenue and billing reports check passed.
- Frontend production build passed.

## Known Note
- Frontend build still shows the existing Vite bundle-size warning. This is already planned for the later code-splitting/performance phase.

## Next Recommended Phase
Phase 5C — Pharmacy, Lab & IPD Reports.
