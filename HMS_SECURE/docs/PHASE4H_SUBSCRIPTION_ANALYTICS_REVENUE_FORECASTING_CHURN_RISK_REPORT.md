# Phase 4H — Subscription Analytics, Revenue Forecasting & Churn Risk Signals Report

## Baseline
Started from: `V48_phase4G_payment_gateway_provider_integration_settlement_reports.zip`

## Goal
Add safe SaaS subscription analytics for platform owners without touching tenant clinical, patient billing, payment webhook, or settlement core flows.

## Implemented
- Added read-only subscription analytics endpoint for super admins:
  - `GET /api/saas/analytics/subscriptions`
- Added SaaS metrics payload:
  - Active tenants
  - Total tenants
  - MRR
  - ARR
  - At-risk MRR
  - Total billed
  - Total collected
  - Total outstanding
  - Collection rate
  - Overdue invoice count
  - High-risk tenant count
- Added six-month rule-based revenue forecast:
  - Projected MRR
  - Projected ARR
  - Active tenant count per forecast month
- Added churn risk signal scoring using:
  - Tenant lifecycle status
  - Subscription status
  - Overdue invoices
  - Outstanding dues
  - Renewal/trial expiry proximity
  - Plan-limit pressure
- Added SaaS Control Center UI panels:
  - Subscription analytics
  - MRR/ARR/at-risk MRR cards
  - Collection health card
  - Six-month forecast list
  - Churn risk signals list
- Added regression guard script:
  - `npm run check:saas-subscription-analytics`

## Safety Notes
- Analytics endpoint is read-only.
- Endpoint is restricted to `super_admin` with `hospital.manage` permission.
- Tenant patient billing and SaaS subscription billing remain separate.
- No tenant clinical/business records are mutated by analytics calculation.
- Existing invoice, payment intent, webhook reconciliation and settlement flows are preserved.

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- SaaS UI safety check
- SaaS billing automation check
- SaaS webhook reconciliation check
- SaaS provider settlement check
- SaaS subscription analytics check
- Frontend production build

## Known Note
- Vite bundle-size warning remains. This should be handled in a later frontend optimization/code-splitting phase.

## Next Recommended Phase
Phase 4I — SaaS Customer Success Playbooks & Renewal Workflow.
