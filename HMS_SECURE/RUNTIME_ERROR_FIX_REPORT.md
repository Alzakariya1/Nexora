# Runtime Error Fix Report

## Fixed issues

1. **Doctor document upload 404 / Doctor not found**
   - Frontend now prefers the stable `doctor_id` for doctor document/profile API calls instead of numeric `id` first.
   - Doctor document upload now sends fallback identifiers in FormData: `doctor_id`, `doctor_code`, `numeric_id`, `public_id`, and `mongo_id` when available.
   - Backend doctor document route now reads these fallback identifiers.
   - Backend response now returns both `certificates` and `documents` aliases to keep older UI views compatible.

2. **Patient timeline 500**
   - Patient timeline now uses safe section queries. If one module has bad/old data, the full timeline endpoint will not crash.
   - Audit logging for patient timeline is now non-blocking, so an audit insert problem will not break timeline loading.

## Validation

- Backend route loading passed with `node backend/scripts/check-routes.js`.
- Frontend production build passed with `npm run build`.

## Deployment note

The live Render backend must be redeployed after uploading/pushing this code. If Vercel frontend is updated but Render is still running old backend code, `/api/doctors/:id/documents` can still show 404.
