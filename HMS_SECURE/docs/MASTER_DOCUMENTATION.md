# HMS Enterprise Master Documentation


---
# SOURCE FILE: PHASE4G_PAYMENT_GATEWAY_PROVIDER_INTEGRATION_SETTLEMENT_REPORT.md

# Phase 4G — Payment Gateway Provider Integration & Admin Settlement Reports

## Baseline
Started from: `V48_phase4F_payment_gateway_webhook_hardening_reconciliation.zip`

## Objective
Extend Phase 4F webhook and invoice reconciliation foundation with provider-adapter readiness and admin settlement reporting while preserving existing HMS billing, tenant isolation, SaaS invoice, payment-link and webhook flows.

## Implemented
- Added provider adapter metadata for SaaS payment gateways:
  - `manual_gateway_ready`
  - `razorpay`
  - `stripe`
  - `payu`
  - custom gateway fallback support
- Added provider-aware payment link generation helper.
- Added gateway fee and net settlement amount calculation.
- Added gateway/settlement fields to SaaS payments:
  - `gateway`
  - `gateway_fee`
  - `net_amount`
  - `settlement_status`
  - `settlement_reference`
  - `settled_at`
- Added SaaS settlement model for provider payout reconciliation.
- Added admin settlement summary, listing, reconciliation and export endpoints.
- Extended SaaS billing summary with settlement KPIs.
- Added SaaS Control Center UI panels for:
  - gateway provider readiness
  - gateway gross/fee/net metrics
  - settlement reconciliation
  - recent settlement list
  - settlement CSV export
- Added regression script for provider + settlement safety checks.

## New/Improved API endpoints
- `GET /api/saas/payment-gateways/providers`
- `GET /api/saas/settlements/summary`
- `GET /api/saas/settlements`
- `POST /api/saas/settlements/reconcile`
- `GET /api/saas/settlements/export.csv`
- `GET /api/saas/billing/summary` now includes settlement metrics.
- `POST /api/saas/invoices/:id/payment-link` is now provider-aware.

## Files Changed
- `backend/src/models/index.js`
- `backend/src/routes/saas-billing.routes.js`
- `backend/scripts/saas-provider-settlement-check.js`
- `backend/package.json`
- `frontend/src/api/saasApi.js`
- `frontend/src/pages/SaasControl.jsx`
- `docs/LATEST_PHASE_REPORT.md`
- `docs/PROJECT_PHASE_HISTORY.md`

## Safety Notes
- Existing HMS patient billing routes were not changed.
- Existing SaaS invoice and payment intent flows are preserved.
- Existing Phase 4F signed webhook/idempotency/reconciliation flow is preserved.
- Provider integrations are adapter-ready and environment-variable driven; no hardcoded real gateway secrets were added.
- Settlement reconciliation is super-admin/permission-protected through existing SaaS billing route guards.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation check passed.
- SaaS webhook reconciliation check passed.
- SaaS provider integration and settlement reporting check passed.
- Frontend production build passed.

## Known Notes
- Frontend production build still shows the existing Vite bundle-size warning. This remains planned for a later code-splitting optimization phase.
- Real gateway API calls are intentionally not hardcoded. Razorpay/Stripe/PayU URLs and secrets should be provided through environment variables when enabling live payments.

## Next Recommended Phase
Phase 4H — Subscription Analytics, Revenue Forecasting & Churn Risk Signals.




---
# SOURCE FILE: PHASE4H_SUBSCRIPTION_ANALYTICS_REVENUE_FORECASTING_CHURN_RISK_REPORT.md

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




---
# SOURCE FILE: PHASE4I_SAAS_CUSTOMER_SUCCESS_RENEWAL_WORKFLOW_REPORT.md

# Phase 4I — SaaS Customer Success Playbooks & Renewal Workflow Report

## Baseline
Started from: `V48_phase4H_subscription_analytics_revenue_forecasting_churn_risk.zip`

## Implemented
- Added customer success note model for tenant-level follow-ups.
- Added renewal workflow model for renewal date, stage, owner, health score, risk level and action items.
- Added super-admin-only customer success overview endpoint.
- Added customer success note create/update endpoints.
- Added renewal workflow create/update endpoints.
- Added audit logging for customer success and renewal workflow actions.
- Added customer success readiness regression check.
- Preserved existing HMS, tenant isolation, billing, webhook, settlement and analytics flows.

## New API endpoints
- `GET /api/saas/customer-success/overview`
- `POST /api/saas/customer-success/notes`
- `PATCH /api/saas/customer-success/notes/:id`
- `POST /api/saas/renewals`
- `PATCH /api/saas/renewals/:id`

## Safety Notes
- All new endpoints require `super_admin` and `hospital.manage`.
- No existing billing/payment logic was modified.
- No tenant-scoped clinical module behavior was changed.
- Risk scoring is advisory and does not suspend or alter tenants automatically.

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- SaaS UI safety check
- SaaS billing automation check
- SaaS webhook reconciliation check
- Provider settlement check
- Subscription analytics check
- SaaS customer success readiness check
- Frontend production build

## Known Notes
- Vite bundle-size warning remains and should be handled in a later code-splitting optimization phase.

## Next Recommended Phase
Phase 4J — SaaS Support Desk, SLA Tracking & Escalation Workflow.




---
# SOURCE FILE: PHASE4J_SAAS_SUPPORT_DESK_SLA_ESCALATION_REPORT.md

# Phase 4J — SaaS Support Desk, SLA Tracking & Escalation Workflow Report

## Baseline
Started from: `V48_phase4I_saas_customer_success_renewal_workflow.zip`

## Implemented
- Added SaaS support ticket foundation for tenant support operations.
- Added SLA due tracking with priority-based default SLA hours.
- Added SLA breach flag in support overview responses.
- Added ticket escalation workflow with escalation timestamp and audit logging.
- Added support comments/activity notes on ticket updates.
- Added super-admin-only support overview and ticket management endpoints.
- Preserved existing HMS, tenant isolation, billing, payment, analytics and customer success flows.

## New/Improved API endpoints
- `GET /api/saas/support/overview`
- `POST /api/saas/support/tickets`
- `PATCH /api/saas/support/tickets/:id`
- `POST /api/saas/support/tickets/:id/escalate`

## Data Model Added
- `SupportTicket`
  - `hospital_id`
  - `ticket_no`
  - `subject`
  - `description`
  - `category`
  - `priority`
  - `status`
  - `sla_hours`
  - `sla_due_at`
  - `escalated`
  - `escalated_at`
  - `assigned_to`
  - `comments`
  - `resolution_notes`

## Safety Notes
- Support desk routes are restricted to `super_admin` with `hospital.manage` permission.
- Support tickets are keyed by `hospital_id` for tenant-specific visibility in SaaS support operations.
- This phase does not modify patient, doctor, appointment, billing, pharmacy, lab, compliance, payment or customer success core flows.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation check passed.
- SaaS webhook reconciliation check passed.
- Provider settlement check passed.
- Subscription analytics check passed.
- SaaS customer success readiness check passed.
- SaaS support desk readiness check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning still remains and should be handled in a later code-splitting optimization phase.
- Support desk file attachment handling can be connected later to the existing document/cloud storage hardening path.

## Next Recommended Phase
Phase 4K — SaaS Knowledge Base, Support Portal & Self-Service Help Center.




---
# SOURCE FILE: PHASE4K_SAAS_KNOWLEDGE_BASE_SELF_SERVICE_REPORT.md

# Phase 4K — SaaS Knowledge Base, Support Portal & Self-Service Help Center

## Baseline
Started from: `V48_phase4J_saas_support_desk_sla_escalation_workflow.zip`

## Goal
Add a SaaS self-service support foundation without harming existing HMS, tenant isolation, billing, webhook, analytics, customer-success, or support-desk workflows.

## Implemented
- Added `KnowledgeBaseArticle` model for help-center content.
- Added super-admin-controlled knowledge base management endpoints.
- Added safe public/tenant-admin knowledge-base read endpoints.
- Added publish/archive workflow for support articles.
- Added slug normalization and duplicate slug protection.
- Added article metadata: category, audience, visibility, status, tags, related ticket category, display order, view count and publish timestamp.
- Added audit logging for create/update/publish/archive actions.
- Added SaaS Control UI section for creating, publishing and archiving help articles.
- Added frontend SaaS API methods for knowledge-base management and portal-safe article reads.
- Added regression check: `npm run check:saas-knowledge-base`.

## New API Endpoints
- `GET /api/saas/knowledge-base/public`
- `GET /api/saas/knowledge-base/public/:slug`
- `GET /api/saas/knowledge-base`
- `POST /api/saas/knowledge-base`
- `PATCH /api/saas/knowledge-base/:id`
- `POST /api/saas/knowledge-base/:id/publish`
- `POST /api/saas/knowledge-base/:id/archive`

## Safety Notes
- Public endpoint only returns published articles with `public` or `tenant_admin` visibility.
- Internal/draft/archived articles are not exposed through the public help-center endpoint.
- Write/admin endpoints are restricted to `super_admin` plus `hospital.manage` permission.
- Existing support ticket, SLA, billing, tenant, payment and HMS clinical flows were not changed.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation check passed.
- SaaS webhook reconciliation check passed.
- SaaS provider settlement check passed.
- SaaS subscription analytics check passed.
- SaaS customer success readiness check passed.
- SaaS support desk readiness check passed.
- SaaS knowledge base readiness check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning remains unchanged and should be handled later in a dedicated code-splitting optimization phase.

## Next Recommended Phase
Phase 4L — Tenant Portal Authentication, Support Self-Service UX & Help-Center Search Hardening.




---
# SOURCE FILE: PHASE4N_BACKUP_RESTORE_TENANT_DATA_EXPORT_HARDENING_REPORT.md

# Phase 4N — Backup, Restore & Tenant Data Export Hardening Report

## Baseline
Started from: `V48_phase4M_hospital_onboarding_wizard_completion.zip`

## Goal
Close the original Phase 4D roadmap gap for backup, restore and tenant-level data export while preserving existing HMS, tenant isolation, billing, support and onboarding flows.

## Implemented
- Hardened tenant backup metadata:
  - retention date
  - SHA-256 checksum
  - verification status
  - verified-by user
  - restore test status
  - disaster recovery log linkage
- Added tenant restore request workflow model and endpoints.
- Added tenant data export model and safe JSON export endpoint.
- Added tenant export download endpoint with expiry and audit logging.
- Added disaster recovery event log model and listing endpoint.
- Enhanced tenant database overview with:
  - restore request counts
  - export readiness counts
  - open DR event counts
- Added backup verification checksum validation.
- Added DR logs for backup queued/completed/failed, verification, restore request/status and export completion/failure.
- Added regression check:
  - `npm run check:tenant-backup-restore-export`

## New/Improved API Endpoints
- `GET /api/tenant-databases/overview`
- `POST /api/tenant-databases/:hospitalId/backup`
- `GET /api/tenant-databases/backups`
- `POST /api/tenant-databases/backups/:id/verify`
- `POST /api/tenant-databases/backups/:id/restore-requests`
- `GET /api/tenant-databases/restore-requests`
- `PATCH /api/tenant-databases/restore-requests/:id`
- `POST /api/tenant-databases/:hospitalId/export`
- `GET /api/tenant-databases/exports`
- `GET /api/tenant-databases/exports/:id/download`
- `GET /api/tenant-databases/disaster-recovery-logs`

## Safety Notes
- Actual destructive restore execution was intentionally not automated in this phase.
- Restore is handled as a gated request workflow with approval/status tracking to avoid accidental production overwrite.
- Existing HMS business flows were not intentionally changed.
- Existing super-admin-only tenant database route protection was preserved.
- Tenant export reads tenant-scoped HMS collections by `hospital_id` and writes a server-side JSON package.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS onboarding readiness check passed.
- Tenant backup/restore/export hardening check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning remains unchanged and should be handled later in the optimization/code-splitting phase.
- Tenant backup still depends on `mongodump` being available in the backend runtime for real archive generation.

## Next Recommended Phase
Phase 5A — Patient & Appointment Reports.




---
# SOURCE FILE: PHASE4N_CONTINUATION_BACKUP_RESTORE_EXPORT_SAFETY_REPORT.md

# Phase 4N Continuation — Backup, Restore & Tenant Data Export Safety Hardening

## Baseline
Started from: `V48_phase4N_backup_restore_tenant_data_export_hardening.zip`

## Purpose
Continue Phase 4N with additional enterprise safety controls for tenant backup, restore approval, and tenant data export integrity without changing existing HMS clinical/billing workflows.

## Implemented
- Added backup/export manifest foundation with checksum, file size, record counts, generated timestamp and generated-by metadata.
- Added `manifest` metadata fields to tenant backup and tenant export records.
- Added `checksum_sha256` tracking to tenant data exports.
- Added restore approval checklist storage.
- Added restore approval guardrail: restore cannot move to `approved` unless checklist confirms:
  - business approval
  - technical approval
  - rollback plan reviewed
  - backup verified
- Added export manifest endpoint:
  - `GET /api/tenant-databases/exports/:id/manifest`
- Added regression check:
  - `npm run check:tenant-backup-restore-export-continuation`

## Safety Notes
- No patient, doctor, appointment, billing, pharmacy, lab, radiology, IPD, compliance, payment or SaaS billing business logic was intentionally changed.
- Existing tenant backup/restore/export endpoints remain compatible.
- Actual restore remains workflow-gated and does not automatically overwrite production data.

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant backup/restore/export hardening check
- Phase 4N continuation backup/restore/export safety check
- Frontend production build

## Known Note
- Vite bundle-size warning remains unchanged and should be handled in the later code-splitting/performance optimization phase.

## Next Recommended Phase
Phase 5A — Patient & Appointment Reports.




---
# SOURCE FILE: PHASE5A_PATIENT_APPOINTMENT_REPORTS_REPORT.md

# Phase 5A — Patient & Appointment Reports Report

## Baseline
Started from: `V48_phase4N_continued_backup_restore_export_safety_hardening.zip`

## Implemented
- Added read-only patient and appointment reporting endpoint.
- Added tenant-safe date-range reports for:
  - daily registrations
  - daily appointments
  - appointment completion/cancellation/no-show status mix
  - doctor-wise appointment performance
  - department-wise unique patient and appointment counts
  - average waiting minutes from check-in to consultation/completion
- Added frontend Reports page.
- Added Reports tab gated by `analytics.view` and enabled module config.
- Added `reportApi` client.
- Added `docs/PHASE5A_PATIENT_APPOINTMENT_REPORTS.md`.
- Added backend regression script `npm run check:phase5a-reports`.

## Safety Notes
- Existing HMS CRUD routes were not intentionally changed.
- Reports route is read-only.
- All report queries use tenant-scoped filtering.
- Route requires authenticated user and `analytics.view` permission.

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- SaaS onboarding check
- Tenant backup/restore/export hardening check
- Phase 4N continuation safety check
- Phase 5A patient/appointment reports check
- Frontend production build

## Known Note
- Vite bundle-size warning still remains and should be handled in the later optimization/code-splitting phase.

## Next Recommended Phase
Phase 5B — Revenue & Billing Reports.




---
# SOURCE FILE: PHASE5B_REVENUE_BILLING_REPORTS_REPORT.md

# Phase 5B — Revenue & Billing Reports Report

## Baseline
Started from: `V48_phase5A_patient_appointment_reports.zip`

## Goal
Add tenant-safe revenue and billing reports without changing core billing CRUD, patient, appointment, pharmacy, lab, IPD or SaaS flows.

## Implemented
- Added tenant-safe revenue and billing analytics endpoint.
- Added report period validation using `from` and `to` query dates.
- Added daily revenue trend metrics.
- Added payment mode report.
- Added service-type revenue report.
- Added doctor-wise revenue report where billing data contains `doctor_id`.
- Added department-wise revenue report through doctor-to-department mapping where available.
- Added payment status mix.
- Added outstanding dues metrics:
  - selected period outstanding
  - lifetime outstanding from open bills
  - insurance outstanding from open insurance claims
- Added discount and refund monitoring metrics.
- Added risk flags for high outstanding, high discounts and high refunds.
- Extended Reports UI with a new `Revenue & Billing` tab.
- Preserved Phase 5A Patient & Appointment Reports tab.
- Added regression check: `npm run check:phase5b-reports`.

## New/Improved API Endpoint
- `GET /api/reports/revenue-billing?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Files Changed
- `backend/src/routes/reports.routes.js`
- `backend/scripts/phase5b-revenue-billing-reports-check.js`
- `backend/package.json`
- `frontend/src/api/reportApi.js`
- `frontend/src/pages/Reports.jsx`
- `docs/LATEST_PHASE_REPORT.md`

## Safety Notes
- Report endpoint is read-only.
- Endpoint uses existing `verifyToken`, `attachTenant`, `tenantFilter(req, ...)` and `requirePermission('analytics.view')`.
- Existing billing create/update/payment/refund/cancel flows were not changed.
- Department-wise revenue is derived through doctor mapping when a bill has doctor linkage; otherwise values remain grouped as unassigned.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- Tenant backup/restore/export hardening check passed.
- Phase 4N continuation backup/restore/export safety check passed.
- Phase 5A patient and appointment reports check passed.
- Phase 5B revenue and billing reports check passed.
- Frontend production build passed.

## Known Note
- Frontend build still shows the existing Vite bundle-size warning. This is already planned for the later code-splitting/performance phase.

## Next Recommended Phase
Phase 5C — Pharmacy, Lab & IPD Reports.




---
# SOURCE FILE: PHASE5C_PHARMACY_LAB_IPD_REPORTS_REPORT.md

# Phase 5C — Pharmacy, Lab & IPD Reports

## Baseline
Started from: `V48_phase5B_revenue_billing_reports.zip`

## Implemented
- Added tenant-safe operational reports endpoint for pharmacy, lab, radiology and IPD metrics.
- Added pharmacy report metrics:
  - low stock items
  - expired stock count
  - expiring-soon stock
  - fast-moving medicines
  - pharmacy sales and revenue summary
- Added lab report metrics:
  - pending lab tests
  - lab status mix
  - category-wise lab summary
  - average lab turnaround time
  - critical result count where result flags exist
- Added radiology report metrics:
  - pending radiology tests
  - modality-wise summary
  - average radiology turnaround time
- Added IPD report metrics:
  - bed occupancy
  - ward-wise occupancy
  - active admissions
  - discharges
  - average length of stay
  - admission/discharge daily trend
- Added frontend Reports tab: `Pharmacy, Lab & IPD`.
- Added new regression check: `npm run check:phase5c-reports`.

## New/Improved API endpoint
- `GET /api/reports/pharmacy-lab-ipd`

## Safety Notes
- Reports are read-only.
- Existing patient, appointment, billing, pharmacy, lab, radiology and IPD CRUD flows were not intentionally changed.
- All report queries use tenant filtering.
- Metrics are defensive and tolerate partially populated historical records.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Phase 5B reports regression check passed.
- Phase 5C reports regression check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning remains and should be handled in the later optimization/code-splitting phase.
- Turnaround-time and length-of-stay metrics depend on workflow timestamps being captured consistently by source modules.

## Next Recommended Phase
Phase 5D — Executive Command Center.




---
# SOURCE FILE: PHASE5D_EXECUTIVE_COMMAND_CENTER_REPORT.md

# Phase 5D — Executive Command Center Report

## Baseline
Started from: `V48_phase5C_pharmacy_lab_ipd_reports.zip`

## Implemented
- Added tenant-safe Executive Command Center report endpoint.
- Added KPI summary for patient footfall, appointments, revenue, collections, outstanding dues, bed occupancy and pending diagnostic work.
- Added daily KPI trend for footfall, appointments, revenue and admissions.
- Added department performance summary combining appointment volume and revenue where data is available.
- Added pending work alerts for finance, occupancy, diagnostics, pharmacy stock and critical lab results.
- Added Executive Command Center tab in Reports UI.
- Added frontend API client method for executive command center reports.
- Added regression check: `npm run check:phase5d-command-center`.

## New API Endpoint
- `GET /api/reports/executive-command-center`

## Safety Notes
- Reporting endpoint is read-only.
- Tenant filtering is preserved through `tenantFilter(req, ...)`.
- Existing patient, appointment, billing, pharmacy, lab, radiology and IPD workflows were not intentionally changed.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Phase 5D executive command center readiness check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning still remains and should be handled in the later optimization/code-splitting phase.

## Next Recommended Phase
Phase 6A — OT / Surgery Module.




---
# SOURCE FILE: PHASE6A_OT_SURGERY_MODULE_REPORT.md

# Phase 6A — OT / Surgery Module Report

## Baseline
Started from: `V48_phase5D_executive_command_center.zip`

## Goal
Add an enterprise-safe OT/Surgery module foundation without harming existing HMS workflows.

## Implemented
- Added tenant-scoped OT/Surgery models:
  - `OTBooking`
  - `SurgeryNote`
  - `AnaesthesiaNote`
  - `PostOpNote`
  - `OTInventoryUsage`
- Added tenant-aware collections for OT/Surgery records.
- Added OT booking workflow foundation:
  - schedule OT booking
  - update OT booking/status
  - list OT bookings by date/status
  - OT dashboard summary
- Added surgery documentation foundation:
  - surgery note
  - anaesthesia note
  - post-op note
- Added OT inventory usage capture linked to OT booking.
- Added audit logging for OT write actions.
- Added clinical permission checks:
  - `clinical.view`
  - `clinical.manage`
- Mounted new backend route file:
  - `backend/src/routes/ot-surgery.routes.js`
- Added regression script:
  - `npm run check:phase6a-ot-surgery`

## New API Endpoints
- `GET /api/ot/bookings`
- `POST /api/ot/bookings`
- `PATCH /api/ot/bookings/:id`
- `GET /api/ot/dashboard`
- `POST /api/ot/bookings/:id/surgery-note`
- `POST /api/ot/bookings/:id/anaesthesia-note`
- `POST /api/ot/bookings/:id/post-op-note`
- `POST /api/ot/bookings/:id/inventory-usage`

## Safety Notes
- Existing patient, doctor, appointment, billing, pharmacy, lab, IPD, SaaS, tenant and reports flows were not intentionally changed.
- OT/Surgery data uses existing tenant isolation helpers.
- Client-supplied `hospital_id` is not trusted for OT creates.
- Write actions are audit logged.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Phase 6A OT/Surgery readiness check passed.
- Frontend production build passed.

## Known Notes
- Frontend bundle-size warning still remains and should be handled in a later optimization/code-splitting phase.
- This phase adds backend OT/Surgery foundation. A richer OT frontend workspace can be expanded in a follow-up phase if required.

## Next Recommended Phase
Phase 6B — Nursing Module.




---
# SOURCE FILE: PHASE6B_NURSING_MODULE_REPORT.md

# Phase 6B — Nursing Module Report

## Baseline
Started from: `V48_phase6A_ot_surgery_module.zip`

## Implemented
- Added tenant-scoped Nursing Module backend foundation.
- Added nursing dashboard endpoint for active admissions, open/overdue shift tasks, medication queue, vitals count and care-plan count.
- Added vitals charting foundation.
- Added Medication Administration Record (MAR) foundation with scheduled/administered/withheld/missed/cancelled statuses.
- Added handover notes foundation using SBAR-style fields: situation, background, assessment and recommendation.
- Added nursing care plan foundation with goals, interventions, review/evaluation notes and status tracking.
- Added shift-wise nursing tasks with due date, priority, assignment and completion tracking.
- Added tenant guardrails through `tenantFilter(req)` and `tenantCreateData(req)`.
- Added clinical permission checks through `clinical.view` and `clinical.manage`.
- Added audit logging for nursing write actions.
- Added frontend Nursing workspace with dashboard cards and quick forms for vitals, shift tasks and medication scheduling.

## New Backend Models / Collections
- `NursingVital` / `nursing_vitals`
- `MedicationAdministration` / `medication_administrations`
- `NursingHandoverNote` / `nursing_handover_notes`
- `NursingCarePlan` / `nursing_care_plans`
- `NursingShiftTask` / `nursing_shift_tasks`

## New API Endpoints
- `GET /api/nursing/dashboard`
- `GET /api/nursing/vitals`
- `POST /api/nursing/vitals`
- `GET /api/nursing/medications`
- `POST /api/nursing/medications`
- `PATCH /api/nursing/medications/:id/administer`
- `GET /api/nursing/handovers`
- `POST /api/nursing/handovers`
- `GET /api/nursing/care-plans`
- `POST /api/nursing/care-plans`
- `PATCH /api/nursing/care-plans/:id`
- `GET /api/nursing/tasks`
- `POST /api/nursing/tasks`
- `PATCH /api/nursing/tasks/:id`

## Frontend Added
- `frontend/src/api/nursingApi.js`
- `frontend/src/pages/Nursing.jsx`
- New sidebar tab: `Nursing`

## New Regression Check
- `npm run check:phase6b-nursing`

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Phase 6A OT/Surgery readiness check passed.
- Phase 6B Nursing readiness check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning still remains and should be handled in the planned optimization/code-splitting phase.
- The Nursing frontend is a safe foundation workspace. Advanced chart visualization, nurse assignment calendar and bedside workflow can be expanded in a later nursing enhancement phase.

## Next Recommended Phase
Phase 6C — Emergency / Casualty Module.




---
# SOURCE FILE: PHASE6C_EMERGENCY_CASUALTY_MODULE_REPORT.md

# Phase 6C — Emergency / Casualty Module Report

## Baseline
Started from: `V48_phase6B_nursing_module.zip`

## Implemented
- Added tenant-scoped Emergency / Casualty module backend foundation.
- Added emergency case registration workflow for existing or walk-in patients.
- Added emergency UID generation and hospital-scoped emergency UID uniqueness.
- Added triage workflow with red/orange/yellow/green/blue categories, triage score, vitals, red flags and notes.
- Added MLC support fields: MLC required flag, MLC number and police informed flag.
- Added emergency doctor assignment, bed reference, arrival mode and disposition fields.
- Added emergency clinical note workflow for assessment, diagnosis, treatment, orders and follow-up plan.
- Added emergency transfer/admission workflow for IPD, OT and external referrals.
- Added emergency billing link endpoint with existing billing permission guardrails.
- Added emergency dashboard with active cases, today cases, critical queue, MLC cases, pending transfers and closed-today metrics.
- Added tenant guardrails through `tenantFilter(req)` and `tenantCreateData(req)`.
- Added audit logging for emergency case, triage, clinical-note, transfer and billing-link actions.
- Added clinical permission checks using existing `clinical.view` and `clinical.manage` permissions.
- Improved clinical permission catalog so admin, hospital admin, doctor and nurse roles can access clinical workflow modules consistently.

## New Backend Models / Collections
- `EmergencyCase` / `emergency_cases`
- `EmergencyTriageNote` / `emergency_triage_notes`
- `EmergencyClinicalNote` / `emergency_clinical_notes`
- `EmergencyTransfer` / `emergency_transfers`

## New API Endpoints
- `GET /api/emergency/dashboard`
- `GET /api/emergency/cases`
- `POST /api/emergency/cases`
- `PATCH /api/emergency/cases/:id`
- `POST /api/emergency/cases/:id/triage`
- `GET /api/emergency/cases/:id/triage`
- `POST /api/emergency/cases/:id/clinical-note`
- `GET /api/emergency/cases/:id/clinical-notes`
- `POST /api/emergency/cases/:id/transfer`
- `GET /api/emergency/transfers`
- `PATCH /api/emergency/transfers/:id`
- `POST /api/emergency/cases/:id/billing-link`

## Frontend Added
- `frontend/src/api/emergencyApi.js`
- `frontend/src/pages/Emergency.jsx`
- New sidebar tab: `Emergency`

## New Regression Check
- `npm run check:phase6c-emergency`

## Full Testing Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation check passed.
- SaaS webhook reconciliation check passed.
- Provider settlement check passed.
- Subscription analytics check passed.
- SaaS customer success readiness check passed.
- SaaS support desk readiness check passed.
- SaaS knowledge base readiness check passed.
- Roadmap alignment check passed.
- SaaS onboarding readiness check passed.
- Tenant backup/restore/export hardening check passed.
- Phase 4N continuation backup/restore/export safety check passed.
- Phase 5A patient/appointment reports check passed.
- Phase 5B revenue/billing reports check passed.
- Phase 5C pharmacy/lab/IPD reports check passed.
- Phase 5D executive command center check passed.
- Phase 6A OT/Surgery readiness check passed.
- Phase 6B Nursing readiness check passed.
- Phase 6C Emergency/Casualty readiness check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning still remains and should be handled in the planned optimization/code-splitting phase.
- Emergency frontend is a safe foundation workspace. Advanced ER queue boards, triage timers, MLC forms, ambulance integration and emergency billing packages can be expanded later.

## Next Recommended Phase
Phase 6D — Blood Bank Module.




---
# SOURCE FILE: PHASE6D_BLOOD_BANK_FULL_COMPLETION_REPORT.md

# Phase 6D — Blood Bank Module Full Completion & Enterprise Hardening

## Baseline
Started from clean baseline: `V48_phase6C_emergency_casualty_module.zip`.

The earlier partial Phase 6D build was not used as the project baseline. This package rebuilds Phase 6D directly on top of the stable Phase 6C Emergency/Casualty module.

## Implemented

### Backend Models
Added tenant-scoped Blood Bank collections:
- `BloodDonor`
- `BloodUnit`
- `BloodRequisition`
- `BloodCrossMatch`
- `BloodIssueRecord`
- `BloodReservation`

Added these collections to the tenant-aware model routing list:
- `blood_donors`
- `blood_units`
- `blood_requisitions`
- `blood_cross_matches`
- `blood_issue_records`
- `blood_reservations`

### Blood Bank APIs
Added `backend/src/routes/blood-bank.routes.js` and mounted it in `server.js`.

New endpoints:
- `GET /api/blood-bank/dashboard`
- `GET /api/blood-bank/donors`
- `POST /api/blood-bank/donors`
- `PATCH /api/blood-bank/donors/:id`
- `GET /api/blood-bank/units`
- `POST /api/blood-bank/units`
- `PATCH /api/blood-bank/units/:id`
- `GET /api/blood-bank/requisitions`
- `POST /api/blood-bank/requisitions`
- `POST /api/blood-bank/requisitions/:id/approve`
- `POST /api/blood-bank/requisitions/:id/reject`
- `GET /api/blood-bank/cross-matches`
- `POST /api/blood-bank/cross-matches`
- `PATCH /api/blood-bank/cross-matches/:id`
- `GET /api/blood-bank/reservations`
- `POST /api/blood-bank/reservations`
- `POST /api/blood-bank/reservations/:id/release`
- `GET /api/blood-bank/issues`
- `POST /api/blood-bank/issues`
- `GET /api/blood-bank/reports/stock`

### Clinical and Operational Safety
- Donor registration and eligibility tracking.
- Blood unit inventory with component type, expiry date, storage location and temperature metadata.
- Duplicate bag-number prevention per tenant/hospital.
- Requisition workflow with doctor authorization traceability.
- Approval/rejection workflow for requisitions.
- Compatibility validation for cross-match flow.
- Compatible cross-match required before routine issue.
- Emergency issue override allowed only with required emergency reason.
- Unit reservation and release workflow.
- Issue, return and discard movements with traceability.
- Partial volume issue tracking.
- Quarantine, rejected, expired and discarded states supported.
- Near-expiry, expiry wastage, stock summary and usage trend metrics.
- Blood Bank audit logging for critical actions.

### Frontend
Added:
- `frontend/src/api/bloodBankApi.js`
- `frontend/src/pages/BloodBank.jsx`
- Blood Bank navigation tab.
- Blood Bank module registration in permission/module utilities.

UI includes:
- Dashboard cards
- Donor registration form
- Blood unit form
- Requisition form
- Cross-match form
- Reservation form
- Issue/return/discard form
- Inventory table
- Stock summary
- Requisition approval table
- Traceability list

### Regression Check Added
Added backend script:
- `npm run check:phase6d-blood-bank`

Script file:
- `backend/scripts/phase6d-blood-bank-enterprise-check.js`

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- Phase 5A reports check
- Phase 5B reports check
- Phase 5C reports check
- Phase 5D command center check
- Phase 6A OT/Surgery check
- Phase 6B Nursing check
- Phase 6C Emergency/Casualty check
- Phase 6D Blood Bank enterprise readiness check
- Frontend production build

## Known Notes
- Frontend build still shows the existing Vite bundle-size warning. This is unchanged and should be handled in the later optimization/code-splitting phase.
- Compatibility rules use a practical guardrail suitable for HMS workflow enforcement. Hospitals may still require lab-specific validation policies before real clinical use.
- This phase does not connect to physical blood bank devices or external regulatory systems; that can be handled in a later integration phase.

## Next Recommended Phase
Phase 6E — HR / Staff Module.




---
# SOURCE FILE: PHASE6E_HR_STAFF_MODULE_REPORT.md

# Phase 6E — HR / Staff Module Report

## Baseline
Started from: `V48_phase6D_blood_bank_full_completion_enterprise_hardening.zip`

## Implemented
- Added tenant-scoped HR / Staff backend foundation.
- Added staff profile management with department/designation/employment/status fields.
- Added attendance marking and attendance update workflow.
- Added shift roster creation and update workflow.
- Added leave request and review workflow.
- Added payroll export basics with period-based staff rows, attendance days and leave days.
- Added HR / Staff dashboard summary endpoint.
- Added audit logging for staff profile, attendance, roster, leave and payroll export actions.
- Added frontend HR / Staff tab with dashboard cards and operational forms/tables.
- Added HR / Staff module to tenant module settings and enterprise/hospital plans.

## New API Endpoints
- `GET /api/hr-staff/dashboard`
- `GET /api/hr-staff/staff`
- `POST /api/hr-staff/staff`
- `PATCH /api/hr-staff/staff/:id`
- `GET /api/hr-staff/attendance`
- `POST /api/hr-staff/attendance`
- `PATCH /api/hr-staff/attendance/:id`
- `GET /api/hr-staff/rosters`
- `POST /api/hr-staff/rosters`
- `PATCH /api/hr-staff/rosters/:id`
- `GET /api/hr-staff/leaves`
- `POST /api/hr-staff/leaves`
- `POST /api/hr-staff/leaves/:id/review`
- `GET /api/hr-staff/payroll-exports`
- `POST /api/hr-staff/payroll-exports`
- `GET /api/hr-staff/payroll-exports/:id`

## Safety Notes
- Existing HMS clinical, billing, reports and Blood Bank flows were not intentionally changed.
- HR / Staff collections are tenant-aware and use existing tenant middleware helpers.
- Routes require authenticated users and admin-level permissions.
- Payroll export is a basic export foundation, not a final payroll calculation engine.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Phase 6A OT/Surgery check passed.
- Phase 6B Nursing check passed.
- Phase 6C Emergency check passed.
- Phase 6D Blood Bank check passed.
- Phase 6E HR / Staff readiness check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning still remains. This should be handled in the later optimization/code-splitting phase.

## Next Recommended Phase
Phase 6F — Patient Portal.




---
# SOURCE FILE: PHASE6G_DOCTOR_PORTAL_UPGRADE_REPORT.md

# Phase 6G — Doctor Portal Upgrade Report

## Baseline
Started from: `V48_phase6F_patient_portal_upgrade.zip`

## Objective
Upgrade the existing Doctor Portal without creating a duplicate portal, while preserving all existing HMS, SaaS, reporting, clinical, Blood Bank, HR and Patient Portal functionality.

## Implemented
- Upgraded existing Doctor Portal backend payload builder.
- Added doctor own-data isolation guardrail:
  - doctor/portal_doctor users cannot select or spoof another `doctor_id`.
  - authorized staff/admin users can still select a doctor for operational support.
- Added audit logging for doctor portal access and spoof-denial events.
- Added segmented doctor portal API endpoints:
  - `GET /api/portal/doctor`
  - `GET /api/portal/doctor/queue`
  - `GET /api/portal/doctor/patients`
  - `GET /api/portal/doctor/emr`
  - `GET /api/portal/doctor/results`
  - `GET /api/portal/doctor/follow-ups`
- Added assigned-patient aggregation from appointments, consultations, lab orders and radiology orders.
- Added ready-results aggregation for completed/approved/reported lab and radiology results.
- Added follow-up list from OPD records with upcoming follow-up dates.
- Added doctor access metadata:
  - self-service vs staff view
  - own-data-only flag
  - selected doctor context
- Upgraded existing Doctor Portal UI with tabs:
  - Overview
  - Today Queue
  - Assigned Patients
  - EMR
  - Results
  - Follow-ups
- Added doctor portal API client methods.
- Added new regression check:
  - `npm run check:phase6g-doctor-portal`

## Safety Notes
- No duplicate doctor portal was created.
- Existing Patient Portal was preserved.
- Existing HMS modules were not intentionally changed.
- Doctor self-service access is restricted to the linked doctor profile.
- Admin/hospital admin selection remains available for operational support.

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- Phase 5A patient/appointment reports check
- Phase 5B revenue/billing reports check
- Phase 5C pharmacy/lab/IPD reports check
- Phase 5D executive command center check
- Phase 6A OT/Surgery check
- Phase 6B Nursing check
- Phase 6C Emergency/Casualty check
- Phase 6D Blood Bank enterprise check
- Phase 6E HR/Staff check
- Phase 6F Patient Portal check
- Phase 6G Doctor Portal check
- Frontend production build

## Known Note
- Vite bundle-size warning still remains and should be handled later in the optimization/code-splitting phase.

## Next Recommended Phase
Phase 7A — FHIR Implementation, unless you want to add another refinement phase for Patient/Doctor Portal UI before integrations.




---
# SOURCE FILE: PHASE7A_FHIR_IMPLEMENTATION_REPORT.md

# Phase 7A — FHIR Implementation Report

## Baseline
Started from: `V48_phase6G_doctor_portal_upgrade.zip`

## Goal
Add a safe FHIR R4 interoperability foundation without breaking existing HMS modules, portals, tenant isolation, reports, billing, or clinical workflows.

## Implemented
- Hardened existing FHIR export foundation instead of creating duplicate integration modules.
- Added FHIR R4-style tenant-scoped exports for:
  - Patient
  - Encounter
  - Observation
  - DiagnosticReport
  - MedicationRequest
  - Invoice
- Added FHIR CapabilityStatement endpoint:
  - `GET /api/fhir/metadata`
- Added FHIR validation endpoint:
  - `POST /api/fhir/validate`
- Added single-resource read endpoints where suitable:
  - `GET /api/fhir/Patient/:id`
  - `GET /api/fhir/Encounter/:id`
  - `GET /api/fhir/Observation/:id`
- Improved FHIR resource mapping quality:
  - identifiers
  - meta/profile fields
  - lastUpdated timestamps
  - subject/practitioner references
  - diagnostic report presented forms
  - invoice line items and totals
  - medication dosage instructions
- Preserved tenant filters on all FHIR export queries.
- Added FHIR integration logs for metadata, validation, and resource export events.
- Kept existing FHIR APIs frontend workspace intact and upgraded backend compatibility.

## Main Endpoints
- `GET /api/fhir/metadata`
- `POST /api/fhir/validate`
- `GET /api/fhir/Patient`
- `GET /api/fhir/Patient/:id`
- `GET /api/fhir/Encounter`
- `GET /api/fhir/Encounter/:id`
- `GET /api/fhir/Observation`
- `GET /api/fhir/Observation/:id`
- `GET /api/fhir/DiagnosticReport`
- `GET /api/fhir/MedicationRequest`
- `GET /api/fhir/Invoice`

## Safety Notes
- All exports are read-only.
- No patient/doctor/appointment/billing CRUD flow was intentionally changed.
- Tenant isolation remains enforced via `tenantFilter(req)` and `attachTenant`.
- FHIR endpoints still require `configuration.manage` permission.
- This is an FHIR R4 foundation/export layer, not a full external HIE gateway yet.

## New Regression Check
- `npm run check:phase7a-fhir`

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Phase 6G Doctor Portal readiness check passed.
- Phase 7A FHIR implementation readiness check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning still remains and should be handled in the later optimization/code-splitting phase.
- FHIR validation is lightweight structural validation. Full profile validation against official HL7 packages can be added later with a dedicated validation service.

## Next Recommended Phase
Phase 7B — HL7 Interface.




---
# SOURCE FILE: PHASE7B_HL7_INTERFACE_REPORT.md

# Phase 7B — HL7 Interface Report

## Baseline
Started from: `V48_phase7A_fhir_implementation.zip`

## Goal
Add an HL7 interface foundation without harming existing HMS, tenant isolation, FHIR, portal, reporting, and clinical modules.

## Implemented
- Added tenant-scoped `HL7Message` model and `hl7_messages` collection.
- Added HL7 message queue foundation with message UID, control ID, direction, status, retry count, ACK metadata, raw message, and parsed payload.
- Added HL7 parser for core MSH/PID/OBR/OBX segments.
- Added HL7 generator helpers for:
  - ADT messages: `ADT^A01`, `ADT^A04`, `ADT^A08`
  - ORM order messages: `ORM^O01`
  - ORU result messages: `ORU^R01`
- Added appointment-to-HL7 helpers for ADT and ORM.
- Added lab-result-to-HL7 helper for ORU.
- Added ACK generation and ACK status update workflow.
- Added retry workflow with max retry guardrail and next retry timestamp.
- Added HL7 integration logs using existing `IntegrationLog` collection.
- Added audit logging for queued HL7 messages.
- Mounted HL7 routes safely under `/api` with token, tenant, and permission checks.
- Upgraded existing HL7 readiness UI instead of creating a duplicate portal/page.
- Added frontend API functions for HL7 summary, messages, generate, parse, queue, ACK, and retry.
- Added dedicated regression check: `npm run check:phase7b-hl7`.

## New API Endpoints
- `GET /api/hl7/summary`
- `GET /api/hl7/messages`
- `POST /api/hl7/parse`
- `POST /api/hl7/generate`
- `POST /api/hl7/messages`
- `POST /api/hl7/messages/:id/ack`
- `POST /api/hl7/messages/:id/retry`
- `POST /api/hl7/adt/from-appointment/:id`
- `POST /api/hl7/orm/from-appointment/:id`
- `POST /api/hl7/oru/from-lab/:id`

## Safety Notes
- Existing HMS business flows were not intentionally changed.
- HL7 routes require existing authentication, tenant context, and `configuration.manage` permission.
- HL7 records are tenant-aware and included in tenant collection protection.
- This phase creates interface readiness and message workflow foundation. Real external MLLP/TCP connector, vendor-specific mapping, and production interface engine deployment should be handled in a later integration-hardening phase.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Phase 6G Doctor Portal readiness check passed.
- Phase 7A FHIR readiness check passed.
- Phase 7B HL7 interface readiness check passed.
- Frontend production build passed.

## Known Notes
- Frontend build still shows the existing large bundle-size warning. This is unchanged and should be handled in the later optimization/code-splitting phase.
- Vite still reports the existing dynamic/static import warning for `appointmentApi.js`. This is not introduced by HL7 and does not block build.

## Next Recommended Phase
Phase 7C — PACS / DICOM Integration.




---
# SOURCE FILE: PHASE7C_PACS_DICOM_INTEGRATION_REPORT.md

# Phase 7C — PACS / DICOM Integration Report

## Baseline
Started from: `V48_phase7B_hl7_interface.zip`

## Goal
Add PACS/DICOM integration foundation without harming existing HMS, radiology, FHIR, HL7, tenant isolation, portal, reporting, or clinical workflows.

## Implemented
- Added PACS/DICOM backend route module: `backend/src/routes/pacs-dicom.routes.js`.
- Added tenant-safe PACS dashboard summary.
- Added DICOM imaging worklist endpoint over existing tenant-scoped radiology studies.
- Added imaging study creation endpoint with:
  - accession number support
  - modality support
  - Study Instance UID generation
  - Orthanc study ID support
  - PACS viewer URL support
- Added PACS/DICOM link update workflow for existing radiology studies.
- Added PACS/radiology status update workflow.
- Added ImagingStudy-style manifest endpoint for study metadata exchange.
- Added PACS / Orthanc / DICOMweb configuration verification endpoint.
- Added audit logs for PACS study creation, linking, status updates and connection verification.
- Upgraded existing PACS/DICOM frontend page instead of creating a duplicate module.
- Added frontend API wrapper: `frontend/src/api/pacsApi.js`.
- Added new regression check: `npm run check:phase7c-pacs-dicom`.

## New API Endpoints
- `GET /api/pacs/dashboard`
- `GET /api/pacs/worklist`
- `POST /api/pacs/studies`
- `PATCH /api/pacs/studies/:id/link`
- `PATCH /api/pacs/studies/:id/status`
- `GET /api/pacs/studies/:id/manifest`
- `POST /api/pacs/verify-connection`

## Safety Notes
- Existing radiology APIs were preserved.
- Existing FHIR and HL7 routes were preserved.
- PACS records reuse tenant-scoped `radiology_tests` data to avoid duplicate imaging orders.
- PACS access is protected with existing radiology/configuration permissions.
- Viewer URLs are validated to require `http://` or `https://`.
- No real PACS server call is forced; configuration is stored as integration-ready metadata so production Orthanc/vendor PACS connection can be enabled later.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Doctor portal readiness check passed.
- FHIR readiness check passed.
- HL7 readiness check passed.
- PACS/DICOM readiness check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning still remains; it should be handled in the later optimization/code-splitting phase.
- PACS/DICOM is integration-ready and Orthanc/vendor PACS configuration-ready, but real DICOM network communication should be connected with hospital PACS credentials and network access in a later deployment/integration hardening step.

## Next Recommended Phase
Phase 7D — ABDM / ABHA Integration.




---
# SOURCE FILE: PHASE7D_ABDM_ABHA_INTEGRATION_UPGRADE_REPORT.md

# Phase 7D — ABDM / ABHA Integration Upgrade Report

## Baseline
Started from: `V48_phase7C_pacs_dicom_integration.zip`

## Goal
Upgrade the existing ABDM/ABHA feature instead of creating a duplicate module. The existing frontend tab and feature flag were preserved and expanded into a safer tenant-scoped ABDM/ABHA readiness workspace.

## Implemented
- Upgraded existing `ABDMABHA.jsx` page instead of adding a duplicate portal/module.
- Added tenant-safe ABDM/ABHA backend route file: `backend/src/routes/abdm-abha.routes.js`.
- Added ABDM/ABHA models:
  - `ABDMConsent`
  - `ABHACareContext`
- Added ABHA identity verification/linking endpoint with masked identifier storage and SHA-256 hash tracking.
- Added consent artefact workflow with status tracking:
  - requested
  - granted
  - denied
  - revoked
  - expired
- Added care context linking workflow for OPD, IPD, Lab, Radiology, Prescription, Billing and Document records.
- Added ABDM gateway callback logging foundation for sandbox readiness.
- Added ABDM readiness endpoint and score.
- Added IntegrationLog + AuditLog coverage for ABDM actions.
- Preserved FHIR Patient bundle preview for ABDM exchange readiness.
- Added frontend API methods for ABDM summary, readiness, identity verification, consent and care-context workflows.
- Added new regression check:
  - `npm run check:phase7d-abdm-abha`

## New/Improved API Endpoints
- `GET /api/abdm/summary`
- `GET /api/abdm/readiness`
- `POST /api/abdm/identity/verify`
- `GET /api/abdm/consents`
- `POST /api/abdm/consents`
- `PATCH /api/abdm/consents/:id/status`
- `GET /api/abdm/care-contexts`
- `POST /api/abdm/care-contexts`
- `POST /api/abdm/gateway/callback`

## Safety Notes
- Raw ABHA number/address is not intentionally exposed in responses.
- ABHA display uses masked value.
- Hash is stored for traceability/dedupe readiness.
- All ABDM records use tenant-aware collections and `tenantFilter` / `tenantCreateData`.
- ABDM callbacks are logged for readiness; real ABDM gateway signing/authorization can be connected later when production ABDM credentials are available.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Doctor Portal readiness check passed.
- FHIR readiness check passed.
- HL7 readiness check passed.
- PACS/DICOM readiness check passed.
- ABDM/ABHA readiness check passed.
- Frontend production build passed.

## Known Note
- Existing Vite bundle-size warning remains. This is already planned for the later performance/code-splitting optimization phase.

## Next Recommended Phase
Phase 7E — ERP / Tally Integration.




---
# SOURCE FILE: PHASE7E_ERP_TALLY_INTEGRATION_UPGRADE_REPORT.md

# Phase 7E — ERP / Tally Integration Upgrade Report

## Baseline
Started from: `V48_phase7D_abdm_abha_integration_upgrade.zip`

## Existing Feature Check
- Existing ERP/Tally UI page was already present: `frontend/src/pages/ERPTally.jsx`.
- Existing enterprise feature flag for `erp` was already present in tenant feature flags.
- No duplicate ERP/Tally module was created.
- The existing ERP/Tally page was upgraded and connected to dedicated tenant-safe backend endpoints.

## Implemented
- Added tenant-safe ERP/Tally backend route: `backend/src/routes/erp-tally.routes.js`.
- Added ERP/Tally ledger mapping persistence using existing `EnterpriseFeatureRecord` model.
- Added billing-to-accounting voucher mapping.
- Added export preview endpoint.
- Added export generation endpoint with integration log creation.
- Added Tally XML, CSV and JSON export support.
- Added export checksum manifest support.
- Added export manifest lookup endpoint.
- Added ERP/Tally permissions:
  - `erp.view`
  - `erp.manage`
- Added accountant/admin/hospital_admin access for ERP/Tally permissions.
- Upgraded existing ERP/Tally frontend page with:
  - ledger mapping form
  - export format selector
  - voucher preview
  - checksum manifest display
  - export log visibility
- Added frontend API client: `frontend/src/api/erpTallyApi.js`.
- Added regression check: `npm run check:phase7e-erp-tally`.

## New / Upgraded API Endpoints
- `GET /api/erp-tally/summary`
- `GET /api/erp-tally/ledger-mapping`
- `POST /api/erp-tally/ledger-mapping`
- `GET /api/erp-tally/export/preview`
- `POST /api/erp-tally/export`
- `GET /api/erp-tally/export/:id/manifest`

## Safety Notes
- Export flow is read-only against billing records.
- Invoice/billing records are not mutated by ERP/Tally export.
- Export activity is logged in `IntegrationLog`.
- All queries are tenant-scoped via tenant middleware.
- Existing ERP/Tally page was upgraded instead of creating a duplicate module.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Doctor Portal readiness check passed.
- FHIR readiness check passed.
- HL7 readiness check passed.
- PACS/DICOM readiness check passed.
- ABDM/ABHA readiness check passed.
- ERP/Tally readiness check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning still remains and should be handled in the later code-splitting / performance optimization phase.
- Tally XML export is integration-ready foundation. Real production deployment may still need hospital-specific ledger naming, voucher type customization, tax ledgers and accounting review before live import.

## Next Recommended Phase
Phase 7F — Communication Integrations Upgrade.




---
# SOURCE FILE: PHASE7F_COMMUNICATION_INTEGRATIONS_UPGRADE_REPORT.md

# Phase 7F — Communication Integrations Upgrade Report

## Baseline
Started from: `V48_phase7E_erp_tally_integration_upgrade.zip`

## Existing Feature Check
The project already had communication-related features:
- `backend/src/routes/communication.routes.js`
- `backend/src/utils/communication.js`
- `backend/src/routes/notification.routes.js`
- `frontend/src/pages/Communications.jsx`
- `frontend/src/pages/WhatsAppSMS.jsx`
- `frontend/src/api/communicationApi.js`

No duplicate Communication / WhatsApp / SMS module was created. The existing communication feature was upgraded in place.

## Implemented / Upgraded
- Communication template governance foundation.
- Approved-template based message rendering with `{{variable}}` support.
- Reminder rule foundation for appointment, report-ready, payment-due and follow-up reminders.
- Appointment reminder workflow upgraded to support templates and tenant-safe contact lookup.
- Payment due reminder workflow added.
- Due communication queue endpoint added.
- Provider callback endpoint added for sent/delivered/read/failed lifecycle tracking.
- Retry workflow for failed/skipped/queued messages.
- Contact normalization for email/SMS/WhatsApp channels.
- Scheduled communication support.
- Provider status, delivery/read timestamps and provider payload metadata added.
- Communication CSV export expanded with template/provider lifecycle fields.
- Existing Communications UI upgraded with:
  - template governance panel
  - reminder rule panel
  - due queue summary
  - payment reminder action
  - retry action
  - provider lifecycle stats
- Tenant scoping preserved through `attachTenant`, `tenantFilter`, and `tenantCreateData`.
- Audit logging preserved/added for communication send, template, rule, retry, callback and reminder workflows.

## New / Improved API Endpoints
- `GET /api/communications/templates`
- `POST /api/communications/templates`
- `PATCH /api/communications/templates/:id/approve`
- `GET /api/communications/rules`
- `POST /api/communications/rules`
- `PATCH /api/communications/rules/:id`
- `GET /api/communications/due`
- `POST /api/communications/payment-due-reminders`
- `POST /api/communications/:id/mark-failed`
- `POST /api/communications/:id/retry`
- `POST /api/communications/provider-callback`

Existing endpoints preserved:
- `GET /api/communications/summary`
- `GET /api/communications/logs`
- `POST /api/communications/send`
- `POST /api/communications/appointment-reminders`
- `POST /api/communications/:id/mark-sent`
- `GET /api/communications/export.csv`

## New Data Models / Fields
- `CommunicationTemplate`
- `CommunicationRule`
- `CommunicationLog` enhanced with:
  - `contact_normalized`
  - `template_key`
  - `template_version`
  - `provider_status`
  - `provider_payload`
  - `retry_count`
  - `next_retry_at`
  - `delivered_at`
  - `read_at`
  - `consent_checked`
  - `scheduled_for` as Date

## New Regression Check
- `npm run check:phase7f-communications`

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Doctor Portal readiness check passed.
- FHIR readiness check passed.
- HL7 readiness check passed.
- PACS/DICOM readiness check passed.
- ABDM/ABHA readiness check passed.
- ERP/Tally readiness check passed.
- Communication Integrations readiness check passed.
- Frontend production build passed.

## Known Notes
- External SMS/WhatsApp/Email delivery is still provider-env ready. Messages are safely skipped if provider credentials are not configured.
- Real provider SDK/API calls can be connected in a later production integration hardening step after provider selection.
- Existing Vite bundle-size warning remains and should be handled in the later code-splitting/performance optimization phase.

## Next Recommended Phase
Phase 8A — Automated Testing.




---
# SOURCE FILE: PHASE8A_AUTOMATED_TESTING_REPORT.md

# Phase 8A — Automated Testing Report

## Baseline
Started from: `V48_phase7F_communication_integrations_upgrade.zip`

## Goal
Formalize the project’s existing safety/readiness scripts into a repeatable automated regression testing workflow before moving into frontend testing and production optimization.

## Implemented
- Added backend automated regression runner:
  - `backend/scripts/run-regression-suite.js`
- Added Phase 8A test harness validation:
  - `backend/scripts/phase8a-automated-testing-check.js`
- Added package scripts:
  - `npm run test:regression`
  - `npm run test:automated`
  - `npm run check:phase8a-automated-testing`
- Added automated testing documentation:
  - `docs/TESTING.md`
- Updated latest phase report:
  - `docs/LATEST_PHASE_REPORT.md`
- Updated consolidated project history:
  - `docs/PROJECT_PHASE_HISTORY.md`
- Preserved existing HMS, SaaS, report, portal and integration business logic.

## Regression Suite Coverage
The new `npm run test:automated` command runs:
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- SaaS onboarding check
- Backup/restore/export checks
- Phase 5 reports checks
- Phase 6 enterprise module checks
- Patient Portal check
- Doctor Portal check
- FHIR check
- HL7 check
- PACS/DICOM check
- ABDM/ABHA check
- ERP/Tally check
- Communication integrations check
- Phase 8A automated testing harness check

## Checks Passed
- Backend dependency install completed.
- `npm run test:automated` passed.
- Automated regression suite passed: 24/24 checks.
- Phase 8A automated testing readiness check passed.
- Frontend dependency install completed.
- Frontend production build passed.

## Known Notes
- Frontend build still shows the existing Vite bundle-size warning. This is expected and should be handled in the later performance/code-splitting phase.
- `react-hot-toast` emits an existing module directive warning during build; build still passes.
- Database mutation/API integration tests were not added in this phase because they should run against a dedicated test database/CI environment to avoid harming real data.

## Next Recommended Phase
Phase 8B — Frontend Testing.




---
# SOURCE FILE: PHASE8B_FRONTEND_TESTING_REPORT.md

# Phase 8B — Frontend Testing Report

## Baseline
Started from: `V48_phase8A_automated_testing.zip`

## Objective
Upgrade the existing frontend quality checks without rewriting the application or creating duplicate modules. The goal was to formalize frontend regression coverage for forms, tables, permissions, error handling, portal flows and patient journey safety.

## Implemented
- Added frontend regression harness:
  - `frontend/scripts/phase8b-frontend-testing-check.cjs`
- Added frontend scripts:
  - `npm run check:phase8b-frontend`
  - `npm run test:frontend`
- Added backend integration check:
  - `backend/scripts/phase8b-frontend-testing-check.js`
  - `npm run check:phase8b-frontend-testing`
- Extended backend automated suite so `npm run test:automated` also verifies Phase 8B frontend testing integration.
- Updated testing documentation with Phase 8B coverage.

## Frontend coverage added
- Frontend build script presence
- API auth token attachment
- refresh-token retry flow
- auth state cleanup on refresh failure
- DataTable internal field hiding
- DataTable row action menu contract
- empty table state
- form field type mapping
- role/status dropdown coverage
- custom field support
- permission-based tab filtering
- tenant/feature flag state preservation
- login submit/error handling contract
- patient create/edit/new workflow contract
- appointment date/time/status flow
- reports page sections
- Patient Portal own-data isolation contract
- Doctor Portal scoped access contract
- segmented portal API endpoints
- critical page existence checks

## Checks Passed
- Backend dependency install completed.
- Backend route load passed.
- Full backend automated regression suite passed: 24/24 checks.
- Phase 8A automated testing check passed.
- Phase 8B frontend testing integration check passed.
- Frontend Phase 8B regression check passed: 24/24.
- Frontend production build passed.

## Notes
- No HMS business workflow was intentionally changed.
- This phase adds static/contract-style frontend checks. Browser-level E2E execution is still planned for Phase 8C.
- Vite bundle-size warning still remains and should be handled in Phase 8D Performance Optimization / code splitting.

## Next Recommended Phase
Phase 8C — E2E Testing.




---
# SOURCE FILE: PHASE8C_E2E_TESTING_REPORT.md

# Phase 8C — E2E Testing Report

## Baseline
Started from: `V48_phase8B_frontend_testing.zip`

## Implemented
- Added backend E2E readiness check script: `backend/scripts/phase8c-e2e-testing-check.js`.
- Added frontend E2E contract check script: `frontend/scripts/phase8c-e2e-check.cjs`.
- Added backend script: `npm run check:phase8c-e2e`.
- Added frontend scripts:
  - `npm run check:phase8c-e2e`
  - `npm run test:e2e`
- Added `docs/E2E_TESTING.md`.
- Updated `docs/TESTING.md`.
- Updated latest phase documentation.

## E2E Journeys Covered
- Login
- Add patient
- Book appointment
- OPD / EMR consultation
- Create bill / invoice receipt
- Lab and radiology order/result flow
- IPD admission/discharge
- Pharmacy stock and sale
- Patient Portal self-service
- Doctor Portal worklist

## Safety
- No HMS business logic intentionally changed.
- No duplicate modules created.
- Existing Phase 8A and Phase 8B testing layers preserved.
- Phase 8C added deterministic contract checks that can run without a live database/browser server.

## Checks Passed
- Backend route load check.
- Backend automated regression suite.
- Phase 8A automated testing check.
- Phase 8B frontend testing check.
- Phase 8C E2E readiness check.
- Frontend Phase 8B check.
- Frontend Phase 8C E2E contract check.
- Frontend production build.

## Known Note
Phase 8C currently validates E2E journey wiring and contracts. A later staging-focused enhancement can add Playwright/Cypress live-browser tests with seeded data.

## Next Recommended Phase
Phase 8D — Performance Optimization.




---
# SOURCE FILE: PHASE8D_PERFORMANCE_OPTIMIZATION_REPORT.md

# Phase 8D — Performance Optimization Report

## Baseline
Started from: `V48_phase8C_e2e_testing.zip`

## Implemented
- Added Vite production config at `frontend/vite.config.js`.
- Added page-level code splitting through `React.lazy` and `Suspense`.
- Removed eager page barrel import from the main app bundle.
- Added chart vendor chunking for Recharts-heavy report/analytics screens.
- Added module loading fallback UI.
- Added frontend performance check script.
- Added backend Phase 8D performance readiness check.
- Added `docs/PERFORMANCE_OPTIMIZATION.md`.
- Preserved existing HMS, SaaS, portal, integration, and report flows.

## New/Updated Commands
- Backend: `npm run check:phase8d-performance`
- Backend: `npm run test:automated` now includes Phase 8D performance check.
- Frontend: `npm run check:phase8d-performance`
- Frontend: `npm run test:performance`

## Checks Passed
- Backend dependency install.
- Backend route load check.
- Full backend automated regression suite.
- Phase 8D performance readiness check.
- Frontend Phase 8B testing check.
- Frontend Phase 8C E2E check.
- Frontend Phase 8D performance check.
- Frontend production build.

## Notes
- The previous bundle-size warning is resolved by page-level code splitting and controlled production chunking.
- CSS is still global and can be further optimized later by splitting page-level styles.
- Database query/index tuning should be validated after production-like data volume is available.

## Next Recommended Phase
Phase 8E — Production Deployment Readiness.




---
# SOURCE FILE: PHASE8E_PRODUCTION_DEPLOYMENT_READINESS_REPORT.md

# Phase 8E — Production Deployment Readiness Report

## Baseline
Started from: `V48_phase8D_performance_optimization.zip`

## Goal
Prepare the Enterprise HMS project for production deployment readiness without changing core hospital workflows.

## Implemented
- Added `docs/PRODUCTION_DEPLOYMENT_READINESS.md`.
- Added `docs/ENVIRONMENT_MATRIX.md`.
- Added `docs/runbooks/PRODUCTION_RELEASE_RUNBOOK.md`.
- Added `docs/RELEASE_NOTES.md`.
- Updated `docs/PRODUCTION_CHECKLIST.md` for Phase 8E.
- Updated `docs/LATEST_PHASE_REPORT.md`.
- Added `.github/workflows/ci.yml`.
- Added backend readiness script: `backend/scripts/phase8e-production-readiness-check.js`.
- Added frontend readiness script: `frontend/scripts/phase8e-production-check.cjs`.
- Registered backend command: `npm run check:phase8e-production-readiness`.
- Registered frontend command: `npm run check:phase8e-production`.
- Added frontend convenience command: `npm run test:production`.
- Updated Render config to use `npm ci` and `/api/health/ready` health checks.
- Extended env examples with release/environment placeholders.

## Preserved
- Existing HMS business modules.
- Existing tenant isolation and SaaS safety checks.
- Existing patient/doctor portal checks.
- Existing integration checks.
- Existing frontend performance/code-splitting changes from Phase 8D.

## Checks Run
- Backend dependency install.
- Backend route load check.
- Backend automated regression suite.
- Backend Phase 8E production readiness check.
- Frontend dependency install.
- Frontend regression checks.
- Frontend E2E checks.
- Frontend performance checks.
- Frontend Phase 8E production readiness check.
- Frontend production build.

## Known Notes
- Production secrets must be set in Render/Vercel dashboards before live deployment.
- Real production smoke testing requires deployed Render/Vercel URLs and a live MongoDB Atlas database.
- Database restore should only be executed after the approval workflow established in Phase 4N.

## Next Recommended Step
Pilot/staging deployment validation, then production launch using the Phase 8E runbook.




---
# SOURCE FILE: PROJECT_NOTES.md

# HMS Enterprise Project Notes

This file consolidates phase notes from previous package versions to keep the ZIP clean.



---

## PHASE3_STEP10_NOTES.md

# Phase 3 Step 10 - Hospital Details, Branding, Three-Dot Actions

## Added
- Hospital details/settings fields in Hospitals panel.
- Hospital branding fields: primary and secondary colors.
- Prefix settings: UHID, bill, prescription, and lab report prefixes.
- Hospital logo file upload using existing Cloudinary setup.
- Hospital details modal.
- Hospital admin users modal.
- Three-dot row actions:
  - View Details
  - Edit Hospital
  - Upload Logo
  - Manage Modules
  - Manage Features
  - Manage Admin Users
  - Disable/Enable
  - Archive Hospital
- Safe archive endpoint instead of hard delete.

## Safety
- Existing data is not reset.
- Existing login flow is preserved.
- `.env` is not included.
- `node_modules` and `dist` are not included.
- `package-lock.json` is preserved for backend and frontend.

## New API Endpoints
- POST /api/tenants/:id/logo
- DELETE /api/tenants/:id

## Important
Archive is soft delete: hospital status becomes `archived`, `is_deleted=true`, and hospital login is blocked.



---

## PHASE3_STEP11B3_DOCTOR_DOCUMENT_UPLOAD_V4_NOTES.md

# PHASE3 STEP11B3 DOCTOR DOCUMENT UPLOAD V4

Base used:
- HMS_SECURE_PHASE3_STEP11B3_DOCTOR_IMAGE_UPLOAD_V3.zip

Scope:
- Phase 4 only: doctor documents/certificates upload and management.
- No unrelated enterprise modules were changed.

Backend changes:
- Added POST `/api/doctors/:id/documents`
  - Requires `doctor.document.manage`
  - Uploads doctor registration/license/certificate files to Cloudinary
  - Saves files in `doctor.certificates`
  - Supports PDF, DOC, DOCX, JPG, PNG, WEBP
  - Max file size: 8MB
- Added DELETE `/api/doctors/:id/documents/:docIndex`
  - Requires `doctor.document.manage`
  - Deletes Cloudinary file when `file_public_id` exists
  - Removes document from doctor certificates array
- Added `doctor.document.manage` permission for admin and hospital_admin.
- Existing doctor profile image upload remains limited to 3MB through validation.

Frontend changes:
- Doctor profile now includes an upload form for:
  - Registration Certificate
  - Medical License
  - Degree Certificate
  - Specialization Certificate
  - Experience Letter
  - Government ID
  - Other
- Doctor profile now shows document list with:
  - View
  - Download
  - Delete
- Profile refreshes after upload/delete.
- Existing doctor profile image functionality remains unchanged.

Checks completed:
- Backend syntax check passed:
  - backend/src/routes/core.routes.js
  - backend/src/models/index.js
  - backend/src/config/permissions.js
  - frontend/src/api/doctorApi.js
- Frontend build passed with existing Vite bundle-size warning only.

Important deployment note:
- Render must have valid Cloudinary environment variables for image/document upload:
  - CLOUDINARY_CLOUD_NAME
  - CLOUDINARY_API_KEY
  - CLOUDINARY_API_SECRET

Excluded from ZIP:
- .env
- node_modules
- dist



---

## PHASE3_STEP11B3_DOCTOR_FINAL_POLISH_TESTING_V6_NOTES.md

# Phase 3 Step11B3 Doctor Final Polish & Testing V6

Base used: `HMS_SECURE_PHASE3_STEP11B3_DOCTOR_PROFILE_EDIT_INTEGRATION_V5.zip`

## Scope
Phase 6 was intentionally limited to final doctor-profile polish and verification. No unrelated enterprise modules were rewritten.

## Doctor profile polish completed
- Added safer Back to Doctors behavior from doctor profile:
  - cancels active doctor edit mode
  - resets pending document form
  - returns to doctors list cleanly
- Added doctor image upload UI busy state.
- Added doctor document upload UI busy state.
- Added doctor document delete busy state.
- Added document file-size display in doctor profile document list.
- Kept existing patient profile, permissions, module controls, hospital settings, billing, pharmacy, lab/radiology, appointments, and dashboard functionality untouched.

## Stability retained from earlier phases
- Doctor update duplicate logic still excludes the current doctor.
- Doctor profile uses fresh `GET /api/doctors/:id` data.
- Doctor image upload route remains `/api/doctors/:id/profile-image`.
- Doctor document upload route remains `/api/doctors/:id/documents`.
- Doctor document delete route remains `/api/doctors/:id/documents/:docIndex`.
- Doctor profile edit still refreshes profile data after save.

## Checks run
From extracted project root:

```bash
node --check backend/src/routes/core.routes.js
node --check backend/src/models/index.js
node --check backend/src/config/permissions.js
npm --prefix frontend ci
npm --prefix frontend run build
```

Result:
- Backend syntax checks passed.
- Frontend production build passed.

## Packaging rule followed
Excluded from ZIP:
- `.env`
- `node_modules`
- `dist`

Included:
- `package.json`
- `package-lock.json`
- `.env.example`

## Deployment reminder
On Render, verify Cloudinary environment variables before testing doctor image/document uploads:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

Also run the existing doctor index migration once if the old global `doctor_id_1` index exists in MongoDB Atlas:

```bash
npm run fix-doctor-indexes
```



---

## PHASE3_STEP11B3_DOCTOR_IMAGE_UPLOAD_V3_NOTES.md

# Phase 3 Doctor Image Upload V3

Base used: HMS_SECURE_PHASE3_STEP11B3_DOCTOR_PROFILE_VIEW_V2.zip

## Scope
This phase only adds doctor profile image upload. Doctor document/certificate upload is intentionally left for Phase 4.

## Backend changes
- Added `POST /api/doctors/:id/profile-image` in `backend/src/routes/core.routes.js`.
- Uses `multer.memoryStorage()` with 3MB limit.
- Accepts field name: `profile_image`.
- Allows JPG, PNG, WEBP only.
- Uploads to Cloudinary folder: `hms/doctor-profile-images`.
- Replaces old image by deleting previous `profile_image_public_id` when present.
- Saves:
  - `profile_image_url`
  - `profile_image_public_id`
- Returns clear 500 message if Cloudinary env vars are missing/wrong on Render.

## Frontend changes
- Added `doctorApi.uploadProfileImage(id, formData)`.
- Doctor profile now shows a camera button over the avatar for users with `doctor.edit` permission.
- Upload refreshes fresh doctor profile data after success.
- Doctor list is reloaded after image upload.

## Required Render env vars
Backend Render service must have:
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

These are now also listed in `backend/.env.example`.

## Checks performed
- Backend syntax check passed for `backend/src/routes/core.routes.js`.
- Backend syntax check passed for `backend/src/models/index.js`.
- Frontend `npm run build` passed after installing dependencies with `npm ci`.

## Not included in ZIP
- `.env`
- `node_modules`
- `dist`



---

## PHASE3_STEP11B3_DOCTOR_PROFILE_EDIT_INTEGRATION_V5_NOTES.md

# Phase 3 Step11B3 Doctor Profile Edit Integration V5

Base: `HMS_SECURE_PHASE3_STEP11B3_DOCTOR_DOCUMENT_UPLOAD_V4.zip`

## Scope
Phase 5 keeps the doctor section changes limited to profile/edit integration. It does not change unrelated HMS modules.

## Completed
- Added doctor profile edit flow from the doctor profile screen.
- Added `Edit Profile` action on doctor profile.
- Reused the safe doctor update API from V1 so same `doctor_id` updates do not trigger duplicate errors.
- Extended frontend doctor form state with enterprise profile fields:
  - `license_number`
  - `registration_number`
  - `status`
- After saving an open doctor profile, frontend fetches fresh doctor data again and updates `selectedDoctor`.
- Image and document data remain visible after profile updates.
- Added cancel edit action for doctor profile edit mode.

## Validation
- Backend syntax check passed:
  - `node --check backend/src/routes/core.routes.js`
  - `node --check backend/src/models/index.js`
- Frontend production build passed:
  - `npm run build`

## Packaging
Excluded from ZIP:
- `.env`
- `node_modules`
- `dist`

Included:
- `package.json`
- `package-lock.json`
- `.env.example`



---

## PHASE3_STEP11B3_DOCTOR_PROFILE_UI_AND_UPLOAD_FIX_V7_NOTES.md

# Phase 7 - Doctor Profile UI + Upload Fix

Base: HMS_SECURE_PHASE3_STEP11B3_DOCTOR_FINAL_POLISH_TESTING_V6.zip

## Fixed
- Doctor document upload no longer fails only because Cloudinary environment variables are missing on Render.
- Doctor profile image upload also supports the same safe fallback.
- If Cloudinary env vars are configured, uploads still use Cloudinary.
- If Cloudinary env vars are not configured, profile images and doctor documents are stored as MongoDB data URLs so the feature remains usable.
- Cloudinary cleanup is now safe and skipped when Cloudinary is not configured.
- Backend error messages are no longer hard-coded to Cloudinary environment variable failure only.

## UI Improved
- Doctor profile header polished.
- Duplicate profile title removed from card body.
- Doctor avatar/camera overlay improved.
- Doctor documents upload form is now hidden behind Add Document.
- Empty document state improved.
- Summary card Doctor ID duplicate replaced with Recent Records.

## Checks
- Frontend npm run build passed.
- Backend JS syntax checks passed.

## Deployment Note
Cloudinary is still recommended for production file storage. Add these in Render for production-grade storage:
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

Without Cloudinary, files are saved in MongoDB as fallback. This is acceptable for testing/small files but not ideal for long-term production storage.



---

## PHASE3_STEP11B3_DOCTOR_PROFILE_VIEW_V2_NOTES.md

# Phase 3 Step 11B3 - Doctor Profile View V2

Base ZIP: HMS_SECURE_PHASE3_STEP11B3_DOCTOR_UPDATE_FIX_V1.zip

## Scope
Phase 2 only: Doctor profile view. No image upload or document upload added in this ZIP.

## Backend changes
- Added `GET /api/doctors/:id` in `backend/src/routes/core.routes.js`.
- Route uses tenant filtering and requires `doctor.view` permission.
- Fetches fresh doctor details by numeric `id`.
- Adds `department_name` when department exists.
- Adds recent doctor appointments for the profile screen.

## Frontend changes
- Added `doctorApi.get(id)`.
- Added `selectedDoctor` state in `frontend/src/main.jsx`.
- Added `openDoctorProfile(row)` handler:
  - Opens profile immediately using table row fallback.
  - Fetches fresh doctor data from backend.
  - Replaces selected doctor with fresh API response.
- Added `doctorProfile` internal tab/view.
- Header title now shows `Doctor Profile` for this internal view.
- Passed `openDoctorProfile` to `Doctors.jsx`.
- Doctor table now shows View Profile in the existing three-dot action menu.
- Added doctor profile screen in `frontend/src/pages/Doctors.jsx` using existing patient profile design classes for consistent UI.

## Not included yet
- Doctor profile image upload.
- Doctor certificate/document upload.
- Doctor document delete/download management.

## Checks completed
- Backend syntax check completed.
- Frontend `npm run build` completed successfully.

## Known build warning
Vite shows existing bundle-size warning and react-hot-toast `use client` warning. Build still succeeds.



---

## PHASE3_STEP11B3_DOCTOR_UPDATE_FIX_V1_NOTES.md

# Phase 3 Step11B3 Doctor Update Fix V1

Base ZIP: `HMS_SECURE_PHASE3_STEP11B3_UI_FUNCTIONALITY_FIXES.zip`

## Scope
This ZIP intentionally fixes only the unstable doctor update/duplicate-ID foundation before adding doctor profile/image/document features.

## Changes
- Removed global `unique: true` from `Doctor.doctor_id` in the Mongoose schema.
- Added a compound unique doctor index definition for `{ hospital_id: 1, doctor_id: 1 }`.
- Updated `PUT /api/doctors/:id` so duplicate checks exclude the current doctor:
  - Allows editing a doctor without changing their existing `doctor_id`.
  - Returns `409` only when another doctor in the same tenant/hospital already has that `doctor_id`.
  - Returns `404` when the doctor does not exist.
  - Returns the updated doctor object after a successful update.
- Added safe script: `npm run fix-doctor-indexes`
  - Drops legacy global unique `doctor_id_1` style index if present.
  - Assigns `DEFAULT_HOSPITAL_ID` to legacy doctor records that have missing/null `hospital_id`.
  - Creates compound unique index: `{ hospital_id: 1, doctor_id: 1 }`.

## Important Render/MongoDB step
After deploying this backend, run once from Render shell/job if duplicate `doctor_id` errors continue:

```bash
npm run fix-doctor-indexes
```

Check Render logs carefully. If MongoDB reports duplicate values inside the same hospital, resolve those duplicate doctor records first, then rerun the script.

## Verified locally
- Frontend: `npm run build` passed.
- Backend syntax checks passed for:
  - `src/server.js`
  - `src/models/index.js`
  - `src/routes/core.routes.js`
  - `scripts/fix-doctor-indexes.js`

## Not included yet
Doctor profile, doctor image upload, and doctor document upload are intentionally not added in this ZIP. They should be added only after confirming doctor edit/update is stable.



---

## PHASE3_STEP11B3_PROFILE_KIKA_UI_V8_NOTES.md

# HMS Secure Phase 3 Step 11B3 - Unified Keka-style Profile UI V8

Base used:
- HMS_SECURE_PHASE3_STEP11B3_DOCTOR_PROFILE_UI_AND_UPLOAD_FIX_V7.zip

Scope:
- Frontend UI/UX polish only.
- No backend feature changes.
- No doctor/patient upload logic removed.

Completed:
- Added Keka-style cover/profile layout styling.
- Updated logged-in user/admin profile page to a Keka-inspired layout.
- Added profile completion indicator, intro/about blocks, quick links, support card, and cleaner account sections.
- Updated patient profile to use a Keka-style banner/cover area while preserving current patient details, appointments, bills, and documents.
- Updated doctor profile to use a Keka-style banner/cover area while preserving profile image upload, document upload, document delete, edit profile, appointments, and credentials.
- Preserved current functionality from V7.

Checks:
- Frontend build passed.
- Backend JavaScript syntax checks passed.

Packaging:
- .env excluded.
- node_modules excluded.
- frontend/dist excluded.
- package.json/package-lock.json retained.
- .env.example retained.



---

## PHASE3_STEP2_NOTES.md

# Phase 3 Step 2 - Permission Middleware Applied

This patch keeps the existing role system compatible while adding permission checks to critical backend routes.

## Protected with permissions

- Patients: view, create, edit, delete, document management
- Doctors: view, create, edit, delete
- Appointments: view, create, edit, delete, status update
- Beds: view, create, status update
- Billing: view, create
- Pharmacy: view, create, stock management
- Lab/Radiology: view, create/report actions
- Admin users: manage users
- Audit/Security: audit view and security manage

## Compatibility

Existing users are not migrated. Their permissions come from their role mapping in `backend/src/config/permissions.js`.

Super admin keeps wildcard access with `*`.



---

## PHASE3_STEP5_NOTES.md

# Phase 3 Step 5 - Tenant-Aware Data Filtering

## What changed
- Added reusable tenant helpers in `backend/src/middleware/tenant.js`:
  - `tenantFilter(req, extra)`
  - `tenantCreateData(req, data)`
- Major backend modules now scope reads/writes by `hospital_id`.
- Existing records without `hospital_id` remain visible for the default hospital only (`DEFAULT_HOSPITAL_ID=1`).

## Scoped modules
- Patients
- Doctors
- Departments
- Appointments
- Beds
- Dashboard stats
- Billing
- Pharmacy
- Lab
- Radiology
- OPD/IPD
- Audit logs
- Security settings
- Admin users

## Safety
- No `.env` files included.
- Existing default single-hospital deployment remains supported.
- Existing old records are not hidden for default hospital.
- No frontend UI changes.



---

## PHASE3_STEP8_NOTES.md

# Phase 3 Step 8 — Feature Flags

This phase adds hospital-wise advanced feature flags without breaking existing modules.

## Added feature flags
- FHIR APIs
- HL7 Ready
- PACS/DICOM
- Biometric
- Insurance/TPA
- ERP/Tally
- WhatsApp/SMS
- ABDM/ABHA
- 2FA Security
- Audit Compliance

## Safety rules
- Existing default hospital remains active.
- Existing modules remain unchanged.
- Existing users and records are not reset.
- `.env`, `node_modules`, and `dist` are not included in the ZIP.
- `package-lock.json` files are included.

## Test checklist
1. Login as super_admin/admin.
2. Open Hospitals tab.
3. Edit a hospital.
4. Toggle multiple feature flags.
5. Save.
6. Re-open Edit and confirm flags are still selected.
7. Check normal modules still work.

## Phase 8C - Theme-aware profile and dashboard colors
- Updated doctor, patient, and admin/profile cover backgrounds to follow the selected theme color.
- Updated profile detail sections, avatar upload controls, document tiles, and empty states to use theme-aware colors.
- Updated dashboard welcome panel, stat cards, Hospital Overview chart, and Billing Status chart to use theme-aware palette instead of default black/grey chart colors.
- Verified frontend production build and backend syntax checks.

## V13A - Appointment Stability + Professional Appointment UI

- Added enterprise appointment status flow: scheduled, checked_in, in_consultation, completed, cancelled, no_show.
- Added appointment type support: OPD, follow-up, emergency, teleconsultation.
- Added backend validation for patient/doctor references inside the active hospital/tenant.
- Added backend doctor slot conflict prevention for same doctor/date/time, excluding cancelled/no-show appointments.
- Added token number generation per appointment date.
- Added status timestamp fields for check-in, consultation start, completion and cancellation.
- Added professional appointment board UI with filters, status badges, token cards and lifecycle actions.
- Frontend build passed.
- Backend syntax checks passed.

## V13B - Doctor Schedule + Slot Booking Foundation

Implemented after V13A appointment stability.

### Added
- Doctor schedule model (`doctor_schedules`) with hospital/tenant isolation.
- Doctor availability setup from Appointment module.
- Working days, start/end time, break time, slot duration, daily patient limit, unavailable dates.
- Schedule list with edit/delete actions.
- Backend appointment validation against active doctor schedule.
- Backend blocks appointments outside working hours, on unavailable dates, during break time, and beyond daily limit.
- Doctor slots endpoint: `GET /api/doctors/:id/slots?date=YYYY-MM-DD`.
- Schedule APIs:
  - `GET /api/doctor-schedules`
  - `POST /api/doctor-schedules`
  - `DELETE /api/doctor-schedules/:id`

### QA
- Frontend `npm run build`: passed.
- Backend syntax checks: passed.
- Backend dependencies install from lock file: passed.
- Database live check was attempted but not run locally because packaged ZIP intentionally excludes `.env`; Render/local environment must provide `MONGODB_URI`.

## V13C - Reception Queue + Token System
- Added backend `/api/appointments/queue` endpoint for date/doctor-wise active reception queue.
- Improved token generation to use the highest existing token for the date instead of raw count, reducing duplicate token risk after deletions.
- Added queue position and waiting-minute metadata in queue response.
- Added professional Reception Queue panel in Appointments page.
- Added Call Next, Check In, Call Patient, Complete, and No Show queue actions.
- Removed duplicate schedule timing line in schedule card UI.

## V13E - Prescription + Billing Integration from OPD Consultation

Implemented after V13D OPD consultation screen.

### Added
- Added `Prescription` model/collection with hospital/tenant isolation.
- OPD consultation save can now also save prescription medicine rows.
- Added optional OPD consultation bill generation from consultation save.
- Billing links to patient, doctor, appointment and OPD source.
- Appointment stores linked `opd_id`, `prescription_id`, and `billing_id` after consultation save.
- Added prescription list endpoint: `GET /api/prescriptions` with appointment/patient/doctor filters.
- OPD consultation UI now has two-column clinical + prescription/billing layout.
- Prescription rows support medicine name, dosage, frequency, duration and instructions.
- Billing form supports fee, paid amount, discount and GST percent.

### QA
- Backend `npm install`: passed.
- Backend syntax checks: passed for models, OPD/IPD routes, core routes and billing routes.
- Frontend `npm install`: passed.
- Frontend `npm run build`: passed.
- Database live check attempted but local package intentionally excludes `.env`; `MONGODB_URI` must be configured in Render/local environment.

---

## HMS_SECURE_PHASE3_STEP11B3_PATIENT_TIMELINE_EMR_V13F

Base used:
- HMS_SECURE_PHASE3_STEP11B3_PRESCRIPTION_BILLING_V13E.zip

Scope:
- Patient Timeline / EMR Foundation only.
- No unrelated modules were redesigned.

Backend changes:
- Added GET `/api/patients/:id/timeline`.
- Timeline is tenant/hospital filtered.
- Timeline combines patient-related records from:
  - appointments
  - OPD consultations
  - prescriptions
  - billing records
  - lab records
  - radiology records
  - IPD admissions
  - patient documents
- Added summary counts for EMR sections.

Frontend changes:
- Patient profile now loads fresh timeline data from the backend.
- Added Patient Timeline / EMR card in patient profile.
- Added event list with status, type, date, diagnosis/medicine/bill details when available.
- Added theme-aware styling for timeline cards.

Testing:
- Frontend production build passed.
- Backend JavaScript syntax checks passed.
- DB check attempted; local ZIP correctly excludes `.env`, so `MONGODB_URI` is required on local/Render.

Packaging:
- `.env` excluded.
- `node_modules` excluded.
- `dist` excluded.
- `package.json`, `package-lock.json`, `.env.example`, and `PROJECT_NOTES.md` preserved.

## V14 - Pharmacy + Inventory Enterprise Upgrade

Built on: HMS_SECURE_PHASE3_STEP11B3_PATIENT_TIMELINE_EMR_V13F.zip

Scope:
- Enterprise pharmacy inventory foundation.
- Medicine batch/vendor/expiry/quantity/low-stock fields.
- Medicine edit/update support.
- Stock adjustment endpoint and UI.
- Direct pharmacy sale endpoint and UI.
- Prescription dispense endpoint foundation.
- Pharmacy summary endpoint with total stock, low stock, expired count and sales revenue.
- Recent pharmacy sales list.
- Theme-aware professional pharmacy UI.

Testing:
- Frontend npm install + npm run build: PASSED.
- Backend npm install + syntax checks: PASSED.
- DB check attempted: needs MONGODB_URI in local/Render env. This ZIP correctly excludes .env.

Packaging:
- .env excluded.
- node_modules excluded.
- frontend dist excluded.


## V15 - Lab/Radiology Workflow Rebuild from V14
- Added enterprise Lab/Radiology workflow foundation.
- Added lab status flow: ordered, sample_collected, processing, completed, cancelled.
- Added radiology status flow: ordered, scheduled, scanned, reported, cancelled.
- Added backend OPD clinical order endpoint: POST /api/opd/:id/orders.
- Added tenant-filtered lab/radiology list, status update, and report upload endpoints.
- Improved frontend Lab/Radiology page with professional workflow UI, stats, status badges, report fields, and patient/doctor selectors.
- Frontend build passed.
- Backend syntax checks passed.
- DB live check requires MONGODB_URI in local/Render because .env is excluded from ZIP.

## V16_REBUILT - Notification Engine

### Backend
- Added `Notification` model with tenant/hospital filtering, read tracking through `read_by`, module/type/severity metadata, and recent lookup index.
- Added `/api/notifications` routes:
  - `GET /api/notifications`
  - `POST /api/notifications`
  - `PATCH /api/notifications/:id/read`
  - `PATCH /api/notifications/read-all`
  - `DELETE /api/notifications/:id`
- Added notification helpers in `backend/src/utils/notifications.js`.
- Added notification permissions for supported roles.
- Appointment creation/status changes now create in-app notifications.
- OPD consultation, prescription, and billing generation now create notifications.
- Lab/radiology order and report status changes now create notifications.
- Pharmacy sales/dispensing and low-stock events now create notifications.

### Frontend
- Added `notificationApi`.
- Navbar notification dropdown now loads real database notifications.
- Added unread count indicator, mark one read, and mark all read.
- Preserved fallback operational alerts if backend notification route is unavailable during deploy transition.

### QA
- Frontend `npm install` passed.
- Frontend `npm run build` passed.
- Backend syntax checks passed for models, notification route, workflow routes, and server.
- DB check attempted; local ZIP does not include `.env`, so `MONGODB_URI` is required on local/Render.

### Packaging
- `.env`, `node_modules`, and `dist` are excluded from the ZIP.

## V17 - Audit + Security Hardening

Built from: HMS_SECURE_PHASE3_STEP11B3_NOTIFICATION_ENGINE_V16_REBUILT.zip

### Backend
- Added centralized audit utility: `backend/src/utils/audit.js`.
- Expanded `AuditLog` schema with:
  - user role
  - entity type/id
  - old/new values
  - status/severity
  - IP address
  - user agent
  - method/path
- Added `LoginHistory` model for successful, failed and blocked login attempts.
- Added tenant-safe security settings schema with compound index `{ hospital_id, setting_key }`.
- Added `npm run fix-security-indexes` to safely drop old global `setting_key_1` index and create tenant-safe compound index.
- Added login history tracking in auth login flow.
- Added audit tracking for:
  - successful login
  - failed login
  - blocked inactive-hospital login
  - profile update
  - password change
  - user create/update/delete
  - permission denied / role denied events
  - security setting updates
- Improved `/api/audit-logs` with filtering.
- Added `/api/audit-logs/export` CSV export.
- Added `/api/security/login-history`.
- Added `/api/security/summary`.
- Added `/api/security-settings/defaults`.

### Frontend
- Added `auditApi`.
- Added Security tab for users with audit/security permissions.
- Added Audit & Security Center UI:
  - security summary cards
  - audit log list
  - audit filter controls
  - CSV export action
  - login history list
  - security settings editor
  - ensure default settings action
- Added theme-aware UI styling for security center.

### Testing
- Backend syntax checks passed:
  - models
  - audit utility
  - audit/security routes
  - auth routes
  - auth middleware
- Frontend `npm install` passed.
- Frontend `npm run build` passed.
- Backend `npm install` passed.
- DB check attempted but `.env` is excluded as required, so `MONGODB_URI` must be set in local/Render.

### Deployment note
After deployment, run this once on Render/local with MongoDB env configured:

```bash
npm run fix-security-indexes
```

This prevents old global `setting_key_1` index from blocking per-hospital security settings.

## V18 - No-Code Dynamic Forms Foundation

Built from: HMS_SECURE_PHASE3_STEP11B3_AUDIT_SECURITY_V17.zip

### Added
- DynamicField MongoDB model with hospital/tenant isolation.
- Backend configuration routes:
  - GET `/api/configuration/dynamic-fields`
  - GET `/api/configuration/public-fields`
  - POST `/api/configuration/dynamic-fields`
  - PUT `/api/configuration/dynamic-fields/:id`
  - PATCH `/api/configuration/dynamic-fields/:id/status`
  - DELETE `/api/configuration/dynamic-fields/:id`
- New `configuration.manage` permission.
- New Configuration tab for admins/super admins.
- Dynamic form builder UI for hospital-specific custom fields.
- Patient and Doctor forms render active dynamic fields.
- Patient and Doctor profiles display saved custom field values.
- DataTable now supports explicit columns and custom extra actions.

### Notes
- Custom values are stored safely under each record's `custom_fields` object.
- Existing patient/doctor fields remain untouched.
- Dynamic fields are per hospital/tenant and do not affect other hospitals.

### Tests
- Frontend `npm install` passed.
- Frontend `npm run build` passed.
- Backend syntax checks passed for models, configuration routes, and server.
- DB live check requires `MONGODB_URI` in local/Render environment because `.env` is not included in the ZIP.

## V19 - Template Builder Foundation
- Added hospital-wise Template model for invoice, prescription, lab report, radiology report and discharge summary templates.
- Added backend template APIs under `/api/templates` with tenant filtering, default-template handling, audit events and permission protection.
- Added Configuration UI section for creating/editing/deleting templates.
- Added template variables guide for future printable/PDF rendering.
- Frontend build passed.
- Backend syntax checks passed.

## V21 - SaaS Plan / Subscription Control

### Scope
- Added Clinic, Hospital, and Enterprise SaaS plan definitions.
- Added subscription current-plan and tenant-plan APIs.
- Added hospital-wise plan limits and subscription metadata fields.
- Added plan-aware module gating: modules not allowed by selected plan are disabled in Hospital Control.
- Added user-count limit enforcement when creating users/admins.
- Added Subscription panel inside Configuration showing current plan, usage, and available plan cards.
- Added backend subscription utility for plan definitions, limits, usage and limit checks.

### Backend
- Added `backend/src/utils/subscription.js`.
- Added `backend/src/routes/subscription.routes.js`.
- Added `/api/subscription/plans`.
- Added `/api/subscription/current`.
- Added `/api/tenants/:id/subscription` GET/PATCH.
- Tenant create/update now normalizes enabled modules and feature flags according to selected plan.
- User creation now checks plan user limit.

### Frontend
- Added `frontend/src/api/subscriptionApi.js`.
- Configuration tab now shows current SaaS plan and plan usage.
- Hospital Control now shows selected plan summary and disables modules outside the selected plan.

### Testing
- Backend syntax checks passed for server, models, routes and utils.
- Frontend `npm install` completed.
- Frontend `npm run build` passed.
- DB live check requires `MONGODB_URI` in local/Render because `.env` is intentionally excluded.

### Packaging
- Clean package: no `.env`, no `node_modules`, no `dist`.

## V22 - SaaS Super Admin Control Center
- Added backend SaaS overview endpoint: `GET /api/saas/overview`.
- Added tenant CSV export endpoint: `GET /api/saas/tenants/export.csv`.
- Added platform owner SaaS Control Center page.
- Shows total tenants, active tenants, MRR estimate, recorded tenant revenue, plan breakdown, subscription status breakdown, and tenant limit usage.
- Added usage warning indicators when tenants approach plan limits or subscription is not active.
- Added SaaS Control sidebar tab gated by `hospital.manage` permission and tenant module access.
- Frontend build passed.
- Backend syntax checks passed.

## V23 - Tenant Lifecycle + Billing Control
- Added tenant lifecycle backend endpoint: activate, trial, suspend, cancel.
- Added plan change control from SaaS Control Center.
- Added billing metadata display: billing cycle, renewal/next billing date, trial end.
- Extended subscription fields for trial, suspension, cancellation, and next billing date.
- Added audit logging for tenant lifecycle actions.
- Frontend build passed and backend syntax checks passed.

## V24 - SaaS Subscription Invoices + Payment Tracking
- Added SaaSInvoice and SaaSPayment models for platform subscription billing.
- Added SaaS billing routes:
  - GET /api/saas/billing/summary
  - GET /api/saas/invoices
  - POST /api/saas/invoices/generate
  - PATCH /api/saas/invoices/:id/status
  - POST /api/saas/invoices/:id/payments
  - GET /api/saas/invoices/export.csv
- SaaS Control Center now shows invoice billing summary, generated invoices, balance tracking and manual payment recording.
- Invoice generation uses current tenant plan and billing cycle with optional tax, discount and due date.
- Payment recording updates invoice status as paid/partial/pending/overdue.
- Audit logs added for invoice generation, status updates and payment records.
- Frontend build passed and backend syntax checks passed.

## V25 - Payment Gateway + Invoice Automation Foundation
- Added SaaS payment intent model for gateway-ready payment links.
- Added backend endpoints to create payment links, list payment intents, confirm gateway payments, and scan/mark overdue invoices.
- Added SaaS payment gateway environment placeholders in backend `.env.example`.
- Added SaaS Control Center UI actions for payment links, overdue scan, and payment intent confirmation.
- Added payment gateway readiness panel showing latest payment link intents.
- Payment gateway is foundation-ready: real Razorpay/Stripe/PayU webhook keys can be integrated later without changing the invoice workflow.
- Tests performed: frontend npm install + build passed; backend syntax checks passed; DB check attempted but requires local/Render `MONGODB_URI` because `.env` is intentionally excluded.

## V26 - Communications + Reminder Automation Foundation
- Added database-backed communication logs.
- Added communication channels: in-app, email, SMS, WhatsApp-ready.
- Added safe provider readiness checks using env placeholders.
- Added manual communication queue UI.
- Added appointment reminder automation for selected date.
- Added communication status flow: queued, sent, failed, skipped.
- Added communication CSV export.
- Added backend APIs under `/api/communications/*`.
- Added frontend Communications tab with channel/status filters.
- Added audit logs for communication actions.
- External email/SMS/WhatsApp sending is intentionally provider-ready only; when env keys are missing, logs are saved as skipped instead of failing.

## V27 Full QA + Bug Stabilization
- Regression QA phase after V26 Communication Reminders.
- Frontend dependencies installed locally and production build passed.
- Backend dependencies installed locally and syntax checks passed for server/app/models/routes.
- Verified clean packaging excludes `.env`, `node_modules`, and `dist`.
- Live database/API functional testing requires `MONGODB_URI` and deployment env on Render/local.
- Known build warnings only: React Hot Toast `use client` bundle warning and large JS chunk warning; not blocking.

## V27 Fix 1 - Hospital Update / Plan Access Clarification
- Fixed hospital update targeting by using the MongoDB record id when available, preventing edits from accidentally updating the wrong hospital when old data contains duplicate numeric `id` values.
- Added safer backend hospital lookup for numeric ids, MongoDB ids, and hospital codes.
- Added duplicate hospital code handling so raw MongoDB `E11000 duplicate key` errors are converted into clear 409 messages.
- Added `npm run fix-hospital-indexes` to repair old duplicate hospital numeric ids, normalize hospital codes, reset the hospitals counter, and recreate the safe hospital code index.
- Added UI note explaining why modules show `Upgrade`: Clinic Plan intentionally locks Beds, Lab, Radiology, Pharmacy, Security, Hospitals, and SaaS Control. Switch the hospital plan to Hospital/Enterprise to unlock them.

## V27 Fix2 - Module/sidebar and feature flag visibility
- Fixed plan/module gating refresh issue by making sidebar filtering feature-flag aware.
- Advanced feature flags now appear in sidebar when enabled for the active hospital.
- Added safe placeholder pages for enabled advanced features so the flags visibly work.
- Hospital/Enterprise modules remain controlled by selected SaaS plan and enabled module settings.
- Frontend build passed and backend syntax checks passed.

## V28 - Patient Portal + Doctor Portal Upgrade
- Added backend portal endpoints:
  - `GET /api/portal/patient`
  - `GET /api/portal/doctor`
- Patient Portal now shows linked patient profile, appointments, prescriptions, bills, lab/radiology reports, documents, and timeline.
- Doctor Portal now shows linked doctor profile, today queue, schedule, recent consultations, lab/radiology orders, and clinical stats.
- Staff/admin users can select a patient/doctor from dropdown for review.
- Patient and doctor logins are auto-linked by email/phone/user id where available.
- Added role permissions: `portal.patient.view` and `portal.doctor.view`.
- Added sidebar tabs: Patient Portal and Doctor Portal.
- Added portal UI styling with theme-aware cards, stats, timeline and status badges.
- Full frontend production build passed.
- Backend syntax checks passed for server, portal routes and permission config.

## V29 - Advanced EMR / EHR Clinical Record Foundation
- Added ClinicalRecord model for structured longitudinal patient records.
- Added EMR backend APIs:
  - GET /api/emr/patients
  - GET /api/emr/patients/:id/summary
  - POST /api/emr/records
  - PUT /api/emr/records/:id
  - DELETE /api/emr/records/:id
- Added EMR permissions for admin, hospital_admin, doctor, nurse, receptionist, and patient roles.
- Added EMR / EHR sidebar module and plan module access.
- Added EMR UI with patient selector, clinical summary, active allergies, conditions, medications, SOAP note entry, vitals, and unified timeline.
- EMR summary merges clinical records with appointments, OPD, prescriptions, lab, radiology, billing, and IPD data.
- Added audit logs and notifications for EMR record creation/update/delete.
- Frontend build passed and backend syntax checks passed.

## V30 - Advanced Billing + Insurance/TPA
- Added Insurance/TPA claim workflow foundation.
- Added backend InsuranceClaim model and APIs for claim list, summary, create, update, status update, and create-from-bill.
- Added tenant/hospital filtering for claims.
- Added audit logs and notifications for insurance claim actions.
- Added Insurance/TPA page replacing the old placeholder when feature flag is enabled.
- Claim register supports provider, TPA, policy, claim number, claim type, claim amount, approved amount, paid amount, status, priority, admission/discharge dates and notes.
- Insurance/TPA can link claims to existing bills/invoices.
- Frontend build passed and backend syntax checks passed.

## V31 Inventory + Purchase Order Deep Upgrade

Added enterprise inventory layer without removing existing Pharmacy functionality.

Backend additions:
- `/api/inventory/suppliers`
- `/api/inventory/items`
- `/api/inventory/batches`
- `/api/inventory/purchase-orders`
- `/api/inventory/stock-receivings`
- `/api/inventory/stock-returns`
- `/api/inventory/supplier-bills`
- `/api/inventory/batch-dispense`
- `/api/inventory/expiry-alerts`
- `/api/inventory/transactions`
- `/api/inventory/summary`

Database models added:
- Supplier
- InventoryItem
- InventoryBatch
- PurchaseOrder
- SupplierBill
- StockReceiving
- StockReturn
- InventoryTransaction

Frontend additions:
- New Inventory sidebar module
- Supplier master form
- Consumables/item master form
- Purchase order form
- Stock receiving / GRN form
- Stock return form
- Supplier bill form
- Batch-wise dispensing form
- Batch stock register
- Expiry alerts
- Recent inventory transactions

Validation performed:
- Backend model syntax check passed
- Backend route syntax check passed
- Backend route require/load check passed
- Frontend production build passed

Packaging rule:
- `.env`, `node_modules`, and `dist` are excluded from delivery zip.
- `package.json`, `package-lock.json`, and `.env.example` are included.

## V32 Advanced LIS/RIS Upgrade

Added enterprise diagnostics workflow without removing previous Lab/Radiology endpoints.

### Backend
- Added `LabTestTemplate` model with parameter templates, normal ranges, sample type, machine code/API-ready fields.
- Extended `LabTest` with sample barcode, accession number, result parameters, approval data, PDF URL, and integration payload.
- Extended `RadiologyTest` with modality, body part, DICOM Study ID, PACS viewer URL, radiologist workflow fields, findings/impression, PDF URL, and integration payload.
- Added endpoints:
  - `GET/POST/PUT /api/lab/templates`
  - `PATCH /api/lab/tests/:id/results`
  - `PATCH /api/lab/tests/:id/approve`
  - `GET /api/lab/machine-api/orders`
  - `PATCH /api/radiology/tests/:id/report`
  - `PATCH /api/radiology/tests/:id/approve`
- Kept old endpoints such as `/api/lab/tests`, `/api/lab/upload-report/:id`, `/api/radiology/tests`, and `/api/radiology/upload-report/:id` backward compatible.

### Frontend
- Upgraded Lab & Radiology screen to Advanced LIS/RIS command view.
- Added template builder, sample barcode display, accession number display, result entry panel, approval action, DICOM/PACS fields, and radiologist report workflow.

### Testing
- Backend syntax check passed.
- Backend route require/load check passed after dependency install.
- Frontend production build passed.

## V33 - NABH / Compliance Center Upgrade

Added enterprise compliance readiness without removing any V32/V31 modules.

### Backend
- Added compliance models: ConsentForm, IncidentReport, SopDocument, ComplianceChecklist, BackupVerification.
- Added tenant-safe compliance routes under `/api/compliance/*`.
- Added role permissions: `compliance.view`, `compliance.manage` for admin and hospital_admin.
- Added audit logging for compliance creates, updates, checklist seeding and CSV exports.
- Added CSV exports for consents, incidents, SOPs, checklists and backup verification.
- Added NABH default checklist seed endpoint.

### Frontend
- Added Compliance module in sidebar and plan/module configuration.
- Added Compliance Center UI with summary cards, records table, search, CSV exports and forms.
- Added workflows for consent forms, incident reporting, SOP approvals, NABH checklist status, and backup/restore verification.

### Testing
- Backend route/model syntax checked.
- Backend route require/load checked.
- Frontend production build checked.
- Clean package rules verified: no `.env`, no `node_modules`, no `dist`; package files and `.env.example` retained.


## V35 Analytics + Hospital Command Center Upgrade

Added enterprise analytics foundation without breaking existing HMS modules.

### Backend
- Added `backend/src/routes/command-center.routes.js`.
- Added protected analytics APIs under `/api/command-center/*`:
  - `/summary` for command KPIs and alerts.
  - `/revenue` for revenue dashboard and status breakdown.
  - `/occupancy` for bed status and ward-wise occupancy.
  - `/doctor-performance` for appointment completion and linked revenue.
  - `/queue` for live appointment queue monitoring.
  - `/pharmacy` for stock, sales, low-stock and expiry stats.
  - `/lab-tat` for lab/radiology turnaround time and pending reports.
  - `/emergency` for urgent workload monitoring.
- Added `analytics.view` permission for admin roles.
- Added `commandCenter` to default enabled hospital modules.

### Frontend
- Added `frontend/src/api/commandCenterApi.js`.
- Added `frontend/src/pages/CommandCenter.jsx`.
- Added sidebar tab: `Command Center`.
- Added dashboard cards/charts/tables for revenue, occupancy, doctor performance, queue, pharmacy, lab TAT and emergency workload.

### Testing
- Backend route syntax and require/load checks passed.
- Frontend production build passed.
- Clean package excludes `.env`, `node_modules`, and `dist`.

## V37: SaaS Stabilization + QA + Pilot Readiness
- Added backend QA smoke script to verify critical route surface after V31-V36.
- Added pilot readiness checklist for tenant isolation, RBAC, CRUD, backup and demo flow.
- No large new clinical module added in this phase; this phase is for stability and pilot readiness.

## V38: SaaS Business Layer + Subscription System

Added dynamic SaaS plan model, SaaS plan management endpoints, hospital onboarding endpoint, license status endpoint, and upgraded SaaS Control Center UI with plan builder and onboarding form. This phase focuses on turning the HMS into a sellable SaaS operating layer with tenant onboarding, trial/license lifecycle, subscription invoices, payment tracking, and plan-based commercial controls.


## V39 - Sales Demo + Website Readiness

V39 adds the business-facing sales layer needed before pilot outreach:

- Public marketing content API
- Demo request capture API
- Protected demo request pipeline
- Sales activity notes
- Sales assets API
- Frontend Sales Demo Center
- Pricing/package comparison
- Demo script and checklist
- Website integration documentation

This phase does not remove or alter existing V31-V38 hospital workflows. It prepares the HMS for real demos, lead capture, pilot conversations and product website integration.

## V40 - Security + Legal Readiness

Added a Legal & Security Readiness Center with policy templates, data protection request tracking, security incident register, policy acknowledgements and audit pack export. This phase helps move the HMS from demo software toward a safer pilot-ready SaaS product.

## V41 - Pilot Hospital Deployment
Added pilot deployment management, pilot task tracking, readiness score API and frontend Pilot Deployment Center for first real clinic/hospital rollout planning.

## V42 - Configuration Engine Deep Fix
- Connected Configuration dynamic fields to Patient and Doctor workflows.
- Added custom field persistence through `custom_fields`.
- Added backend validation for required, number and select dynamic field values.
- Added toast notifications for Configuration actions.
- Added template preview API and UI.
- Backend route load, QA smoke and frontend production build passed.


## V43 - Tenant Database Isolation + Backup Architecture

- Added hybrid master DB + database-per-tenant architecture.
- New hospitals onboarded from SaaS Control can create a separate MongoDB tenant database by default.
- Existing hospitals remain in shared DB fallback mode until provisioned/migrated, preventing data loss.
- Operational models now route to tenant DB through request tenant context when `tenant_db_name` is available.
- Patient ID uniqueness is now tenant/hospital-safe instead of globally unique.
- Added tenant DB provision, backup queue, backup verify APIs and SaaS Control Center UI.
- Added safe migration scripts that copy data first and do not delete source data unless explicitly requested.

## V43.1 - Tenant Isolation Verification + Route Hardening

V43.1 hardens the V43 tenant database architecture. Command Center, Legal/Security and Pilot Deployment flows now run under tenant context, tenant-aware collections were expanded, and a `tenant:audit` script was added to verify operational route coverage. Existing shared DB fallback remains preserved to avoid data loss.




---
# SOURCE FILE: docs/BACKUP_RESTORE.md

# Backup and Restore Runbook

V36 adds JSON backup scripts for staging and small/medium deployments. For large production hospitals, also enable MongoDB Atlas scheduled backups.

## Create backup

```bash
cd backend
npm run backup
```

Backups are saved to `BACKUP_DIR`, default `./backups`.

## Verify latest backup

```bash
cd backend
npm run verify-backup
```

This records a verification row in the compliance backup verification collection.

## Restore in staging

Never restore directly into production without a maintenance window and a fresh backup.

```bash
cd backend
RESTORE_CONFIRMATION=I_UNDERSTAND_RESTORE_OVERWRITES_DATA npm run restore -- ./backups/hms-backup-file.json
npm run verify-backup
npm run health
```

## Recommended production schedule

- Atlas automated backup: daily
- HMS JSON backup: daily or before major migration
- Restore drill: monthly in staging
- Backup retention: at least 14 days for app exports, longer in Atlas




---
# SOURCE FILE: docs/DEPLOYMENT.md

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




---
# SOURCE FILE: docs/E2E_TESTING.md

# Phase 8C — E2E Testing

Phase 8C adds an end-to-end journey readiness layer without replacing the existing backend and frontend regression suites.

## Goal

Validate that the critical HMS user journeys remain wired from UI pages to API contracts:

1. Login
2. Add patient
3. Book appointment
4. OPD / EMR consultation
5. Create bill / invoice receipt
6. Lab and radiology order/result flow
7. IPD admission and discharge
8. Pharmacy stock and sale
9. Patient portal self-service
10. Doctor portal worklist

## Commands

From `backend/`:

```bash
npm run check:phase8c-e2e
npm run test:automated
```

From `frontend/`:

```bash
npm run test:e2e
npm run build
```

## Scope

This phase uses deterministic static contract checks. It intentionally avoids requiring a live MongoDB Atlas database or browser automation server, so the checks can run reliably in local, CI, Render build verification, and offline review environments.

## Future Enhancement

A later production-readiness pass can add Playwright/Cypress browser automation against a seeded staging environment. The current Phase 8C harness prepares the journey map and verifies that the critical page/API contracts are present before that live-browser layer is added.




---
# SOURCE FILE: docs/ENVIRONMENT_MATRIX.md

# Environment Matrix

| Variable | Backend/Frontend | Local | Staging | Production | Required |
| --- | --- | --- | --- | --- | --- |
| NODE_ENV | Backend | development | production | production | yes |
| PORT | Backend | 5000 | Render assigned/10000 | Render assigned/10000 | yes |
| MONGODB_URI | Backend | local/Atlas dev | Atlas staging | Atlas production | yes |
| MONGODB_DB_NAME | Backend | hms_db | hms_staging | hms_production | yes |
| JWT_SECRET | Backend | dev secret | staging secret | 64+ char production secret | yes |
| FRONTEND_URL | Backend | http://localhost:5173 | staging Vercel URL | production Vercel/custom URL | yes |
| CORS_EXTRA_ORIGINS | Backend | optional | optional | custom domains | no |
| API_PUBLIC_URL | Backend | http://localhost:5000 | staging Render URL | production Render URL | yes |
| RATE_LIMIT_MAX | Backend | 500 | 500 | 500 or lower | yes |
| TRUST_PROXY | Backend | 1 | 1 | 1 | yes |
| BACKUP_DIR | Backend | ./backups | persistent path if available | production backup path | yes |
| TENANT_BACKUP_DIR | Backend | ./backups/tenants | staging tenant backup path | production tenant backup path | yes |
| VITE_API_URL | Frontend | http://localhost:5000/api | staging API `/api` URL | production API `/api` URL | yes |




---
# SOURCE FILE: docs/LATEST_PHASE_REPORT.md

# Latest Phase Report

## Phase 8E — Production Deployment Readiness

### Status
Completed.

### Baseline
Started from `V48_phase8D_performance_optimization.zip`.

### Implemented
- Production deployment readiness documentation.
- Render/Vercel deployment guidance and environment matrix.
- Production release runbook.
- Release notes template.
- GitHub Actions CI workflow for backend and frontend checks.
- Backend production readiness check script.
- Frontend production readiness check script.
- Updated production checklist.
- Updated Render build command to `npm ci` and health check path.

### Safety
- No core HMS business logic was intentionally changed.
- Existing route, tenant, SaaS, reporting, portal and integration regression checks remain registered.
- Production readiness checks are documentation/config/check-script focused.

### Checks
- Backend route load.
- Backend automated regression suite.
- Phase 8E backend production readiness check.
- Frontend Phase 8B/8C/8D checks.
- Phase 8E frontend production readiness check.
- Frontend production build.

### Next Recommended Step
Pilot/staging deployment validation and final production environment setup.




---
# SOURCE FILE: docs/MONITORING.md

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




---
# SOURCE FILE: docs/PERFORMANCE_OPTIMIZATION.md

# Performance Optimization Notes

## Phase 8D changes

- Added page-level lazy loading with `React.lazy` and `Suspense` so enterprise modules are loaded only when opened.
- Removed eager page barrel import from `frontend/src/main.jsx` to reduce initial JavaScript parsing work.
- Added `frontend/vite.config.js` with production build controls and chunk splitting.
- Split analytics-heavy chart code into a `vendor-charts` chunk.
- Added performance regression checks for frontend and backend automation.

## Deployment notes

Vercel settings remain:

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment: `VITE_API_URL=<Render backend URL>/api`

## Future optimization candidates

- Move large CSS blocks into module/page-specific CSS files.
- Add API pagination on very large patient/appointment/billing lists.
- Add query index review on production MongoDB after real data volume is available.
- Add virtualized tables for high-volume enterprise datasets.




---
# SOURCE FILE: docs/PHASE4C_1_DOCUMENTATION_CLEANUP_REPORT.md

# Phase 4C.1 — Documentation Cleanup & Phase Report Consolidation Report

## Baseline
Started from: `V48_phase4C_tenant_billing_guardrails_plan_limits.zip`

## Goal
Reduce root-folder note/report clutter without deleting historical project context.

## Implemented
- Created `docs/PROJECT_PHASE_HISTORY.md` as a consolidated master history from available phase/version reports.
- Created `docs/LATEST_PHASE_REPORT.md` for the latest completed phase summary.
- Moved old root-level phase/version reports into `docs/archive/phase-reports/`.
- Preserved `README.md`, `PROJECT_NOTES.md`, backend, frontend, database and existing docs.
- Did not change backend or frontend business logic.

## Safety Notes
- No phase report was deleted.
- Old individual reports remain available in the archive folder.
- Base HMS functionality was not modified.

## Checks Passed
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning remains and should be handled in a later code-splitting optimization phase.
- Phase 4B individual report was not present in the Phase 4C ZIP root, so the master history consolidates the reports available inside this baseline ZIP.




---
# SOURCE FILE: docs/PHASE4C_2_VERCEL_ROOT_FLATTEN_DEPLOYMENT_FIX_REPORT.md

# Phase 4C.2 — Vercel Root Flatten & Deployment Fix Report

## Baseline
Started from: `V48_phase4C_1_documentation_cleanup_consolidation.zip`

## Issue Found
The project was wrapped inside an unnecessary `phase3A/` folder. This made Vercel deployment settings confusing because the frontend was not available at a clean root path.

Also, frontend/backend package-lock files contained internal package registry URLs from the build environment. These URLs are not accessible from Vercel and can cause install failures.

## Changes Applied
- Removed the unnecessary `phase3A/` wrapper folder from the ZIP structure.
- Cleaned project root structure so these folders now appear directly at root:
  - `frontend/`
  - `backend/`
  - `database/`
  - `docs/`
- Replaced internal package-lock registry URLs with public npm registry URLs.
- Kept backend/frontend business logic unchanged.
- Preserved documentation cleanup from Phase 4C.1.

## Recommended Vercel Settings
Use these settings for frontend deployment:

- Root Directory: `frontend`
- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

Required frontend environment variable:

```txt
VITE_API_URL=https://your-render-backend-url.com/api
```

## Backend Deployment
Backend should remain on Render, not Vercel.

## Checks Passed
- Frontend dependency install passed.
- Frontend production build passed.
- Backend dependency install passed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.

## Notes
- Frontend build still shows the existing large bundle warning. This is not a deployment blocker and should be handled later in a code-splitting optimization phase.
- Backend npm audit reports one moderate dependency warning. No runtime route failure was found during this patch.




---
# SOURCE FILE: docs/PHASE4D_SAAS_BILLING_UI_TENANT_USAGE_DASHBOARD_REPORT.md

# Phase 4D — SaaS Billing UI & Tenant Usage Dashboard Report

## Baseline
Started from: `V48_phase4C_2_vercel_root_flatten_deployment_fix.zip`

## Goal
Improve SaaS billing visibility and tenant usage monitoring without harming existing hospital workflows, tenant isolation, RBAC, or billing/pharmacy/lab/patient/doctor base flows.

## Implemented
- Added SaaS Control Center commercial operations dashboard cards:
  - Collection rate
  - Total collected
  - Outstanding subscription dues
  - Subscription invoice status summary
- Added high-usage tenant panel to surface tenants near plan limits or with subscription warnings.
- Improved tenant usage visibility in the Configuration page by labeling it as a Tenant Usage Dashboard and showing guardrail warnings when usage is close to/exceeds plan limits.
- Fixed frontend lifecycle API call to use the canonical Phase 4B lifecycle endpoint:
  - `POST /api/tenants/:id/lifecycle/:action`
- Hardened the older compatibility lifecycle route so only `super_admin` can use it.
- Added default hospital protection to the compatibility lifecycle route so it cannot be suspended or cancelled.
- Added `npm run check:saas-ui` backend safety check for SaaS UI/API wiring.

## Preserved
- Existing tenant isolation protections from Phase 4A.
- Tenant lifecycle and subscription foundation from Phase 4B.
- Plan limit guardrails from Phase 4C.
- Vercel flattened root structure from Phase 4C.2.
- Existing patient, doctor, appointment, pharmacy, lab, radiology, billing, compliance and audit flows.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- Frontend production build passed.

## Known Notes
- Frontend build still shows the existing Vite bundle-size warning. This is expected and should be handled in a later code-splitting optimization phase.
- `react-hot-toast` module directive warning remains non-blocking.

## Next Recommended Phase
Phase 4E — SaaS Invoice Automation & Dunning Readiness.




---
# SOURCE FILE: docs/PHASE4E_SAAS_INVOICE_AUTOMATION_DUNNING_READINESS_REPORT.md

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




---
# SOURCE FILE: docs/PHASE4F_PAYMENT_GATEWAY_WEBHOOK_HARDENING_RECONCILIATION_REPORT.md

# Phase 4F — Payment Gateway Webhook Hardening & Invoice Reconciliation Report

## Baseline
Started from: `V48_phase4E_saas_invoice_automation_dunning_readiness.zip`

## Goal
Harden the SaaS subscription billing layer for payment gateway readiness without disturbing existing HMS clinical, billing, compliance, tenant isolation or SaaS dashboard flows.

## Implemented
- Added signed payment gateway webhook foundation for SaaS invoices.
- Added HMAC-SHA256 signature verification using gateway-specific or common webhook secret.
- Added webhook idempotency protection using gateway + event id.
- Added duplicate transaction protection for gateway payment records.
- Added payment intent link uniqueness guardrail.
- Added webhook event persistence for audit/reconciliation traceability.
- Added automatic invoice reconciliation from verified paid webhook events.
- Added safe handling for duplicate, failed, ignored and invalid-signature webhook events.
- Added manual invoice reconciliation endpoint that recalculates invoice paid/balance/status from recorded payments.
- Added super-admin webhook listing endpoint for operational support.
- Preserved existing manual payment, payment-link, payment-intent, dunning and invoice generation flows.

## New/Improved Backend Model
- `SaaSPaymentWebhook`
  - Stores gateway, event id, signature status, invoice linkage, transaction id, amount, payload, processing status and errors.

## New/Improved API Endpoints
- `POST /api/saas/payment-webhooks/:gateway`
  - Public gateway-facing endpoint.
  - Requires valid webhook signature.
  - Uses idempotency and transaction dedupe before recording payment.
- `GET /api/saas/payment-webhooks`
  - Super-admin only webhook event listing.
- `POST /api/saas/invoices/:id/reconcile`
  - Super-admin only invoice reconciliation from recorded payment rows.

## Environment Variables Added
- `SAAS_PAYMENT_WEBHOOK_SECRET`
  - Common fallback webhook signing secret.
- `SAAS_<GATEWAY>_WEBHOOK_SECRET`
  - Optional gateway-specific secret, for example `SAAS_RAZORPAY_WEBHOOK_SECRET`.

## Safety Notes
- No existing HMS tenant, patient, doctor, appointment, pharmacy, lab, compliance, audit or normal billing route was removed.
- Gateway webhook endpoint is intentionally not JWT-protected because real payment gateways cannot send user JWT tokens; instead it requires HMAC signature verification.
- Invalid signatures are persisted as failed webhook events and rejected with HTTP 401.
- Duplicate webhook deliveries return safely without double-charging/double-recording payment.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation readiness check passed.
- SaaS webhook reconciliation check passed.
- Frontend production build passed.

## Known Notes
- Frontend build still passes with the existing Vite bundle-size warning. This remains planned for a later code-splitting/performance phase.
- Webhook integration is gateway-ready; production connection requires configuring the gateway dashboard webhook URL and secret.

## Next Recommended Phase
Phase 4G — Payment Gateway Provider Integration & Admin Settlement Reports.




---
# SOURCE FILE: docs/PHASE4H_SUBSCRIPTION_ANALYTICS_REVENUE_FORECASTING_CHURN_RISK_REPORT.md

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




---
# SOURCE FILE: docs/PHASE4L_ROADMAP_REALIGNMENT_AUDIT_REPORT.md

# Phase 4L — Roadmap Realignment & Pending Phase 4 Completion Audit

## Baseline
Started from: `V48_phase4K_saas_knowledge_base_self_service_help_center.zip`

## Purpose
This phase realigns the project with the original enterprise HMS roadmap after the Phase 4 SaaS expansion. No HMS business logic was intentionally changed in this phase.

## Audit Result
The project is still aligned with the original roadmap, but Phase 4 was expanded beyond the original four planned SaaS-readiness items.

### Original Phase 4 Roadmap Status
| Original Roadmap Item | Status | Notes |
|---|---:|---|
| Phase 4A — Tenant Isolation & SaaS Safety | Completed | Tenant isolation, tenant safety checks and audits are present. |
| Phase 4B — Hospital Onboarding Workflow | Partially completed | Tenant/admin/subscription foundation exists, but full onboarding wizard, branding, branch setup and initial settings workflow still need completion. |
| Phase 4C — Subscription & Plan Control | Mostly completed | Subscription status, plan limits, billing guardrails, invoice/payment tracking and SaaS dashboard foundations are present. |
| Phase 4D — Backup, Restore & Data Export | Pending/partial | Backup/restore scripts and docs exist, but tenant-wise restore request workflow, export UI/API and disaster recovery workflow still need hardening. |

### Extra SaaS Expansion Completed
The following additions were completed as useful enterprise SaaS platform layers, but they were beyond the original Phase 4 scope:

- SaaS billing UI and tenant usage dashboard
- Invoice automation and dunning readiness
- Payment webhook hardening and invoice reconciliation
- Payment provider adapter and settlement reporting
- Subscription analytics, revenue forecasting and churn signals
- Customer success and renewal workflow
- Support desk, SLA and escalation workflow
- Knowledge base and self-service help center

## Pending Roadmap Gaps Before Phase 5
Before starting Phase 5 reports and analytics, the recommended remaining Phase 4 work is:

1. **Phase 4M — Hospital Onboarding Wizard Completion**
   - Create hospital wizard
   - Assign subscription plan during onboarding
   - Create first hospital admin
   - Enable/disable modules
   - Hospital logo/branding
   - Branch/department setup
   - Initial settings setup
   - Onboarding audit log

2. **Phase 4N — Backup, Restore & Tenant Data Export Hardening**
   - Hospital-wise backup metadata review
   - Backup verification workflow
   - Restore request workflow
   - Tenant data export endpoint/UI readiness
   - Disaster recovery log
   - Backup/restore audit trail

3. **Phase 5A — Patient & Appointment Reports**
   - Start only after Phase 4M and 4N are complete or intentionally postponed.

## Files Added/Updated
- Added `docs/PHASE4L_ROADMAP_REALIGNMENT_AUDIT_REPORT.md`
- Added `docs/ROADMAP_STATUS_AFTER_PHASE4L.md`
- Updated `docs/LATEST_PHASE_REPORT.md`
- Added backend regression script `backend/scripts/roadmap-alignment-check.js`
- Added npm script `check:roadmap-alignment`

## Safety Notes
- No patient, doctor, billing, pharmacy, lab, IPD, tenant, payment or support business routes were intentionally modified.
- This phase is documentation/audit focused.

## Checks Passed
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- SaaS UI safety check
- SaaS billing automation check
- SaaS webhook reconciliation check
- Provider settlement check
- Subscription analytics check
- SaaS customer success readiness check
- SaaS support desk readiness check
- SaaS knowledge base readiness check
- Roadmap alignment check
- Frontend production build

## Next Recommended Phase
**Phase 4M — Hospital Onboarding Wizard Completion**




---
# SOURCE FILE: docs/PHASE4M_HOSPITAL_ONBOARDING_WIZARD_COMPLETION_REPORT.md

# Phase 4M — Hospital Onboarding Wizard Completion Report

## Baseline
Started from: `V48_phase4L_roadmap_realignment_pending_phase4_audit.zip`

## Goal
Close the original Phase 4B roadmap gap for hospital onboarding while preserving existing HMS, tenant isolation, billing, support and knowledge-base flows.

## Implemented
- Added hospital onboarding schema fields on Hospital:
  - `branches`
  - `onboarding.status`
  - `onboarding.current_step`
  - `onboarding.completed_steps`
  - onboarding completion flags and audit metadata
- Added safe onboarding draft endpoint:
  - `POST /api/tenants/onboarding/draft`
- Added onboarding update endpoint:
  - `PATCH /api/tenants/:id/onboarding`
- Added onboarding completion endpoint:
  - `POST /api/tenants/:id/onboarding/complete`
- Added branch sanitization for onboarding branch setup.
- Added completion guardrails so onboarding cannot be marked complete without:
  - hospital profile
  - enabled modules
  - contact settings
  - hospital admin user
- Preserved super-admin-only tenant management boundaries.
- Added audit logging for onboarding draft, update and completion actions.
- Added regression check:
  - `npm run check:saas-onboarding`

## Safety Notes
- Existing `/api/tenants` create/edit/admin/logo/lifecycle routes were preserved.
- No patient, doctor, appointment, billing, pharmacy, lab, IPD, compliance, support or knowledge-base business logic was intentionally changed.
- Existing tenant isolation and plan-limit checks still pass.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS onboarding readiness check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning remains unchanged and should be handled later in the optimization/code-splitting phase.

## Next Recommended Phase
Phase 4N — Backup, Restore & Tenant Data Export Hardening.




---
# SOURCE FILE: docs/PHASE5A_PATIENT_APPOINTMENT_REPORTS.md

# Phase 5A — Patient & Appointment Reports

## Goal
Add tenant-safe operational reports for patient registrations and appointment performance without changing existing HMS CRUD flows.

## Added
- Patient and appointment report backend route.
- Date range filters with safe defaults.
- Daily registration and appointment trend.
- New vs repeat appointment patient indicators.
- Department-wise patient/appointment summary.
- Doctor-wise appointment summary.
- Appointment status mix with cancellation/no-show rates.
- Average waiting-time metric based on check-in and consultation timestamps.
- Reports UI page with summary cards and tables.
- Regression check: `npm run check:phase5a-reports`.

## Endpoint
- `GET /api/reports/patients-appointments?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Safety
- Uses existing auth and tenant middleware.
- Requires `analytics.view` permission.
- Uses `tenantFilter(req)` for all report queries.
- Read-only reporting endpoint; no patient, appointment, billing, pharmacy, lab, or SaaS business data mutation.




---
# SOURCE FILE: docs/PHASE6C_EMERGENCY_CASUALTY_MODULE_REPORT.md

# Phase 6C — Emergency / Casualty Module Report

## Baseline
Started from: `V48_phase6B_nursing_module.zip`

## Implemented
- Added tenant-scoped Emergency / Casualty module backend foundation.
- Added emergency case registration workflow for existing or walk-in patients.
- Added emergency UID generation and hospital-scoped emergency UID uniqueness.
- Added triage workflow with red/orange/yellow/green/blue categories, triage score, vitals, red flags and notes.
- Added MLC support fields: MLC required flag, MLC number and police informed flag.
- Added emergency doctor assignment, bed reference, arrival mode and disposition fields.
- Added emergency clinical note workflow for assessment, diagnosis, treatment, orders and follow-up plan.
- Added emergency transfer/admission workflow for IPD, OT and external referrals.
- Added emergency billing link endpoint with existing billing permission guardrails.
- Added emergency dashboard with active cases, today cases, critical queue, MLC cases, pending transfers and closed-today metrics.
- Added tenant guardrails through `tenantFilter(req)` and `tenantCreateData(req)`.
- Added audit logging for emergency case, triage, clinical-note, transfer and billing-link actions.
- Added clinical permission checks using existing `clinical.view` and `clinical.manage` permissions.
- Improved clinical permission catalog so admin, hospital admin, doctor and nurse roles can access clinical workflow modules consistently.

## New Backend Models / Collections
- `EmergencyCase` / `emergency_cases`
- `EmergencyTriageNote` / `emergency_triage_notes`
- `EmergencyClinicalNote` / `emergency_clinical_notes`
- `EmergencyTransfer` / `emergency_transfers`

## New API Endpoints
- `GET /api/emergency/dashboard`
- `GET /api/emergency/cases`
- `POST /api/emergency/cases`
- `PATCH /api/emergency/cases/:id`
- `POST /api/emergency/cases/:id/triage`
- `GET /api/emergency/cases/:id/triage`
- `POST /api/emergency/cases/:id/clinical-note`
- `GET /api/emergency/cases/:id/clinical-notes`
- `POST /api/emergency/cases/:id/transfer`
- `GET /api/emergency/transfers`
- `PATCH /api/emergency/transfers/:id`
- `POST /api/emergency/cases/:id/billing-link`

## Frontend Added
- `frontend/src/api/emergencyApi.js`
- `frontend/src/pages/Emergency.jsx`
- New sidebar tab: `Emergency`

## New Regression Check
- `npm run check:phase6c-emergency`

## Full Testing Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation check passed.
- SaaS webhook reconciliation check passed.
- Provider settlement check passed.
- Subscription analytics check passed.
- SaaS customer success readiness check passed.
- SaaS support desk readiness check passed.
- SaaS knowledge base readiness check passed.
- Roadmap alignment check passed.
- SaaS onboarding readiness check passed.
- Tenant backup/restore/export hardening check passed.
- Phase 4N continuation backup/restore/export safety check passed.
- Phase 5A patient/appointment reports check passed.
- Phase 5B revenue/billing reports check passed.
- Phase 5C pharmacy/lab/IPD reports check passed.
- Phase 5D executive command center check passed.
- Phase 6A OT/Surgery readiness check passed.
- Phase 6B Nursing readiness check passed.
- Phase 6C Emergency/Casualty readiness check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning still remains and should be handled in the planned optimization/code-splitting phase.
- Emergency frontend is a safe foundation workspace. Advanced ER queue boards, triage timers, MLC forms, ambulance integration and emergency billing packages can be expanded later.

## Next Recommended Phase
Phase 6D — Blood Bank Module.




---
# SOURCE FILE: docs/PHASE6E_HR_STAFF_MODULE_REPORT.md

# Phase 6E — HR / Staff Module Report

## Baseline
Started from: `V48_phase6D_blood_bank_full_completion_enterprise_hardening.zip`

## Implemented
- Added tenant-scoped HR / Staff backend foundation.
- Added staff profile management with department/designation/employment/status fields.
- Added attendance marking and attendance update workflow.
- Added shift roster creation and update workflow.
- Added leave request and review workflow.
- Added payroll export basics with period-based staff rows, attendance days and leave days.
- Added HR / Staff dashboard summary endpoint.
- Added audit logging for staff profile, attendance, roster, leave and payroll export actions.
- Added frontend HR / Staff tab with dashboard cards and operational forms/tables.
- Added HR / Staff module to tenant module settings and enterprise/hospital plans.

## New API Endpoints
- `GET /api/hr-staff/dashboard`
- `GET /api/hr-staff/staff`
- `POST /api/hr-staff/staff`
- `PATCH /api/hr-staff/staff/:id`
- `GET /api/hr-staff/attendance`
- `POST /api/hr-staff/attendance`
- `PATCH /api/hr-staff/attendance/:id`
- `GET /api/hr-staff/rosters`
- `POST /api/hr-staff/rosters`
- `PATCH /api/hr-staff/rosters/:id`
- `GET /api/hr-staff/leaves`
- `POST /api/hr-staff/leaves`
- `POST /api/hr-staff/leaves/:id/review`
- `GET /api/hr-staff/payroll-exports`
- `POST /api/hr-staff/payroll-exports`
- `GET /api/hr-staff/payroll-exports/:id`

## Safety Notes
- Existing HMS clinical, billing, reports and Blood Bank flows were not intentionally changed.
- HR / Staff collections are tenant-aware and use existing tenant middleware helpers.
- Routes require authenticated users and admin-level permissions.
- Payroll export is a basic export foundation, not a final payroll calculation engine.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Phase 6A OT/Surgery check passed.
- Phase 6B Nursing check passed.
- Phase 6C Emergency check passed.
- Phase 6D Blood Bank check passed.
- Phase 6E HR / Staff readiness check passed.
- Frontend production build passed.

## Known Note
- Vite bundle-size warning still remains. This should be handled in the later optimization/code-splitting phase.

## Next Recommended Phase
Phase 6F — Patient Portal.




---
# SOURCE FILE: docs/PHASE6F_PATIENT_PORTAL_UPGRADE_REPORT.md

# Phase 6F — Patient Portal Upgrade Report

## Baseline
Started from: `V48_phase6E_hr_staff_module.zip`

## Scope
Upgrade the existing Patient Portal instead of creating a duplicate portal. Preserve existing portal routes and UI patterns while adding safer patient self-service capabilities and stronger own-data isolation.

## Implemented
- Upgraded existing `PatientPortal.jsx` with a structured self-service workspace.
- Added tabbed Patient Portal sections:
  - Overview
  - Appointments
  - Prescriptions / OPD records
  - Lab & Radiology Reports
  - Bills & Receipts
  - Document Vault
  - Medical Timeline
- Hardened patient portal own-data access:
  - Patient/portal roles cannot override `patient_id` through query parameters.
  - Staff roles may select a patient for assisted portal view.
  - Tenant filtering remains enforced through existing tenant middleware and `tenantFilter`.
- Added patient portal audit logging for portal views and denied spoof attempts.
- Added normalized document vault response combining:
  - patient documents
  - lab report files
  - radiology report files
  - bill/receipt metadata
- Added outstanding bill summary and ready-report counts.
- Preserved the existing Doctor Portal route; Doctor Portal upgrade remains planned for Phase 6G.

## New / Improved API endpoints
- `GET /api/portal/patient`
- `GET /api/portal/patient/profile`
- `GET /api/portal/patient/appointments`
- `GET /api/portal/patient/prescriptions`
- `GET /api/portal/patient/reports`
- `GET /api/portal/patient/bills`
- `GET /api/portal/patient/documents`

## Safety Notes
- No duplicate patient portal module was created.
- Existing HMS CRUD modules were not intentionally changed.
- Patient portal users are restricted to their linked patient record.
- Staff-assisted patient selection remains available only for approved staff roles.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- OT/Surgery readiness check passed.
- Nursing readiness check passed.
- Emergency/Casualty readiness check passed.
- Blood Bank enterprise readiness check passed.
- HR/Staff readiness check passed.
- Patient Portal upgrade readiness check passed.
- Frontend production build passed.

## Known Notes
- Frontend build still shows the existing bundle-size warning. This should be handled in a later code-splitting optimization phase.
- Payment collection is intentionally not enabled in this phase; the patient portal safely displays bill status and outstanding amounts only.

## Next Recommended Phase
Phase 6G — Doctor Portal Upgrade.




---
# SOURCE FILE: docs/PHASE7E_ERP_TALLY_INTEGRATION_UPGRADE_REPORT.md

# Phase 7E — ERP / Tally Integration Upgrade Report

## Baseline
Started from: `V48_phase7D_abdm_abha_integration_upgrade.zip`

## Existing Feature Check
- Existing ERP/Tally UI page was already present: `frontend/src/pages/ERPTally.jsx`.
- Existing enterprise feature flag for `erp` was already present in tenant feature flags.
- No duplicate ERP/Tally module was created.
- The existing ERP/Tally page was upgraded and connected to dedicated tenant-safe backend endpoints.

## Implemented
- Added tenant-safe ERP/Tally backend route: `backend/src/routes/erp-tally.routes.js`.
- Added ERP/Tally ledger mapping persistence using existing `EnterpriseFeatureRecord` model.
- Added billing-to-accounting voucher mapping.
- Added export preview endpoint.
- Added export generation endpoint with integration log creation.
- Added Tally XML, CSV and JSON export support.
- Added export checksum manifest support.
- Added export manifest lookup endpoint.
- Added ERP/Tally permissions:
  - `erp.view`
  - `erp.manage`
- Added accountant/admin/hospital_admin access for ERP/Tally permissions.
- Upgraded existing ERP/Tally frontend page with:
  - ledger mapping form
  - export format selector
  - voucher preview
  - checksum manifest display
  - export log visibility
- Added frontend API client: `frontend/src/api/erpTallyApi.js`.
- Added regression check: `npm run check:phase7e-erp-tally`.

## New / Upgraded API Endpoints
- `GET /api/erp-tally/summary`
- `GET /api/erp-tally/ledger-mapping`
- `POST /api/erp-tally/ledger-mapping`
- `GET /api/erp-tally/export/preview`
- `POST /api/erp-tally/export`
- `GET /api/erp-tally/export/:id/manifest`

## Safety Notes
- Export flow is read-only against billing records.
- Invoice/billing records are not mutated by ERP/Tally export.
- Export activity is logged in `IntegrationLog`.
- All queries are tenant-scoped via tenant middleware.
- Existing ERP/Tally page was upgraded instead of creating a duplicate module.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Doctor Portal readiness check passed.
- FHIR readiness check passed.
- HL7 readiness check passed.
- PACS/DICOM readiness check passed.
- ABDM/ABHA readiness check passed.
- ERP/Tally readiness check passed.
- Frontend production build passed.

## Known Notes
- Vite bundle-size warning still remains and should be handled in the later code-splitting / performance optimization phase.
- Tally XML export is integration-ready foundation. Real production deployment may still need hospital-specific ledger naming, voucher type customization, tax ledgers and accounting review before live import.

## Next Recommended Phase
Phase 7F — Communication Integrations Upgrade.




---
# SOURCE FILE: docs/PHASE7F_COMMUNICATION_INTEGRATIONS_UPGRADE_REPORT.md

# Phase 7F — Communication Integrations Upgrade Report

## Baseline
Started from: `V48_phase7E_erp_tally_integration_upgrade.zip`

## Existing Feature Check
The project already had communication-related features:
- `backend/src/routes/communication.routes.js`
- `backend/src/utils/communication.js`
- `backend/src/routes/notification.routes.js`
- `frontend/src/pages/Communications.jsx`
- `frontend/src/pages/WhatsAppSMS.jsx`
- `frontend/src/api/communicationApi.js`

No duplicate Communication / WhatsApp / SMS module was created. The existing communication feature was upgraded in place.

## Implemented / Upgraded
- Communication template governance foundation.
- Approved-template based message rendering with `{{variable}}` support.
- Reminder rule foundation for appointment, report-ready, payment-due and follow-up reminders.
- Appointment reminder workflow upgraded to support templates and tenant-safe contact lookup.
- Payment due reminder workflow added.
- Due communication queue endpoint added.
- Provider callback endpoint added for sent/delivered/read/failed lifecycle tracking.
- Retry workflow for failed/skipped/queued messages.
- Contact normalization for email/SMS/WhatsApp channels.
- Scheduled communication support.
- Provider status, delivery/read timestamps and provider payload metadata added.
- Communication CSV export expanded with template/provider lifecycle fields.
- Existing Communications UI upgraded with:
  - template governance panel
  - reminder rule panel
  - due queue summary
  - payment reminder action
  - retry action
  - provider lifecycle stats
- Tenant scoping preserved through `attachTenant`, `tenantFilter`, and `tenantCreateData`.
- Audit logging preserved/added for communication send, template, rule, retry, callback and reminder workflows.

## New / Improved API Endpoints
- `GET /api/communications/templates`
- `POST /api/communications/templates`
- `PATCH /api/communications/templates/:id/approve`
- `GET /api/communications/rules`
- `POST /api/communications/rules`
- `PATCH /api/communications/rules/:id`
- `GET /api/communications/due`
- `POST /api/communications/payment-due-reminders`
- `POST /api/communications/:id/mark-failed`
- `POST /api/communications/:id/retry`
- `POST /api/communications/provider-callback`

Existing endpoints preserved:
- `GET /api/communications/summary`
- `GET /api/communications/logs`
- `POST /api/communications/send`
- `POST /api/communications/appointment-reminders`
- `POST /api/communications/:id/mark-sent`
- `GET /api/communications/export.csv`

## New Data Models / Fields
- `CommunicationTemplate`
- `CommunicationRule`
- `CommunicationLog` enhanced with:
  - `contact_normalized`
  - `template_key`
  - `template_version`
  - `provider_status`
  - `provider_payload`
  - `retry_count`
  - `next_retry_at`
  - `delivered_at`
  - `read_at`
  - `consent_checked`
  - `scheduled_for` as Date

## New Regression Check
- `npm run check:phase7f-communications`

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Doctor Portal readiness check passed.
- FHIR readiness check passed.
- HL7 readiness check passed.
- PACS/DICOM readiness check passed.
- ABDM/ABHA readiness check passed.
- ERP/Tally readiness check passed.
- Communication Integrations readiness check passed.
- Frontend production build passed.

## Known Notes
- External SMS/WhatsApp/Email delivery is still provider-env ready. Messages are safely skipped if provider credentials are not configured.
- Real provider SDK/API calls can be connected in a later production integration hardening step after provider selection.
- Existing Vite bundle-size warning remains and should be handled in the later code-splitting/performance optimization phase.

## Next Recommended Phase
Phase 8A — Automated Testing.




---
# SOURCE FILE: docs/PRODUCTION_CHECKLIST.md

# Production Checklist — Phase 8E

## Build checks

```bash
cd backend
npm ci
npm run check-routes
npm run test:automated
npm run check:phase8e-production-readiness

cd ../frontend
npm ci
npm run test:frontend
npm run test:e2e
npm run test:performance
npm run check:phase8e-production
npm run build
```

## Backend checks

- `/api/health/live` returns 200.
- `/api/health/ready` returns 200 after DB connection.
- CORS includes the current Vercel domain in `FRONTEND_URL`.
- Custom domains are added to `CORS_EXTRA_ORIGINS` if needed.
- Rate-limit headers are present on API responses.
- Seed admin can login, then default password is changed.
- Tenant isolation and permission checks pass.
- Old modules still open: patients, doctors, appointments, pharmacy, lab, billing, reports, portals.

## Frontend checks

- Vercel Root Directory is `frontend`.
- Build command is `npm run build`.
- Output directory is `dist`.
- `VITE_API_URL` points to the Render backend and ends with `/api`.
- Login, dashboard, reports, Patient Portal and Doctor Portal open without console-blocking API errors.

## Backup checks

- MongoDB Atlas automated backups are enabled.
- `npm run backup` creates a JSON backup in staging.
- `npm run verify-backup` records verification in staging.
- Tenant backup/export metadata checks pass.
- Restore is tested in staging before any production restore.
- Production restore requires business approval, technical approval and rollback plan review.

## Deployment checks

- Render health path is `/api/health/ready`.
- Render build command is `npm ci`.
- Vercel frontend deploy uses the same release commit as backend.
- GitHub Actions CI passes.
- Docker/local production smoke test passes if Docker is used.
- Release notes are updated in `docs/RELEASE_NOTES.md`.

## Launch decision

Go live only when all checks above are green and production secrets are not default/demo values.




---
# SOURCE FILE: docs/PRODUCTION_DEPLOYMENT_READINESS.md

# Phase 8E — Production Deployment Readiness

This guide is the final launch-readiness checklist for the Enterprise HMS build. It is designed for the current deployment model:

- Frontend: Vercel
- Backend API: Render
- Database: MongoDB Atlas
- Optional storage: Cloudinary
- Optional monitoring: uptime monitor and Sentry-compatible DSN

## 1. Required environments

Use at least two environments before production launch:

| Environment | Purpose | Notes |
| --- | --- | --- |
| Staging | final validation and user acceptance testing | Use production-like MongoDB Atlas database, never production data unless anonymized. |
| Production | live hospital usage | Use separate DB, separate secrets and protected branch deploys. |

## 2. Backend Render settings

```text
Root Directory: backend
Build Command: npm ci
Start Command: npm start
Health Check Path: /api/health/ready
Node Version: 20+
```

Required variables:

```env
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=hms_production
JWT_SECRET=<64+ character random secret>
REFRESH_TOKEN_EXPIRES_IN=7d
JWT_EXPIRES_IN=8h
FRONTEND_URL=https://your-vercel-domain.vercel.app
CORS_EXTRA_ORIGINS=https://your-custom-domain.com
RATE_LIMIT_MAX=500
TRUST_PROXY=1
API_PUBLIC_URL=https://your-render-service.onrender.com
BACKUP_DIR=./backups
TENANT_BACKUP_DIR=./backups/tenants
BACKUP_RETENTION_DAYS=14
TENANT_DATABASE_MODE=hybrid
TENANT_DB_ISOLATION=hybrid
TENANT_DB_PREFIX=hms_tenant
SAAS_PAYMENT_GATEWAY=manual_gateway_ready
SAAS_WEBHOOK_SECRET=<gateway webhook secret when enabled>
```

Optional provider variables should be added only when the provider is live:

```env
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMS_PROVIDER=
SMS_API_KEY=
WHATSAPP_PROVIDER=
WHATSAPP_TOKEN=
SENTRY_DSN=
UPTIME_MONITOR_URL=
```

## 3. Frontend Vercel settings

```text
Root Directory: frontend
Framework Preset: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: dist
```

Environment:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

## 4. Pre-deploy commands

Run before every release:

```bash
cd backend
npm ci
npm run check-routes
npm run test:automated
npm run check:phase8e-production-readiness

cd ../frontend
npm ci
npm run test:frontend
npm run test:e2e
npm run test:performance
npm run check:phase8e-production
npm run build
```

## 5. Database and backup readiness

Before production:

- Create a dedicated MongoDB Atlas production database.
- Restrict network access to trusted deployment sources where possible.
- Run `npm run check-db` from the backend environment.
- Run `npm run seed` once to create/update the secure admin.
- Change seeded credentials immediately after first login.
- Configure scheduled MongoDB Atlas backups.
- Validate application backup scripts in staging.
- Document restore approval owners.

## 6. Smoke test after deploy

After deployment, validate:

```text
GET /api/health/live
GET /api/health/ready
POST /api/auth/login
GET /api/patients
GET /api/doctors
GET /api/appointments
GET /api/reports/patients-appointments
GET /api/command-center/summary
```

Then verify UI flows:

- Login/logout
- Dashboard stats
- Patient add/view
- Appointment create/view
- OPD/EMR access
- Billing list
- Lab/radiology list
- Pharmacy list
- Reports tabs
- Patient Portal
- Doctor Portal

## 7. Release process

1. Merge to staging branch.
2. Deploy staging.
3. Run smoke tests and automated checks.
4. Confirm database backup is healthy.
5. Tag release, for example `v48-phase8e`.
6. Deploy production.
7. Monitor `/api/health/ready` and error logs for at least the first release window.
8. Record release notes in `docs/RELEASE_NOTES.md`.

## 8. Rollback plan

- Frontend: rollback to previous Vercel deployment.
- Backend: rollback to previous Render deploy or previous git tag.
- Database: do not restore production unless business and technical approvals are recorded.
- Tenant data restore must use the Phase 4N approval checklist and verified backup metadata.

## 9. Launch decision

Production launch is allowed only when:

- backend route load passes
- automated regression passes
- frontend contract and E2E checks pass
- production readiness checks pass
- frontend production build passes
- staging smoke test passes
- backup/restore owners are assigned
- secrets are production-grade and not default values




---
# SOURCE FILE: docs/PROJECT_PHASE_HISTORY.md

# Project Phase History

Consolidated phase/report history for the Enterprise HMS project.

Generated in Phase 4C.1 — Documentation Cleanup & Phase Report Consolidation.

## Index
- V45 FIXES
- V47 CHANGELOG
- V48 STABILIZATION REPORT
- PHASE0 AUDIT AND FIX REPORT
- PHASE1A PATIENT MODULE REPORT
- PHASE1B DOCTOR MODULE REPORT
- PHASE1C APPOINTMENT MODULE REPORT
- PHASE1D BILLING MODULE REPORT
- PHASE1E PHARMACY MODULE REPORT
- PHASE2A OPD EMR WORKFLOW REPORT
- PHASE2B PATIENT TIMELINE REPORT
- PHASE2C IPD ADMISSION WORKFLOW REPORT
- PHASE2E ADVANCED LAB WORKFLOW REPORT
- PHASE2F ADVANCED PHARMACY WORKFLOW REPORT
- PHASE3A AUTH SESSION SECURITY REPORT
- PHASE3B ROLE BASED ACCESS CONTROL REPORT
- PHASE3C AUDIT TRAIL HARDENING REPORT
- PHASE3D COMPLIANCE CENTER HARDENING REPORT
- PHASE4A TENANT ISOLATION SAAS SAFETY REPORT
- PHASE4C TENANT BILLING GUARDRAILS PLAN LIMITS REPORT

---


## Source: `V45_FIXES.md`

# V45 Fix Summary

Targeted fixes applied without removing existing HMS functionality:

- Command Center now loads each KPI widget safely and shows zero-state widgets even if one analytics endpoint fails.
- Patient Portal and Doctor Portal dropdown copy improved for admin/staff mode selection.
- Beds module replaced raw generic form with labelled HMS-specific form and valid bed statuses.
- Billing module upgraded from raw patient id/amount form to labelled invoice form with patient dropdown, paid amount, payment mode and invoice register columns.
- Backend Bed model now has ward, bed_number, status and tenant-safe unique index on hospital_id + ward + bed_number.
- Backend bed creation validates duplicate bed numbers per hospital/ward and normalizes status values.
- Backend Billing model now defines invoice fields, totals, paid/due amount, payment status, items and invoice unique index per hospital.
- Billing create payload now supports legacy amount fields and richer invoice totals safely.
- Configuration page now shows load errors instead of staying stuck on “Loading fields...”.
- Added global UI hardening: responsive tables, labelled form styling, command alert grid, empty states, inventory hero contrast, and safer letter spacing.

Validation:
- Backend route loading: passed with `npm run check-routes`.
- Frontend production build: passed with `npm run build`.


## Source: `V47_CHANGELOG.md`

# V47 Full Module Stabilization

Base: V46 enterprise modules.

## Added
- Tenant-scoped EnterpriseFeatureRecord MongoDB model.
- Backend CRUD API for advanced features:
  - GET /api/enterprise-features/:feature/summary
  - GET /api/enterprise-features/:feature/records
  - POST /api/enterprise-features/:feature/records
  - PATCH /api/enterprise-features/:feature/records/:id
  - DELETE /api/enterprise-features/:feature/records/:id
  - PUT /api/enterprise-features/:feature/enabled
- Frontend enterpriseFeatureApi client.
- Reusable EnterpriseFeatureWorkspace component with real create/edit/delete records, feature enable/disable, stats, checklist, audit/integration log views.
- Dedicated FHIRAPIs.jsx page instead of generic placeholder.
- Dedicated WhatsAppSMS.jsx page integrated with Communications.

## Improved
- Advanced feature pages now save tenant-scoped data to MongoDB through backend APIs instead of displaying only static placeholder content.
- Audit Compliance filter uses backend-supported query params.
- Advanced feature UI: readable hero, forms, tables, responsive layout, records table, module-specific checklist.

## Existing functionality protected
- Core pages/routes retained.
- Existing integration logs, API keys, webhooks, FHIR preview, communications, insurance, legal/security, SaaS, hospital management flows remain available.

## Tests run
- Frontend production build: PASS
- Backend route load test: PASS


## Source: `V48_STABILIZATION_REPORT.md`

# V48 Existing Module Stabilization & Polish

Scope: no new feature expansion. This version focuses on improving the existing V47 module experience without removing current functionality.

## Fixed / Improved
- Added global enterprise-module polish CSS for advanced modules and existing card/table/form layouts.
- Improved Legal/Security and advanced module page readability: hero cards, stats cards, form grids, tables, empty states, responsive behavior.
- Standardized buttons, inputs, cards, table wrappers, checklist, status pill and action-row styling.
- Preserved existing frontend routes, backend APIs, models, permissions and feature flags.
- No existing module was intentionally removed or disabled.

## Stabilization Target
- HL7 Ready
- PACS/DICOM
- Biometric
- ERP/Tally
- ABDM/ABHA
- 2FA Security
- Audit Compliance
- Legal & Security
- Inventory/Pharmacy visual consistency
- Command/Production enterprise pages

## Verification
- Frontend production build should be run after extraction with `npm install && npm run build`.
- Backend route loading should be checked with `npm run check-routes` from backend if dependencies are installed.


## Source: `PHASE0_AUDIT_AND_FIX_REPORT.md`

# Phase 0 Audit & Stabilization Report - V48 HMS

## Checks completed

- Backend JavaScript syntax check: PASS
- Backend route load check: PASS
- Backend QA smoke route inventory: PASS, 276 routes loaded
- Frontend production build: PASS
- Backend security-check without env: FAIL as expected because local `.env` is not configured

## Fixes applied in this Phase 0 pass

### 1. CORS configuration improved
File: `backend/src/server.js`

`CORS_EXTRA_ORIGINS` from `.env.example` was present but not used in the server. It is now included with `FRONTEND_URL`, so extra Vercel/custom domains can be added safely without replacing the main frontend URL.

### 2. Production error response hardened
File: `backend/src/middleware/errorHandler.js`

The error handler now returns a standard error shape with `success:false`. In production, internal 500 error messages are hidden and stack traces are not exposed.

### 3. Forgot password flow made safer
File: `backend/src/routes/auth.routes.js`

The reset token is no longer returned in production responses. It is still returned only in non-production environments for development/testing until SMTP is configured.

### 4. Change password validation added
File: `backend/src/routes/auth.routes.js`

`/api/auth/change-password` now validates the new password against `PASSWORD_MIN_LENGTH` before saving.

## Important findings

### Frontend status
Frontend builds successfully, but Vite reports a large bundle warning:

- Main JS bundle: about 1.06 MB before gzip
- Recommendation: split advanced pages with lazy loading after core modules are stable

### Backend status
Backend routes load successfully and critical routes are present. This means there is no immediate route import crash.

### Environment status
The security check currently fails locally because these required variables are missing:

- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`

This is expected unless `.env` is configured locally or Render env variables are configured.

### Database runtime status
A real DB connection test was not completed because no real MongoDB Atlas URI was provided in the uploaded ZIP. To verify runtime fully, configure `.env` and run:

```bash
cd backend
npm run check-db
npm run seed
npm run security-check
npm run qa:smoke
```

## Phase 0 remaining tasks

### Critical

1. Configure backend `.env`
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `JWT_SECRET` with at least 32 random characters
   - `FRONTEND_URL` with live Vercel URL
   - `CORS_EXTRA_ORIGINS` if multiple domains are used

2. Configure frontend `.env`
   - `VITE_API_URL=https://your-render-backend.onrender.com/api`

3. Run live backend checks
   - `npm run check-db`
   - `npm run seed`
   - `npm run security-check`
   - `npm run qa:smoke`

4. Login test
   - Verify seeded admin can log in
   - Verify token is stored
   - Verify `/api/auth/me` works

5. Basic module API test
   - Patients list/create
   - Doctors list/create
   - Appointments list/create
   - Billing list/create
   - Pharmacy medicines list/create
   - Lab templates list/create

### High priority

1. Add request validation layer for important modules.
2. Reduce frontend bundle size using lazy loading.
3. Replace hard deletes with soft deletes in sensitive modules.
4. Standardize API response format across all routes.
5. Add a stable manual test checklist for every core module.

## Recommended next step

Continue Phase 0 with live environment verification. After DB, auth, seed, and login are confirmed, move to Phase 1A: Patient module stabilization.


## Source: `PHASE1A_PATIENT_MODULE_REPORT.md`

# Phase 1A - Patient Module Stabilization Report

## Scope completed
This update starts Phase 1 with the Patient module because it is the base dependency for appointments, OPD/EMR, lab, radiology, pharmacy, billing, and IPD.

## Backend changes
- Added patient payload validation for:
  - full name
  - age range
  - gender enum
  - email format
  - phone format
  - emergency phone format
  - blood group enum
- Added normalization for:
  - phone spacing
  - lowercase email
  - lowercase gender
  - uppercase blood group
- Added active patient filtering so archived patients no longer appear in normal patient lists or profiles.
- Converted patient delete into soft-delete/archive using `status`, `deleted_at`, and `deleted_by`.
- Added patient create/update audit events.
- Added duplicate warning support using patient ID, phone, email, and name+age+gender matching.
- Added `GET /api/patients/duplicate-check` endpoint.
- Kept strict duplicate blocking for same `patient_id` inside the same hospital/tenant.
- Added active-patient checks for profile, timeline, document upload, profile image upload, and document delete.
- Added patient schema fields for `status`, `deleted_at`, and `deleted_by`.

## Frontend changes
- Patient delete UI now shows archive wording instead of hard delete wording.
- Patient document upload no longer requires manual Patient ID before selecting a file. This supports auto-generated/backend patient IDs.
- Create/update patient flow now surfaces duplicate warning toast when the backend detects possible duplicate patients.
- Added patient document delete API method.
- Patient profile document list now supports deleting saved documents.
- Document list keys made safer for records that do not have a frontend-only `id`.

## Validation / checks run
- Backend route loading: PASS
- Backend QA smoke inventory: PASS
- Routes loaded: 277
- Frontend production build: PASS

## Build warnings still present
- Frontend JS bundle is over 500KB. This is not a blocker, but Phase 0/Phase 1 technical debt remains: future code-splitting is recommended.
- Vite warning about `appointmentApi.js` being both dynamically and statically imported remains. This is not caused by the patient module change.

## Remaining Phase 1A improvements recommended next
- Add patient merge workflow for true duplicate resolution.
- Add patient record view audit logging.
- Add patient search API with server-side pagination for large hospitals.
- Add restore archived patient endpoint for admin users.
- Add patient category: cash, insurance, corporate, government scheme, panel.
- Add guardian/family contact structure.
- Add patient consent links to the profile.


## Source: `PHASE1B_DOCTOR_MODULE_REPORT.md`

# Phase 1B — Doctor Module Stabilization Report

## Scope
Phase 1B focused on making the Doctor module safer and closer to enterprise HMS requirements without changing the overall architecture.

## Completed Improvements

### Backend
- Added doctor payload validation for required Doctor ID and full name.
- Added email format validation.
- Added phone format validation.
- Added consultation fee validation as a non-negative number.
- Added department ID numeric validation.
- Added controlled doctor status values: `active`, `inactive`, `on_leave`, `archived`.
- Added duplicate Doctor ID protection per hospital/tenant.
- Added duplicate warning support for doctor phone/email matches.
- Changed doctor delete into soft archive instead of permanent delete.
- Doctor list now hides archived doctors by default.
- Added `include_archived=true` support for admin recovery/audit views.
- Added audit logs for:
  - doctor created
  - doctor updated
  - doctor archived
  - doctor profile image uploaded
  - doctor document uploaded
  - doctor document deleted
- Added doctor schema fields for archive metadata:
  - `deleted_at`
  - `deleted_by`

### Frontend
- Updated doctor delete success message to show archive behavior.
- Existing doctor profile image upload flow remains working.
- Existing doctor document upload/delete flow remains working.
- Existing doctor profile page remains compatible.

## Validation / Test Results

### Backend
- `npm run check-routes`: passed
- `npm run qa:smoke`: passed
- QA smoke route inventory: 277 routes loaded

### Frontend
- `npm run build`: passed

### Known Build Warning
- Frontend JS bundle is still larger than 500 KB after minification.
- This is not blocking, but Phase 8 or later should add route-level code splitting/manual chunks.

## Files Changed
- `backend/src/routes/core.routes.js`
- `backend/src/models/index.js`
- `frontend/src/main.jsx`

## Enterprise HMS Impact
This phase makes Doctor management safer for production by preventing bad doctor records, protecting against accidental permanent deletion, and creating an audit trail around doctor profile changes.

## Recommended Next Phase
Start **Phase 1C: Appointment Module**.

Priority items:
1. Appointment validation
2. Appointment status lifecycle
3. Double-booking prevention
4. Token number generation
5. Reschedule/cancel reason support
6. Queue stability
7. Appointment audit logs


## Source: `PHASE1C_APPOINTMENT_MODULE_REPORT.md`

# Phase 1C — Appointment Module Report

## Status
Completed with regression checks. Base functionality was preserved and appointment workflow was improved without changing existing API names used by the frontend.

## Backend changes
- Strengthened appointment validation for date/time/status/type.
- Kept existing appointment CRUD endpoints intact.
- Added audit logging for:
  - appointment creation
  - appointment status changes
  - appointment edit/reschedule
  - appointment archive
- Converted delete behavior to soft archive instead of permanent delete.
- Hidden archived appointments from normal list and queue responses.
- Added cancellation reason requirement when appointment is cancelled.
- Added optional no-show reason support.
- Added reschedule tracking:
  - previous doctor/date/time
  - rescheduled timestamp
  - reschedule reason
- Improved active-slot conflict logic so archived/cancelled/no-show appointments do not block future bookings.
- Added appointment indexes for daily token lookup and doctor slot lookup.

## Frontend changes
- Added patient selector support using a datalist while preserving manual patient ID entry.
- Added cancellation reason prompt before cancelling an appointment.
- Added optional no-show note prompt.
- Added reschedule reason field when doctor/date/time changes during edit.
- Changed delete confirmation/copy to archive wording to match safer backend behavior.
- Preserved existing appointment board, queue, OPD consult, schedule, and status buttons.

## Existing functionality preserved
- Appointment create
- Appointment update
- Appointment status update
- Appointment queue
- Doctor schedule creation/edit/delete
- Doctor slot protection
- OPD consultation from appointment
- Notification creation on appointment activity
- Existing API paths used by frontend

## Tests run
- Backend syntax check passed.
- Backend route load check passed.
- QA smoke passed: 277 routes loaded.
- Frontend production build passed.

## Known warnings
- Frontend bundle is still larger than 500 KB after minification. This is not a new breakage; later phases should add code-splitting.
- Vite warning: `appointmentApi.js` is dynamically and statically imported. This does not break the build, but can be cleaned later.

## Next recommended phase
Phase 1D — Basic Billing Module.

Focus:
- OPD/lab/radiology/pharmacy bill support
- bill item validation
- payment mode/status flow
- invoice/receipt reliability
- discount reason and audit trail
- soft cancel bill instead of hard delete


## Source: `PHASE1D_BILLING_MODULE_REPORT.md`

# Phase 1D — Basic Billing Module Report

## Source Baseline
- Started from: `V48_phase1C_appointment_module.zip`
- Phase target: Billing module hardening without damaging existing Patient, Doctor, Appointment, Lab, Pharmacy, IPD or SaaS routes.

## Implemented

### Backend Billing Improvements
- Added billing payload validation for:
  - `patient_id`
  - total amount / line items
  - negative amount prevention
  - invalid payment status prevention
  - invalid payment mode prevention
  - invalid service type prevention
  - discount reason requirement when discount is applied
  - paid amount not exceeding total amount
- Added normalized invoice calculation:
  - subtotal
  - GST/tax amount
  - discount
  - total amount
  - paid amount
  - due amount
  - payment status auto-calculation
- Added patient enrichment for billing lists using patient ID / UID.
- Added tenant-aware billing collection support by including `billing` in tenant collections.
- Added active billing filter so archived invoices are hidden from normal lists and summaries.
- Added new billing routes:
  - `GET /api/billing/:id`
  - `PUT /api/billing/:id`
  - `PATCH /api/billing/:id/payment`
  - `PATCH /api/billing/:id/cancel`
  - `DELETE /api/billing/:id`
- Added soft archive instead of hard delete.
- Added cancellation reason requirement.
- Added archive reason requirement.
- Added audit logs for:
  - invoice created
  - invoice updated
  - payment updated
  - invoice cancelled
  - invoice archived
- Improved PDF invoice output with cleaner billing fields instead of dumping every raw database field.
- Revenue summary now excludes cancelled/refunded invoices.

### Billing Model Improvements
Added/standardized fields:
- `transaction_id`
- `service_type`
- `discount_reason`
- `cancel_reason`
- `cancelled_at`
- `cancelled_by`
- `is_archived`
- `archived_at`
- `archived_by`
- `archive_reason`

### Frontend Billing Improvements
- Added billing API methods for:
  - list
  - summary
  - get
  - create
  - update
  - update payment
  - cancel
  - archive
  - PDF URL
- Added billing edit permission mapping: `billingEdit`.
- Billing form now supports:
  - edit existing invoice
  - new invoice reset
  - service type
  - GST/tax
  - discount reason
  - transaction ID
  - patient dropdown retained
  - payment status retained
- Billing table now has action menu support for:
  - edit invoice
  - open PDF
  - record payment
  - cancel invoice
  - archive invoice
- Billing summary excludes cancelled/refunded invoices from revenue totals.

## Regression / Safety Checks

### Backend
- `node --check backend/src/routes/billing.routes.js`: passed
- `node --check backend/src/models/index.js`: passed
- `npm run check-routes`: passed
- `npm run qa:smoke`: passed
- Smoke result: 282 routes loaded

### Frontend
- `npm run build`: passed

## Build Notes
- Existing Vite warning still appears: main JS bundle is larger than 500kB. This existed before this phase and should be handled later with code-splitting.
- Existing React Hot Toast bundle warning still appears. It does not block production build.

## What Was Not Changed
To protect base functionality, this phase did not rewrite:
- Patient module
- Doctor module
- Appointment module
- Lab/Radiology workflow
- Pharmacy workflow
- IPD workflow
- SaaS billing module
- Authentication flow

## Recommended Next Phase
Phase 1E should be **Pharmacy Basic**:
- medicine CRUD validation
- batch/expiry-safe basic stock
- low-stock logic
- patient-linked sale
- prescription-to-pharmacy queue safety
- audit logs
- frontend action flow


## Source: `PHASE1E_PHARMACY_MODULE_REPORT.md`

# Phase 1E Pharmacy Module Report

## Baseline
Started from `V48_phase1D_billing_module.zip` and preserved the existing Phase 0–1D functionality.

## Implemented
- Added stronger medicine validation for required name, non-negative quantity/stock/prices, and valid expiry date.
- Added duplicate protection for active medicines using medicine name + batch number.
- Added pharmacy audit logs for:
  - medicine create
  - medicine update
  - medicine archive
  - stock adjustment
  - direct sale
  - prescription dispense
- Added safe soft archive for medicines instead of permanent delete.
- Added active medicine filtering so archived medicines are hidden from normal medicine, low-stock, and summary screens.
- Improved sale validation for medicine ID, quantity, and selling price.
- Kept stock reduction safety: sale and prescription dispense fail if stock is insufficient.
- Preserved low-stock notifications after stock adjustment, sale, and prescription dispense.
- Added frontend archive action for medicines with reason prompt.
- Improved recent pharmacy sales table to show cleaner sales columns.
- Added API client support for medicine archive.

## Files Changed
- `backend/src/routes/pharmacy.routes.js`
- `frontend/src/api/pharmacyApi.js`
- `frontend/src/pages/Pharmacy.jsx`

## Regression / Build Checks
- Backend syntax check: passed
- Backend route loading: passed
- QA smoke: passed, 283 routes loaded
- Frontend production build: passed

## Notes
- Frontend build still shows the existing large bundle warning. It does not break build, but later phases should add route-level code splitting.
- Pharmacy now has a safer foundation for the later advanced phase: batch-wise dispensing, FEFO, purchase order/GRN connection, returns, and controlled drug register.


## Source: `PHASE2A_OPD_EMR_WORKFLOW_REPORT.md`

# Phase 2A — OPD / EMR Complete Workflow Report

## Baseline
- Started from: `V48_phase1G_admin_user_management.zip`
- Focus: OPD consultation depth, structured EMR continuity, finalize/lock safety, auditability, and patient timeline linkage.

## Implemented

### Backend: OPD Consultation Workflow
- Added structured OPD consultation payload handling.
- Added validation for required `patient_id`/`doctor_id`, chief complaint, diagnosis/assessment, and follow-up date format.
- Added richer OPD fields:
  - Chief complaint
  - History of present illness
  - Past history
  - Medication history
  - Surgical history
  - Family history
  - Allergies
  - Vitals
  - Examination findings
  - Diagnosis / final diagnosis
  - Diagnosis code
  - Clinical notes
  - Treatment plan
  - Advice
  - Referral notes
  - Investigation orders
  - Follow-up date
- Added finalize/lock support using `is_finalized`, `locked_at`, and `finalized_by`.
- Added finalized consultation edit protection: finalized/locked records require `edit_reason` before update.
- Added soft archive for OPD consultations with required archive reason.

### Backend: OPD / EMR Linkage
- OPD consultation creation now also creates a linked SOAP-style `ClinicalRecord`.
- Patient EMR timeline now excludes archived OPD records and archived EMR records.
- EMR record deletion converted to soft archive.

### Backend: Audit Logs
- OPD registration audit added.
- OPD consultation creation audit added.
- Prescription generation audit added.
- Auto consultation bill generation audit added.
- OPD consultation update audit added.
- OPD consultation finalize audit added.
- OPD consultation archive audit added.
- Existing IPD admission/nursing/discharge actions now also create audit events.

### Backend: New/Improved Endpoints
- `GET /api/opd/consultations/:id`
- `PUT /api/opd/consultations/:id`
- `PATCH /api/opd/consultations/:id/finalize`
- `DELETE /api/opd/consultations/:id`

### Data Model
- Expanded `OpdRecord` schema definition while keeping `strict:false` compatibility.
- Added useful OPD indexes:
  - hospital + patient + visit date
  - hospital + doctor + visit date

### Frontend
- OPD consultation modal inside Appointments now captures more real clinical workflow fields:
  - History of present illness
  - Extended vitals
  - Allergies
  - Past history
  - Examination findings
  - Diagnosis code
  - Advice
  - Referral notes
- Consultation save now sends `finalize: true` so the OPD note is locked after completion.
- Button label updated to clarify finalization.
- EMR API client extended with OPD consultation read/update/finalize/archive helpers.

## Regression Tests

Passed:
- Backend route load check
- Backend QA smoke test
- Frontend production build

Results:
- Backend routes loaded successfully.
- QA smoke route inventory: 290 routes loaded.
- Frontend Vite build completed successfully.

## Notes
- Frontend build still has a large bundle warning around ~1MB JS. This is not a breaking error, but future phases should add route-level code splitting.
- The React hot-toast `use client` warning is from the package bundle and is non-blocking.

## Next Recommended Phase
Phase 2B — Patient Timeline Deepening

Recommended tasks:
- Add timeline event grouping by visit/episode.
- Add filters for OPD, prescriptions, billing, lab, radiology, IPD, documents.
- Add patient clinical summary cards directly on patient profile.
- Add direct report/prescription/bill quick actions from patient timeline.


## Source: `PHASE2B_PATIENT_TIMELINE_REPORT.md`

# Phase 2B — Patient Timeline / Medical Journey

## Baseline
Started from `V48_phase2A_opd_emr_workflow.zip`.

## Implemented
- Expanded patient timeline from basic EMR events to full patient journey.
- Added patient identity matching using `patient_id`, `patient_uid`, and numeric `id` for safer cross-module linkage.
- Added timeline support for:
  - Patient registration
  - Appointments
  - OPD consultations
  - Clinical records
  - Prescriptions
  - Billing
  - Pharmacy sales
  - Lab tests
  - Radiology tests
  - IPD admissions
  - Insurance/TPA claims
  - Nursing notes
  - Uploaded documents
- Improved archived/deleted filtering so inactive clinical or financial records are not shown in the active patient journey.
- Added pending amount summary directly from patient-linked billing records.
- Improved frontend timeline rendering with module-specific icons and detail lines.
- Removed the old 12-event display limit so profile can show the complete available timeline.
- Fixed patient document delete bug where the document array was spliced twice.
- Added audit event for patient document deletion.

## Files Changed
- `backend/src/routes/patient.routes.js`
- `frontend/src/pages/Patients.jsx`

## Regression Checks
- Backend route load: PASSED
- Backend QA smoke: PASSED — 290 routes loaded
- Frontend production build: PASSED

## Notes
- Timeline quality depends on each module storing patient references consistently. This phase made patient matching more tolerant by checking `patient_id`, `patient_uid`, and numeric `id`.
- Future Phase 2C IPD work should make admission, bed transfer, nursing, discharge and billing-clearance records more structured so the patient timeline becomes even richer.


## Source: `PHASE2C_IPD_ADMISSION_WORKFLOW_REPORT.md`

# Phase 2C — IPD / Admission Workflow Report

## Baseline
- Started from: `V48_phase2B_patient_timeline.zip`
- Scope: IPD admission workflow, bed allocation, transfer/discharge safety, nursing notes, audit logs, patient timeline continuity, and regression testing.

## Backend Changes
- Hardened `POST /api/ipd/admit` with validation for patient, consultant, bed, admission type and admission reason.
- Added active-admission guard so the same patient cannot be admitted twice while an active IPD record exists.
- Added bed availability guard so occupied/admitted beds cannot be reused.
- Admission now stores patient UID/name, consultant ID, bed ID, ward, bed number, diagnosis, admission reason and bed history.
- Bed status is automatically changed to `occupied` on admission.
- Added `GET /api/ipd` with non-archived filtering, patient/status filters, and patient/doctor/bed enrichment.
- Added `PATCH /api/ipd/:id/status` for IPD lifecycle statuses:
  - admission_requested
  - admitted
  - under_treatment
  - discharge_initiated
  - billing_pending
- Added `PATCH /api/ipd/:id/transfer-bed` with transfer reason, bed availability check, old-bed release and new-bed occupation.
- Added `POST /api/ipd/nursing-notes` with admission validation and patient linkage.
- Added `GET /api/ipd/:id/nursing-notes`.
- Hardened `POST /api/ipd/discharge` with required discharge summary and automatic bed release.
- Added `DELETE /api/ipd/:id` as safe archive instead of hard delete, with reason and bed release.
- Added/expanded audit events for admission, status update, bed transfer, nursing notes, discharge and archive.

## Frontend Changes
- Added `ipdApi` client.
- Added new IPD page/module.
- Added IPD tab in navigation.
- Added admission form with patient, consultant, available bed, admission type, admission date, diagnosis and admission reason.
- Added admission register with patient/bed/status details.
- Added action controls for:
  - status update
  - discharge initiation
  - billing pending
  - bed transfer
  - nursing note
  - discharge
  - safe archive
- Added IPD state loading in the main application.
- Added IPD permissions visibility via existing role/permission utility.
- Added IPD to enabled hospital modules so the page can appear for hospital/enterprise plans.

## Safety Notes
- Existing patient, doctor, appointment, OPD, billing, pharmacy, lab/radiology and timeline code was preserved.
- IPD archive is soft archive only.
- Discharge and archive automatically release the bed to `available`.
- Bed transfer requires a reason and blocks occupied beds.
- Patient timeline already reads IPD admissions and will continue to show admission/discharge records while archived records remain hidden.

## Tests Passed
- Backend JS syntax check: passed.
- Backend route check: passed.
- QA smoke route inventory: 294 routes loaded.
- Frontend production build: passed.

## Remaining Future Improvements
- Dedicated discharge summary PDF.
- Structured nursing chart with vitals trend.
- Medication Administration Record (MAR).
- IPD billing auto-posting for bed/doctor/nursing charges.
- Insurance pre-authorisation connection.
- Bed occupancy analytics by ward/floor.


## Source: `PHASE2E_ADVANCED_LAB_WORKFLOW_REPORT.md`

# Phase 2E — Advanced Lab Workflow Report

## Baseline
- Started from `V48_phase2D_advanced_billing_workflow.zip`.
- Existing Phase 2D billing/IPD/patient/doctor/appointment functionality preserved.

## Implemented
- Extended lab lifecycle statuses with `verified` and `rejected`.
- Added sample/result rejection workflow with mandatory reason.
- Added lab result verification endpoint before approval.
- Added critical result detection using parameter `flag: critical` or `critical_low` / `critical_high` thresholds.
- Added critical alert timestamp and lab-user entry metadata.
- Added TAT calculation on approval.
- Added lab TAT summary endpoint with:
  - total orders
  - pending orders
  - critical alerts
  - rejected samples
  - average TAT hours
- Preserved existing barcode/accession number, machine API order, report upload, approval, archive, audit and notification flows.

## Backend Routes Added/Improved
- `PATCH /api/lab/tests/:id/verify`
- `PATCH /api/lab/tests/:id/reject-sample`
- `GET /api/lab/tat-summary`
- Enhanced `PATCH /api/lab/tests/:id/status`
- Enhanced `PATCH /api/lab/tests/:id/results`
- Enhanced `PATCH /api/lab/tests/:id/approve`

## Testing
- Backend route check: passed
- QA smoke: passed — 301 routes loaded
- Frontend production build: passed

## Notes
- Frontend build required refreshing frontend dependencies after ZIP extraction because the packaged `node_modules/.bin/vite` symlink path was stale. After dependency refresh, build passed.
- Existing frontend bundle-size warning remains from earlier phases and should be handled later with code splitting.

## Next Recommended Phase
Phase 2F — Advanced Pharmacy Workflow:
- batch-wise dispensing
- FEFO expiry logic
- purchase/GRN flow
- returns/refunds
- controlled medicine audit
- stock adjustment approval


## Source: `PHASE2F_ADVANCED_PHARMACY_WORKFLOW_REPORT.md`

# Phase 2F — Advanced Pharmacy Workflow Report

## Baseline
Started from `V48_phase2E_advanced_lab_workflow.zip`.

## Implemented
- Expiry alert endpoint for near-expiry/expired medicines.
- Purchase/GRN-style stock receive endpoint.
- Sale return workflow with mandatory reason.
- Stock restoration on sale return.
- Controlled medicine register endpoint.
- Audit logs for purchase receive and sale return.
- Existing medicine CRUD, low-stock, direct sale, prescription dispense and summary flows preserved.

## New/Improved API Endpoints
- `GET /api/pharmacy/expiry-alerts?days=90`
- `POST /api/pharmacy/purchase-receive`
- `POST /api/pharmacy/sales/:id/return`
- `GET /api/pharmacy/controlled-register`

## Safety Notes
- No hard delete introduced.
- Existing stock deduction flow preserved.
- Return flow blocks duplicate full returns and requires a reason.
- Purchase receive updates an existing medicine batch or creates a new batch.
- Controlled register is metadata/category based for now; later it should become a stricter statutory register with dispensing signatures and ID capture.

## Checks
- Backend route load check: passed.
- QA smoke: 305 routes loaded.
- Frontend production build: passed.
- Build warning remains: large frontend bundle; code-splitting should be handled in a later optimization phase.

## Next Recommended Phase
Phase 3A — Authentication & Session Security.


## Source: `PHASE3A_AUTH_SESSION_SECURITY_REPORT.md`

# Phase 3A — Authentication & Session Security Report

## Baseline
Started from: `V48_phase2F_advanced_pharmacy_workflow.zip`

## Implemented

### Backend
- Added `AuthSession` model for persistent session tracking.
- Added session-aware access token payload with `session_id`.
- Added refresh-token flow with hashed refresh token storage.
- Added refresh-token rotation on each refresh.
- Added `/api/auth/logout` to revoke current session.
- Added `/api/auth/logout-all` to revoke all active sessions for current user.
- Added `/api/auth/sessions` to view recent user sessions.
- Added failed-login tracking on user records.
- Added temporary account lockout after configurable failed attempts.
- Added session revocation after password change.
- Added session revocation after password reset.
- Added password complexity option through environment flag.
- Added password-change audit/security logs.
- Added login lockout audit/security logs.

### Frontend
- Login now stores `refreshToken` when returned by backend.
- Axios client now attempts token refresh on expired access token.
- Failed refresh clears auth storage so stale sessions do not continue silently.
- Auth API now supports refresh, logout, logout-all and sessions endpoints.

## New / Updated API Endpoints
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/sessions`

## New Environment Options
```env
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_EXPIRES_IN=7d
LOGIN_LOCK_ATTEMPTS=5
LOGIN_LOCK_DURATION=15m
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_COMPLEXITY=false
```

## Regression Checks
- Backend syntax check: passed
- Backend route check: passed
- QA smoke: passed, 309 routes loaded
- Frontend production build: passed

## Notes
- Existing base flows were preserved.
- Current bundle-size warning remains from earlier phases and is not a functional blocker.
- For stricter production deployment, set `PASSWORD_REQUIRE_COMPLEXITY=true` and use a strong `JWT_SECRET`.

## Next Recommended Phase
Phase 3B — Role-Based Access Control / Permission Builder.


## Source: `PHASE3B_ROLE_BASED_ACCESS_CONTROL_REPORT.md`

# Phase 3B — Role-Based Access Control / Permission Builder Report

## Baseline
Started from: `V48_phase3A_auth_session_security.zip`

## Implemented

### Backend RBAC hardening
- Added central permission metadata:
  - `ALL_PERMISSIONS`
  - `PERMISSION_LABELS`
  - `PERMISSION_GROUPS`
  - permission catalog builder
- Added grantable-permission filtering based on the logged-in actor.
- Prevented managers from assigning custom permissions they do not personally have.
- Prevented custom permissions from duplicating the selected role's base permissions.
- Preserved role hierarchy protection:
  - `super_admin` can manage all roles.
  - `admin` cannot create/manage `super_admin`.
  - `hospital_admin` cannot create/manage platform admin roles.
- Added `/api/auth/roles` for user-management screens.
- Expanded `/api/auth/permissions` to return:
  - current role
  - effective permissions
  - role permission matrix
  - all valid permissions
  - grouped permission catalog
  - manageable roles

### User-management safety
- Create-user flow now sanitizes custom permissions by actor authority and target role.
- Update-user flow now sanitizes custom permissions by actor authority and target role.
- Users cannot manage permissions for roles above their authority.
- Existing self role/status protection remains intact.
- Existing soft deactivate behavior remains intact.

### Frontend permission builder
- Added role-aware permission catalog loading from `/auth/permissions`.
- Added custom permission selector to Add User workflow.
- Added per-user permission builder in Admin Profile user list.
- Role base permissions remain automatic; selected checkboxes store only custom override permissions.
- Added permission builder UI styling.

## Regression checks

Passed:
- Backend route load check
- QA smoke route inventory
- Frontend production build

## Route count
QA smoke detected: **310 routes**

## Notes
- Frontend bundle-size warning still exists from previous phases. It is not a functional failure. It should be handled later with code-splitting/manual chunks.
- React Hot Toast `use client` bundling warning is from dependency packaging and did not block build.

## Next recommended phase
**Phase 3C — Audit Trail Hardening**

Recommended focus:
- Patient record view audit
- Old/new value audit consistency
- Audit reason enforcement for sensitive actions
- Export/download audit
- Permission change audit details
- Audit filters and compliance-ready exports


## Source: `PHASE3C_AUDIT_TRAIL_HARDENING_REPORT.md`

# Phase 3C — Audit Trail Hardening Report

## Baseline
- Started from: `V48_phase3B_rbac_permission_builder.zip`
- Target phase: Phase 3C — Audit Trail Hardening

## Implemented

### Backend audit utility hardening
- Added automatic `changed_fields` detection when both old and new values are supplied.
- Added audit `reason` support from explicit audit payload, request body, or query string.
- Added audit `metadata` support for structured context.
- Preserved redaction of sensitive values such as passwords, tokens, reset tokens, and authorization data.

### Audit log model improvements
- Added fields:
  - `reason`
  - `changed_fields`
  - `metadata`
- Added entity timeline index for faster entity-level audit lookup.
- Added severity/date lookup index.

### Audit API improvements
- Added filters for:
  - severity
  - action
  - entity type
  - entity id
  - date range
- Added entity-specific audit endpoint:
  - `GET /api/audit-logs/entity/:entityType/:entityId`
- Audit CSV export now includes:
  - reason
  - changed fields
  - severity
- Audit export action now creates its own audit log entry.
- Security summary now includes:
  - patient record views in last 24 hours
  - export events in last 24 hours

### Patient access audit hardening
- Patient profile view now creates an audit log.
- Patient timeline view now creates an audit log.
- Patient sensitive edits now require a reason for:
  - medical notes
  - insurance provider
  - insurance policy number
  - direct document array changes
- Patient document upload now creates an audit log.
- Patient document delete now requires a reason and creates an audit log.
- Patient profile image update now creates an audit log.

### Frontend improvements
- Audit & Security page now supports extra filters:
  - severity
  - entity type
  - entity id
  - from date
  - to date
- Audit rows now show:
  - changed fields
  - reason
  - severity
- Dashboard stats now show:
  - patient views in 24h
  - exports in 24h
- Patient document deletion now asks for a deletion reason.

## Regression checks
- Backend syntax check: passed
- Backend route load check: passed
- QA smoke: passed — 311 routes loaded
- Frontend production build: passed

## Notes
- Existing frontend bundle-size warning remains. It is not a functionality failure; it should be handled later with route-level code splitting.
- Audit logging remains non-blocking by design: if audit write fails, core workflows continue.

## Next recommended phase
Phase 3D — Compliance Center / NABH-style workflow hardening.


## Source: `PHASE3D_COMPLIANCE_CENTER_HARDENING_REPORT.md`

# Phase 3D — Compliance Center Hardening Report

## Baseline
Started from: `V48_phase3C_audit_trail_hardening.zip`

## Implemented
- Added weighted compliance score logic: compliant = full score, partial = half score.
- Added incident CAPA endpoint with required root cause, corrective action and preventive action.
- Added incident evidence endpoint with attachment metadata and audit logging.
- Added checklist evidence endpoint with reviewed-by, evidence notes/URL and automatic review timestamp.
- Preserved existing consent, SOP, incident, checklist, backup and export flows.
- Preserved tenant filtering and permission requirements.

## New/Improved API endpoints
- `POST /api/compliance/incidents/:id/capa`
- `POST /api/compliance/incidents/:id/evidence`
- `POST /api/compliance/checklists/:id/evidence`
- `GET /api/compliance/summary` now includes `checklistPartial` and weighted `complianceScore`.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Frontend production build passed.

## Notes
- Evidence endpoints currently store evidence metadata/URLs. File upload integration can be connected to Cloudinary in a later document-management hardening phase.
- CAPA fields are stored on the incident document to avoid breaking existing incident UI/data flow.

## Next Recommended Phase
Phase 4A — Tenant Isolation & SaaS Safety.


## Source: `PHASE4A_TENANT_ISOLATION_SAAS_SAFETY_REPORT.md`

# Phase 4A — Tenant Isolation & SaaS Safety Report

## Baseline
Started from: `V48_phase3D_compliance_center_hardening.zip`

Previous completed phase: Phase 3D — Compliance Center Hardening.

## Goal
Improve tenant isolation and SaaS safety without harming existing hospital workflows, compliance flows, or production build stability.

## Inspection Summary
Reviewed tenant middleware, tenant-aware model wiring, SaaS/platform routes, tenant database routes, route loading, and existing tenant audit script.

### Key Tenant Isolation Risks Found
1. `x-hospital-id` / `x-tenant-hospital-id` headers could influence tenant context before strict role validation.
2. Client-supplied `hospital_id` inside create payloads could override tenant-scoped creation data.
3. Platform-level SaaS and tenant-management endpoints were permission-gated, but not consistently role-gated to `super_admin`.
4. Regression coverage existed for route wiring and tenant route usage, but not for tenant-spoofing safety behavior.

## Implemented Safely

### 1. Locked tenant context for non-super-admin users
Updated `backend/src/middleware/tenant.js`:
- Added `isSuperAdmin(req)` helper.
- Added `validPositiveId(value)` helper.
- Regular users are now pinned to the `hospital_id` in their JWT/user context.
- `x-hospital-id` / `x-tenant-hospital-id` tenant switching remains available only for `super_admin`.
- Token tenant DB is trusted only when it matches the token hospital.

### 2. Prevented create-payload tenant override
Updated `tenantCreateData(req, data)`:
- Client-provided `hospital_id` no longer overrides tenant-scoped create data.
- Created records now use the resolved safe `req.hospital_id`.
- Existing default-hospital compatibility remains preserved.

### 3. Platform-only protection for SaaS master routes
Added `allowRoles('super_admin')` to platform-wide tenant/SaaS endpoints, including:
- Tenant management routes
- Tenant database provisioning/backup routes
- SaaS overview/export routes
- SaaS billing routes
- SaaS business/onboarding routes
- Sales admin routes
- Cross-tenant subscription management routes

Public sales/marketing routes and normal tenant self-route `/tenant/me` were preserved.

### 4. Added tenant safety regression check
Added new script:
- `backend/scripts/tenant-safety-check.js`

Added npm command:
- `npm run tenant:safety-check`

This validates:
- Non-super-admin users cannot spoof tenant via headers.
- Super admin intentional tenant switching still works.
- Client `hospital_id` is ignored during tenant-scoped create payload generation.
- Platform permission assumption is safe.
- Tenant DB name sanitization is working.

## Files Changed
- `backend/src/middleware/tenant.js`
- `backend/src/routes/tenant.routes.js`
- `backend/src/routes/tenant-database.routes.js`
- `backend/src/routes/saas.routes.js`
- `backend/src/routes/saas-billing.routes.js`
- `backend/src/routes/saas-business.routes.js`
- `backend/src/routes/sales.routes.js`
- `backend/src/routes/subscription.routes.js`
- `backend/scripts/tenant-safety-check.js`
- `backend/package.json`

## Regression Checks Run

### Backend
- `npm install --no-audit --no-fund` — Passed
- `npm run check-routes` — Passed
- `npm run tenant:audit` — Passed
- `npm run tenant:safety-check` — Passed

### Frontend
- `npm install --no-audit --no-fund` — Passed
- `npm run build` — Passed

## Notes
- Frontend production build still shows the known Vite bundle-size warning. This was already noted for a later code-splitting optimization phase.
- React Hot Toast `use client` warning remains non-blocking.
- No broad model/schema rewrites were done in this phase to avoid disturbing base functionality.
- Database-per-tenant and shared-database compatibility were preserved.

## Recommended Next Phase
Phase 4B — Subscription Enforcement & Plan Limit Guardrails.


## Source: `PHASE4C_TENANT_BILLING_GUARDRAILS_PLAN_LIMITS_REPORT.md`

# Phase 4C — Tenant Billing Guardrails & Plan Limits Report

## Baseline
Started from: `V48_phase4B_tenant_admin_subscription_foundation.zip`

## Goal
Add SaaS-safe plan guardrails without harming existing HMS base functionality. Phase 4B introduced tenant lifecycle and subscription foundation; Phase 4C enforces practical tenant usage limits at high-risk create points.

## Implemented
- Added subscription guardrail output to `getHospitalSubscription()`:
  - per-limit `used`, `limit`, `remaining`, `percent`
  - `warning` when usage reaches 80%+
  - `exceeded` when usage reaches/over limit
  - `guardrails.can_create` and `guardrails.blocked_reason`
- Added current-tenant guardrail endpoint:
  - `GET /api/subscription/guardrails`
- Added super-admin tenant guardrail endpoint:
  - `GET /api/tenants/:id/subscription/guardrails`
- Added safe plan-limit enforcement on create flows:
  - Patient creation checks `patients`
  - Doctor creation checks `doctors`
  - Appointment creation checks `appointments_per_month`
  - Medicine creation checks `medicines`
  - User/admin creation limit from Phase 4B remains preserved
- Suspended/cancelled subscriptions are blocked from create flows through the shared `ensureWithinLimit()` helper.
- Added static regression script:
  - `npm run check:plan-limits`

## Safety Notes
- Existing read/list/edit/delete flows were not changed.
- Default enterprise limits are high, so normal existing usage should not be blocked.
- Limit enforcement returns HTTP `402` with subscription details so the UI can show an upgrade/limit message later.
- Tenant isolation and Phase 4A/4B safeguards remain preserved.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- Frontend production build passed.

## Commands Run
```bash
cd backend
npm install --no-audit --no-fund
npm run check-routes
npm run tenant:audit
npm run tenant:safety-check
npm run check:plan-limits

cd ../frontend
npm install --no-audit --no-fund
npm run build
```

## Known Notes
- Frontend build still shows the existing Vite bundle-size warning. This remains planned for a later code-splitting/performance phase.
- No UI changes were made in this phase to avoid disturbing base functionality; guardrail UI banners can be added in a later SaaS dashboard phase.

## Next Recommended Phase
Phase 4D — SaaS Billing UI & Tenant Usage Dashboard.

## Phase 4D — SaaS Billing UI & Tenant Usage Dashboard
- Added commercial billing dashboard cards for collection rate, collected amount, outstanding dues and invoice status summary.
- Added high-usage tenant risk panel.
- Improved current tenant usage dashboard visibility with guardrail warnings.
- Fixed SaaS lifecycle UI to call canonical lifecycle POST endpoint.
- Hardened compatibility lifecycle route to super-admin only and protected default hospital from suspension/cancellation.
- Checks passed: route load, tenant audit, tenant safety, plan limits, SaaS UI safety, frontend build.



## Phase 4E — SaaS Invoice Automation & Dunning Readiness

- Added due invoice generation endpoint.
- Added dunning scan endpoint and dunning stages.
- Added invoice automation metadata and duplicate-period guardrails.
- Added communication and audit logging for SaaS billing automation.
- Added SaaS billing automation readiness check.
- Backend route load, tenant audits, plan limits, SaaS UI check, automation check, and frontend build passed.

## Phase 4F — Payment Gateway Webhook Hardening & Invoice Reconciliation
- Added signed SaaS payment gateway webhook endpoint.
- Added webhook event persistence and idempotency protection.
- Added gateway transaction dedupe and payment intent link uniqueness guardrails.
- Added automatic invoice reconciliation from verified paid webhook events.
- Added super-admin webhook event listing and manual invoice reconciliation endpoint.
- Preserved existing invoice generation, dunning, payment link and dashboard flows.
- Checks passed: backend route load, tenant audits, plan limits, SaaS UI, SaaS billing automation, webhook reconciliation and frontend production build.


---

## Phase 4G — Payment Gateway Provider Integration & Admin Settlement Reports

### Implemented
- Payment gateway provider adapter metadata for manual gateway-ready, Razorpay, Stripe and PayU.
- Provider-aware SaaS payment links.
- Gateway fee, net amount and settlement status tracking on SaaS payments.
- SaaS settlement model and provider payout reconciliation workflow.
- Admin settlement summary/list/export endpoints.
- SaaS Control Center UI for provider readiness and settlement reports.
- Regression script: `npm run check:saas-provider-settlements`.

### Checks Passed
- Backend route load
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- SaaS UI safety check
- SaaS billing automation check
- SaaS webhook reconciliation check
- SaaS provider integration and settlement reporting check
- Frontend production build

---

## Source: `PHASE4H_SUBSCRIPTION_ANALYTICS_REVENUE_FORECASTING_CHURN_RISK_REPORT.md`

# Phase 4H — Subscription Analytics, Revenue Forecasting & Churn Risk Signals

- Added read-only super-admin subscription analytics endpoint.
- Added MRR, ARR, at-risk MRR, collection health and overdue metrics.
- Added six-month revenue forecasting.
- Added churn risk signal scoring for tenant follow-up prioritisation.
- Added frontend panels for subscription analytics and churn risk.
- Added regression guard `npm run check:saas-subscription-analytics`.
- Preserved existing SaaS billing, webhook and settlement flows.

---

# Phase 4N — Backup, Restore & Tenant Data Export Hardening

## Status
Completed.

## Summary
Closed the original Phase 4D roadmap gap by hardening tenant backup metadata, adding restore request workflow, tenant data export, export downloads and disaster recovery logs.

## Regression Check Added
- `npm run check:tenant-backup-restore-export`

## Phase 5B — Revenue & Billing Reports
- Added tenant-safe revenue and billing report endpoint.
- Added daily revenue, payment mode, service type, doctor-wise and department-wise revenue metrics.
- Added outstanding dues, insurance outstanding, discount and refund monitoring metrics.
- Added Revenue & Billing tab in Reports UI.
- Added `npm run check:phase5b-reports` regression check.

---

## Phase 6B — Nursing Module

Completed in `V48_phase6B_nursing_module.zip`.

Summary:
- Added tenant-scoped Nursing Module backend foundation.
- Added vitals charting, MAR, handovers, care plans and shift tasks.
- Added Nursing workspace in frontend.
- Added clinical permission checks and audit logging.
- Regression checks and frontend build passed.

---

# Phase 6C — Emergency / Casualty Module

Completed from baseline `V48_phase6B_nursing_module.zip`.

Summary:
- Emergency/casualty case registration foundation.
- Triage categories, triage notes, vitals/red flags and critical queue tracking.
- MLC support fields and audit-safe emergency actions.
- Emergency clinical notes and transfer/admission workflow.
- Billing link endpoint with existing billing permissions.
- Emergency dashboard and frontend Emergency tab.
- Tenant-scoped models, routes and regression check.

Checks passed:
- Full backend route, tenant, SaaS, reports, OT, nursing, emergency and frontend build checks.

## Phase 6F — Patient Portal Upgrade
- Upgraded existing Patient Portal instead of creating a duplicate portal.
- Added patient self-service workspace for profile, appointments, OPD/prescriptions, reports, bills, documents and timeline.
- Added segmented patient portal endpoints and own-data isolation guardrails.
- Added audit logging for portal view and denied patient_id override attempts.
- Added Patient Portal readiness regression check.


## Phase 8A — Automated Testing

- Baseline: `V48_phase7F_communication_integrations_upgrade.zip`
- Added automated regression test orchestration.
- Added `npm run test:regression` and `npm run test:automated`.
- Added testing documentation and release-gate guidance.
- Business logic preserved; testing layer only.

## Phase 8C — E2E Testing

- Added backend E2E readiness checks.
- Added frontend E2E contract checks.
- Documented E2E journey coverage in `docs/E2E_TESTING.md`.
- Covered login, patient, appointment, OPD/EMR, billing, lab/radiology, IPD discharge, pharmacy, Patient Portal and Doctor Portal journeys.
- Preserved existing automated regression and frontend testing harnesses.




---
# SOURCE FILE: docs/RELEASE_NOTES.md

# Release Notes

## V48 — Phase 8E Production Deployment Readiness

### Summary
This release prepares the Enterprise HMS for production deployment readiness after completing the roadmap through Phase 8D.

### Highlights
- Production deployment readiness documentation added.
- Environment checklist for Render, Vercel and MongoDB Atlas added.
- CI workflow added for backend regression and frontend build checks.
- Release checklist and rollback plan added.
- Production readiness verification scripts added for backend and frontend.

### Validation
- Backend route load check
- Automated regression harness
- Frontend regression/e2e/performance checks
- Frontend production build

### Operational notes
- Production secrets must be rotated before going live.
- MongoDB Atlas backups should be enabled before onboarding real hospitals.
- Vite bundle optimization was introduced in Phase 8D and should be monitored after deployment.




---
# SOURCE FILE: docs/ROADMAP_STATUS_AFTER_PHASE4L.md

# Roadmap Status After Phase 4L

## Current Position
The project remains on the enterprise HMS roadmap. Phase 4 was expanded with additional SaaS operations features, so this document resets the next steps back to the original roadmap sequence.

## Completed Major Phases
- Phase 0 — Project Audit & Stabilization
- Phase 1 — Core HMS Stability
- Phase 2 — Real Hospital Workflow Depth
- Phase 3 — Security, Audit & Compliance Hardening
- Phase 4A — Tenant Isolation & SaaS Safety
- Phase 4C — Subscription & Plan Control foundation and expanded billing/payment layers

## Partially Completed
- Phase 4B — Hospital Onboarding Workflow
  - Tenant/subscription foundation exists.
  - Full onboarding wizard and setup flow still pending.

## Pending Before Phase 5
1. Phase 4M — Hospital Onboarding Wizard Completion
2. Phase 4N — Backup, Restore & Tenant Data Export Hardening

## Phase 5 Start Point
After Phase 4M/4N, continue with:

### Phase 5A — Patient & Appointment Reports
- Daily registration report
- New vs repeat patients
- Department-wise patients
- Doctor-wise appointments
- No-show report
- Cancellation report
- Waiting time report

## Recommendation
Do not continue adding more SaaS operations modules until original Phase 4B and Phase 4D gaps are closed.




---
# SOURCE FILE: docs/SECURITY.md

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




---
# SOURCE FILE: docs/TESTING.md

# HMS Automated Testing Guide

## Purpose
Phase 8A formalizes the existing safety checks into a repeatable automated regression workflow. The suite is intentionally built around current project scripts so existing HMS, SaaS, report, portal and integration functionality is preserved instead of being replaced.

## Backend automated suite
Run from `backend/`:

```bash
npm run test:automated
```

This runs:

1. `npm run check-routes` — verifies backend route loading.
2. `npm run test:regression` — runs the full static/regression readiness suite across tenant safety, SaaS controls, reports, enterprise modules, portals and integrations.
3. `npm run check:phase8a-automated-testing` — verifies the automated testing harness and documentation are present.

The regression runner writes a summary file to:

```txt
backend/test-results/phase8a-regression-summary.json
```

## Frontend production build
Run from `frontend/`:

```bash
npm run build
```

The frontend build remains the required regression check for Vercel readiness. The existing bundle-size warning is known and should be handled in the later performance/code-splitting phase.

## Recommended release gate
Before creating a release ZIP, run:

```bash
cd backend
npm install
npm run test:automated
cd ../frontend
npm install
npm run build
```

## Scope covered
- Backend API route loading
- Auth/tenant isolation checks
- SaaS plan/billing/support/knowledge-base checks
- Backup/restore/export checks
- Reports and command center checks
- OT, Nursing, Emergency, Blood Bank and HR checks
- Patient and Doctor Portal checks
- FHIR, HL7, PACS/DICOM, ABDM/ABHA, ERP/Tally and Communication integration checks

## Notes
This phase does not introduce destructive test data seeding or database mutation tests. Database-connected automated tests should be added later with a dedicated test database and CI environment.

## Phase 8B — Frontend Testing

Frontend regression checks are available from the frontend project:

```bash
cd frontend
npm run test:frontend
```

The Phase 8B harness verifies frontend contracts for:
- API auth and refresh-token handling
- Forms and field typing
- Table hidden metadata and row actions
- Permission-based navigation
- Login error handling
- Patient and appointment journey basics
- Patient Portal own-data isolation UI contract
- Doctor Portal scoped access UI contract
- Critical page availability

Backend automated testing also verifies that the frontend testing harness is present:

```bash
cd backend
npm run check:phase8b-frontend-testing
npm run test:automated
```

These checks are static/contract-style checks. Browser-level journey automation is planned for Phase 8C.

## Phase 8C — E2E Testing

Phase 8C adds E2E journey readiness checks for login, patient creation, appointment booking, OPD/EMR, billing, lab/radiology, IPD discharge, pharmacy sale, Patient Portal and Doctor Portal.

Backend:

```bash
npm run check:phase8c-e2e
npm run test:automated
```

Frontend:

```bash
npm run test:e2e
npm run build
```

The Phase 8C checks are deterministic contract tests. They verify journey wiring and critical UI/API contracts without requiring a live browser or database. Full browser automation can be layered later against a seeded staging environment.




---
# SOURCE FILE: docs/V37_QA_PILOT_READINESS.md

# V37 SaaS Stabilization + QA + Pilot Readiness

## Goal
Freeze new feature expansion and verify the HMS is safe for real clinic/hospital demo and pilot usage.

## Critical QA Areas
- Authentication and CORS on deployed Vercel + Render URLs
- Tenant/hospital isolation for patients, doctors, billing, pharmacy, inventory, lab, compliance and analytics
- Role-based access for super admin, hospital admin, doctor, nurse, receptionist, pharmacist, lab staff, radiologist, billing staff, inventory manager and compliance officer
- CRUD validation on all operational modules
- Duplicate key prevention for hospital_code, doctor_id, patient_uid and auto-increment ids
- Data persistence after refresh and re-login
- Health checks, backup verification and restore dry-run

## Pilot Demo Flow
1. Create/select hospital tenant
2. Create users and assign roles
3. Register patient
4. Book appointment
5. Doctor consultation/EMR
6. Lab order and result approval
7. Pharmacy dispense with stock check
8. Billing/payment
9. Analytics review
10. Audit/compliance review

## Release Gate
Do not deploy to a pilot hospital until backend route load, frontend build, security check, backup verification and QA smoke all pass.




---
# SOURCE FILE: docs/V38_SAAS_BUSINESS_LAYER.md

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




---
# SOURCE FILE: docs/V39_SALES_DEMO_WEBSITE_READINESS.md

# V39: Sales Demo + Website Readiness

V39 turns the HMS from an internal product into a sales-ready SaaS package.

## Added

- Public marketing content API: `GET /api/public/marketing`
- Public demo request API: `POST /api/public/demo-requests`
- Protected demo request pipeline: `GET /api/sales/demo-requests`
- Lead status updates: `PATCH /api/sales/demo-requests/:id`
- Sales activity notes: `POST /api/sales/activities`
- Sales assets API: `GET /api/sales/assets`
- Frontend Sales Demo Center
- Landing page copy preview
- Pricing/package comparison
- Lead capture form
- Demo script and sales checklist
- Demo request pipeline with status changes and notes

## Suggested SaaS demo flow

1. Create a patient and upload documents.
2. Book an appointment and show the queue.
3. Add doctor consultation notes and prescription.
4. Order lab/radiology tests and approve report.
5. Dispense medicines with batch/expiry awareness.
6. Generate bill and record payment.
7. Show Command Center analytics.
8. Show compliance/audit logs.
9. Show SaaS Control Center for plans, tenants and license status.

## Website integration

A public website or landing page can connect directly to:

- `GET /api/public/marketing` for packages/highlights
- `POST /api/public/demo-requests` for demo booking forms

Required demo request fields:

- `name`
- `email`
- `organization`

Optional fields:

- `phone`
- `organization_type`
- `city`
- `staff_size`
- `interest`
- `preferred_demo_date`
- `message`
- `source`

## Sales pipeline statuses

Recommended statuses:

- `new`
- `contacted`
- `qualified`
- `demo_scheduled`
- `pilot`
- `won`
- `lost`

## Pilot readiness gate

Move a lead to pilot only after:

- Hospital size and workflow are known.
- Required modules are identified.
- Demo has been completed.
- Pilot hospital tenant is created.
- Admin user is created.
- Trial/license dates are confirmed.
- Support and training owner is assigned.




---
# SOURCE FILE: docs/V40_SECURITY_LEGAL_READINESS.md

# V40: Security + Legal Readiness

This phase prepares the HMS SaaS platform for real pilot conversations by adding the operational evidence hospitals expect before trusting a live healthcare platform.

## Added

- Legal & Security Readiness Center in the frontend.
- Privacy policy, terms, data protection, backup retention and incident response policy templates.
- Data protection request register for access, correction, deletion, export and consent withdrawal workflows.
- Security incident register with severity, containment, root cause and corrective action fields.
- Policy approval and policy acknowledgement foundation.
- Audit pack export endpoint for pilots, internal audits and enterprise due diligence.

## Backend endpoints

- `GET /api/legal-security/overview`
- `POST /api/legal-security/bootstrap-policies`
- `GET /api/legal-security/policies`
- `POST /api/legal-security/policies`
- `PATCH /api/legal-security/policies/:id/approve`
- `POST /api/legal-security/policies/:id/acknowledge`
- `GET /api/legal-security/data-requests`
- `POST /api/legal-security/data-requests`
- `PATCH /api/legal-security/data-requests/:id`
- `GET /api/legal-security/incidents`
- `POST /api/legal-security/incidents`
- `PATCH /api/legal-security/incidents/:id`
- `GET /api/legal-security/export/audit-pack`

## New collections

- `legal_policies`
- `data_requests`
- `security_incidents`
- `policy_acknowledgements`

## Pilot release gate

Before a real hospital pilot:

1. Load policy templates.
2. Review and approve policy content with your legal advisor.
3. Confirm no critical open security incidents.
4. Export the audit pack.
5. Keep backup/restore evidence from V36 available.
6. Verify tenant isolation and RBAC using V37 checklist.

## Important note

These templates are operational readiness documents. They are not a substitute for jurisdiction-specific legal advice. Before selling to hospitals, review privacy, data protection and contract documents with a qualified legal professional.




---
# SOURCE FILE: docs/V41_PILOT_HOSPITAL_DEPLOYMENT.md

# V41: Pilot Hospital Deployment

Goal: prepare the HMS for a real first hospital/clinic pilot after SaaS, sales, legal and QA readiness.

## Added
- Pilot Deployment Center UI
- Pilot deployment backend APIs
- Pilot tasks and readiness scoring
- Training/migration/go-live checklist foundation
- Hospital pilot owner, target date, stage and success criteria tracking

## Recommended pilot flow
1. Create hospital tenant and admin user.
2. Create pilot deployment record.
3. Confirm scope modules: patients, appointments, billing, pharmacy, lab, inventory as required.
4. Add tasks for configuration, data migration, staff training and go-live support.
5. Track readiness percentage before go-live.
6. Move stage from planning -> active -> live.

## Release gate
Do not start a paid rollout until:
- tenant isolation is verified
- backup/restore is tested
- staff training is completed
- billing flow is verified
- support contact and escalation process are agreed




---
# SOURCE FILE: docs/V42_CONFIGURATION_ENGINE_DEEP_FIX.md

# V42 Configuration Engine Deep Fix

## Goal
Make the Configuration section operational instead of UI-only. This phase connects dynamic fields and document templates to the real Patient/Doctor workflows and adds clear success/error notifications.

## Delivered

### Dynamic Fields
- Dynamic fields can be created, edited, toggled active/inactive, deleted and listed.
- Created fields refresh immediately in Configuration and supported forms.
- Patient form renders active patient dynamic fields.
- Doctor form renders active doctor dynamic fields.
- Custom field values are stored in `custom_fields` on Patient and Doctor records.
- Edit forms prefill saved custom field values.
- Patient/Doctor profiles show saved custom fields.
- Backend validates required dynamic fields.
- Backend validates numeric dynamic fields.
- Backend validates select/dropdown options.
- Dynamic fields remain tenant/hospital isolated using the existing tenant middleware.

### Notifications
- Added toast notifications for field create/update/delete/toggle.
- Added toast notifications for template create/update/delete/preview.
- Patient and Doctor save flows continue to show success/error notifications.
- Backend validation errors are shown clearly in the UI.

### Templates
- Template create/edit/delete already existed and now has toast feedback.
- Added template preview API.
- Added template preview UI inside Configuration.
- Preview replaces template variables such as `{{patient_name}}`, `{{doctor_name}}`, `{{hospital_name}}`, `{{invoice_number}}`, `{{total_amount}}`, `{{paid_amount}}`, `{{diagnosis}}`, `{{prescription_items}}`, and `{{report_notes}}`.

## APIs Added / Updated

### Configuration
- `GET /api/configuration/dynamic-fields`
- `GET /api/configuration/public-fields`
- `POST /api/configuration/dynamic-fields`
- `PUT /api/configuration/dynamic-fields/:id`
- `PATCH /api/configuration/dynamic-fields/:id/status`
- `DELETE /api/configuration/dynamic-fields/:id`

### Templates
- `POST /api/templates/:id/preview`

### Patient / Doctor
- Patient create/update supports `custom_fields`.
- Doctor create/update supports `custom_fields`.

## Manual QA Checklist

### Dynamic Field Test
1. Open Configuration.
2. Create a patient field:
   - Module: Patients
   - Label: ABHA ID
   - Field Key: abha_id
   - Type: Text
   - Active: Yes
3. Confirm success toast appears.
4. Confirm the field appears in Configured Fields.
5. Open Patients.
6. Confirm ABHA ID appears under Additional Details.
7. Save a patient with ABHA ID.
8. Edit that patient and confirm ABHA ID is prefilled.
9. Open patient profile and confirm ABHA ID is visible.

### Required Validation Test
1. Create a required patient field.
2. Try saving a patient without filling it.
3. Confirm the backend error is shown in toast.

### Select Options Test
1. Create a select field:
   - Label: Insurance Type
   - Options: Private, Corporate, Government, Self Pay
2. Confirm dropdown options appear in Patients.
3. Save and edit to confirm value persists.

### Doctor Custom Field Test
1. Create a doctor field:
   - Label: Medical Council Registration No.
   - Field Key: medical_council_registration_no
2. Confirm it appears in Add Doctor/Edit Doctor.
3. Save and confirm it appears in Doctor Profile.

### Template Preview Test
1. Create an invoice template.
2. Use variables like `{{patient_name}}` and `{{total_amount}}`.
3. Use the Preview action.
4. Confirm preview text renders sample values.

## Release Notes
- No `.env`, `node_modules`, or `dist` should be shipped.
- Keep `package.json`, `package-lock.json`, and `.env.example` included.




---
# SOURCE FILE: docs/V43_1_TENANT_ISOLATION_VERIFICATION.md

# V43.1 Tenant Isolation Verification + Route Hardening

## Goal

V43 introduced the safe hybrid master DB + tenant DB architecture. V43.1 verifies and hardens route-by-route tenant isolation without deleting or force-migrating existing data.

## What changed

- Command Center analytics now run inside the resolved tenant database context.
- Legal/Security request and incident registers now use tenant context.
- Pilot deployment tracking now uses tenant context for hospital-admin scoped views.
- Tenant-aware model list now includes legal/security and pilot collections.
- Added `npm run tenant:audit` to check that operational routes are wired with tenant middleware and tenant helpers.

## Safety model

- Existing shared DB data is preserved.
- Hospitals with `tenant_db_name` use their own database.
- Hospitals without `tenant_db_name` continue to use shared DB fallback.
- No automatic destructive migration runs during app startup.
- Migration remains explicit through scripts/APIs.

## Manual verification checklist

### Hospital A / Hospital B conflict test

1. Create Hospital A with tenant DB.
2. Create Hospital B with tenant DB.
3. Login or switch to Hospital A.
4. Add patient with `patient_id = 001`.
5. Login or switch to Hospital B.
6. Add patient with `patient_id = 001`.
7. Both should save successfully because databases are separate.
8. Hospital A should not see Hospital B patient.
9. Hospital B should not see Hospital A patient.

### Operational module isolation

Verify these modules from two different hospitals:

- Patients
- Doctors
- Appointments
- OPD/IPD
- Billing
- Pharmacy
- Inventory
- Lab/Radiology
- Compliance
- Configuration dynamic fields/templates
- Command Center analytics
- Legal/Security registers
- Pilot Deployment

Expected result: each hospital sees only its own tenant DB data.

### Super admin tenant switching

1. Login as super admin.
2. Select/switch a tenant or use tenant DB header/tooling.
3. Verify selected tenant data appears.
4. Switch to another tenant.
5. Verify previous tenant data disappears and new tenant data appears.

### Backup verification

1. Queue backup for Hospital A.
2. Confirm backup record shows Hospital A tenant DB name.
3. Queue backup for Hospital B.
4. Confirm backup record shows Hospital B tenant DB name.
5. Verify records do not overwrite each other.

## Scripts

```bash
cd backend
npm run tenant:audit
npm run check-routes
npm run qa:smoke
npm run fix-tenant-indexes
```

## Important production note

Do not manually drop global indexes in Atlas without running the provided safe index script and taking a backup first. For shared fallback collections, duplicate prevention should be hospital-scoped. For tenant databases, duplicate IDs are independent per database.




---
# SOURCE FILE: docs/V43_TENANT_DATABASE_ISOLATION_BACKUP.md

# V43: Tenant Database Isolation + Backup Architecture

## Goal
V43 moves the HMS toward a safer SaaS architecture where every new hospital, clinic, lab, diagnostic center, or nursing home can receive its own MongoDB database while existing shared-database deployments continue to work.

This is a hybrid/no-data-loss migration design:

- Existing hospitals without `tenant_db_name` continue using the current shared database.
- New hospitals created from SaaS onboarding receive a separate tenant database by default.
- Existing hospitals can be provisioned/migrated one by one.
- Shared DB records are copied during migration; they are not deleted unless the operator explicitly passes `--delete-source=true`.

## Architecture

### Master database
The existing database remains the master SaaS database for platform records:

- hospitals
- users
- SaaS plans
- subscriptions
- SaaS invoices/payments
- sales/demo requests
- pilot deployments
- tenant backup registry

### Tenant databases
Hospital operational data is routed to the tenant database when a hospital has `tenant_db_name` set:

- patients
- doctors
- appointments
- beds/IPD/OPD
- billing/payments
- pharmacy/inventory
- lab/radiology
- compliance
- audit logs
- templates/configuration
- integrations/webhooks

Example:

```txt
Master DB: hms_secure
Tenant DB: hms_tenant_city_hospital
Tenant DB: hms_tenant_prime_lab
Tenant DB: hms_tenant_green_clinic
```

## Why this fixes duplicate IDs
Earlier, a global unique index such as `patients.patient_id` caused this issue:

```txt
Hospital A patient_id = 001
Hospital B patient_id = 001
E11000 duplicate key error
```

V43 fixes this in two ways:

1. Tenant DBs store each hospital's patients in separate databases.
2. Shared fallback mode uses compound indexes such as:

```txt
hospital_id + patient_id
hospital_id + doctor_id
```

So the same patient ID can exist in different hospitals, while duplicates inside the same hospital are still blocked.

## New backend files

```txt
backend/src/config/tenantDb.js
backend/src/routes/tenant-database.routes.js
backend/scripts/fix-tenant-indexes.js
backend/scripts/provision-tenant-db.js
backend/scripts/migrate-shared-to-tenant.js
```

## New APIs

```txt
GET  /api/tenant-databases/overview
POST /api/tenant-databases/:hospitalId/provision
POST /api/tenant-databases/:hospitalId/backup
GET  /api/tenant-databases/backups
POST /api/tenant-databases/backups/:id/verify
```

These are restricted to users with `hospital.manage` permission.

## New frontend behavior

SaaS Control Center now includes:

- Tenant database isolation summary
- Isolated/shared tenant status
- Provision tenant DB button
- Backup now button
- Recent backup queue/status
- Backup verification button
- Onboarding checkbox: create separate tenant database

## Required production note
`mongodump` must be installed on the backend server for live backup execution. If Render does not include `mongodump`, either:

1. Use a Docker image that includes MongoDB Database Tools, or
2. Run scheduled backups from GitHub Actions/VPS, or
3. Use MongoDB Atlas backups plus this app-level registry.

## Safe migration steps for existing hospitals

### 1. Fix old global unique indexes

```bash
cd backend
npm run fix-tenant-indexes
```

### 2. Provision tenant DB for a hospital

```bash
npm run tenant:provision -- HOSP001
```

### 3. Copy shared DB data into the tenant DB without deleting source

```bash
npm run tenant:migrate -- HOSP001
```

### 4. Verify tenant login and module data

Log in as that hospital admin and verify:

- patients
- doctors
- appointments
- billing
- pharmacy
- lab/radiology
- inventory
- compliance

### 5. Optional source cleanup after verification

Only after backup and manual verification:

```bash
npm run tenant:migrate -- HOSP001 --delete-source=true
```

## No-data-loss policy
V43 does not automatically delete old shared data. Migration copies data first and keeps the old source records unless you explicitly opt into source deletion.

## Testing completed in build

- Backend dependency install
- Backend route load
- Backend QA smoke
- Frontend dependency install
- Frontend production build
- Clean zip verification





---
# SOURCE FILE: docs/V44_FIX_REPORT.md

# V44 Fix Report

## Summary
V44 is a targeted stability patch based on v43. The goal was to fix backend/frontend/database-facing errors without changing the existing HMS functionality or rewriting modules.

## Fixed

### 1. Patient upload Cloudinary crash
Fixed the broken Cloudinary import in `backend/src/routes/patient.routes.js`.

Old behavior could cause:

```txt
Cannot read properties of undefined (reading 'upload_stream')
```

Patient document upload and patient profile image upload now safely support:
- Cloudinary storage when Cloudinary environment variables are configured.
- MongoDB data URL fallback when Cloudinary is not configured.

### 2. Tenant logo Cloudinary crash
Fixed the same broken Cloudinary import in `backend/src/routes/tenant.routes.js`.

Tenant/hospital logo upload now safely supports:
- Cloudinary storage when configured.
- MongoDB data URL fallback when not configured.

### 3. Safe Cloudinary cleanup
Added safe destroy helpers so deleting/replacing files does not crash if Cloudinary is not configured.

### 4. Patient duplicate ID handling
Patient create/update now checks duplicate `patient_id` inside the current hospital/tenant before saving.

Instead of a raw MongoDB E11000 error, API returns a clean 409 response:

```txt
Patient ID already exists in this hospital. Please use a different Patient ID.
```

### 5. Doctor duplicate ID handling
Doctor create now checks duplicate `doctor_id` inside the current hospital/tenant before saving.

Instead of a raw MongoDB E11000 error, API returns a clean 409 response.

### 6. Patient update response improved
Patient update now returns the updated patient object and validates duplicate IDs before saving.

## Verified

Backend:

```bash
npm run check-routes
```

Result:

```txt
Backend routes loaded successfully.
```

Frontend:

```bash
npm run build
```

Result:

```txt
✓ built
```

## Notes
- No major module rewrite was done.
- Existing routes and modules were preserved.
- This patch focuses on breaking errors, upload reliability, and duplicate ID stability.
- For live deployment, confirm Render environment variables:
  - `MONGODB_URI`
  - `JWT_SECRET`
  - `FRONTEND_URL`
  - Optional Cloudinary vars: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`




---
# SOURCE FILE: docs/V45_REAL_FIX_REPORT.md

# V45 Real Fix Pass

This V45 package is rebuilt after re-checking the screenshots and the previous incomplete patch.

## Frontend fixes applied
- Rebuilt Command Center to render real operational widgets using safe fallbacks from dashboard, patients, doctors, appointments, beds, billing, lab, pharmacy and audit APIs. It no longer stays blank when advanced analytics endpoints are empty or restricted.
- Fixed Patient Portal admin/staff UX by auto-selecting the first patient when staff/admin opens the page, while still keeping login auto-link for patient role.
- Fixed Doctor Portal admin/staff UX by auto-selecting the first doctor when staff/admin opens the page, while still keeping login auto-link for doctor role.
- Improved Billing into a usable invoice page: patient dropdown, invoice number, consultation/lab/medicine charges, total, discount, paid amount, due amount, payment mode, transaction ID, summary cards and better billing register columns.
- Improved Beds module with correct bed statuses and client-side duplicate ward + bed number protection before submit.
- Fixed inventory hero text contrast with a readable gradient style.
- Added global responsive table hardening for Lab/Radiology and other wide tables.
- Improved Production Ops readability using grid spacing and wrapping rules.
- Added UI hardening for empty states, labels, responsive forms, command center cards, invoice cards and portal selectors.
- Adjusted permissions/module mapping so admin/hospital admin can access Command Center analytics and key platform pages are not hidden unexpectedly by mismatched module IDs.

## Backend checks
- Backend route loading test passed.
- Existing backend functionality was not removed or rewritten.

## Frontend checks
- Frontend production build passed.

## Notes
Deep future work still recommended: full billing ledger/accounting, inventory accounting automation, complete role-permission matrix UI, real backup execution/restore UI, and automated smoke tests against a live MongoDB Atlas database.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE0_AUDIT_AND_FIX_REPORT.md

# Phase 0 Audit & Stabilization Report - V48 HMS

## Checks completed

- Backend JavaScript syntax check: PASS
- Backend route load check: PASS
- Backend QA smoke route inventory: PASS, 276 routes loaded
- Frontend production build: PASS
- Backend security-check without env: FAIL as expected because local `.env` is not configured

## Fixes applied in this Phase 0 pass

### 1. CORS configuration improved
File: `backend/src/server.js`

`CORS_EXTRA_ORIGINS` from `.env.example` was present but not used in the server. It is now included with `FRONTEND_URL`, so extra Vercel/custom domains can be added safely without replacing the main frontend URL.

### 2. Production error response hardened
File: `backend/src/middleware/errorHandler.js`

The error handler now returns a standard error shape with `success:false`. In production, internal 500 error messages are hidden and stack traces are not exposed.

### 3. Forgot password flow made safer
File: `backend/src/routes/auth.routes.js`

The reset token is no longer returned in production responses. It is still returned only in non-production environments for development/testing until SMTP is configured.

### 4. Change password validation added
File: `backend/src/routes/auth.routes.js`

`/api/auth/change-password` now validates the new password against `PASSWORD_MIN_LENGTH` before saving.

## Important findings

### Frontend status
Frontend builds successfully, but Vite reports a large bundle warning:

- Main JS bundle: about 1.06 MB before gzip
- Recommendation: split advanced pages with lazy loading after core modules are stable

### Backend status
Backend routes load successfully and critical routes are present. This means there is no immediate route import crash.

### Environment status
The security check currently fails locally because these required variables are missing:

- `MONGODB_URI`
- `JWT_SECRET`
- `FRONTEND_URL`

This is expected unless `.env` is configured locally or Render env variables are configured.

### Database runtime status
A real DB connection test was not completed because no real MongoDB Atlas URI was provided in the uploaded ZIP. To verify runtime fully, configure `.env` and run:

```bash
cd backend
npm run check-db
npm run seed
npm run security-check
npm run qa:smoke
```

## Phase 0 remaining tasks

### Critical

1. Configure backend `.env`
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `JWT_SECRET` with at least 32 random characters
   - `FRONTEND_URL` with live Vercel URL
   - `CORS_EXTRA_ORIGINS` if multiple domains are used

2. Configure frontend `.env`
   - `VITE_API_URL=https://your-render-backend.onrender.com/api`

3. Run live backend checks
   - `npm run check-db`
   - `npm run seed`
   - `npm run security-check`
   - `npm run qa:smoke`

4. Login test
   - Verify seeded admin can log in
   - Verify token is stored
   - Verify `/api/auth/me` works

5. Basic module API test
   - Patients list/create
   - Doctors list/create
   - Appointments list/create
   - Billing list/create
   - Pharmacy medicines list/create
   - Lab templates list/create

### High priority

1. Add request validation layer for important modules.
2. Reduce frontend bundle size using lazy loading.
3. Replace hard deletes with soft deletes in sensitive modules.
4. Standardize API response format across all routes.
5. Add a stable manual test checklist for every core module.

## Recommended next step

Continue Phase 0 with live environment verification. After DB, auth, seed, and login are confirmed, move to Phase 1A: Patient module stabilization.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE1A_PATIENT_MODULE_REPORT.md

# Phase 1A - Patient Module Stabilization Report

## Scope completed
This update starts Phase 1 with the Patient module because it is the base dependency for appointments, OPD/EMR, lab, radiology, pharmacy, billing, and IPD.

## Backend changes
- Added patient payload validation for:
  - full name
  - age range
  - gender enum
  - email format
  - phone format
  - emergency phone format
  - blood group enum
- Added normalization for:
  - phone spacing
  - lowercase email
  - lowercase gender
  - uppercase blood group
- Added active patient filtering so archived patients no longer appear in normal patient lists or profiles.
- Converted patient delete into soft-delete/archive using `status`, `deleted_at`, and `deleted_by`.
- Added patient create/update audit events.
- Added duplicate warning support using patient ID, phone, email, and name+age+gender matching.
- Added `GET /api/patients/duplicate-check` endpoint.
- Kept strict duplicate blocking for same `patient_id` inside the same hospital/tenant.
- Added active-patient checks for profile, timeline, document upload, profile image upload, and document delete.
- Added patient schema fields for `status`, `deleted_at`, and `deleted_by`.

## Frontend changes
- Patient delete UI now shows archive wording instead of hard delete wording.
- Patient document upload no longer requires manual Patient ID before selecting a file. This supports auto-generated/backend patient IDs.
- Create/update patient flow now surfaces duplicate warning toast when the backend detects possible duplicate patients.
- Added patient document delete API method.
- Patient profile document list now supports deleting saved documents.
- Document list keys made safer for records that do not have a frontend-only `id`.

## Validation / checks run
- Backend route loading: PASS
- Backend QA smoke inventory: PASS
- Routes loaded: 277
- Frontend production build: PASS

## Build warnings still present
- Frontend JS bundle is over 500KB. This is not a blocker, but Phase 0/Phase 1 technical debt remains: future code-splitting is recommended.
- Vite warning about `appointmentApi.js` being both dynamically and statically imported remains. This is not caused by the patient module change.

## Remaining Phase 1A improvements recommended next
- Add patient merge workflow for true duplicate resolution.
- Add patient record view audit logging.
- Add patient search API with server-side pagination for large hospitals.
- Add restore archived patient endpoint for admin users.
- Add patient category: cash, insurance, corporate, government scheme, panel.
- Add guardian/family contact structure.
- Add patient consent links to the profile.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE1B_DOCTOR_MODULE_REPORT.md

# Phase 1B — Doctor Module Stabilization Report

## Scope
Phase 1B focused on making the Doctor module safer and closer to enterprise HMS requirements without changing the overall architecture.

## Completed Improvements

### Backend
- Added doctor payload validation for required Doctor ID and full name.
- Added email format validation.
- Added phone format validation.
- Added consultation fee validation as a non-negative number.
- Added department ID numeric validation.
- Added controlled doctor status values: `active`, `inactive`, `on_leave`, `archived`.
- Added duplicate Doctor ID protection per hospital/tenant.
- Added duplicate warning support for doctor phone/email matches.
- Changed doctor delete into soft archive instead of permanent delete.
- Doctor list now hides archived doctors by default.
- Added `include_archived=true` support for admin recovery/audit views.
- Added audit logs for:
  - doctor created
  - doctor updated
  - doctor archived
  - doctor profile image uploaded
  - doctor document uploaded
  - doctor document deleted
- Added doctor schema fields for archive metadata:
  - `deleted_at`
  - `deleted_by`

### Frontend
- Updated doctor delete success message to show archive behavior.
- Existing doctor profile image upload flow remains working.
- Existing doctor document upload/delete flow remains working.
- Existing doctor profile page remains compatible.

## Validation / Test Results

### Backend
- `npm run check-routes`: passed
- `npm run qa:smoke`: passed
- QA smoke route inventory: 277 routes loaded

### Frontend
- `npm run build`: passed

### Known Build Warning
- Frontend JS bundle is still larger than 500 KB after minification.
- This is not blocking, but Phase 8 or later should add route-level code splitting/manual chunks.

## Files Changed
- `backend/src/routes/core.routes.js`
- `backend/src/models/index.js`
- `frontend/src/main.jsx`

## Enterprise HMS Impact
This phase makes Doctor management safer for production by preventing bad doctor records, protecting against accidental permanent deletion, and creating an audit trail around doctor profile changes.

## Recommended Next Phase
Start **Phase 1C: Appointment Module**.

Priority items:
1. Appointment validation
2. Appointment status lifecycle
3. Double-booking prevention
4. Token number generation
5. Reschedule/cancel reason support
6. Queue stability
7. Appointment audit logs




---
# SOURCE FILE: docs/archive/phase-reports/PHASE1C_APPOINTMENT_MODULE_REPORT.md

# Phase 1C — Appointment Module Report

## Status
Completed with regression checks. Base functionality was preserved and appointment workflow was improved without changing existing API names used by the frontend.

## Backend changes
- Strengthened appointment validation for date/time/status/type.
- Kept existing appointment CRUD endpoints intact.
- Added audit logging for:
  - appointment creation
  - appointment status changes
  - appointment edit/reschedule
  - appointment archive
- Converted delete behavior to soft archive instead of permanent delete.
- Hidden archived appointments from normal list and queue responses.
- Added cancellation reason requirement when appointment is cancelled.
- Added optional no-show reason support.
- Added reschedule tracking:
  - previous doctor/date/time
  - rescheduled timestamp
  - reschedule reason
- Improved active-slot conflict logic so archived/cancelled/no-show appointments do not block future bookings.
- Added appointment indexes for daily token lookup and doctor slot lookup.

## Frontend changes
- Added patient selector support using a datalist while preserving manual patient ID entry.
- Added cancellation reason prompt before cancelling an appointment.
- Added optional no-show note prompt.
- Added reschedule reason field when doctor/date/time changes during edit.
- Changed delete confirmation/copy to archive wording to match safer backend behavior.
- Preserved existing appointment board, queue, OPD consult, schedule, and status buttons.

## Existing functionality preserved
- Appointment create
- Appointment update
- Appointment status update
- Appointment queue
- Doctor schedule creation/edit/delete
- Doctor slot protection
- OPD consultation from appointment
- Notification creation on appointment activity
- Existing API paths used by frontend

## Tests run
- Backend syntax check passed.
- Backend route load check passed.
- QA smoke passed: 277 routes loaded.
- Frontend production build passed.

## Known warnings
- Frontend bundle is still larger than 500 KB after minification. This is not a new breakage; later phases should add code-splitting.
- Vite warning: `appointmentApi.js` is dynamically and statically imported. This does not break the build, but can be cleaned later.

## Next recommended phase
Phase 1D — Basic Billing Module.

Focus:
- OPD/lab/radiology/pharmacy bill support
- bill item validation
- payment mode/status flow
- invoice/receipt reliability
- discount reason and audit trail
- soft cancel bill instead of hard delete




---
# SOURCE FILE: docs/archive/phase-reports/PHASE1D_BILLING_MODULE_REPORT.md

# Phase 1D — Basic Billing Module Report

## Source Baseline
- Started from: `V48_phase1C_appointment_module.zip`
- Phase target: Billing module hardening without damaging existing Patient, Doctor, Appointment, Lab, Pharmacy, IPD or SaaS routes.

## Implemented

### Backend Billing Improvements
- Added billing payload validation for:
  - `patient_id`
  - total amount / line items
  - negative amount prevention
  - invalid payment status prevention
  - invalid payment mode prevention
  - invalid service type prevention
  - discount reason requirement when discount is applied
  - paid amount not exceeding total amount
- Added normalized invoice calculation:
  - subtotal
  - GST/tax amount
  - discount
  - total amount
  - paid amount
  - due amount
  - payment status auto-calculation
- Added patient enrichment for billing lists using patient ID / UID.
- Added tenant-aware billing collection support by including `billing` in tenant collections.
- Added active billing filter so archived invoices are hidden from normal lists and summaries.
- Added new billing routes:
  - `GET /api/billing/:id`
  - `PUT /api/billing/:id`
  - `PATCH /api/billing/:id/payment`
  - `PATCH /api/billing/:id/cancel`
  - `DELETE /api/billing/:id`
- Added soft archive instead of hard delete.
- Added cancellation reason requirement.
- Added archive reason requirement.
- Added audit logs for:
  - invoice created
  - invoice updated
  - payment updated
  - invoice cancelled
  - invoice archived
- Improved PDF invoice output with cleaner billing fields instead of dumping every raw database field.
- Revenue summary now excludes cancelled/refunded invoices.

### Billing Model Improvements
Added/standardized fields:
- `transaction_id`
- `service_type`
- `discount_reason`
- `cancel_reason`
- `cancelled_at`
- `cancelled_by`
- `is_archived`
- `archived_at`
- `archived_by`
- `archive_reason`

### Frontend Billing Improvements
- Added billing API methods for:
  - list
  - summary
  - get
  - create
  - update
  - update payment
  - cancel
  - archive
  - PDF URL
- Added billing edit permission mapping: `billingEdit`.
- Billing form now supports:
  - edit existing invoice
  - new invoice reset
  - service type
  - GST/tax
  - discount reason
  - transaction ID
  - patient dropdown retained
  - payment status retained
- Billing table now has action menu support for:
  - edit invoice
  - open PDF
  - record payment
  - cancel invoice
  - archive invoice
- Billing summary excludes cancelled/refunded invoices from revenue totals.

## Regression / Safety Checks

### Backend
- `node --check backend/src/routes/billing.routes.js`: passed
- `node --check backend/src/models/index.js`: passed
- `npm run check-routes`: passed
- `npm run qa:smoke`: passed
- Smoke result: 282 routes loaded

### Frontend
- `npm run build`: passed

## Build Notes
- Existing Vite warning still appears: main JS bundle is larger than 500kB. This existed before this phase and should be handled later with code-splitting.
- Existing React Hot Toast bundle warning still appears. It does not block production build.

## What Was Not Changed
To protect base functionality, this phase did not rewrite:
- Patient module
- Doctor module
- Appointment module
- Lab/Radiology workflow
- Pharmacy workflow
- IPD workflow
- SaaS billing module
- Authentication flow

## Recommended Next Phase
Phase 1E should be **Pharmacy Basic**:
- medicine CRUD validation
- batch/expiry-safe basic stock
- low-stock logic
- patient-linked sale
- prescription-to-pharmacy queue safety
- audit logs
- frontend action flow




---
# SOURCE FILE: docs/archive/phase-reports/PHASE1E_PHARMACY_MODULE_REPORT.md

# Phase 1E Pharmacy Module Report

## Baseline
Started from `V48_phase1D_billing_module.zip` and preserved the existing Phase 0–1D functionality.

## Implemented
- Added stronger medicine validation for required name, non-negative quantity/stock/prices, and valid expiry date.
- Added duplicate protection for active medicines using medicine name + batch number.
- Added pharmacy audit logs for:
  - medicine create
  - medicine update
  - medicine archive
  - stock adjustment
  - direct sale
  - prescription dispense
- Added safe soft archive for medicines instead of permanent delete.
- Added active medicine filtering so archived medicines are hidden from normal medicine, low-stock, and summary screens.
- Improved sale validation for medicine ID, quantity, and selling price.
- Kept stock reduction safety: sale and prescription dispense fail if stock is insufficient.
- Preserved low-stock notifications after stock adjustment, sale, and prescription dispense.
- Added frontend archive action for medicines with reason prompt.
- Improved recent pharmacy sales table to show cleaner sales columns.
- Added API client support for medicine archive.

## Files Changed
- `backend/src/routes/pharmacy.routes.js`
- `frontend/src/api/pharmacyApi.js`
- `frontend/src/pages/Pharmacy.jsx`

## Regression / Build Checks
- Backend syntax check: passed
- Backend route loading: passed
- QA smoke: passed, 283 routes loaded
- Frontend production build: passed

## Notes
- Frontend build still shows the existing large bundle warning. It does not break build, but later phases should add route-level code splitting.
- Pharmacy now has a safer foundation for the later advanced phase: batch-wise dispensing, FEFO, purchase order/GRN connection, returns, and controlled drug register.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE2A_OPD_EMR_WORKFLOW_REPORT.md

# Phase 2A — OPD / EMR Complete Workflow Report

## Baseline
- Started from: `V48_phase1G_admin_user_management.zip`
- Focus: OPD consultation depth, structured EMR continuity, finalize/lock safety, auditability, and patient timeline linkage.

## Implemented

### Backend: OPD Consultation Workflow
- Added structured OPD consultation payload handling.
- Added validation for required `patient_id`/`doctor_id`, chief complaint, diagnosis/assessment, and follow-up date format.
- Added richer OPD fields:
  - Chief complaint
  - History of present illness
  - Past history
  - Medication history
  - Surgical history
  - Family history
  - Allergies
  - Vitals
  - Examination findings
  - Diagnosis / final diagnosis
  - Diagnosis code
  - Clinical notes
  - Treatment plan
  - Advice
  - Referral notes
  - Investigation orders
  - Follow-up date
- Added finalize/lock support using `is_finalized`, `locked_at`, and `finalized_by`.
- Added finalized consultation edit protection: finalized/locked records require `edit_reason` before update.
- Added soft archive for OPD consultations with required archive reason.

### Backend: OPD / EMR Linkage
- OPD consultation creation now also creates a linked SOAP-style `ClinicalRecord`.
- Patient EMR timeline now excludes archived OPD records and archived EMR records.
- EMR record deletion converted to soft archive.

### Backend: Audit Logs
- OPD registration audit added.
- OPD consultation creation audit added.
- Prescription generation audit added.
- Auto consultation bill generation audit added.
- OPD consultation update audit added.
- OPD consultation finalize audit added.
- OPD consultation archive audit added.
- Existing IPD admission/nursing/discharge actions now also create audit events.

### Backend: New/Improved Endpoints
- `GET /api/opd/consultations/:id`
- `PUT /api/opd/consultations/:id`
- `PATCH /api/opd/consultations/:id/finalize`
- `DELETE /api/opd/consultations/:id`

### Data Model
- Expanded `OpdRecord` schema definition while keeping `strict:false` compatibility.
- Added useful OPD indexes:
  - hospital + patient + visit date
  - hospital + doctor + visit date

### Frontend
- OPD consultation modal inside Appointments now captures more real clinical workflow fields:
  - History of present illness
  - Extended vitals
  - Allergies
  - Past history
  - Examination findings
  - Diagnosis code
  - Advice
  - Referral notes
- Consultation save now sends `finalize: true` so the OPD note is locked after completion.
- Button label updated to clarify finalization.
- EMR API client extended with OPD consultation read/update/finalize/archive helpers.

## Regression Tests

Passed:
- Backend route load check
- Backend QA smoke test
- Frontend production build

Results:
- Backend routes loaded successfully.
- QA smoke route inventory: 290 routes loaded.
- Frontend Vite build completed successfully.

## Notes
- Frontend build still has a large bundle warning around ~1MB JS. This is not a breaking error, but future phases should add route-level code splitting.
- The React hot-toast `use client` warning is from the package bundle and is non-blocking.

## Next Recommended Phase
Phase 2B — Patient Timeline Deepening

Recommended tasks:
- Add timeline event grouping by visit/episode.
- Add filters for OPD, prescriptions, billing, lab, radiology, IPD, documents.
- Add patient clinical summary cards directly on patient profile.
- Add direct report/prescription/bill quick actions from patient timeline.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE2B_PATIENT_TIMELINE_REPORT.md

# Phase 2B — Patient Timeline / Medical Journey

## Baseline
Started from `V48_phase2A_opd_emr_workflow.zip`.

## Implemented
- Expanded patient timeline from basic EMR events to full patient journey.
- Added patient identity matching using `patient_id`, `patient_uid`, and numeric `id` for safer cross-module linkage.
- Added timeline support for:
  - Patient registration
  - Appointments
  - OPD consultations
  - Clinical records
  - Prescriptions
  - Billing
  - Pharmacy sales
  - Lab tests
  - Radiology tests
  - IPD admissions
  - Insurance/TPA claims
  - Nursing notes
  - Uploaded documents
- Improved archived/deleted filtering so inactive clinical or financial records are not shown in the active patient journey.
- Added pending amount summary directly from patient-linked billing records.
- Improved frontend timeline rendering with module-specific icons and detail lines.
- Removed the old 12-event display limit so profile can show the complete available timeline.
- Fixed patient document delete bug where the document array was spliced twice.
- Added audit event for patient document deletion.

## Files Changed
- `backend/src/routes/patient.routes.js`
- `frontend/src/pages/Patients.jsx`

## Regression Checks
- Backend route load: PASSED
- Backend QA smoke: PASSED — 290 routes loaded
- Frontend production build: PASSED

## Notes
- Timeline quality depends on each module storing patient references consistently. This phase made patient matching more tolerant by checking `patient_id`, `patient_uid`, and numeric `id`.
- Future Phase 2C IPD work should make admission, bed transfer, nursing, discharge and billing-clearance records more structured so the patient timeline becomes even richer.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE2C_IPD_ADMISSION_WORKFLOW_REPORT.md

# Phase 2C — IPD / Admission Workflow Report

## Baseline
- Started from: `V48_phase2B_patient_timeline.zip`
- Scope: IPD admission workflow, bed allocation, transfer/discharge safety, nursing notes, audit logs, patient timeline continuity, and regression testing.

## Backend Changes
- Hardened `POST /api/ipd/admit` with validation for patient, consultant, bed, admission type and admission reason.
- Added active-admission guard so the same patient cannot be admitted twice while an active IPD record exists.
- Added bed availability guard so occupied/admitted beds cannot be reused.
- Admission now stores patient UID/name, consultant ID, bed ID, ward, bed number, diagnosis, admission reason and bed history.
- Bed status is automatically changed to `occupied` on admission.
- Added `GET /api/ipd` with non-archived filtering, patient/status filters, and patient/doctor/bed enrichment.
- Added `PATCH /api/ipd/:id/status` for IPD lifecycle statuses:
  - admission_requested
  - admitted
  - under_treatment
  - discharge_initiated
  - billing_pending
- Added `PATCH /api/ipd/:id/transfer-bed` with transfer reason, bed availability check, old-bed release and new-bed occupation.
- Added `POST /api/ipd/nursing-notes` with admission validation and patient linkage.
- Added `GET /api/ipd/:id/nursing-notes`.
- Hardened `POST /api/ipd/discharge` with required discharge summary and automatic bed release.
- Added `DELETE /api/ipd/:id` as safe archive instead of hard delete, with reason and bed release.
- Added/expanded audit events for admission, status update, bed transfer, nursing notes, discharge and archive.

## Frontend Changes
- Added `ipdApi` client.
- Added new IPD page/module.
- Added IPD tab in navigation.
- Added admission form with patient, consultant, available bed, admission type, admission date, diagnosis and admission reason.
- Added admission register with patient/bed/status details.
- Added action controls for:
  - status update
  - discharge initiation
  - billing pending
  - bed transfer
  - nursing note
  - discharge
  - safe archive
- Added IPD state loading in the main application.
- Added IPD permissions visibility via existing role/permission utility.
- Added IPD to enabled hospital modules so the page can appear for hospital/enterprise plans.

## Safety Notes
- Existing patient, doctor, appointment, OPD, billing, pharmacy, lab/radiology and timeline code was preserved.
- IPD archive is soft archive only.
- Discharge and archive automatically release the bed to `available`.
- Bed transfer requires a reason and blocks occupied beds.
- Patient timeline already reads IPD admissions and will continue to show admission/discharge records while archived records remain hidden.

## Tests Passed
- Backend JS syntax check: passed.
- Backend route check: passed.
- QA smoke route inventory: 294 routes loaded.
- Frontend production build: passed.

## Remaining Future Improvements
- Dedicated discharge summary PDF.
- Structured nursing chart with vitals trend.
- Medication Administration Record (MAR).
- IPD billing auto-posting for bed/doctor/nursing charges.
- Insurance pre-authorisation connection.
- Bed occupancy analytics by ward/floor.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE2E_ADVANCED_LAB_WORKFLOW_REPORT.md

# Phase 2E — Advanced Lab Workflow Report

## Baseline
- Started from `V48_phase2D_advanced_billing_workflow.zip`.
- Existing Phase 2D billing/IPD/patient/doctor/appointment functionality preserved.

## Implemented
- Extended lab lifecycle statuses with `verified` and `rejected`.
- Added sample/result rejection workflow with mandatory reason.
- Added lab result verification endpoint before approval.
- Added critical result detection using parameter `flag: critical` or `critical_low` / `critical_high` thresholds.
- Added critical alert timestamp and lab-user entry metadata.
- Added TAT calculation on approval.
- Added lab TAT summary endpoint with:
  - total orders
  - pending orders
  - critical alerts
  - rejected samples
  - average TAT hours
- Preserved existing barcode/accession number, machine API order, report upload, approval, archive, audit and notification flows.

## Backend Routes Added/Improved
- `PATCH /api/lab/tests/:id/verify`
- `PATCH /api/lab/tests/:id/reject-sample`
- `GET /api/lab/tat-summary`
- Enhanced `PATCH /api/lab/tests/:id/status`
- Enhanced `PATCH /api/lab/tests/:id/results`
- Enhanced `PATCH /api/lab/tests/:id/approve`

## Testing
- Backend route check: passed
- QA smoke: passed — 301 routes loaded
- Frontend production build: passed

## Notes
- Frontend build required refreshing frontend dependencies after ZIP extraction because the packaged `node_modules/.bin/vite` symlink path was stale. After dependency refresh, build passed.
- Existing frontend bundle-size warning remains from earlier phases and should be handled later with code splitting.

## Next Recommended Phase
Phase 2F — Advanced Pharmacy Workflow:
- batch-wise dispensing
- FEFO expiry logic
- purchase/GRN flow
- returns/refunds
- controlled medicine audit
- stock adjustment approval




---
# SOURCE FILE: docs/archive/phase-reports/PHASE2F_ADVANCED_PHARMACY_WORKFLOW_REPORT.md

# Phase 2F — Advanced Pharmacy Workflow Report

## Baseline
Started from `V48_phase2E_advanced_lab_workflow.zip`.

## Implemented
- Expiry alert endpoint for near-expiry/expired medicines.
- Purchase/GRN-style stock receive endpoint.
- Sale return workflow with mandatory reason.
- Stock restoration on sale return.
- Controlled medicine register endpoint.
- Audit logs for purchase receive and sale return.
- Existing medicine CRUD, low-stock, direct sale, prescription dispense and summary flows preserved.

## New/Improved API Endpoints
- `GET /api/pharmacy/expiry-alerts?days=90`
- `POST /api/pharmacy/purchase-receive`
- `POST /api/pharmacy/sales/:id/return`
- `GET /api/pharmacy/controlled-register`

## Safety Notes
- No hard delete introduced.
- Existing stock deduction flow preserved.
- Return flow blocks duplicate full returns and requires a reason.
- Purchase receive updates an existing medicine batch or creates a new batch.
- Controlled register is metadata/category based for now; later it should become a stricter statutory register with dispensing signatures and ID capture.

## Checks
- Backend route load check: passed.
- QA smoke: 305 routes loaded.
- Frontend production build: passed.
- Build warning remains: large frontend bundle; code-splitting should be handled in a later optimization phase.

## Next Recommended Phase
Phase 3A — Authentication & Session Security.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE3A_AUTH_SESSION_SECURITY_REPORT.md

# Phase 3A — Authentication & Session Security Report

## Baseline
Started from: `V48_phase2F_advanced_pharmacy_workflow.zip`

## Implemented

### Backend
- Added `AuthSession` model for persistent session tracking.
- Added session-aware access token payload with `session_id`.
- Added refresh-token flow with hashed refresh token storage.
- Added refresh-token rotation on each refresh.
- Added `/api/auth/logout` to revoke current session.
- Added `/api/auth/logout-all` to revoke all active sessions for current user.
- Added `/api/auth/sessions` to view recent user sessions.
- Added failed-login tracking on user records.
- Added temporary account lockout after configurable failed attempts.
- Added session revocation after password change.
- Added session revocation after password reset.
- Added password complexity option through environment flag.
- Added password-change audit/security logs.
- Added login lockout audit/security logs.

### Frontend
- Login now stores `refreshToken` when returned by backend.
- Axios client now attempts token refresh on expired access token.
- Failed refresh clears auth storage so stale sessions do not continue silently.
- Auth API now supports refresh, logout, logout-all and sessions endpoints.

## New / Updated API Endpoints
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET /api/auth/sessions`

## New Environment Options
```env
JWT_EXPIRES_IN=8h
REFRESH_TOKEN_EXPIRES_IN=7d
LOGIN_LOCK_ATTEMPTS=5
LOGIN_LOCK_DURATION=15m
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_COMPLEXITY=false
```

## Regression Checks
- Backend syntax check: passed
- Backend route check: passed
- QA smoke: passed, 309 routes loaded
- Frontend production build: passed

## Notes
- Existing base flows were preserved.
- Current bundle-size warning remains from earlier phases and is not a functional blocker.
- For stricter production deployment, set `PASSWORD_REQUIRE_COMPLEXITY=true` and use a strong `JWT_SECRET`.

## Next Recommended Phase
Phase 3B — Role-Based Access Control / Permission Builder.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE3B_ROLE_BASED_ACCESS_CONTROL_REPORT.md

# Phase 3B — Role-Based Access Control / Permission Builder Report

## Baseline
Started from: `V48_phase3A_auth_session_security.zip`

## Implemented

### Backend RBAC hardening
- Added central permission metadata:
  - `ALL_PERMISSIONS`
  - `PERMISSION_LABELS`
  - `PERMISSION_GROUPS`
  - permission catalog builder
- Added grantable-permission filtering based on the logged-in actor.
- Prevented managers from assigning custom permissions they do not personally have.
- Prevented custom permissions from duplicating the selected role's base permissions.
- Preserved role hierarchy protection:
  - `super_admin` can manage all roles.
  - `admin` cannot create/manage `super_admin`.
  - `hospital_admin` cannot create/manage platform admin roles.
- Added `/api/auth/roles` for user-management screens.
- Expanded `/api/auth/permissions` to return:
  - current role
  - effective permissions
  - role permission matrix
  - all valid permissions
  - grouped permission catalog
  - manageable roles

### User-management safety
- Create-user flow now sanitizes custom permissions by actor authority and target role.
- Update-user flow now sanitizes custom permissions by actor authority and target role.
- Users cannot manage permissions for roles above their authority.
- Existing self role/status protection remains intact.
- Existing soft deactivate behavior remains intact.

### Frontend permission builder
- Added role-aware permission catalog loading from `/auth/permissions`.
- Added custom permission selector to Add User workflow.
- Added per-user permission builder in Admin Profile user list.
- Role base permissions remain automatic; selected checkboxes store only custom override permissions.
- Added permission builder UI styling.

## Regression checks

Passed:
- Backend route load check
- QA smoke route inventory
- Frontend production build

## Route count
QA smoke detected: **310 routes**

## Notes
- Frontend bundle-size warning still exists from previous phases. It is not a functional failure. It should be handled later with code-splitting/manual chunks.
- React Hot Toast `use client` bundling warning is from dependency packaging and did not block build.

## Next recommended phase
**Phase 3C — Audit Trail Hardening**

Recommended focus:
- Patient record view audit
- Old/new value audit consistency
- Audit reason enforcement for sensitive actions
- Export/download audit
- Permission change audit details
- Audit filters and compliance-ready exports




---
# SOURCE FILE: docs/archive/phase-reports/PHASE3C_AUDIT_TRAIL_HARDENING_REPORT.md

# Phase 3C — Audit Trail Hardening Report

## Baseline
- Started from: `V48_phase3B_rbac_permission_builder.zip`
- Target phase: Phase 3C — Audit Trail Hardening

## Implemented

### Backend audit utility hardening
- Added automatic `changed_fields` detection when both old and new values are supplied.
- Added audit `reason` support from explicit audit payload, request body, or query string.
- Added audit `metadata` support for structured context.
- Preserved redaction of sensitive values such as passwords, tokens, reset tokens, and authorization data.

### Audit log model improvements
- Added fields:
  - `reason`
  - `changed_fields`
  - `metadata`
- Added entity timeline index for faster entity-level audit lookup.
- Added severity/date lookup index.

### Audit API improvements
- Added filters for:
  - severity
  - action
  - entity type
  - entity id
  - date range
- Added entity-specific audit endpoint:
  - `GET /api/audit-logs/entity/:entityType/:entityId`
- Audit CSV export now includes:
  - reason
  - changed fields
  - severity
- Audit export action now creates its own audit log entry.
- Security summary now includes:
  - patient record views in last 24 hours
  - export events in last 24 hours

### Patient access audit hardening
- Patient profile view now creates an audit log.
- Patient timeline view now creates an audit log.
- Patient sensitive edits now require a reason for:
  - medical notes
  - insurance provider
  - insurance policy number
  - direct document array changes
- Patient document upload now creates an audit log.
- Patient document delete now requires a reason and creates an audit log.
- Patient profile image update now creates an audit log.

### Frontend improvements
- Audit & Security page now supports extra filters:
  - severity
  - entity type
  - entity id
  - from date
  - to date
- Audit rows now show:
  - changed fields
  - reason
  - severity
- Dashboard stats now show:
  - patient views in 24h
  - exports in 24h
- Patient document deletion now asks for a deletion reason.

## Regression checks
- Backend syntax check: passed
- Backend route load check: passed
- QA smoke: passed — 311 routes loaded
- Frontend production build: passed

## Notes
- Existing frontend bundle-size warning remains. It is not a functionality failure; it should be handled later with route-level code splitting.
- Audit logging remains non-blocking by design: if audit write fails, core workflows continue.

## Next recommended phase
Phase 3D — Compliance Center / NABH-style workflow hardening.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE3D_COMPLIANCE_CENTER_HARDENING_REPORT.md

# Phase 3D — Compliance Center Hardening Report

## Baseline
Started from: `V48_phase3C_audit_trail_hardening.zip`

## Implemented
- Added weighted compliance score logic: compliant = full score, partial = half score.
- Added incident CAPA endpoint with required root cause, corrective action and preventive action.
- Added incident evidence endpoint with attachment metadata and audit logging.
- Added checklist evidence endpoint with reviewed-by, evidence notes/URL and automatic review timestamp.
- Preserved existing consent, SOP, incident, checklist, backup and export flows.
- Preserved tenant filtering and permission requirements.

## New/Improved API endpoints
- `POST /api/compliance/incidents/:id/capa`
- `POST /api/compliance/incidents/:id/evidence`
- `POST /api/compliance/checklists/:id/evidence`
- `GET /api/compliance/summary` now includes `checklistPartial` and weighted `complianceScore`.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Frontend production build passed.

## Notes
- Evidence endpoints currently store evidence metadata/URLs. File upload integration can be connected to Cloudinary in a later document-management hardening phase.
- CAPA fields are stored on the incident document to avoid breaking existing incident UI/data flow.

## Next Recommended Phase
Phase 4A — Tenant Isolation & SaaS Safety.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE4A_TENANT_ISOLATION_SAAS_SAFETY_REPORT.md

# Phase 4A — Tenant Isolation & SaaS Safety Report

## Baseline
Started from: `V48_phase3D_compliance_center_hardening.zip`

Previous completed phase: Phase 3D — Compliance Center Hardening.

## Goal
Improve tenant isolation and SaaS safety without harming existing hospital workflows, compliance flows, or production build stability.

## Inspection Summary
Reviewed tenant middleware, tenant-aware model wiring, SaaS/platform routes, tenant database routes, route loading, and existing tenant audit script.

### Key Tenant Isolation Risks Found
1. `x-hospital-id` / `x-tenant-hospital-id` headers could influence tenant context before strict role validation.
2. Client-supplied `hospital_id` inside create payloads could override tenant-scoped creation data.
3. Platform-level SaaS and tenant-management endpoints were permission-gated, but not consistently role-gated to `super_admin`.
4. Regression coverage existed for route wiring and tenant route usage, but not for tenant-spoofing safety behavior.

## Implemented Safely

### 1. Locked tenant context for non-super-admin users
Updated `backend/src/middleware/tenant.js`:
- Added `isSuperAdmin(req)` helper.
- Added `validPositiveId(value)` helper.
- Regular users are now pinned to the `hospital_id` in their JWT/user context.
- `x-hospital-id` / `x-tenant-hospital-id` tenant switching remains available only for `super_admin`.
- Token tenant DB is trusted only when it matches the token hospital.

### 2. Prevented create-payload tenant override
Updated `tenantCreateData(req, data)`:
- Client-provided `hospital_id` no longer overrides tenant-scoped create data.
- Created records now use the resolved safe `req.hospital_id`.
- Existing default-hospital compatibility remains preserved.

### 3. Platform-only protection for SaaS master routes
Added `allowRoles('super_admin')` to platform-wide tenant/SaaS endpoints, including:
- Tenant management routes
- Tenant database provisioning/backup routes
- SaaS overview/export routes
- SaaS billing routes
- SaaS business/onboarding routes
- Sales admin routes
- Cross-tenant subscription management routes

Public sales/marketing routes and normal tenant self-route `/tenant/me` were preserved.

### 4. Added tenant safety regression check
Added new script:
- `backend/scripts/tenant-safety-check.js`

Added npm command:
- `npm run tenant:safety-check`

This validates:
- Non-super-admin users cannot spoof tenant via headers.
- Super admin intentional tenant switching still works.
- Client `hospital_id` is ignored during tenant-scoped create payload generation.
- Platform permission assumption is safe.
- Tenant DB name sanitization is working.

## Files Changed
- `backend/src/middleware/tenant.js`
- `backend/src/routes/tenant.routes.js`
- `backend/src/routes/tenant-database.routes.js`
- `backend/src/routes/saas.routes.js`
- `backend/src/routes/saas-billing.routes.js`
- `backend/src/routes/saas-business.routes.js`
- `backend/src/routes/sales.routes.js`
- `backend/src/routes/subscription.routes.js`
- `backend/scripts/tenant-safety-check.js`
- `backend/package.json`

## Regression Checks Run

### Backend
- `npm install --no-audit --no-fund` — Passed
- `npm run check-routes` — Passed
- `npm run tenant:audit` — Passed
- `npm run tenant:safety-check` — Passed

### Frontend
- `npm install --no-audit --no-fund` — Passed
- `npm run build` — Passed

## Notes
- Frontend production build still shows the known Vite bundle-size warning. This was already noted for a later code-splitting optimization phase.
- React Hot Toast `use client` warning remains non-blocking.
- No broad model/schema rewrites were done in this phase to avoid disturbing base functionality.
- Database-per-tenant and shared-database compatibility were preserved.

## Recommended Next Phase
Phase 4B — Subscription Enforcement & Plan Limit Guardrails.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE4C_TENANT_BILLING_GUARDRAILS_PLAN_LIMITS_REPORT.md

# Phase 4C — Tenant Billing Guardrails & Plan Limits Report

## Baseline
Started from: `V48_phase4B_tenant_admin_subscription_foundation.zip`

## Goal
Add SaaS-safe plan guardrails without harming existing HMS base functionality. Phase 4B introduced tenant lifecycle and subscription foundation; Phase 4C enforces practical tenant usage limits at high-risk create points.

## Implemented
- Added subscription guardrail output to `getHospitalSubscription()`:
  - per-limit `used`, `limit`, `remaining`, `percent`
  - `warning` when usage reaches 80%+
  - `exceeded` when usage reaches/over limit
  - `guardrails.can_create` and `guardrails.blocked_reason`
- Added current-tenant guardrail endpoint:
  - `GET /api/subscription/guardrails`
- Added super-admin tenant guardrail endpoint:
  - `GET /api/tenants/:id/subscription/guardrails`
- Added safe plan-limit enforcement on create flows:
  - Patient creation checks `patients`
  - Doctor creation checks `doctors`
  - Appointment creation checks `appointments_per_month`
  - Medicine creation checks `medicines`
  - User/admin creation limit from Phase 4B remains preserved
- Suspended/cancelled subscriptions are blocked from create flows through the shared `ensureWithinLimit()` helper.
- Added static regression script:
  - `npm run check:plan-limits`

## Safety Notes
- Existing read/list/edit/delete flows were not changed.
- Default enterprise limits are high, so normal existing usage should not be blocked.
- Limit enforcement returns HTTP `402` with subscription details so the UI can show an upgrade/limit message later.
- Tenant isolation and Phase 4A/4B safeguards remain preserved.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- Frontend production build passed.

## Commands Run
```bash
cd backend
npm install --no-audit --no-fund
npm run check-routes
npm run tenant:audit
npm run tenant:safety-check
npm run check:plan-limits

cd ../frontend
npm install --no-audit --no-fund
npm run build
```

## Known Notes
- Frontend build still shows the existing Vite bundle-size warning. This remains planned for a later code-splitting/performance phase.
- No UI changes were made in this phase to avoid disturbing base functionality; guardrail UI banners can be added in a later SaaS dashboard phase.

## Next Recommended Phase
Phase 4D — SaaS Billing UI & Tenant Usage Dashboard.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE4G_PAYMENT_GATEWAY_PROVIDER_INTEGRATION_SETTLEMENT_REPORT.md

# Phase 4G — Payment Gateway Provider Integration & Admin Settlement Reports

## Baseline
Started from: `V48_phase4F_payment_gateway_webhook_hardening_reconciliation.zip`

## Objective
Extend Phase 4F webhook and invoice reconciliation foundation with provider-adapter readiness and admin settlement reporting while preserving existing HMS billing, tenant isolation, SaaS invoice, payment-link and webhook flows.

## Implemented
- Added provider adapter metadata for SaaS payment gateways:
  - `manual_gateway_ready`
  - `razorpay`
  - `stripe`
  - `payu`
  - custom gateway fallback support
- Added provider-aware payment link generation helper.
- Added gateway fee and net settlement amount calculation.
- Added gateway/settlement fields to SaaS payments:
  - `gateway`
  - `gateway_fee`
  - `net_amount`
  - `settlement_status`
  - `settlement_reference`
  - `settled_at`
- Added SaaS settlement model for provider payout reconciliation.
- Added admin settlement summary, listing, reconciliation and export endpoints.
- Extended SaaS billing summary with settlement KPIs.
- Added SaaS Control Center UI panels for:
  - gateway provider readiness
  - gateway gross/fee/net metrics
  - settlement reconciliation
  - recent settlement list
  - settlement CSV export
- Added regression script for provider + settlement safety checks.

## New/Improved API endpoints
- `GET /api/saas/payment-gateways/providers`
- `GET /api/saas/settlements/summary`
- `GET /api/saas/settlements`
- `POST /api/saas/settlements/reconcile`
- `GET /api/saas/settlements/export.csv`
- `GET /api/saas/billing/summary` now includes settlement metrics.
- `POST /api/saas/invoices/:id/payment-link` is now provider-aware.

## Files Changed
- `backend/src/models/index.js`
- `backend/src/routes/saas-billing.routes.js`
- `backend/scripts/saas-provider-settlement-check.js`
- `backend/package.json`
- `frontend/src/api/saasApi.js`
- `frontend/src/pages/SaasControl.jsx`
- `docs/LATEST_PHASE_REPORT.md`
- `docs/PROJECT_PHASE_HISTORY.md`

## Safety Notes
- Existing HMS patient billing routes were not changed.
- Existing SaaS invoice and payment intent flows are preserved.
- Existing Phase 4F signed webhook/idempotency/reconciliation flow is preserved.
- Provider integrations are adapter-ready and environment-variable driven; no hardcoded real gateway secrets were added.
- Settlement reconciliation is super-admin/permission-protected through existing SaaS billing route guards.

## Checks Passed
- Backend dependency install completed.
- Backend route load check passed.
- Tenant isolation audit passed.
- Tenant safety check passed.
- Plan limit guardrail check passed.
- SaaS UI safety check passed.
- SaaS billing automation check passed.
- SaaS webhook reconciliation check passed.
- SaaS provider integration and settlement reporting check passed.
- Frontend production build passed.

## Known Notes
- Frontend production build still shows the existing Vite bundle-size warning. This remains planned for a later code-splitting optimization phase.
- Real gateway API calls are intentionally not hardcoded. Razorpay/Stripe/PayU URLs and secrets should be provided through environment variables when enabling live payments.

## Next Recommended Phase
Phase 4H — Subscription Analytics, Revenue Forecasting & Churn Risk Signals.




---
# SOURCE FILE: docs/archive/phase-reports/PHASE6G_DOCTOR_PORTAL_UPGRADE_REPORT.md

# Phase 6G — Doctor Portal Upgrade Report

## Baseline
Started from: `V48_phase6F_patient_portal_upgrade.zip`

## Objective
Upgrade the existing Doctor Portal without creating a duplicate portal, while preserving all existing HMS, SaaS, reporting, clinical, Blood Bank, HR and Patient Portal functionality.

## Implemented
- Upgraded existing Doctor Portal backend payload builder.
- Added doctor own-data isolation guardrail:
  - doctor/portal_doctor users cannot select or spoof another `doctor_id`.
  - authorized staff/admin users can still select a doctor for operational support.
- Added audit logging for doctor portal access and spoof-denial events.
- Added segmented doctor portal API endpoints:
  - `GET /api/portal/doctor`
  - `GET /api/portal/doctor/queue`
  - `GET /api/portal/doctor/patients`
  - `GET /api/portal/doctor/emr`
  - `GET /api/portal/doctor/results`
  - `GET /api/portal/doctor/follow-ups`
- Added assigned-patient aggregation from appointments, consultations, lab orders and radiology orders.
- Added ready-results aggregation for completed/approved/reported lab and radiology results.
- Added follow-up list from OPD records with upcoming follow-up dates.
- Added doctor access metadata:
  - self-service vs staff view
  - own-data-only flag
  - selected doctor context
- Upgraded existing Doctor Portal UI with tabs:
  - Overview
  - Today Queue
  - Assigned Patients
  - EMR
  - Results
  - Follow-ups
- Added doctor portal API client methods.
- Added new regression check:
  - `npm run check:phase6g-doctor-portal`

## Safety Notes
- No duplicate doctor portal was created.
- Existing Patient Portal was preserved.
- Existing HMS modules were not intentionally changed.
- Doctor self-service access is restricted to the linked doctor profile.
- Admin/hospital admin selection remains available for operational support.

## Checks Passed
- Backend dependency install
- Backend route load check
- Tenant isolation audit
- Tenant safety check
- Plan limit guardrail check
- Phase 5A patient/appointment reports check
- Phase 5B revenue/billing reports check
- Phase 5C pharmacy/lab/IPD reports check
- Phase 5D executive command center check
- Phase 6A OT/Surgery check
- Phase 6B Nursing check
- Phase 6C Emergency/Casualty check
- Phase 6D Blood Bank enterprise check
- Phase 6E HR/Staff check
- Phase 6F Patient Portal check
- Phase 6G Doctor Portal check
- Frontend production build

## Known Note
- Vite bundle-size warning still remains and should be handled later in the optimization/code-splitting phase.

## Next Recommended Phase
Phase 7A — FHIR Implementation, unless you want to add another refinement phase for Patient/Doctor Portal UI before integrations.




---
# SOURCE FILE: docs/archive/phase-reports/V45_FIXES.md

# V45 Fix Summary

Targeted fixes applied without removing existing HMS functionality:

- Command Center now loads each KPI widget safely and shows zero-state widgets even if one analytics endpoint fails.
- Patient Portal and Doctor Portal dropdown copy improved for admin/staff mode selection.
- Beds module replaced raw generic form with labelled HMS-specific form and valid bed statuses.
- Billing module upgraded from raw patient id/amount form to labelled invoice form with patient dropdown, paid amount, payment mode and invoice register columns.
- Backend Bed model now has ward, bed_number, status and tenant-safe unique index on hospital_id + ward + bed_number.
- Backend bed creation validates duplicate bed numbers per hospital/ward and normalizes status values.
- Backend Billing model now defines invoice fields, totals, paid/due amount, payment status, items and invoice unique index per hospital.
- Billing create payload now supports legacy amount fields and richer invoice totals safely.
- Configuration page now shows load errors instead of staying stuck on “Loading fields...”.
- Added global UI hardening: responsive tables, labelled form styling, command alert grid, empty states, inventory hero contrast, and safer letter spacing.

Validation:
- Backend route loading: passed with `npm run check-routes`.
- Frontend production build: passed with `npm run build`.




---
# SOURCE FILE: docs/archive/phase-reports/V47_CHANGELOG.md

# V47 Full Module Stabilization

Base: V46 enterprise modules.

## Added
- Tenant-scoped EnterpriseFeatureRecord MongoDB model.
- Backend CRUD API for advanced features:
  - GET /api/enterprise-features/:feature/summary
  - GET /api/enterprise-features/:feature/records
  - POST /api/enterprise-features/:feature/records
  - PATCH /api/enterprise-features/:feature/records/:id
  - DELETE /api/enterprise-features/:feature/records/:id
  - PUT /api/enterprise-features/:feature/enabled
- Frontend enterpriseFeatureApi client.
- Reusable EnterpriseFeatureWorkspace component with real create/edit/delete records, feature enable/disable, stats, checklist, audit/integration log views.
- Dedicated FHIRAPIs.jsx page instead of generic placeholder.
- Dedicated WhatsAppSMS.jsx page integrated with Communications.

## Improved
- Advanced feature pages now save tenant-scoped data to MongoDB through backend APIs instead of displaying only static placeholder content.
- Audit Compliance filter uses backend-supported query params.
- Advanced feature UI: readable hero, forms, tables, responsive layout, records table, module-specific checklist.

## Existing functionality protected
- Core pages/routes retained.
- Existing integration logs, API keys, webhooks, FHIR preview, communications, insurance, legal/security, SaaS, hospital management flows remain available.

## Tests run
- Frontend production build: PASS
- Backend route load test: PASS




---
# SOURCE FILE: docs/archive/phase-reports/V48_STABILIZATION_REPORT.md

# V48 Existing Module Stabilization & Polish

Scope: no new feature expansion. This version focuses on improving the existing V47 module experience without removing current functionality.

## Fixed / Improved
- Added global enterprise-module polish CSS for advanced modules and existing card/table/form layouts.
- Improved Legal/Security and advanced module page readability: hero cards, stats cards, form grids, tables, empty states, responsive behavior.
- Standardized buttons, inputs, cards, table wrappers, checklist, status pill and action-row styling.
- Preserved existing frontend routes, backend APIs, models, permissions and feature flags.
- No existing module was intentionally removed or disabled.

## Stabilization Target
- HL7 Ready
- PACS/DICOM
- Biometric
- ERP/Tally
- ABDM/ABHA
- 2FA Security
- Audit Compliance
- Legal & Security
- Inventory/Pharmacy visual consistency
- Command/Production enterprise pages

## Verification
- Frontend production build should be run after extraction with `npm install && npm run build`.
- Backend route loading should be checked with `npm run check-routes` from backend if dependencies are installed.




---
# SOURCE FILE: docs/runbooks/PRODUCTION_RELEASE_RUNBOOK.md

# Production Release Runbook

## Before deployment

1. Confirm the release ZIP or git commit is the approved build.
2. Confirm production env variables are configured.
3. Confirm `FRONTEND_URL` exactly matches the Vercel production domain.
4. Confirm `VITE_API_URL` ends with `/api` and points to the Render backend.
5. Confirm MongoDB Atlas backup is enabled.
6. Run backend and frontend checks locally or in CI.

## Deploy backend

1. Deploy Render backend from the approved commit.
2. Wait until the service is healthy.
3. Open `/api/health/live`.
4. Open `/api/health/ready`.
5. Review Render logs for CORS, DB or route-load errors.

## Deploy frontend

1. Deploy Vercel frontend.
2. Confirm `VITE_API_URL` is present in Vercel env.
3. Confirm the build output directory is `dist`.
4. Open the production URL and login.

## Post-deploy smoke test

- Login as admin.
- Open dashboard.
- Search patients.
- Add a test appointment in staging only.
- Open reports and command center.
- Confirm Patient Portal and Doctor Portal are accessible.
- Confirm API calls are not blocked by CORS.

## Rollback

- Frontend: use Vercel instant rollback.
- Backend: roll back Render to previous deploy.
- Database: restore only after formal approval and verified backup review.

