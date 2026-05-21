# V45 Fix Summary

Targeted fixes applied without removing existing HMS functionality:

- Command Center now loads each KPI widget safely and shows zero-state widgets even if one analytics endpoint fails.
- Patient Portal and Doctor Portal dropdown copy improved for admin/staff mode selection.
- Beds module replaced raw generic form with labelled HMS-specific form and valid bed statuses.
- Billing module upgraded from raw patient id/amount form to labelled invoice form with patient dropdown, paid amount, payment mode and invoice register columns.
- Backend Bed model now has ward, bed_number, status and tenant-safe unique index on hospital_id + ward + bed_number.
- Backend bed creation validates duplicate bed numbers per hospital/ward and normalizes status values.
- Backend Billing model now defines invoice fields, totals, paid/due amount, payment status, items and invoice unique index per hospital.
- Billing create payload now supports legacy amount fields and richer invoice totals safely.
- Configuration page now shows load errors instead of staying stuck on “Loading fields...”.
- Added global UI hardening: responsive tables, labelled form styling, command alert grid, empty states, inventory hero contrast, and safer letter spacing.

Validation:
- Backend route loading: passed with `npm run check-routes`.
- Frontend production build: passed with `npm run build`.
