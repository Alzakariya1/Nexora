# Phase 6G — Doctor Portal Upgrade Report

## Baseline
Started from: `V48_phase6F_patient_portal_upgrade.zip`

## Objective
Upgrade the existing Doctor Portal without creating a duplicate portal, while preserving all existing HMS, SaaS, reporting, clinical, Blood Bank, HR and Patient Portal functionality.

## Implemented
- Upgraded existing Doctor Portal backend payload builder.
- Added doctor own-data isolation guardrail:
  - doctor/portal_doctor users cannot select or spoof another `doctor_id`.
  - authorized staff/admin users can still select a doctor for operational support.
- Added audit logging for doctor portal access and spoof-denial events.
- Added segmented doctor portal API endpoints:
  - `GET /api/portal/doctor`
  - `GET /api/portal/doctor/queue`
  - `GET /api/portal/doctor/patients`
  - `GET /api/portal/doctor/emr`
  - `GET /api/portal/doctor/results`
  - `GET /api/portal/doctor/follow-ups`
- Added assigned-patient aggregation from appointments, consultations, lab orders and radiology orders.
- Added ready-results aggregation for completed/approved/reported lab and radiology results.
- Added follow-up list from OPD records with upcoming follow-up dates.
- Added doctor access metadata:
  - self-service vs staff view
  - own-data-only flag
  - selected doctor context
- Upgraded existing Doctor Portal UI with tabs:
  - Overview
  - Today Queue
  - Assigned Patients
  - EMR
  - Results
  - Follow-ups
- Added doctor portal API client methods.
- Added new regression check:
  - `npm run check:phase6g-doctor-portal`

## Safety Notes
- No duplicate doctor portal was created.
- Existing Patient Portal was preserved.
- Existing HMS modules were not intentionally changed.
- Doctor self-service access is restricted to the linked doctor profile.
- Admin/hospital admin selection remains available for operational support.

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- Phase 5A patient/appointment reports check
- Phase 5B revenue/billing reports check
- Phase 5C pharmacy/lab/IPD reports check
- Phase 5D executive command center check
- Phase 6A OT/Surgery check
- Phase 6B Nursing check
- Phase 6C Emergency/Casualty check
- Phase 6D Blood Bank enterprise check
- Phase 6E HR/Staff check
- Phase 6F Patient Portal check
- Phase 6G Doctor Portal check
- Frontend production build

## Known Note
- Vite bundle-size warning still remains and should be handled later in the optimization/code-splitting phase.

## Next Recommended Phase
Phase 7A — FHIR Implementation, unless you want to add another refinement phase for Patient/Doctor Portal UI before integrations.
