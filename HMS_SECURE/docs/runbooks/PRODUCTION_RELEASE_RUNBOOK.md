# Production Release Runbook

## Pre-release

1. Run backend `npm run test:automated`.
2. Run frontend `npm run test:production`.
3. Confirm backend `/api/health/ready` is available after deploy.

## Release

1. Deploy backend on Render.
2. Deploy frontend on Vercel.
3. Run smoke tests.

## Rollback

Redeploy the previous known-good Render and Vercel deployments if `/api/health/ready` or smoke testing fails.
