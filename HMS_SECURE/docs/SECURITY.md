# Security Hardening Checklist

Run before production:

```bash
cd backend
npm run security-check
```

Required checks:

- strong `JWT_SECRET`, minimum 32 characters
- production `FRONTEND_URL`, not localhost
- secure MongoDB Atlas URI
- no `.env` committed
- no `node_modules` committed
- no `dist` committed
- Render and Vercel env values match current domains
- `RATE_LIMIT_MAX` configured for expected traffic
- admin seed password changed immediately after first login
- MongoDB Atlas network access restricted after testing
- API keys rotated if exposed
- compliance backup verification reviewed monthly
