# Monitoring and Error Tracking

## Health endpoints

Public endpoints:

```text
GET /api/health/live
GET /api/health/ready
GET /api/health
```

Use `/api/health/ready` for Render or uptime monitoring because it checks database readiness.

## Uptime monitoring

Configure an uptime tool to check:

```text
https://your-backend-domain/api/health/ready
```

Recommended alert targets:

- backend down for 2 consecutive checks
- ready endpoint returns 503
- response time exceeds your acceptable threshold
- MongoDB Atlas cluster alerts

## Error tracking

`SENTRY_DSN` is included in `.env.example` as a production-ready placeholder. Install and configure Sentry when you are ready to connect a real project. Do not commit DSNs or secrets.
