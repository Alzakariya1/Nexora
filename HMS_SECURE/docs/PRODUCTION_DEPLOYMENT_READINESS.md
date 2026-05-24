# Production Deployment Readiness

Phase 8E production readiness checklist for Enterprise HMS.

## Environment
- Backend Render root directory: `backend`
- Backend build command: `npm ci`
- Backend start command: `npm start`
- Frontend build command: `npm run build`
- Frontend API variable: `VITE_API_URL=https://your-backend-domain/api`

## Health checks
Use `/api/health/live` for liveness checks and `/api/health/ready` for readiness checks. Render health check path should be `/api/health/ready` because it validates database readiness.

## Smoke test after deploy
1. Open backend `/api/health/live`.
2. Open backend `/api/health/ready`.
3. Login with a seeded admin account.
4. Verify patients, doctors, appointments, billing, lab, pharmacy and dashboard pages load.
5. Create a test patient and appointment, then delete or mark as test data.

## Rollback plan
1. Revert to the previous Render deploy if backend health fails.
2. Revert to the previous Vercel deployment if frontend routing/API calls fail.
3. Restore database backup only after confirming data corruption.
4. Re-run smoke tests after rollback.
