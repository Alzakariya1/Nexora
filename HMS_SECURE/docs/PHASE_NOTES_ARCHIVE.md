# Phase Notes Archive

This file consolidates the old phase note files to keep the project root clean.


# PHASE3_NOTES.md

# Phase 3 Stabilization Notes

## Focus
- Frontend identifier consistency for doctor, patient and appointment flows.
- Doctor document/profile upload now resolves a stable doctor public id before calling the API.
- Appointment create/edit normalizes doctor_id and patient_id from current frontend lists before sending to backend.
- Backend doctor list/profile responses include `public_id` so the frontend avoids accidentally sending Mongo `_id`.
- Added data consistency repair script for old appointment reference and token records.

## After deploy
Run this once on the backend service after setting environment variables:

```bash
npm run phase3:data-consistency
```

Then redeploy/restart backend and frontend.

## Checks run locally
- `npm run check-routes` in backend
- `npm run build` in frontend


# PHASE4_NOTES.md

# Phase 4 Stabilization Notes

Focus: Appointment queue workflow hardening.

Changes included:
- Added strict appointment status transition rules on backend.
- Blocked invalid jumps such as completed -> checked_in or cancelled -> in_consultation.
- Enforced one active `in_consultation` appointment per doctor per day.
- Added queue-safe status timestamps for check-in, consultation start, completion, cancellation.
- Improved appointment list sorting by date + token sequence instead of unstable UI ordering.
- Added repair script to normalize old invalid statuses and move duplicate active consultations back to checked-in.

After deployment, run once from backend:

```bash
npm run phase4:appointment-workflow
```

Then redeploy/restart backend and frontend.


# PHASE5_NOTES.md

# Phase 5 - Patient Module Stabilization

## What changed

- Patient APIs now support stable lookup by numeric `id`, manual `patient_id`, `patient_uid`, and Mongo `_id`.
- Patient list/get/create/update responses include `public_id` for frontend-safe routing.
- Patient document upload, profile image upload, timeline, delete document, and archive now use the same public patient resolver.
- Frontend patient edit/delete/profile/document actions now use `getPatientPublicId()` instead of guessing between `_id`, `id`, and `patient_id`.
- Patient profile timeline uses a normalized patient identifier, avoiding stale or mismatched patient profile requests.
- Added patient data repair script to normalize documents/profile storage and fix patient references across dependent modules.

## After deploy

Run once on Render shell/backend environment:

```bash
npm run phase5:patients
```

Then redeploy/restart backend and frontend.
