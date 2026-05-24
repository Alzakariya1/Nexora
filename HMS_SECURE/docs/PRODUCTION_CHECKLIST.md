# V36 Production Checklist

## Build checks

```bash
cd backend && npm ci && npm run check-routes && npm run security-check
cd ../frontend && npm ci && npm run build
```

## Backend checks

- `/api/health/live` returns 200
- `/api/health/ready` returns 200 after DB connection
- CORS includes the current Vercel domain
- rate limit headers are present on API responses
- seed admin can login
- old modules still open: patients, doctors, appointments, pharmacy, lab, billing

## Backup checks

- `npm run backup` creates a JSON backup
- `npm run verify-backup` records verification
- staging restore tested before any production restore

## Deployment checks

- Render health path set to `/api/health/ready`
- Vercel `VITE_API_URL` points to Render `/api`
- GitHub Actions CI passes
- Docker compose local production smoke test passes
