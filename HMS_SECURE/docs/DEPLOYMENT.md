# V36 Deployment Guide

## Render backend

Use these settings:

```text
Root Directory: backend
Build Command: npm ci
Start Command: npm start
Health Check Path: /api/health/ready
```

Required production environment variables:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=your_mongodb_atlas_uri
JWT_SECRET=use_a_32_plus_character_random_secret
FRONTEND_URL=https://your-vercel-domain.vercel.app
RATE_LIMIT_MAX=500
API_PUBLIC_URL=https://your-render-service.onrender.com
BACKUP_DIR=./backups
BACKUP_RETENTION_DAYS=14
SENTRY_DSN=
UPTIME_MONITOR_URL=
```

After deploy, run:

```bash
npm run security-check
npm run seed
npm run health
```

## Vercel frontend

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Environment:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

## Docker local production test

```bash
cp backend/.env.example backend/.env
# update backend/.env values
VITE_API_URL=http://localhost:5000/api docker compose up --build
```

Open:

```text
Frontend: http://localhost:8080
Backend health: http://localhost:5000/api/health/ready
```
