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
