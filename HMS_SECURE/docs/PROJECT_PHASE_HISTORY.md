# Project Phase History

Consolidated phase/report history for the Enterprise HMS project.

Generated in Phase 4C.1 — Documentation Cleanup & Phase Report Consolidation.

## Index
- V45 FIXES
- V47 CHANGELOG
- V48 STABILIZATION REPORT
- PHASE0 AUDIT AND FIX REPORT
- PHASE1A PATIENT MODULE REPORT
- PHASE1B DOCTOR MODULE REPORT
- PHASE1C APPOINTMENT MODULE REPORT
- PHASE1D BILLING MODULE REPORT
- PHASE1E PHARMACY MODULE REPORT
- PHASE2A OPD EMR WORKFLOW REPORT
- PHASE2B PATIENT TIMELINE REPORT
- PHASE2C IPD ADMISSION WORKFLOW REPORT
- PHASE2E ADVANCED LAB WORKFLOW REPORT
- PHASE2F ADVANCED PHARMACY WORKFLOW REPORT
- PHASE3A AUTH SESSION SECURITY REPORT
- PHASE3B ROLE BASED ACCESS CONTROL REPORT
- PHASE3C AUDIT TRAIL HARDENING REPORT
- PHASE3D COMPLIANCE CENTER HARDENING REPORT
- PHASE4A TENANT ISOLATION SAAS SAFETY REPORT
- PHASE4C TENANT BILLING GUARDRAILS PLAN LIMITS REPORT

---


## Source: `V45_FIXES.md`

# V45 Fix Summary

Targeted fixes applied without removing existing HMS functionality:

- Command Center now loads each KPI widget safely and shows zero-state widgets even if one analytics endpoint fails.
- Patient Portal and Doctor Portal dropdown copy improved for admin/staff mode selection.
- Beds module replaced raw generic form with labelled HMS-specific form and valid bed statuses.
- Billing module upgraded from raw patient id/amount form to labelled invoice form with patient dropdown, paid amount, payment mode and invoice register columns.
- Backend Bed model now has ward, bed_number, status and tenant-safe unique index on hospital_id + ward + bed_number.
- Backend bed creation validates duplicate bed numbers per hospital/ward and normalizes status values.
- Backend Billing model now defines invoice fields, totals, paid/due amount, payment status, items and invoice unique index per hospital.
- Billing create payload now supports legacy amount fields and richer invoice totals safely.
- Configuration page now shows load errors instead of staying stuck on “Loading fields...”.
- Added global UI hardening: responsive tables, labelled form styling, command alert grid, empty states, inventory hero contrast, and safer letter spacing.

Validation:
- Backend route loading: passed with `npm run check-routes`.
- Frontend production build: passed with `npm run build`.


## Source: `V47_CHANGELOG.md`

# V47 Full Module Stabilization

Base: V46 enterprise modules.

## Added
- Tenant-scoped EnterpriseFeatureRecord MongoDB model.
- Backend CRUD API for advanced features:
  - GET /api/enterprise-features/:feature/summary
  - GET /api/enterprise-features/:feature/records
  - POST /api/enterprise-features/:feature/records
  - PATCH /api/enterprise-features/:feature/records/:id
  - DELETE /api/enterprise-features/:feature/records/:id
  - PUT /api/enterprise-features/:feature/enabled
- Frontend enterpriseFeatureApi client.
- Reusable EnterpriseFeatureWorkspace component with real create/edit/delete records, feature enable/disable, stats, checklist, audit/integration log views.
- Dedicated FHIRAPIs.jsx page instead of generic placeholder.
- Dedicated WhatsAppSMS.jsx page integrated with Communications.

## Improved
- Advanced feature pages now save tenant-scoped data to MongoDB through backend APIs instead of displaying only static placeholder content.
- Audit Compliance filter uses backend-supported query params.
- Advanced feature UI: readable hero, forms, tables, responsive layout, records table, module-specific checklist.

## Existing functionality protected
- Core pages/routes retained.
- Existing integration logs, API keys, webhooks, FHIR preview, communications, insurance, legal/security, SaaS, hospital management flows remain available.

## Tests run
- Frontend production build: PASS
- Backend route load test: PASS


## Source: `V48_STABILIZATION_REPORT.md`

# V48 Existing Module Stabilization & Polish

Scope: no new feature expansion. This version focuses on improving the existing V47 module experience without removing current functionality.

## Fixed / Improved
- Added global enterprise-module polish CSS for advanced modules and existing card/table/form layouts.
- Improved Legal/Security and advanced module page readability: hero cards, stats cards, form grids, tables, empty states, responsive behavior.
- Standardized buttons, inputs, cards, table wrappers, checklist, status pill and action-row styling.
- Preserved existing frontend routes, backend APIs, models, permissions and feature flags.
- No existing module was intentionally removed or disabled.

## Stabilization Target
- HL7 Ready
- PACS/DICOM
- Biometric
- ERP/Tally
- ABDM/ABHA
- 2FA Security
- Audit Compliance
- Legal & Security
- Inventory/Pharmacy visual consistency
- Command/Production enterprise pages

## Verification
- Frontend production build should be run after extraction with `npm install && npm run build`.
- Backend route loading should be checked with `npm run check-routes` from backend if dependencies are installed.


## Source: `PHASE0_AUDIT_AND_FIX_REPORT.md`

# Phase 0 Audit & Stabilization Report - V48 HMS

## Checks completed

- Backend JavaScript syntax check: PASS
- Backend route load check: PASS
- Backend QA smoke route inventory: PASS, 276 routes loaded
- Frontend production build: PASS
- Backend security-check without env: FAIL as expected because local `.env` is not configured

## Fixes applied in this Phase 0 pass

### 1. CORS configuration improved
File: `backend/src/server.js`

`CORS_EXTRA_ORIGINS` from `.env.example` was present but not used in the server. It is now included with `FRONTEND_URL`, so extra Vercel/custom domains can be added safely without replacing the main frontend URL.

### 2. Production error response hardened
File: `backend/src/middleware/errorHandler.js`

The error handler now returns a standard error shape with `success:false`. In production, internal 500 error messages are hidden and stack traces are not exposed.

### 3. Forgot password flow made safer
File: `backend/src/routes/auth.routes.js`

The reset token is no longer returned in production responses. It is still returned only in non-production environments for development/testing until SMTP is configured.

### 4. Change password validation added
File: `backend/src/routes/auth.routes.js`

`/api/auth/change-password` now validates the new password against `PASSWORD_MIN_LENGTH` before saving.

## Important findings

### Frontend status
Frontend builds successfully, but Vite reports a large bundle warning:

- Main JS bundle: about 1.06 MB before gzip
- Recommendation: split advanced pages with lazy loading after core modules are stable

### Backend status
Backend routes load successfully and critical routes are present. This means there is no immediate route import crash.

### Environment status
The security check currently fails locally because these required variables are missing:

- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`

This is expected unless `.env` is configured locally or Render env variables are configured.

### Database runtime status
A real DB connection test was not completed because no real MongoDB Atlas URI was provided in the uploaded ZIP. To verify runtime fully, configure `.env` and run:

```bash
cd backend
npm run check-db
npm run seed
npm run security-check
npm run qa:smoke
```

## Phase 0 remaining tasks

### Critical

1. Configure backend `.env`
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `JWT_SECRET` with at least 32 random characters
   - `FRONTEND_URL` with live Vercel URL
   - `CORS_EXTRA_ORIGINS` if multiple domains are used

2. Configure frontend `.env`
   - `VITE_API_URL=https://your-render-backend.onrender.com/api`

3. Run live backend checks
   - `npm run check-db`
   - `npm run seed`
   - `npm run security-check`
   - `npm run qa:smoke`

4. Login test
   - Verify seeded admin can log in
   - Verify token is stored
   - Verify `/api/auth/me` works

5. Basic module API test
   - Patients list/create
   - Doctors list/create
   - Appointments list/create
   - Billing list/create
   - Pharmacy medicines list/create
   - Lab templates list/create

### High priority

1. Add request validation layer for important modules.
2. Reduce frontend bundle size using lazy loading.
3. Replace hard deletes with soft deletes in sensitive modules.
4. Standardize API response format across all routes.
5. Add a stable manual test checklist for every core module.

## Recommended next step

Continue Phase 0 with live environment verification. After DB, auth, seed, and login are confirmed, move to Phase 1A: Patient module stabilization.


## Source: `PHASE1A_PATIENT_MODULE_REPORT.md`

# Phase 1A - Patient Module Stabilization Report

## Scope completed
This update starts Phase 1 with the Patient module because it is the base dependency for appointments, OPD/EMR, lab, radiology, pharmacy, billing, and IPD.

## Backend changes
- Added patient payload validation for:
  - full name
  - age range
  - gender enum
  - email format
  - phone format
  - emergency phone format
  - blood group enum
- Added normalization for:
  - phone spacing
  - lowercase email
  - lowercase gender
  - uppercase blood group
- Added active patient filtering so archived patients no longer appear in normal patient lists or profiles.
- Converted patient delete into soft-delete/archive using `status`, `deleted_at`, and `deleted_by`.
- Added patient create/update audit events.
- Added duplicate warning support using patient ID, phone, email, and name+age+gender matching.
- Added `GET /api/patients/duplicate-check` endpoint.
- Kept strict duplicate blocking for same `patient_id` inside the same hospital/tenant.
- Added active-patient checks for profile, timeline, document upload, profile image upload, and document delete.
- Added patient schema fields for `status`, `deleted_at`, and `deleted_by`.

## Frontend changes
- Patient delete UI now shows archive wording instead of hard delete wording.
- Patient document upload no longer requires manual Patient ID before selecting a file. This supports auto-generated/backend patient IDs.
- Create/update patient flow now surfaces duplicate warning toast when the backend detects possible duplicate patients.
- Added patient document delete API method.
- Patient profile document list now supports deleting saved documents.
- Document list keys made safer for records that do not have a frontend-only `id`.

## Validation / checks run
- Backend route loading: PASS
- Backend QA smoke inventory: PASS
- Routes loaded: 277
- Frontend production build: PASS

## Build warnings still present
- Frontend JS bundle is over 500KB. This is not a blocker, but Phase 0/Phase 1 technical debt remains: future code-splitting is recommended.
- Vite warning about `appointmentApi.js` being both dynamically and statically imported remains. This is not caused by the patient module change.

## Remaining Phase 1A improvements recommended next
- Add patient merge workflow for true duplicate resolution.
- Add patient record view audit logging.
- Add patient search API with server-side pagination for large hospitals.
- Add restore archived patient endpoint for admin users.
- Add patient category: cash, insurance, corporate, government scheme, panel.
- Add guardian/family contact structure.
- Add patient consent links to the profile.


## Source: `PHASE1B_DOCTOR_MODULE_REPORT.md`

# Phase 1B — Doctor Module Stabilization Report

## Scope
Phase 1B focused on making the Doctor module safer and closer to enterprise HMS requirements without changing the overall architecture.

## Completed Improvements

### Backend
- Added doctor payload validation for required Doctor ID and full name.
- Added email format validation.
- Added phone format validation.
- Added consultation fee validation as a non-negative number.
- Added department ID numeric validation.
- Added controlled doctor status values: `active`, `inactive`, `on_leave`, `archived`.
- Added duplicate Doctor ID protection per hospital/tenant.
- Added duplicate warning support for doctor phone/email matches.
- Changed doctor delete into soft archive instead of permanent delete.
- Doctor list now hides archived doctors by default.
- Added `include_archived=true` support for admin recovery/audit views.
- Added audit logs for:
  - doctor created
  - doctor updated
  - doctor archived
  - doctor profile image uploaded
  - doctor document uploaded
  - doctor document deleted
- Added doctor schema fields for archive metadata:
  - `deleted_at`
  - `deleted_by`

### Frontend
- Updated doctor delete success message to show archive behavior.
- Existing doctor profile image upload flow remains working.
- Existing doctor document upload/delete flow remains working.
- Existing doctor profile page remains compatible.

## Validation / Test Results

### Backend
- `npm run check-routes`: passed
- `npm run qa:smoke`: passed
- QA smoke route inventory: 277 routes loaded

### Frontend
- `npm run build`: passed

### Known Build Warning
- Frontend JS bundle is still larger than 500 KB after minification.
- This is not blocking, but Phase 8 or later should add route-level code splitting/manual chunks.

## Files Changed
- `backend/src/routes/core.routes.js`
- `backend/src/models/index.js`
- `frontend/src/main.jsx`

## Enterprise HMS Impact
This phase makes Doctor management safer for production by preventing bad doctor records, protecting against accidental permanent deletion, and creating an audit trail around doctor profile changes.

## Recommended Next Phase
Start **Phase 1C: Appointment Module**.

Priority items:
1. Appointment validation
2. Appointment status lifecycle
3. Double-booking prevention
4. Token number generation
5. Reschedule/cancel reason support
6. Queue stability
7. Appointment audit logs


## Source: `PHASE1C_APPOINTMENT_MODULE_REPORT.md`

# Phase 1C — Appointment Module Report

## Status
Completed with regression checks. Base functionality was preserved and appointment workflow was improved without changing existing API names used by the frontend.

## Backend changes
- Strengthened appointment validation for date/time/status/type.
- Kept existing appointment CRUD endpoints intact.
- Added audit logging for:
  - appointment creation
  - appointment status changes
  - appointment edit/reschedule
  - appointment archive
- Converted delete behavior to soft archive instead of permanent delete.
- Hidden archived appointments from normal list and queue responses.
- Added cancellation reason requirement when appointment is cancelled.
- Added optional no-show reason support.
- Added reschedule tracking:
  - previous doctor/date/time
  - rescheduled timestamp
  - reschedule reason
- Improved active-slot conflict logic so archived/cancelled/no-show appointments do not block future bookings.
- Added appointment indexes for daily token lookup and doctor slot lookup.

## Frontend changes
- Added patient selector support using a datalist while preserving manual patient ID entry.
- Added cancellation reason prompt before cancelling an appointment.
- Added optional no-show note prompt.
- Added reschedule reason field when doctor/date/time changes during edit.
- Changed delete confirmation/copy to archive wording to match safer backend behavior.
- Preserved existing appointment board, queue, OPD consult, schedule, and status buttons.

## Existing functionality preserved
- Appointment create
- Appointment update
- Appointment status update
- Appointment queue
- Doctor schedule creation/edit/delete
- Doctor slot protection
- OPD consultation from appointment
- Notification creation on appointment activity
- Existing API paths used by frontend

## Tests run
- Backend syntax check passed.
- Backend route load check passed.
- QA smoke passed: 277 routes loaded.
- Frontend production build passed.

## Known warnings
- Frontend bundle is still larger than 500 KB after minification. This is not a new breakage; later phases should add code-splitting.
- Vite warning: `appointmentApi.js` is dynamically and statically imported. This does not break the build, but can be cleaned later.

## Next recommended phase
Phase 1D — Basic Billing Module.

Focus:
- OPD/lab/radiology/pharmacy bill support
- bill item validation
- payment mode/status flow
- invoice/receipt reliability
- discount reason and audit trail
- soft cancel bill instead of hard delete


## Source: `PHASE1D_BILLING_MODULE_REPORT.md`

# Phase 1D — Basic Billing Module Report

## Source Baseline
- Started from: `V48_phase1C_appointment_module.zip`
- Phase target: Billing module hardening without damaging existing Patient, Doctor, Appointment, Lab, Pharmacy, IPD or SaaS routes.

## Implemented

### Backend Billing Improvements
- Added billing payload validation for:
  - `patient_id`
  - total amount / line items
  - negative amount prevention
  - invalid payment status prevention
  - invalid payment mode prevention
  - invalid service type prevention
  - discount reason requirement when discount is applied
  - paid amount not exceeding total amount
- Added normalized invoice calculation:
  - subtotal
  - GST/tax amount
  - discount
  - total amount
  - paid amount
  - due amount
  - payment status auto-calculation
- Added patient enrichment for billing lists using patient ID / UID.
- Added tenant-aware billing collection support by including `billing` in tenant collections.
- Added active billing filter so archived invoices are hidden from normal lists and summaries.
- Added new billing routes:
  - `GET /api/billing/:id`
  - `PUT /api/billing/:id`
  - `PATCH /api/billing/:id/payment`
  - `PATCH /api/billing/:id/cancel`
  - `DELETE /api/billing/:id`
- Added soft archive instead of hard delete.
- Added cancellation reason requirement.
- Added archive reason requirement.
- Added audit logs for:
  - invoice created
  - invoice updated
  - payment updated
  - invoice cancelled
  - invoice archived
- Improved PDF invoice output with cleaner billing fields instead of dumping every raw database field.
- Revenue summary now excludes cancelled/refunded invoices.

### Billing Model Improvements
Added/standardized fields:
- `transaction_id`
- `service_type`
- `discount_reason`
- `cancel_reason`
- `cancelled_at`
- `cancelled_by`
- `is_archived`
- `archived_at`
- `archived_by`
- `archive_reason`

### Frontend Billing Improvements
- Added billing API methods for:
  - list
  - summary
  - get
  - create
  - update
  - update payment
  - cancel
  - archive
  - PDF URL
- Added billing edit permission mapping: `billingEdit`.
- Billing form now supports:
  - edit existing invoice
  - new invoice reset
  - service type
  - GST/tax
  - discount reason
  - transaction ID
  - patient dropdown retained
  - payment status retained
- Billing table now has action menu support for:
  - edit invoice
  - open PDF
  - record payment
  - cancel invoice
  - archive invoice
- Billing summary excludes cancelled/refunded invoices from revenue totals.

## Regression / Safety Checks

### Backend
- `node --check backend/src/routes/billing.routes.js`: passed
- `node --check backend/src/models/index.js`: passed
- `npm run check-routes`: passed
- `npm run qa:smoke`: passed
- Smoke result: 282 routes loaded

### Frontend
- `npm run build`: passed

## Build Notes
- Existing Vite warning still appears: main JS bundle is larger than 500kB. This existed before this phase and should be handled later with code-splitting.
- Existing React Hot Toast bundle warning still appears. It does not block production build.

## What Was Not Changed
To protect base functionality, this phase did not rewrite:
- Patient module
- Doctor module
- Appointment module
- Lab/Radiology workflow
- Pharmacy workflow
- IPD workflow
- SaaS billing module
- Authentication flow

## Recommended Next Phase
Phase 1E should be **Pharmacy Basic**:
- medicine CRUD validation
- batch/expiry-safe basic stock
- low-stock logic
- patient-linked sale
- prescription-to-pharmacy queue safety
- audit logs
- frontend action flow


## Source: `PHASE1E_PHARMACY_MODULE_REPORT.md`

# Phase 1E Pharmacy Module Report

## Baseline
Started from `V48_phase1D_billing_module.zip` and preserved the existing Phase 0–1D functionality.

## Implemented
- Added stronger medicine validation for required name, non-negative quantity/stock/prices, and valid expiry date.
- Added duplicate protection for active medicines using medicine name + batch number.
- Added pharmacy audit logs for:
  - medicine create
  - medicine update
  - medicine archive
  - stock adjustment
  - direct sale
  - prescription dispense
- Added safe soft archive for medicines instead of permanent delete.
- Added active medicine filtering so archived medicines are hidden from normal medicine, low-stock, and summary screens.
- Improved sale validation for medicine ID, quantity, and selling price.
- Kept stock reduction safety: sale and prescription dispense fail if stock is insufficient.
- Preserved low-stock notifications after stock adjustment, sale, and prescription dispense.
- Added frontend archive action for medicines with reason prompt.
- Improved recent pharmacy sales table to show cleaner sales columns.
- Added API client support for medicine archive.

## Files Changed
- `backend/src/routes/pharmacy.routes.js`
- `frontend/src/api/pharmacyApi.js`
- `frontend/src/pages/Pharmacy.jsx`

## Regression / Build Checks
- Backend syntax check: passed
- Backend route loading: passed
- QA smoke: passed, 283 routes loaded
- Frontend production build: passed

## Notes
- Frontend build still shows the existing large bundle warning. It does not break build, but later phases should add route-level code splitting.
- Pharmacy now has a safer foundation for the later advanced phase: batch-wise dispensing, FEFO, purchase order/GRN connection, returns, and controlled drug register.


## Source: `PHASE2A_OPD_EMR_WORKFLOW_REPORT.md`

# Phase 2A — OPD / EMR Complete Workflow Report

## Baseline
- Started from: `V48_phase1G_admin_user_management.zip`
- Focus: OPD consultation depth, structured EMR continuity, finalize/lock safety, auditability, and patient timeline linkage.

## Implemented

### Backend: OPD Consultation Workflow
- Added structured OPD consultation payload handling.
- Added validation for required `patient_id`/`doctor_id`, chief complaint, diagnosis/assessment, and follow-up date format.
- Added richer OPD fields:
  - Chief complaint
  - History of present illness
  - Past history
  - Medication history
  - Surgical history
  - Family history
  - Allergies
  - Vitals
  - Examination findings
  - Diagnosis / final diagnosis
  - Diagnosis code
  - Clinical notes
  - Treatment plan
  - Advice
  - Referral notes
  - Investigation orders
  - Follow-up date
- Added finalize/lock support using `is_finalized`, `locked_at`, and `finalized_by`.
- Added finalized consultation edit protection: finalized/locked records require `edit_reason` before update.
- Added soft archive for OPD consultations with required archive reason.

### Backend: OPD / EMR Linkage
- OPD consultation creation now also creates a linked SOAP-style `ClinicalRecord`.
- Patient EMR timeline now excludes archived OPD records and archived EMR records.
- EMR record deletion converted to soft archive.

### Backend: Audit Logs
- OPD registration audit added.
- OPD consultation creation audit added.
- Prescription generation audit added.
- Auto consultation bill generation audit added.
- OPD consultation update audit added.
- OPD consultation finalize audit added.
- OPD consultation archive audit added.
- Existing IPD admission/nursing/discharge actions now also create audit events.

### Backend: New/Improved Endpoints
- `GET /api/opd/consultations/:id`
- `PUT /api/opd/consultations/:id`
- `PATCH /api/opd/consultations/:id/finalize`
- `DELETE /api/opd/consultations/:id`

### Data Model
- Expanded `OpdRecord` schema definition while keeping `strict:false` compatibility.
- Added useful OPD indexes:
  - hospital + patient + visit date
  - hospital + doctor + visit date

### Frontend
- OPD consultation modal inside Appointments now captures more real clinical workflow fields:
  - History of present illness
  - Extended vitals
  - Allergies
  - Past history
  - Examination findings
  - Diagnosis code
  - Advice
  - Referral notes
- Consultation save now sends `finalize: true` so the OPD note is locked after completion.
- Button label updated to clarify finalization.
- EMR API client extended with OPD consultation read/update/finalize/archive helpers.

## Regression Tests

Passed:
- Backend route load check
- Backend QA smoke test
- Frontend production build

Results:
- Backend routes loaded successfully.
- QA smoke route inventory: 290 routes loaded.
- Frontend Vite build completed successfully.

## Notes
- Frontend build still has a large bundle warning around ~1MB JS. This is not a breaking error, but future phases should add route-level code splitting.
- The React hot-toast `use client` warning is from the package bundle and is non-blocking.

## Next Recommended Phase
Phase 2B — Patient Timeline Deepening

Recommended tasks:
- Add timeline event grouping by visit/episode.
- Add filters for OPD, prescriptions, billing, lab, radiology, IPD, documents.
- Add patient clinical summary cards directly on patient profile.
- Add direct report/prescription/bill quick actions from patient timeline.


## Source: `PHASE2B_PATIENT_TIMELINE_REPORT.md`

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


## Source: `PHASE2C_IPD_ADMISSION_WORKFLOW_REPORT.md`

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


## Source: `PHASE2E_ADVANCED_LAB_WORKFLOW_REPORT.md`

# Phase 2E — Advanced Lab Workflow Report

## Baseline
- Started from `V48_phase2D_advanced_billing_workflow.zip`.
- Existing Phase 2D billing/IPD/patient/doctor/appointment functionality preserved.

## Implemented
- Extended lab lifecycle statuses with `verified` and `rejected`.
- Added sample/result rejection workflow with mandatory reason.
- Added lab result verification endpoint before approval.
- Added critical result detection using parameter `flag: critical` or `critical_low` / `critical_high` thresholds.
- Added critical alert timestamp and lab-user entry metadata.
- Added TAT calculation on approval.
- Added lab TAT summary endpoint with:
  - total orders
  - pending orders
  - critical alerts
  - rejected samples
  - average TAT hours
- Preserved existing barcode/accession number, machine API order, report upload, approval, archive, audit and notification flows.

## Backend Routes Added/Improved
- `PATCH /api/lab/tests/:id/verify`
- `PATCH /api/lab/tests/:id/reject-sample`
- `GET /api/lab/tat-summary`
- Enhanced `PATCH /api/lab/tests/:id/status`
- Enhanced `PATCH /api/lab/tests/:id/results`
- Enhanced `PATCH /api/lab/tests/:id/approve`

## Testing
- Backend route check: passed
- QA smoke: passed — 301 routes loaded
- Frontend production build: passed

## Notes
- Frontend build required refreshing frontend dependencies after ZIP extraction because the packaged `node_modules/.bin/vite` symlink path was stale. After dependency refresh, build passed.
- Existing frontend bundle-size warning remains from earlier phases and should be handled later with code splitting.

## Next Recommended Phase
Phase 2F — Advanced Pharmacy Workflow:
- batch-wise dispensing
- FEFO expiry logic
- purchase/GRN flow
- returns/refunds
- controlled medicine audit
- stock adjustment approval


## Source: `PHASE2F_ADVANCED_PHARMACY_WORKFLOW_REPORT.md`

# Phase 2F — Advanced Pharmacy Workflow Report

## Baseline
Started from `V48_phase2E_advanced_lab_workflow.zip`.

## Implemented
- Expiry alert endpoint for near-expiry/expired medicines.
- Purchase/GRN-style stock receive endpoint.
- Sale return workflow with mandatory reason.
- Stock restoration on sale return.
- Controlled medicine register endpoint.
- Audit logs for purchase receive and sale return.
- Existing medicine CRUD, low-stock, direct sale, prescription dispense and summary flows preserved.

## New/Improved API Endpoints
- `GET /api/pharmacy/expiry-alerts?days=90`
- `POST /api/pharmacy/purchase-receive`
- `POST /api/pharmacy/sales/:id/return`
- `GET /api/pharmacy/controlled-register`

## Safety Notes
- No hard delete introduced.
- Existing stock deduction flow preserved.
- Return flow blocks duplicate full returns and requires a reason.
- Purchase receive updates an existing medicine batch or creates a new batch.
- Controlled register is metadata/category based for now; later it should become a stricter statutory register with dispensing signatures and ID capture.

## Checks
- Backend route load check: passed.
- QA smoke: 305 routes loaded.
- Frontend production build: passed.
- Build warning remains: large frontend bundle; code-splitting should be handled in a later optimization phase.

## Next Recommended Phase
Phase 3A — Authentication & Session Security.


## Source: `PHASE3A_AUTH_SESSION_SECURITY_REPORT.md`

# Phase 3A — Authentication & Session Security Report

## Baseline
Started from: `V48_phase2F_advanced_pharmacy_workflow.zip`

## Implemented

### Backend
- Added `AuthSession` model for persistent session tracking.
- Added session-aware access token payload with `session_id`.
- Added refresh-token flow with hashed refresh token storage.
- Added refresh-token rotation on each refresh.
- Added `/api/auth/logout` to revoke current session.
- Added `/api/auth/logout-all` to revoke all active sessions for current user.
- Added `/api/auth/sessions` to view recent user sessions.
- Added failed-login tracking on user records.
- Added temporary account lockout after configurable failed attempts.
- Added session revocation after password change.
- Added session revocation after password reset.
- Added password complexity option through environment flag.
- Added password-change audit/security logs.
- Added login lockout audit/security logs.

### Frontend
- Login now stores `refreshToken` when returned by backend.
- Axios client now attempts token refresh on expired access token.
- Failed refresh clears auth storage so stale sessions do not continue silently.
- Auth API now supports refresh, logout, logout-all and sessions endpoints.

## New / Updated API Endpoints
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/sessions`

## New Environment Options
```env
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_EXPIRES_IN=7d
LOGIN_LOCK_ATTEMPTS=5
LOGIN_LOCK_DURATION=15m
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_COMPLEXITY=false
```

## Regression Checks
- Backend syntax check: passed
- Backend route check: passed
- QA smoke: passed, 309 routes loaded
- Frontend production build: passed

## Notes
- Existing base flows were preserved.
- Current bundle-size warning remains from earlier phases and is not a functional blocker.
- For stricter production deployment, set `PASSWORD_REQUIRE_COMPLEXITY=true` and use a strong `JWT_SECRET`.

## Next Recommended Phase
Phase 3B — Role-Based Access Control / Permission Builder.


## Source: `PHASE3B_ROLE_BASED_ACCESS_CONTROL_REPORT.md`

# Phase 3B — Role-Based Access Control / Permission Builder Report

## Baseline
Started from: `V48_phase3A_auth_session_security.zip`

## Implemented

### Backend RBAC hardening
- Added central permission metadata:
  - `ALL_PERMISSIONS`
  - `PERMISSION_LABELS`
  - `PERMISSION_GROUPS`
  - permission catalog builder
- Added grantable-permission filtering based on the logged-in actor.
- Prevented managers from assigning custom permissions they do not personally have.
- Prevented custom permissions from duplicating the selected role's base permissions.
- Preserved role hierarchy protection:
  - `super_admin` can manage all roles.
  - `admin` cannot create/manage `super_admin`.
  - `hospital_admin` cannot create/manage platform admin roles.
- Added `/api/auth/roles` for user-management screens.
- Expanded `/api/auth/permissions` to return:
  - current role
  - effective permissions
  - role permission matrix
  - all valid permissions
  - grouped permission catalog
  - manageable roles

### User-management safety
- Create-user flow now sanitizes custom permissions by actor authority and target role.
- Update-user flow now sanitizes custom permissions by actor authority and target role.
- Users cannot manage permissions for roles above their authority.
- Existing self role/status protection remains intact.
- Existing soft deactivate behavior remains intact.

### Frontend permission builder
- Added role-aware permission catalog loading from `/auth/permissions`.
- Added custom permission selector to Add User workflow.
- Added per-user permission builder in Admin Profile user list.
- Role base permissions remain automatic; selected checkboxes store only custom override permissions.
- Added permission builder UI styling.

## Regression checks

Passed:
- Backend route load check
- QA smoke route inventory
- Frontend production build

## Route count
QA smoke detected: **310 routes**

## Notes
- Frontend bundle-size warning still exists from previous phases. It is not a functional failure. It should be handled later with code-splitting/manual chunks.
- React Hot Toast `use client` bundling warning is from dependency packaging and did not block build.

## Next recommended phase
**Phase 3C — Audit Trail Hardening**

Recommended focus:
- Patient record view audit
- Old/new value audit consistency
- Audit reason enforcement for sensitive actions
- Export/download audit
- Permission change audit details
- Audit filters and compliance-ready exports


## Source: `PHASE3C_AUDIT_TRAIL_HARDENING_REPORT.md`

# Phase 3C — Audit Trail Hardening Report

## Baseline
- Started from: `V48_phase3B_rbac_permission_builder.zip`
- Target phase: Phase 3C — Audit Trail Hardening

## Implemented

### Backend audit utility hardening
- Added automatic `changed_fields` detection when both old and new values are supplied.
- Added audit `reason` support from explicit audit payload, request body, or query string.
- Added audit `metadata` support for structured context.
- Preserved redaction of sensitive values such as passwords, tokens, reset tokens, and authorization data.

### Audit log model improvements
- Added fields:
  - `reason`
  - `changed_fields`
  - `metadata`
- Added entity timeline index for faster entity-level audit lookup.
- Added severity/date lookup index.

### Audit API improvements
- Added filters for:
  - severity
  - action
  - entity type
  - entity id
  - date range
- Added entity-specific audit endpoint:
  - `GET /api/audit-logs/entity/:entityType/:entityId`
- Audit CSV export now includes:
  - reason
  - changed fields
  - severity
- Audit export action now creates its own audit log entry.
- Security summary now includes:
  - patient record views in last 24 hours
  - export events in last 24 hours

### Patient access audit hardening
- Patient profile view now creates an audit log.
- Patient timeline view now creates an audit log.
- Patient sensitive edits now require a reason for:
  - medical notes
  - insurance provider
  - insurance policy number
  - direct document array changes
- Patient document upload now creates an audit log.
- Patient document delete now requires a reason and creates an audit log.
- Patient profile image update now creates an audit log.

### Frontend improvements
- Audit & Security page now supports extra filters:
  - severity
  - entity type
  - entity id
  - from date
  - to date
- Audit rows now show:
  - changed fields
  - reason
  - severity
- Dashboard stats now show:
  - patient views in 24h
  - exports in 24h
- Patient document deletion now asks for a deletion reason.

## Regression checks
- Backend syntax check: passed
- Backend route load check: passed
- QA smoke: passed — 311 routes loaded
- Frontend production build: passed

## Notes
- Existing frontend bundle-size warning remains. It is not a functionality failure; it should be handled later with route-level code splitting.
- Audit logging remains non-blocking by design: if audit write fails, core workflows continue.

## Next recommended phase
Phase 3D — Compliance Center / NABH-style workflow hardening.


## Source: `PHASE3D_COMPLIANCE_CENTER_HARDENING_REPORT.md`

# Phase 3D — Compliance Center Hardening Report

## Baseline
Started from: `V48_phase3C_audit_trail_hardening.zip`

## Implemented
- Added weighted compliance score logic: compliant = full score, partial = half score.
- Added incident CAPA endpoint with required root cause, corrective action and preventive action.
- Added incident evidence endpoint with attachment metadata and audit logging.
- Added checklist evidence endpoint with reviewed-by, evidence notes/URL and automatic review timestamp.
- Preserved existing consent, SOP, incident, checklist, backup and export flows.
- Preserved tenant filtering and permission requirements.

## New/Improved API endpoints
- `POST /api/compliance/incidents/:id/capa`
- `POST /api/compliance/incidents/:id/evidence`
- `POST /api/compliance/checklists/:id/evidence`
- `GET /api/compliance/summary` now includes `checklistPartial` and weighted `complianceScore`.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Frontend production build passed.

## Notes
- Evidence endpoints currently store evidence metadata/URLs. File upload integration can be connected to Cloudinary in a later document-management hardening phase.
- CAPA fields are stored on the incident document to avoid breaking existing incident UI/data flow.

## Next Recommended Phase
Phase 4A — Tenant Isolation & SaaS Safety.


## Source: `PHASE4A_TENANT_ISOLATION_SAAS_SAFETY_REPORT.md`

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


## Source: `PHASE4C_TENANT_BILLING_GUARDRAILS_PLAN_LIMITS_REPORT.md`

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
