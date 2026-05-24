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
