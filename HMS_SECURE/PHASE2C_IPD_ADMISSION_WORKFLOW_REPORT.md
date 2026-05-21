# Phase 2C — IPD / Admission Workflow Report

## Baseline
- Started from: `V48_phase2B_patient_timeline.zip`
- Scope: IPD admission workflow, bed allocation, transfer/discharge safety, nursing notes, audit logs, patient timeline continuity, and regression testing.

## Backend Changes
- Hardened `POST /api/ipd/admit` with validation for patient, consultant, bed, admission type and admission reason.
- Added active-admission guard so the same patient cannot be admitted twice while an active IPD record exists.
- Added bed availability guard so occupied/admitted beds cannot be reused.
- Admission now stores patient UID/name, consultant ID, bed ID, ward, bed number, diagnosis, admission reason and bed history.
- Bed status is automatically changed to `occupied` on admission.
- Added `GET /api/ipd` with non-archived filtering, patient/status filters, and patient/doctor/bed enrichment.
- Added `PATCH /api/ipd/:id/status` for IPD lifecycle statuses:
  - admission_requested
  - admitted
  - under_treatment
  - discharge_initiated
  - billing_pending
- Added `PATCH /api/ipd/:id/transfer-bed` with transfer reason, bed availability check, old-bed release and new-bed occupation.
- Added `POST /api/ipd/nursing-notes` with admission validation and patient linkage.
- Added `GET /api/ipd/:id/nursing-notes`.
- Hardened `POST /api/ipd/discharge` with required discharge summary and automatic bed release.
- Added `DELETE /api/ipd/:id` as safe archive instead of hard delete, with reason and bed release.
- Added/expanded audit events for admission, status update, bed transfer, nursing notes, discharge and archive.

## Frontend Changes
- Added `ipdApi` client.
- Added new IPD page/module.
- Added IPD tab in navigation.
- Added admission form with patient, consultant, available bed, admission type, admission date, diagnosis and admission reason.
- Added admission register with patient/bed/status details.
- Added action controls for:
  - status update
  - discharge initiation
  - billing pending
  - bed transfer
  - nursing note
  - discharge
  - safe archive
- Added IPD state loading in the main application.
- Added IPD permissions visibility via existing role/permission utility.
- Added IPD to enabled hospital modules so the page can appear for hospital/enterprise plans.

## Safety Notes
- Existing patient, doctor, appointment, OPD, billing, pharmacy, lab/radiology and timeline code was preserved.
- IPD archive is soft archive only.
- Discharge and archive automatically release the bed to `available`.
- Bed transfer requires a reason and blocks occupied beds.
- Patient timeline already reads IPD admissions and will continue to show admission/discharge records while archived records remain hidden.

## Tests Passed
- Backend JS syntax check: passed.
- Backend route check: passed.
- QA smoke route inventory: 294 routes loaded.
- Frontend production build: passed.

## Remaining Future Improvements
- Dedicated discharge summary PDF.
- Structured nursing chart with vitals trend.
- Medication Administration Record (MAR).
- IPD billing auto-posting for bed/doctor/nursing charges.
- Insurance pre-authorisation connection.
- Bed occupancy analytics by ward/floor.
