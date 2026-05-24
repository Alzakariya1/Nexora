# Production Checklist

Phase 8E checklist before release:

- Run backend `npm run check-routes`.
- Run backend `npm run check:phase8e-production-readiness`.
- Run frontend `npm run test:production`.
- Confirm Render health check path is `/api/health/ready`.
- Confirm Vercel `VITE_API_URL` ends with `/api`.
- Confirm rollback plan and smoke test after deploy are documented.
