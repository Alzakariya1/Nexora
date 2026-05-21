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
