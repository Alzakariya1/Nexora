# Testing Guide

## Automated checks
Run the full backend-controlled suite from the backend folder:

```bash
npm run test:automated
```

This includes route loading, regression checks, Phase 8A automated testing checks, frontend contract checks, E2E contract checks, performance checks and production readiness checks.

## Frontend production build
Before deployment, run the frontend production build:

```bash
cd frontend
npm run test:production
```

The Frontend production build must complete successfully before Vercel deployment.

## Phase 8A
Phase 8A added automated regression coverage and documentation requirements so enterprise modules can be checked before release.
