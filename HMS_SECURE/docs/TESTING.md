# HMS Testing Guide

Phase 8A automated testing is the baseline for safe releases.

## Backend

Run these commands from `backend`:

```bash
npm ci
npm run check-routes
npm run test:regression
npm run test:automated
```

## Frontend

Run these commands from `frontend`:

```bash
npm ci
npm run test:frontend
npm run test:e2e
npm run test:performance
npm run check:phase8e-production
npm run build
```

Frontend production build must pass before every Vercel deployment.

## Smoke Testing After Deployment

1. Login with seeded admin credentials.
2. Check dashboard stats.
3. Create and edit Patient, Doctor, Appointment, Bed, Lab, Pharmacy and Billing records.
4. Upload patient profile image/document and doctor profile image/document.
5. Verify Cloudinary uploads when Cloudinary environment variables are present.
6. Confirm `/api/health`, `/api/health/live`, and `/api/health/ready` return healthy responses.

## Phase 8C E2E Contract Testing

Run backend E2E contract checks:

```bash
npm run check:phase8c-e2e
```

Run frontend E2E checks:

```bash
npm run test:e2e
```

Phase 8C validates login, patient creation, appointment booking, OPD/EMR, billing invoice, lab report, IPD discharge, pharmacy sale, patient portal and doctor portal journeys.
