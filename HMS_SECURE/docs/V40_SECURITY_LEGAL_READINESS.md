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
