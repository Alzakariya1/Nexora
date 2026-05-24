# HMS Enterprise Project Notes

This file consolidates phase notes from previous package versions to keep the ZIP clean.



---

## PHASE3_STEP10_NOTES.md

# Phase 3 Step 10 - Hospital Details, Branding, Three-Dot Actions

## Added
- Hospital details/settings fields in Hospitals panel.
- Hospital branding fields: primary and secondary colors.
- Prefix settings: UHID, bill, prescription, and lab report prefixes.
- Hospital logo file upload using existing Cloudinary setup.
- Hospital details modal.
- Hospital admin users modal.
- Three-dot row actions:
  - View Details
  - Edit Hospital
  - Upload Logo
  - Manage Modules
  - Manage Features
  - Manage Admin Users
  - Disable/Enable
  - Archive Hospital
- Safe archive endpoint instead of hard delete.

## Safety
- Existing data is not reset.
- Existing login flow is preserved.
- `.env` is not included.
- `node_modules` and `dist` are not included.
- `package-lock.json` is preserved for backend and frontend.

## New API Endpoints
- POST /api/tenants/:id/logo
- DELETE /api/tenants/:id

## Important
Archive is soft delete: hospital status becomes `archived`, `is_deleted=true`, and hospital login is blocked.



---

## PHASE3_STEP11B3_DOCTOR_DOCUMENT_UPLOAD_V4_NOTES.md

# PHASE3 STEP11B3 DOCTOR DOCUMENT UPLOAD V4

Base used:
- HMS_SECURE_PHASE3_STEP11B3_DOCTOR_IMAGE_UPLOAD_V3.zip

Scope:
- Phase 4 only: doctor documents/certificates upload and management.
- No unrelated enterprise modules were changed.

Backend changes:
- Added POST `/api/doctors/:id/documents`
  - Requires `doctor.document.manage`
  - Uploads doctor registration/license/certificate files to Cloudinary
  - Saves files in `doctor.certificates`
  - Supports PDF, DOC, DOCX, JPG, PNG, WEBP
  - Max file size: 8MB
- Added DELETE `/api/doctors/:id/documents/:docIndex`
  - Requires `doctor.document.manage`
  - Deletes Cloudinary file when `file_public_id` exists
  - Removes document from doctor certificates array
- Added `doctor.document.manage` permission for admin and hospital_admin.
- Existing doctor profile image upload remains limited to 3MB through validation.

Frontend changes:
- Doctor profile now includes an upload form for:
  - Registration Certificate
  - Medical License
  - Degree Certificate
  - Specialization Certificate
  - Experience Letter
  - Government ID
  - Other
- Doctor profile now shows document list with:
  - View
  - Download
  - Delete
- Profile refreshes after upload/delete.
- Existing doctor profile image functionality remains unchanged.

Checks completed:
- Backend syntax check passed:
  - backend/src/routes/core.routes.js
  - backend/src/models/index.js
  - backend/src/config/permissions.js
  - frontend/src/api/doctorApi.js
- Frontend build passed with existing Vite bundle-size warning only.

Important deployment note:
- Render must have valid Cloudinary environment variables for image/document upload:
  - CLOUDINARY_CLOUD_NAME
  - CLOUDINARY_API_KEY
  - CLOUDINARY_API_SECRET

Excluded from ZIP:
- .env
- node_modules
- dist



---

## PHASE3_STEP11B3_DOCTOR_FINAL_POLISH_TESTING_V6_NOTES.md

# Phase 3 Step11B3 Doctor Final Polish & Testing V6

Base used: `HMS_SECURE_PHASE3_STEP11B3_DOCTOR_PROFILE_EDIT_INTEGRATION_V5.zip`

## Scope
Phase 6 was intentionally limited to final doctor-profile polish and verification. No unrelated enterprise modules were rewritten.

## Doctor profile polish completed
- Added safer Back to Doctors behavior from doctor profile:
  - cancels active doctor edit mode
  - resets pending document form
  - returns to doctors list cleanly
- Added doctor image upload UI busy state.
- Added doctor document upload UI busy state.
- Added doctor document delete busy state.
- Added document file-size display in doctor profile document list.
- Kept existing patient profile, permissions, module controls, hospital settings, billing, pharmacy, lab/radiology, appointments, and dashboard functionality untouched.

## Stability retained from earlier phases
- Doctor update duplicate logic still excludes the current doctor.
- Doctor profile uses fresh `GET /api/doctors/:id` data.
- Doctor image upload route remains `/api/doctors/:id/profile-image`.
- Doctor document upload route remains `/api/doctors/:id/documents`.
- Doctor document delete route remains `/api/doctors/:id/documents/:docIndex`.
- Doctor profile edit still refreshes profile data after save.

## Checks run
From extracted project root:

```bash
node --check backend/src/routes/core.routes.js
node --check backend/src/models/index.js
node --check backend/src/config/permissions.js
npm --prefix frontend ci
npm --prefix frontend run build
```

Result:
- Backend syntax checks passed.
- Frontend production build passed.

## Packaging rule followed
Excluded from ZIP:
- `.env`
- `node_modules`
- `dist`

Included:
- `package.json`
- `package-lock.json`
- `.env.example`

## Deployment reminder
On Render, verify Cloudinary environment variables before testing doctor image/document uploads:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Also run the existing doctor index migration once if the old global `doctor_id_1` index exists in MongoDB Atlas:

```bash
npm run fix-doctor-indexes
```



---

## PHASE3_STEP11B3_DOCTOR_IMAGE_UPLOAD_V3_NOTES.md

# Phase 3 Doctor Image Upload V3

Base used: HMS_SECURE_PHASE3_STEP11B3_DOCTOR_PROFILE_VIEW_V2.zip

## Scope
This phase only adds doctor profile image upload. Doctor document/certificate upload is intentionally left for Phase 4.

## Backend changes
- Added `POST /api/doctors/:id/profile-image` in `backend/src/routes/core.routes.js`.
- Uses `multer.memoryStorage()` with 3MB limit.
- Accepts field name: `profile_image`.
- Allows JPG, PNG, WEBP only.
- Uploads to Cloudinary folder: `hms/doctor-profile-images`.
- Replaces old image by deleting previous `profile_image_public_id` when present.
- Saves:
  - `profile_image_url`
  - `profile_image_public_id`
- Returns clear 500 message if Cloudinary env vars are missing/wrong on Render.

## Frontend changes
- Added `doctorApi.uploadProfileImage(id, formData)`.
- Doctor profile now shows a camera button over the avatar for users with `doctor.edit` permission.
- Upload refreshes fresh doctor profile data after success.
- Doctor list is reloaded after image upload.

## Required Render env vars
Backend Render service must have:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

These are now also listed in `backend/.env.example`.

## Checks performed
- Backend syntax check passed for `backend/src/routes/core.routes.js`.
- Backend syntax check passed for `backend/src/models/index.js`.
- Frontend `npm run build` passed after installing dependencies with `npm ci`.

## Not included in ZIP
- `.env`
- `node_modules`
- `dist`



---

## PHASE3_STEP11B3_DOCTOR_PROFILE_EDIT_INTEGRATION_V5_NOTES.md

# Phase 3 Step11B3 Doctor Profile Edit Integration V5

Base: `HMS_SECURE_PHASE3_STEP11B3_DOCTOR_DOCUMENT_UPLOAD_V4.zip`

## Scope
Phase 5 keeps the doctor section changes limited to profile/edit integration. It does not change unrelated HMS modules.

## Completed
- Added doctor profile edit flow from the doctor profile screen.
- Added `Edit Profile` action on doctor profile.
- Reused the safe doctor update API from V1 so same `doctor_id` updates do not trigger duplicate errors.
- Extended frontend doctor form state with enterprise profile fields:
  - `license_number`
  - `registration_number`
  - `status`
- After saving an open doctor profile, frontend fetches fresh doctor data again and updates `selectedDoctor`.
- Image and document data remain visible after profile updates.
- Added cancel edit action for doctor profile edit mode.

## Validation
- Backend syntax check passed:
  - `node --check backend/src/routes/core.routes.js`
  - `node --check backend/src/models/index.js`
- Frontend production build passed:
  - `npm run build`

## Packaging
Excluded from ZIP:
- `.env`
- `node_modules`
- `dist`

Included:
- `package.json`
- `package-lock.json`
- `.env.example`



---

## PHASE3_STEP11B3_DOCTOR_PROFILE_UI_AND_UPLOAD_FIX_V7_NOTES.md

# Phase 7 - Doctor Profile UI + Upload Fix

Base: HMS_SECURE_PHASE3_STEP11B3_DOCTOR_FINAL_POLISH_TESTING_V6.zip

## Fixed
- Doctor document upload no longer fails only because Cloudinary environment variables are missing on Render.
- Doctor profile image upload also supports the same safe fallback.
- If Cloudinary env vars are configured, uploads still use Cloudinary.
- If Cloudinary env vars are not configured, profile images and doctor documents are stored as MongoDB data URLs so the feature remains usable.
- Cloudinary cleanup is now safe and skipped when Cloudinary is not configured.
- Backend error messages are no longer hard-coded to Cloudinary environment variable failure only.

## UI Improved
- Doctor profile header polished.
- Duplicate profile title removed from card body.
- Doctor avatar/camera overlay improved.
- Doctor documents upload form is now hidden behind Add Document.
- Empty document state improved.
- Summary card Doctor ID duplicate replaced with Recent Records.

## Checks
- Frontend npm run build passed.
- Backend JS syntax checks passed.

## Deployment Note
Cloudinary is still recommended for production file storage. Add these in Render for production-grade storage:
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Without Cloudinary, files are saved in MongoDB as fallback. This is acceptable for testing/small files but not ideal for long-term production storage.



---

## PHASE3_STEP11B3_DOCTOR_PROFILE_VIEW_V2_NOTES.md

# Phase 3 Step 11B3 - Doctor Profile View V2

Base ZIP: HMS_SECURE_PHASE3_STEP11B3_DOCTOR_UPDATE_FIX_V1.zip

## Scope
Phase 2 only: Doctor profile view. No image upload or document upload added in this ZIP.

## Backend changes
- Added `GET /api/doctors/:id` in `backend/src/routes/core.routes.js`.
- Route uses tenant filtering and requires `doctor.view` permission.
- Fetches fresh doctor details by numeric `id`.
- Adds `department_name` when department exists.
- Adds recent doctor appointments for the profile screen.

## Frontend changes
- Added `doctorApi.get(id)`.
- Added `selectedDoctor` state in `frontend/src/main.jsx`.
- Added `openDoctorProfile(row)` handler:
  - Opens profile immediately using table row fallback.
  - Fetches fresh doctor data from backend.
  - Replaces selected doctor with fresh API response.
- Added `doctorProfile` internal tab/view.
- Header title now shows `Doctor Profile` for this internal view.
- Passed `openDoctorProfile` to `Doctors.jsx`.
- Doctor table now shows View Profile in the existing three-dot action menu.
- Added doctor profile screen in `frontend/src/pages/Doctors.jsx` using existing patient profile design classes for consistent UI.

## Not included yet
- Doctor profile image upload.
- Doctor certificate/document upload.
- Doctor document delete/download management.

## Checks completed
- Backend syntax check completed.
- Frontend `npm run build` completed successfully.

## Known build warning
Vite shows existing bundle-size warning and react-hot-toast `use client` warning. Build still succeeds.



---

## PHASE3_STEP11B3_DOCTOR_UPDATE_FIX_V1_NOTES.md

# Phase 3 Step11B3 Doctor Update Fix V1

Base ZIP: `HMS_SECURE_PHASE3_STEP11B3_UI_FUNCTIONALITY_FIXES.zip`

## Scope
This ZIP intentionally fixes only the unstable doctor update/duplicate-ID foundation before adding doctor profile/image/document features.

## Changes
- Removed global `unique: true` from `Doctor.doctor_id` in the Mongoose schema.
- Added a compound unique doctor index definition for `{ hospital_id: 1, doctor_id: 1 }`.
- Updated `PUT /api/doctors/:id` so duplicate checks exclude the current doctor:
  - Allows editing a doctor without changing their existing `doctor_id`.
  - Returns `409` only when another doctor in the same tenant/hospital already has that `doctor_id`.
  - Returns `404` when the doctor does not exist.
  - Returns the updated doctor object after a successful update.
- Added safe script: `npm run fix-doctor-indexes`
  - Drops legacy global unique `doctor_id_1` style index if present.
  - Assigns `DEFAULT_HOSPITAL_ID` to legacy doctor records that have missing/null `hospital_id`.
  - Creates compound unique index: `{ hospital_id: 1, doctor_id: 1 }`.

## Important Render/MongoDB step
After deploying this backend, run once from Render shell/job if duplicate `doctor_id` errors continue:

```bash
npm run fix-doctor-indexes
```

Check Render logs carefully. If MongoDB reports duplicate values inside the same hospital, resolve those duplicate doctor records first, then rerun the script.

## Verified locally
- Frontend: `npm run build` passed.
- Backend syntax checks passed for:
  - `src/server.js`
  - `src/models/index.js`
  - `src/routes/core.routes.js`
  - `scripts/fix-doctor-indexes.js`

## Not included yet
Doctor profile, doctor image upload, and doctor document upload are intentionally not added in this ZIP. They should be added only after confirming doctor edit/update is stable.



---

## PHASE3_STEP11B3_PROFILE_KIKA_UI_V8_NOTES.md

# HMS Secure Phase 3 Step 11B3 - Unified Keka-style Profile UI V8

Base used:
- HMS_SECURE_PHASE3_STEP11B3_DOCTOR_PROFILE_UI_AND_UPLOAD_FIX_V7.zip

Scope:
- Frontend UI/UX polish only.
- No backend feature changes.
- No doctor/patient upload logic removed.

Completed:
- Added Keka-style cover/profile layout styling.
- Updated logged-in user/admin profile page to a Keka-inspired layout.
- Added profile completion indicator, intro/about blocks, quick links, support card, and cleaner account sections.
- Updated patient profile to use a Keka-style banner/cover area while preserving current patient details, appointments, bills, and documents.
- Updated doctor profile to use a Keka-style banner/cover area while preserving profile image upload, document upload, document delete, edit profile, appointments, and credentials.
- Preserved current functionality from V7.

Checks:
- Frontend build passed.
- Backend JavaScript syntax checks passed.

Packaging:
- .env excluded.
- node_modules excluded.
- frontend/dist excluded.
- package.json/package-lock.json retained.
- .env.example retained.



---

## PHASE3_STEP2_NOTES.md

# Phase 3 Step 2 - Permission Middleware Applied

This patch keeps the existing role system compatible while adding permission checks to critical backend routes.

## Protected with permissions

- Patients: view, create, edit, delete, document management
- Doctors: view, create, edit, delete
- Appointments: view, create, edit, delete, status update
- Beds: view, create, status update
- Billing: view, create
- Pharmacy: view, create, stock management
- Lab/Radiology: view, create/report actions
- Admin users: manage users
- Audit/Security: audit view and security manage

## Compatibility

Existing users are not migrated. Their permissions come from their role mapping in `backend/src/config/permissions.js`.

Super admin keeps wildcard access with `*`.



---

## PHASE3_STEP5_NOTES.md

# Phase 3 Step 5 - Tenant-Aware Data Filtering

## What changed
- Added reusable tenant helpers in `backend/src/middleware/tenant.js`:
  - `tenantFilter(req, extra)`
  - `tenantCreateData(req, data)`
- Major backend modules now scope reads/writes by `hospital_id`.
- Existing records without `hospital_id` remain visible for the default hospital only (`DEFAULT_HOSPITAL_ID=1`).

## Scoped modules
- Patients
- Doctors
- Departments
- Appointments
- Beds
- Dashboard stats
- Billing
- Pharmacy
- Lab
- Radiology
- OPD/IPD
- Audit logs
- Security settings
- Admin users

## Safety
- No `.env` files included.
- Existing default single-hospital deployment remains supported.
- Existing old records are not hidden for default hospital.
- No frontend UI changes.



---

## PHASE3_STEP8_NOTES.md

# Phase 3 Step 8 — Feature Flags

This phase adds hospital-wise advanced feature flags without breaking existing modules.

## Added feature flags
- FHIR APIs
- HL7 Ready
- PACS/DICOM
- Biometric
- Insurance/TPA
- ERP/Tally
- WhatsApp/SMS
- ABDM/ABHA
- 2FA Security
- Audit Compliance

## Safety rules
- Existing default hospital remains active.
- Existing modules remain unchanged.
- Existing users and records are not reset.
- `.env`, `node_modules`, and `dist` are not included in the ZIP.
- `package-lock.json` files are included.

## Test checklist
1. Login as super_admin/admin.
2. Open Hospitals tab.
3. Edit a hospital.
4. Toggle multiple feature flags.
5. Save.
6. Re-open Edit and confirm flags are still selected.
7. Check normal modules still work.

## Phase 8C - Theme-aware profile and dashboard colors
- Updated doctor, patient, and admin/profile cover backgrounds to follow the selected theme color.
- Updated profile detail sections, avatar upload controls, document tiles, and empty states to use theme-aware colors.
- Updated dashboard welcome panel, stat cards, Hospital Overview chart, and Billing Status chart to use theme-aware palette instead of default black/grey chart colors.
- Verified frontend production build and backend syntax checks.

## V13A - Appointment Stability + Professional Appointment UI

- Added enterprise appointment status flow: scheduled, checked_in, in_consultation, completed, cancelled, no_show.
- Added appointment type support: OPD, follow-up, emergency, teleconsultation.
- Added backend validation for patient/doctor references inside the active hospital/tenant.
- Added backend doctor slot conflict prevention for same doctor/date/time, excluding cancelled/no-show appointments.
- Added token number generation per appointment date.
- Added status timestamp fields for check-in, consultation start, completion and cancellation.
- Added professional appointment board UI with filters, status badges, token cards and lifecycle actions.
- Frontend build passed.
- Backend syntax checks passed.

## V13B - Doctor Schedule + Slot Booking Foundation

Implemented after V13A appointment stability.

### Added
- Doctor schedule model (`doctor_schedules`) with hospital/tenant isolation.
- Doctor availability setup from Appointment module.
- Working days, start/end time, break time, slot duration, daily patient limit, unavailable dates.
- Schedule list with edit/delete actions.
- Backend appointment validation against active doctor schedule.
- Backend blocks appointments outside working hours, on unavailable dates, during break time, and beyond daily limit.
- Doctor slots endpoint: `GET /api/doctors/:id/slots?date=YYYY-MM-DD`.
- Schedule APIs:
  - `GET /api/doctor-schedules`
  - `POST /api/doctor-schedules`
  - `DELETE /api/doctor-schedules/:id`

### QA
- Frontend `npm run build`: passed.
- Backend syntax checks: passed.
- Backend dependencies install from lock file: passed.
- Database live check was attempted but not run locally because packaged ZIP intentionally excludes `.env`; Render/local environment must provide `MONGODB_URI`.

## V13C - Reception Queue + Token System
- Added backend `/api/appointments/queue` endpoint for date/doctor-wise active reception queue.
- Improved token generation to use the highest existing token for the date instead of raw count, reducing duplicate token risk after deletions.
- Added queue position and waiting-minute metadata in queue response.
- Added professional Reception Queue panel in Appointments page.
- Added Call Next, Check In, Call Patient, Complete, and No Show queue actions.
- Removed duplicate schedule timing line in schedule card UI.

## V13E - Prescription + Billing Integration from OPD Consultation

Implemented after V13D OPD consultation screen.

### Added
- Added `Prescription` model/collection with hospital/tenant isolation.
- OPD consultation save can now also save prescription medicine rows.
- Added optional OPD consultation bill generation from consultation save.
- Billing links to patient, doctor, appointment and OPD source.
- Appointment stores linked `opd_id`, `prescription_id`, and `billing_id` after consultation save.
- Added prescription list endpoint: `GET /api/prescriptions` with appointment/patient/doctor filters.
- OPD consultation UI now has two-column clinical + prescription/billing layout.
- Prescription rows support medicine name, dosage, frequency, duration and instructions.
- Billing form supports fee, paid amount, discount and GST percent.

### QA
- Backend `npm install`: passed.
- Backend syntax checks: passed for models, OPD/IPD routes, core routes and billing routes.
- Frontend `npm install`: passed.
- Frontend `npm run build`: passed.
- Database live check attempted but local package intentionally excludes `.env`; `MONGODB_URI` must be configured in Render/local environment.

---

## HMS_SECURE_PHASE3_STEP11B3_PATIENT_TIMELINE_EMR_V13F

Base used:
- HMS_SECURE_PHASE3_STEP11B3_PRESCRIPTION_BILLING_V13E.zip

Scope:
- Patient Timeline / EMR Foundation only.
- No unrelated modules were redesigned.

Backend changes:
- Added GET `/api/patients/:id/timeline`.
- Timeline is tenant/hospital filtered.
- Timeline combines patient-related records from:
  - appointments
  - OPD consultations
  - prescriptions
  - billing records
  - lab records
  - radiology records
  - IPD admissions
  - patient documents
- Added summary counts for EMR sections.

Frontend changes:
- Patient profile now loads fresh timeline data from the backend.
- Added Patient Timeline / EMR card in patient profile.
- Added event list with status, type, date, diagnosis/medicine/bill details when available.
- Added theme-aware styling for timeline cards.

Testing:
- Frontend production build passed.
- Backend JavaScript syntax checks passed.
- DB check attempted; local ZIP correctly excludes `.env`, so `MONGODB_URI` is required on local/Render.

Packaging:
- `.env` excluded.
- `node_modules` excluded.
- `dist` excluded.
- `package.json`, `package-lock.json`, `.env.example`, and `PROJECT_NOTES.md` preserved.

## V14 - Pharmacy + Inventory Enterprise Upgrade

Built on: HMS_SECURE_PHASE3_STEP11B3_PATIENT_TIMELINE_EMR_V13F.zip

Scope:
- Enterprise pharmacy inventory foundation.
- Medicine batch/vendor/expiry/quantity/low-stock fields.
- Medicine edit/update support.
- Stock adjustment endpoint and UI.
- Direct pharmacy sale endpoint and UI.
- Prescription dispense endpoint foundation.
- Pharmacy summary endpoint with total stock, low stock, expired count and sales revenue.
- Recent pharmacy sales list.
- Theme-aware professional pharmacy UI.

Testing:
- Frontend npm install + npm run build: PASSED.
- Backend npm install + syntax checks: PASSED.
- DB check attempted: needs MONGODB_URI in local/Render env. This ZIP correctly excludes .env.

Packaging:
- .env excluded.
- node_modules excluded.
- frontend dist excluded.


## V15 - Lab/Radiology Workflow Rebuild from V14
- Added enterprise Lab/Radiology workflow foundation.
- Added lab status flow: ordered, sample_collected, processing, completed, cancelled.
- Added radiology status flow: ordered, scheduled, scanned, reported, cancelled.
- Added backend OPD clinical order endpoint: POST /api/opd/:id/orders.
- Added tenant-filtered lab/radiology list, status update, and report upload endpoints.
- Improved frontend Lab/Radiology page with professional workflow UI, stats, status badges, report fields, and patient/doctor selectors.
- Frontend build passed.
- Backend syntax checks passed.
- DB live check requires MONGODB_URI in local/Render because .env is excluded from ZIP.

## V16_REBUILT - Notification Engine

### Backend
- Added `Notification` model with tenant/hospital filtering, read tracking through `read_by`, module/type/severity metadata, and recent lookup index.
- Added `/api/notifications` routes:
  - `GET /api/notifications`
  - `POST /api/notifications`
  - `PATCH /api/notifications/:id/read`
  - `PATCH /api/notifications/read-all`
  - `DELETE /api/notifications/:id`
- Added notification helpers in `backend/src/utils/notifications.js`.
- Added notification permissions for supported roles.
- Appointment creation/status changes now create in-app notifications.
- OPD consultation, prescription, and billing generation now create notifications.
- Lab/radiology order and report status changes now create notifications.
- Pharmacy sales/dispensing and low-stock events now create notifications.

### Frontend
- Added `notificationApi`.
- Navbar notification dropdown now loads real database notifications.
- Added unread count indicator, mark one read, and mark all read.
- Preserved fallback operational alerts if backend notification route is unavailable during deploy transition.

### QA
- Frontend `npm install` passed.
- Frontend `npm run build` passed.
- Backend syntax checks passed for models, notification route, workflow routes, and server.
- DB check attempted; local ZIP does not include `.env`, so `MONGODB_URI` is required on local/Render.

### Packaging
- `.env`, `node_modules`, and `dist` are excluded from the ZIP.

## V17 - Audit + Security Hardening

Built from: HMS_SECURE_PHASE3_STEP11B3_NOTIFICATION_ENGINE_V16_REBUILT.zip

### Backend
- Added centralized audit utility: `backend/src/utils/audit.js`.
- Expanded `AuditLog` schema with:
  - user role
  - entity type/id
  - old/new values
  - status/severity
  - IP address
  - user agent
  - method/path
- Added `LoginHistory` model for successful, failed and blocked login attempts.
- Added tenant-safe security settings schema with compound index `{ hospital_id, setting_key }`.
- Added `npm run fix-security-indexes` to safely drop old global `setting_key_1` index and create tenant-safe compound index.
- Added login history tracking in auth login flow.
- Added audit tracking for:
  - successful login
  - failed login
  - blocked inactive-hospital login
  - profile update
  - password change
  - user create/update/delete
  - permission denied / role denied events
  - security setting updates
- Improved `/api/audit-logs` with filtering.
- Added `/api/audit-logs/export` CSV export.
- Added `/api/security/login-history`.
- Added `/api/security/summary`.
- Added `/api/security-settings/defaults`.

### Frontend
- Added `auditApi`.
- Added Security tab for users with audit/security permissions.
- Added Audit & Security Center UI:
  - security summary cards
  - audit log list
  - audit filter controls
  - CSV export action
  - login history list
  - security settings editor
  - ensure default settings action
- Added theme-aware UI styling for security center.

### Testing
- Backend syntax checks passed:
  - models
  - audit utility
  - audit/security routes
  - auth routes
  - auth middleware
- Frontend `npm install` passed.
- Frontend `npm run build` passed.
- Backend `npm install` passed.
- DB check attempted but `.env` is excluded as required, so `MONGODB_URI` must be set in local/Render.

### Deployment note
After deployment, run this once on Render/local with MongoDB env configured:

```bash
npm run fix-security-indexes
```

This prevents old global `setting_key_1` index from blocking per-hospital security settings.

## V18 - No-Code Dynamic Forms Foundation

Built from: HMS_SECURE_PHASE3_STEP11B3_AUDIT_SECURITY_V17.zip

### Added
- DynamicField MongoDB model with hospital/tenant isolation.
- Backend configuration routes:
  - GET `/api/configuration/dynamic-fields`
  - GET `/api/configuration/public-fields`
  - POST `/api/configuration/dynamic-fields`
  - PUT `/api/configuration/dynamic-fields/:id`
  - PATCH `/api/configuration/dynamic-fields/:id/status`
  - DELETE `/api/configuration/dynamic-fields/:id`
- New `configuration.manage` permission.
- New Configuration tab for admins/super admins.
- Dynamic form builder UI for hospital-specific custom fields.
- Patient and Doctor forms render active dynamic fields.
- Patient and Doctor profiles display saved custom field values.
- DataTable now supports explicit columns and custom extra actions.

### Notes
- Custom values are stored safely under each record's `custom_fields` object.
- Existing patient/doctor fields remain untouched.
- Dynamic fields are per hospital/tenant and do not affect other hospitals.

### Tests
- Frontend `npm install` passed.
- Frontend `npm run build` passed.
- Backend syntax checks passed for models, configuration routes, and server.
- DB live check requires `MONGODB_URI` in local/Render environment because `.env` is not included in the ZIP.

## V19 - Template Builder Foundation
- Added hospital-wise Template model for invoice, prescription, lab report, radiology report and discharge summary templates.
- Added backend template APIs under `/api/templates` with tenant filtering, default-template handling, audit events and permission protection.
- Added Configuration UI section for creating/editing/deleting templates.
- Added template variables guide for future printable/PDF rendering.
- Frontend build passed.
- Backend syntax checks passed.

## V21 - SaaS Plan / Subscription Control

### Scope
- Added Clinic, Hospital, and Enterprise SaaS plan definitions.
- Added subscription current-plan and tenant-plan APIs.
- Added hospital-wise plan limits and subscription metadata fields.
- Added plan-aware module gating: modules not allowed by selected plan are disabled in Hospital Control.
- Added user-count limit enforcement when creating users/admins.
- Added Subscription panel inside Configuration showing current plan, usage, and available plan cards.
- Added backend subscription utility for plan definitions, limits, usage and limit checks.

### Backend
- Added `backend/src/utils/subscription.js`.
- Added `backend/src/routes/subscription.routes.js`.
- Added `/api/subscription/plans`.
- Added `/api/subscription/current`.
- Added `/api/tenants/:id/subscription` GET/PATCH.
- Tenant create/update now normalizes enabled modules and feature flags according to selected plan.
- User creation now checks plan user limit.

### Frontend
- Added `frontend/src/api/subscriptionApi.js`.
- Configuration tab now shows current SaaS plan and plan usage.
- Hospital Control now shows selected plan summary and disables modules outside the selected plan.

### Testing
- Backend syntax checks passed for server, models, routes and utils.
- Frontend `npm install` completed.
- Frontend `npm run build` passed.
- DB live check requires `MONGODB_URI` in local/Render because `.env` is intentionally excluded.

### Packaging
- Clean package: no `.env`, no `node_modules`, no `dist`.

## V22 - SaaS Super Admin Control Center
- Added backend SaaS overview endpoint: `GET /api/saas/overview`.
- Added tenant CSV export endpoint: `GET /api/saas/tenants/export.csv`.
- Added platform owner SaaS Control Center page.
- Shows total tenants, active tenants, MRR estimate, recorded tenant revenue, plan breakdown, subscription status breakdown, and tenant limit usage.
- Added usage warning indicators when tenants approach plan limits or subscription is not active.
- Added SaaS Control sidebar tab gated by `hospital.manage` permission and tenant module access.
- Frontend build passed.
- Backend syntax checks passed.

## V23 - Tenant Lifecycle + Billing Control
- Added tenant lifecycle backend endpoint: activate, trial, suspend, cancel.
- Added plan change control from SaaS Control Center.
- Added billing metadata display: billing cycle, renewal/next billing date, trial end.
- Extended subscription fields for trial, suspension, cancellation, and next billing date.
- Added audit logging for tenant lifecycle actions.
- Frontend build passed and backend syntax checks passed.

## V24 - SaaS Subscription Invoices + Payment Tracking
- Added SaaSInvoice and SaaSPayment models for platform subscription billing.
- Added SaaS billing routes:
  - GET /api/saas/billing/summary
  - GET /api/saas/invoices
  - POST /api/saas/invoices/generate
  - PATCH /api/saas/invoices/:id/status
  - POST /api/saas/invoices/:id/payments
  - GET /api/saas/invoices/export.csv
- SaaS Control Center now shows invoice billing summary, generated invoices, balance tracking and manual payment recording.
- Invoice generation uses current tenant plan and billing cycle with optional tax, discount and due date.
- Payment recording updates invoice status as paid/partial/pending/overdue.
- Audit logs added for invoice generation, status updates and payment records.
- Frontend build passed and backend syntax checks passed.

## V25 - Payment Gateway + Invoice Automation Foundation
- Added SaaS payment intent model for gateway-ready payment links.
- Added backend endpoints to create payment links, list payment intents, confirm gateway payments, and scan/mark overdue invoices.
- Added SaaS payment gateway environment placeholders in backend `.env.example`.
- Added SaaS Control Center UI actions for payment links, overdue scan, and payment intent confirmation.
- Added payment gateway readiness panel showing latest payment link intents.
- Payment gateway is foundation-ready: real Razorpay/Stripe/PayU webhook keys can be integrated later without changing the invoice workflow.
- Tests performed: frontend npm install + build passed; backend syntax checks passed; DB check attempted but requires local/Render `MONGODB_URI` because `.env` is intentionally excluded.

## V26 - Communications + Reminder Automation Foundation
- Added database-backed communication logs.
- Added communication channels: in-app, email, SMS, WhatsApp-ready.
- Added safe provider readiness checks using env placeholders.
- Added manual communication queue UI.
- Added appointment reminder automation for selected date.
- Added communication status flow: queued, sent, failed, skipped.
- Added communication CSV export.
- Added backend APIs under `/api/communications/*`.
- Added frontend Communications tab with channel/status filters.
- Added audit logs for communication actions.
- External email/SMS/WhatsApp sending is intentionally provider-ready only; when env keys are missing, logs are saved as skipped instead of failing.

## V27 Full QA + Bug Stabilization
- Regression QA phase after V26 Communication Reminders.
- Frontend dependencies installed locally and production build passed.
- Backend dependencies installed locally and syntax checks passed for server/app/models/routes.
- Verified clean packaging excludes `.env`, `node_modules`, and `dist`.
- Live database/API functional testing requires `MONGODB_URI` and deployment env on Render/local.
- Known build warnings only: React Hot Toast `use client` bundle warning and large JS chunk warning; not blocking.

## V27 Fix 1 - Hospital Update / Plan Access Clarification
- Fixed hospital update targeting by using the MongoDB record id when available, preventing edits from accidentally updating the wrong hospital when old data contains duplicate numeric `id` values.
- Added safer backend hospital lookup for numeric ids, MongoDB ids, and hospital codes.
- Added duplicate hospital code handling so raw MongoDB `E11000 duplicate key` errors are converted into clear 409 messages.
- Added `npm run fix-hospital-indexes` to repair old duplicate hospital numeric ids, normalize hospital codes, reset the hospitals counter, and recreate the safe hospital code index.
- Added UI note explaining why modules show `Upgrade`: Clinic Plan intentionally locks Beds, Lab, Radiology, Pharmacy, Security, Hospitals, and SaaS Control. Switch the hospital plan to Hospital/Enterprise to unlock them.

## V27 Fix2 - Module/sidebar and feature flag visibility
- Fixed plan/module gating refresh issue by making sidebar filtering feature-flag aware.
- Advanced feature flags now appear in sidebar when enabled for the active hospital.
- Added safe placeholder pages for enabled advanced features so the flags visibly work.
- Hospital/Enterprise modules remain controlled by selected SaaS plan and enabled module settings.
- Frontend build passed and backend syntax checks passed.

## V28 - Patient Portal + Doctor Portal Upgrade
- Added backend portal endpoints:
  - `GET /api/portal/patient`
  - `GET /api/portal/doctor`
- Patient Portal now shows linked patient profile, appointments, prescriptions, bills, lab/radiology reports, documents, and timeline.
- Doctor Portal now shows linked doctor profile, today queue, schedule, recent consultations, lab/radiology orders, and clinical stats.
- Staff/admin users can select a patient/doctor from dropdown for review.
- Patient and doctor logins are auto-linked by email/phone/user id where available.
- Added role permissions: `portal.patient.view` and `portal.doctor.view`.
- Added sidebar tabs: Patient Portal and Doctor Portal.
- Added portal UI styling with theme-aware cards, stats, timeline and status badges.
- Full frontend production build passed.
- Backend syntax checks passed for server, portal routes and permission config.

## V29 - Advanced EMR / EHR Clinical Record Foundation
- Added ClinicalRecord model for structured longitudinal patient records.
- Added EMR backend APIs:
  - GET /api/emr/patients
  - GET /api/emr/patients/:id/summary
  - POST /api/emr/records
  - PUT /api/emr/records/:id
  - DELETE /api/emr/records/:id
- Added EMR permissions for admin, hospital_admin, doctor, nurse, receptionist, and patient roles.
- Added EMR / EHR sidebar module and plan module access.
- Added EMR UI with patient selector, clinical summary, active allergies, conditions, medications, SOAP note entry, vitals, and unified timeline.
- EMR summary merges clinical records with appointments, OPD, prescriptions, lab, radiology, billing, and IPD data.
- Added audit logs and notifications for EMR record creation/update/delete.
- Frontend build passed and backend syntax checks passed.

## V30 - Advanced Billing + Insurance/TPA
- Added Insurance/TPA claim workflow foundation.
- Added backend InsuranceClaim model and APIs for claim list, summary, create, update, status update, and create-from-bill.
- Added tenant/hospital filtering for claims.
- Added audit logs and notifications for insurance claim actions.
- Added Insurance/TPA page replacing the old placeholder when feature flag is enabled.
- Claim register supports provider, TPA, policy, claim number, claim type, claim amount, approved amount, paid amount, status, priority, admission/discharge dates and notes.
- Insurance/TPA can link claims to existing bills/invoices.
- Frontend build passed and backend syntax checks passed.

## V31 Inventory + Purchase Order Deep Upgrade

Added enterprise inventory layer without removing existing Pharmacy functionality.

Backend additions:
- `/api/inventory/suppliers`
- `/api/inventory/items`
- `/api/inventory/batches`
- `/api/inventory/purchase-orders`
- `/api/inventory/stock-receivings`
- `/api/inventory/stock-returns`
- `/api/inventory/supplier-bills`
- `/api/inventory/batch-dispense`
- `/api/inventory/expiry-alerts`
- `/api/inventory/transactions`
- `/api/inventory/summary`

Database models added:
- Supplier
- InventoryItem
- InventoryBatch
- PurchaseOrder
- SupplierBill
- StockReceiving
- StockReturn
- InventoryTransaction

Frontend additions:
- New Inventory sidebar module
- Supplier master form
- Consumables/item master form
- Purchase order form
- Stock receiving / GRN form
- Stock return form
- Supplier bill form
- Batch-wise dispensing form
- Batch stock register
- Expiry alerts
- Recent inventory transactions

Validation performed:
- Backend model syntax check passed
- Backend route syntax check passed
- Backend route require/load check passed
- Frontend production build passed

Packaging rule:
- `.env`, `node_modules`, and `dist` are excluded from delivery zip.
- `package.json`, `package-lock.json`, and `.env.example` are included.

## V32 Advanced LIS/RIS Upgrade

Added enterprise diagnostics workflow without removing previous Lab/Radiology endpoints.

### Backend
- Added `LabTestTemplate` model with parameter templates, normal ranges, sample type, machine code/API-ready fields.
- Extended `LabTest` with sample barcode, accession number, result parameters, approval data, PDF URL, and integration payload.
- Extended `RadiologyTest` with modality, body part, DICOM Study ID, PACS viewer URL, radiologist workflow fields, findings/impression, PDF URL, and integration payload.
- Added endpoints:
  - `GET/POST/PUT /api/lab/templates`
  - `PATCH /api/lab/tests/:id/results`
  - `PATCH /api/lab/tests/:id/approve`
  - `GET /api/lab/machine-api/orders`
  - `PATCH /api/radiology/tests/:id/report`
  - `PATCH /api/radiology/tests/:id/approve`
- Kept old endpoints such as `/api/lab/tests`, `/api/lab/upload-report/:id`, `/api/radiology/tests`, and `/api/radiology/upload-report/:id` backward compatible.

### Frontend
- Upgraded Lab & Radiology screen to Advanced LIS/RIS command view.
- Added template builder, sample barcode display, accession number display, result entry panel, approval action, DICOM/PACS fields, and radiologist report workflow.

### Testing
- Backend syntax check passed.
- Backend route require/load check passed after dependency install.
- Frontend production build passed.

## V33 - NABH / Compliance Center Upgrade

Added enterprise compliance readiness without removing any V32/V31 modules.

### Backend
- Added compliance models: ConsentForm, IncidentReport, SopDocument, ComplianceChecklist, BackupVerification.
- Added tenant-safe compliance routes under `/api/compliance/*`.
- Added role permissions: `compliance.view`, `compliance.manage` for admin and hospital_admin.
- Added audit logging for compliance creates, updates, checklist seeding and CSV exports.
- Added CSV exports for consents, incidents, SOPs, checklists and backup verification.
- Added NABH default checklist seed endpoint.

### Frontend
- Added Compliance module in sidebar and plan/module configuration.
- Added Compliance Center UI with summary cards, records table, search, CSV exports and forms.
- Added workflows for consent forms, incident reporting, SOP approvals, NABH checklist status, and backup/restore verification.

### Testing
- Backend route/model syntax checked.
- Backend route require/load checked.
- Frontend production build checked.
- Clean package rules verified: no `.env`, no `node_modules`, no `dist`; package files and `.env.example` retained.


## V35 Analytics + Hospital Command Center Upgrade

Added enterprise analytics foundation without breaking existing HMS modules.

### Backend
- Added `backend/src/routes/command-center.routes.js`.
- Added protected analytics APIs under `/api/command-center/*`:
  - `/summary` for command KPIs and alerts.
  - `/revenue` for revenue dashboard and status breakdown.
  - `/occupancy` for bed status and ward-wise occupancy.
  - `/doctor-performance` for appointment completion and linked revenue.
  - `/queue` for live appointment queue monitoring.
  - `/pharmacy` for stock, sales, low-stock and expiry stats.
  - `/lab-tat` for lab/radiology turnaround time and pending reports.
  - `/emergency` for urgent workload monitoring.
- Added `analytics.view` permission for admin roles.
- Added `commandCenter` to default enabled hospital modules.

### Frontend
- Added `frontend/src/api/commandCenterApi.js`.
- Added `frontend/src/pages/CommandCenter.jsx`.
- Added sidebar tab: `Command Center`.
- Added dashboard cards/charts/tables for revenue, occupancy, doctor performance, queue, pharmacy, lab TAT and emergency workload.

### Testing
- Backend route syntax and require/load checks passed.
- Frontend production build passed.
- Clean package excludes `.env`, `node_modules`, and `dist`.

## V37: SaaS Stabilization + QA + Pilot Readiness
- Added backend QA smoke script to verify critical route surface after V31-V36.
- Added pilot readiness checklist for tenant isolation, RBAC, CRUD, backup and demo flow.
- No large new clinical module added in this phase; this phase is for stability and pilot readiness.

## V38: SaaS Business Layer + Subscription System

Added dynamic SaaS plan model, SaaS plan management endpoints, hospital onboarding endpoint, license status endpoint, and upgraded SaaS Control Center UI with plan builder and onboarding form. This phase focuses on turning the HMS into a sellable SaaS operating layer with tenant onboarding, trial/license lifecycle, subscription invoices, payment tracking, and plan-based commercial controls.


## V39 - Sales Demo + Website Readiness

V39 adds the business-facing sales layer needed before pilot outreach:

- Public marketing content API
- Demo request capture API
- Protected demo request pipeline
- Sales activity notes
- Sales assets API
- Frontend Sales Demo Center
- Pricing/package comparison
- Demo script and checklist
- Website integration documentation

This phase does not remove or alter existing V31-V38 hospital workflows. It prepares the HMS for real demos, lead capture, pilot conversations and product website integration.

## V40 - Security + Legal Readiness

Added a Legal & Security Readiness Center with policy templates, data protection request tracking, security incident register, policy acknowledgements and audit pack export. This phase helps move the HMS from demo software toward a safer pilot-ready SaaS product.

## V41 - Pilot Hospital Deployment
Added pilot deployment management, pilot task tracking, readiness score API and frontend Pilot Deployment Center for first real clinic/hospital rollout planning.

## V42 - Configuration Engine Deep Fix
- Connected Configuration dynamic fields to Patient and Doctor workflows.
- Added custom field persistence through `custom_fields`.
- Added backend validation for required, number and select dynamic field values.
- Added toast notifications for Configuration actions.
- Added template preview API and UI.
- Backend route load, QA smoke and frontend production build passed.


## V43 - Tenant Database Isolation + Backup Architecture

- Added hybrid master DB + database-per-tenant architecture.
- New hospitals onboarded from SaaS Control can create a separate MongoDB tenant database by default.
- Existing hospitals remain in shared DB fallback mode until provisioned/migrated, preventing data loss.
- Operational models now route to tenant DB through request tenant context when `tenant_db_name` is available.
- Patient ID uniqueness is now tenant/hospital-safe instead of globally unique.
- Added tenant DB provision, backup queue, backup verify APIs and SaaS Control Center UI.
- Added safe migration scripts that copy data first and do not delete source data unless explicitly requested.

## V43.1 - Tenant Isolation Verification + Route Hardening

V43.1 hardens the V43 tenant database architecture. Command Center, Legal/Security and Pilot Deployment flows now run under tenant context, tenant-aware collections were expanded, and a `tenant:audit` script was added to verify operational route coverage. Existing shared DB fallback remains preserved to avoid data loss.
