# Doctor Document Upload Fix Report

## Issue
Doctor profile document upload could show `Doctor not found` because the doctor module was passing mixed identifiers directly from `selectedDoctor` and did not normalize IDs as safely as the patient module.

## Fixes Applied
- Updated `frontend/src/pages/Doctors.jsx` to use HMS ID helpers like the patient module.
- Added a stable doctor ID resolver before profile image upload, document upload, and document delete.
- Patched backend doctor resolver active filter so existing records with `deleted_at: null` are still treated as active.
- Kept support for numeric `id`, custom `doctor_id`, `public_id`, and Mongo `_id` style identifiers.

## Verification
- Frontend production build passed with Vite.
- Backend route loading check passed.

## Files Changed
- `frontend/src/pages/Doctors.jsx`
- `backend/src/routes/core.routes.js`
