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

