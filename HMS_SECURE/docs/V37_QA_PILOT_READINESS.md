# V37 SaaS Stabilization + QA + Pilot Readiness

## Goal
Freeze new feature expansion and verify the HMS is safe for real clinic/hospital demo and pilot usage.

## Critical QA Areas
- Authentication and CORS on deployed Vercel + Render URLs
- Tenant/hospital isolation for patients, doctors, billing, pharmacy, inventory, lab, compliance and analytics
- Role-based access for super admin, hospital admin, doctor, nurse, receptionist, pharmacist, lab staff, radiologist, billing staff, inventory manager and compliance officer
- CRUD validation on all operational modules
- Duplicate key prevention for hospital_code, doctor_id, patient_uid and auto-increment ids
- Data persistence after refresh and re-login
- Health checks, backup verification and restore dry-run

## Pilot Demo Flow
1. Create/select hospital tenant
2. Create users and assign roles
3. Register patient
4. Book appointment
5. Doctor consultation/EMR
6. Lab order and result approval
7. Pharmacy dispense with stock check
8. Billing/payment
9. Analytics review
10. Audit/compliance review

## Release Gate
Do not deploy to a pilot hospital until backend route load, frontend build, security check, backup verification and QA smoke all pass.
