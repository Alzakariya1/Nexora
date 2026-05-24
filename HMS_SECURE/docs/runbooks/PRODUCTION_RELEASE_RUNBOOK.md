# Production Release Runbook

## Pre-release
1. Pull latest code.
2. Run backend and frontend checks.
3. Confirm environment variables are set on Render and Vercel.

## Deploy
1. Deploy backend on Render.
2. Confirm `/api/health/live` returns live.
3. Confirm `/api/health/ready` returns ready.
4. Deploy frontend on Vercel.
5. Run smoke test after deploy.

## Smoke test after deploy
- Login.
- Open dashboard.
- Verify patients, doctors, appointments, pharmacy, lab and billing screens.

## Rollback plan
- Use previous Render deployment for backend rollback.
- Use previous Vercel deployment for frontend rollback.
- Restore database backup only if a release damaged data.
