# Environment Matrix

## Backend Render

Required:
- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`
- `API_PUBLIC_URL`

Optional but recommended:
- `CORS_EXTRA_ORIGINS`
- `TENANT_BACKUP_DIR`
- `SAAS_WEBHOOK_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## Frontend Vercel

Required:
- `VITE_API_URL=https://your-render-backend.onrender.com/api`
