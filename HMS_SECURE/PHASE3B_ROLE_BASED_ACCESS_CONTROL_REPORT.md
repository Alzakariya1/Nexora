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
