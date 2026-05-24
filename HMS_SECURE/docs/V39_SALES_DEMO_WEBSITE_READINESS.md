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
