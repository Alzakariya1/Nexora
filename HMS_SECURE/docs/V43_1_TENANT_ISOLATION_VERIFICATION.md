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
