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
