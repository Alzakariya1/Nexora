# V38: SaaS Business Layer + Subscription System

V38 converts the HMS from a feature-rich hospital app into a SaaS-operable product layer.

## Added in V38

### Backend
- Dynamic SaaS plan model: `SaaSPlan`
- SaaS business routes: `backend/src/routes/saas-business.routes.js`
- Plan management endpoints:
  - `GET /api/saas/business/plans`
  - `POST /api/saas/business/plans`
  - `PATCH /api/saas/business/plans/:planId`
- Hospital onboarding endpoint:
  - `POST /api/saas/onboarding/hospitals`
- License status endpoint:
  - `GET /api/saas/license/status`
- Onboarding checklist endpoint:
  - `GET /api/saas/onboarding/checklist`

### Frontend
- SaaS Control Center now includes:
  - current tenant license strip
  - custom SaaS plan builder
  - hospital onboarding form
  - existing tenant usage monitor
  - subscription invoice and payment controls

## Intended SaaS workflow
1. Create or select a SaaS plan.
2. Onboard a hospital tenant.
3. Optionally create the first hospital admin user.
4. Trial/license dates are automatically assigned.
5. Use SaaS billing to generate invoices and record payments.
6. Use license status and usage limits to decide renewals, upgrades, suspensions, or cancellations.

## Production note
The payment link system remains gateway-ready. Connect Razorpay/Stripe/PayU webhooks before using automated payment confirmation in production.

## Clean packaging rule
Do not include:
- `.env`
- `node_modules`
- `dist`

Must include:
- `package.json`
- `package-lock.json`
- `.env.example`
