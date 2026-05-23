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
