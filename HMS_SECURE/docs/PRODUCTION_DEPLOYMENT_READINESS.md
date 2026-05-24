# Production Deployment Readiness

## Phase 8E Checklist

- Backend deploys on Render with `rootDir: backend`.
- Frontend deploys on Vercel with SPA fallback to `/index.html`.
- Backend health check path: `/api/health/ready`.
- Frontend `VITE_API_URL` must point to the Render API base path ending in `/api`.
- Render `FRONTEND_URL` must include every active Vercel domain.

## Smoke test after deploy

1. Open `/api/health/ready` and confirm service readiness.
2. Login as admin.
3. Open Dashboard, Patients, Doctors, Appointments, Beds, Lab, Pharmacy and Billing.
4. Create a test patient and doctor.
5. Upload profile image and document for patient and doctor.
6. Verify no 404/500 errors in browser Network tab.

## Rollback plan

If a deployment fails, immediately redeploy the previous successful Render build and Vercel deployment. Keep the previous zip/release artifact available until the new deployment passes smoke testing.
