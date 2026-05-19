# V49 Existing Module Testing & Stabilization

This phase intentionally does not add a new hospital feature. It stabilizes the current module surface and makes the existing enterprise modules easier to verify.

## What changed

- Added a V49 module audit script: `npm run qa:v49` in `backend/`.
- The audit checks that critical backend route surfaces are registered and that the current frontend module pages exist.
- Enabled existing enterprise feature flags by default for the working enterprise build, so HL7, PACS/DICOM, Biometric, ERP/Tally, ABDM/ABHA, 2FA Security and Audit Compliance are visible unless a hospital explicitly disables them.
- Added advanced module IDs into the frontend module registry so SaaS/Configuration module visibility controls can manage them consistently.
- Kept all existing routes, models, pages and permissions intact.

## Verified in this build

- `npm run check-routes` passes.
- `npm run qa:smoke` passes.
- `npm run qa:v49` passes.
- Frontend production build passes.

## Next manual QA checklist

1. Login as super admin/admin.
2. Open each sidebar module once and check for console errors.
3. Create one test record in Patients, Doctors, Appointments, Beds, Pharmacy, Inventory, Billing, Legal & Security and every enterprise module.
4. Refresh the page and confirm each record persists.
5. Confirm hospital/tenant context does not leak records between hospitals.
6. Export audit/security data and confirm recent actions appear.
