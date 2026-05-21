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
