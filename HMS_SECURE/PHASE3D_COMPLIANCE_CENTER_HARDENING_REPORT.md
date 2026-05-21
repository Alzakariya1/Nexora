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
