# Phase 5A — Patient & Appointment Reports

## Goal
Add tenant-safe operational reports for patient registrations and appointment performance without changing existing HMS CRUD flows.

## Added
- Patient and appointment report backend route.
- Date range filters with safe defaults.
- Daily registration and appointment trend.
- New vs repeat appointment patient indicators.
- Department-wise patient/appointment summary.
- Doctor-wise appointment summary.
- Appointment status mix with cancellation/no-show rates.
- Average waiting-time metric based on check-in and consultation timestamps.
- Reports UI page with summary cards and tables.
- Regression check: `npm run check:phase5a-reports`.

## Endpoint
- `GET /api/reports/patients-appointments?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Safety
- Uses existing auth and tenant middleware.
- Requires `analytics.view` permission.
- Uses `tenantFilter(req)` for all report queries.
- Read-only reporting endpoint; no patient, appointment, billing, pharmacy, lab, or SaaS business data mutation.
