# Phase 4E — SaaS Invoice Automation & Dunning Readiness Report

## Baseline
Started from: `V48_phase4D_saas_billing_ui_tenant_usage_dashboard.zip`

## Objective
Add a safe SaaS billing automation foundation without harming existing HMS billing, tenant isolation, RBAC, compliance, pharmacy, lab, radiology, OPD/IPD, patient, doctor, appointment, and admin flows.

## Implemented
- Added SaaS invoice automation metadata on `SaaSInvoice`:
  - `auto_generated`
  - `generated_run_id`
  - `reminder_count`
  - `last_reminder_at`
  - `next_reminder_at`
  - `dunning_stage`
  - `dunning_notes`
- Added invoice period guardrail index to reduce duplicate open invoices for the same tenant billing period.
- Added dunning lookup index for reminder automation readiness.
- Added shared invoice generation helper for manual and automated invoice creation.
- Preserved existing manual invoice generation endpoint behavior while adding duplicate-period protection.
- Added due invoice generation endpoint for super admin:
  - `POST /api/saas/invoices/generate-due`
- Added dunning scan endpoint for super admin:
  - `POST /api/saas/invoices/dunning-scan`
- Added dunning stages:
  - `reminder`
  - `past_due`
  - `suspension_warning`
  - `suspended`
- Added subscription updates during dunning:
  - Past-due invoices can mark tenant subscription as `past_due`.
  - Long-overdue invoices can mark tenant subscription and tenant status as `suspended` according to policy thresholds.
- Added communication log entries for dunning reminders.
- Added audit logs for automated invoice generation and dunning actions.
- Added SaaS billing automation readiness regression script:
  - `npm run check:saas-billing-automation`

## Safety Notes
- All new SaaS billing automation endpoints are restricted to `super_admin` with `hospital.manage` permission.
- Existing hospital billing routes are not changed.
- Existing patient/doctor/appointment/pharmacy/lab/compliance/tenant isolation flows are preserved.
- Automation is API-ready but not externally scheduled yet. A cron/worker can call these endpoints later after production scheduling policy is finalized.

## New/Improved API Endpoints
- `POST /api/saas/invoices/generate-due`
- `POST /api/saas/invoices/dunning-scan`

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation readiness check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning remains unchanged and should be handled in a later code-splitting optimization phase.
- Payment gateway integration is still gateway-ready/manual-intent based. Real Razorpay/Stripe webhook hardening can be added in a later payment gateway phase.

## Next Recommended Phase
Phase 4F — Payment Gateway Webhook Hardening & Invoice Reconciliation.
