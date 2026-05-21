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
