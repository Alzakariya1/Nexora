# Environment Matrix

| Area | Local | Production |
|---|---|---|
| Backend URL | `http://localhost:5000` | Render backend public URL |
| Frontend URL | `http://localhost:5173` | Vercel frontend URL |
| API base | `http://localhost:5000/api` | `https://your-backend-domain/api` |
| Database | MongoDB Atlas dev DB | MongoDB Atlas production DB |
| Health ready | `/api/health/ready` | `/api/health/ready` |
| Health live | `/api/health/live` | `/api/health/live` |

Required production variables include `MONGODB_URI`, `JWT_SECRET`, `FRONTEND_URL`, `API_PUBLIC_URL`, `CORS_EXTRA_ORIGINS`, `TENANT_BACKUP_DIR` and `SAAS_WEBHOOK_SECRET`.
