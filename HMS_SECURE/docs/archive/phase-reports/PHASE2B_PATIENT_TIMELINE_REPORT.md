# Phase 2B — Patient Timeline / Medical Journey

## Baseline
Started from `V48_phase2A_opd_emr_workflow.zip`.

## Implemented
- Expanded patient timeline from basic EMR events to full patient journey.
- Added patient identity matching using `patient_id`, `patient_uid`, and numeric `id` for safer cross-module linkage.
- Added timeline support for:
  - Patient registration
  - Appointments
  - OPD consultations
  - Clinical records
  - Prescriptions
  - Billing
  - Pharmacy sales
  - Lab tests
  - Radiology tests
  - IPD admissions
  - Insurance/TPA claims
  - Nursing notes
  - Uploaded documents
- Improved archived/deleted filtering so inactive clinical or financial records are not shown in the active patient journey.
- Added pending amount summary directly from patient-linked billing records.
- Improved frontend timeline rendering with module-specific icons and detail lines.
- Removed the old 12-event display limit so profile can show the complete available timeline.
- Fixed patient document delete bug where the document array was spliced twice.
- Added audit event for patient document deletion.

## Files Changed
- `backend/src/routes/patient.routes.js`
- `frontend/src/pages/Patients.jsx`

## Regression Checks
- Backend route load: PASSED
- Backend QA smoke: PASSED — 290 routes loaded
- Frontend production build: PASSED

## Notes
- Timeline quality depends on each module storing patient references consistently. This phase made patient matching more tolerant by checking `patient_id`, `patient_uid`, and numeric `id`.
- Future Phase 2C IPD work should make admission, bed transfer, nursing, discharge and billing-clearance records more structured so the patient timeline becomes even richer.
