# Phase 6F — Patient Portal Upgrade Report

## Baseline
Started from: `V48_phase6E_hr_staff_module.zip`

## Scope
Upgrade the existing Patient Portal instead of creating a duplicate portal. Preserve existing portal routes and UI patterns while adding safer patient self-service capabilities and stronger own-data isolation.

## Implemented
- Upgraded existing `PatientPortal.jsx` with a structured self-service workspace.
- Added tabbed Patient Portal sections:
  - Overview
  - Appointments
  - Prescriptions / OPD records
  - Lab & Radiology Reports
  - Bills & Receipts
  - Document Vault
  - Medical Timeline
- Hardened patient portal own-data access:
  - Patient/portal roles cannot override `patient_id` through query parameters.
  - Staff roles may select a patient for assisted portal view.
  - Tenant filtering remains enforced through existing tenant middleware and `tenantFilter`.
- Added patient portal audit logging for portal views and denied spoof attempts.
- Added normalized document vault response combining:
  - patient documents
  - lab report files
  - radiology report files
  - bill/receipt metadata
- Added outstanding bill summary and ready-report counts.
- Preserved the existing Doctor Portal route; Doctor Portal upgrade remains planned for Phase 6G.

## New / Improved API endpoints
- `GET /api/portal/patient`
- `GET /api/portal/patient/profile`
- `GET /api/portal/patient/appointments`
- `GET /api/portal/patient/prescriptions`
- `GET /api/portal/patient/reports`
- `GET /api/portal/patient/bills`
- `GET /api/portal/patient/documents`

## Safety Notes
- No duplicate patient portal module was created.
- Existing HMS CRUD modules were not intentionally changed.
- Patient portal users are restricted to their linked patient record.
- Staff-assisted patient selection remains available only for approved staff roles.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- OT/Surgery readiness check passed.
- Nursing readiness check passed.
- Emergency/Casualty readiness check passed.
- Blood Bank enterprise readiness check passed.
- HR/Staff readiness check passed.
- Patient Portal upgrade readiness check passed.
- Frontend production build passed.

## Known Notes
- Frontend build still shows the existing bundle-size warning. This should be handled in a later code-splitting optimization phase.
- Payment collection is intentionally not enabled in this phase; the patient portal safely displays bill status and outstanding amounts only.

## Next Recommended Phase
Phase 6G — Doctor Portal Upgrade.
