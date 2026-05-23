#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const checks = [];
function check(name, condition) { checks.push({ name, ok: Boolean(condition) }); }
function includes(file, fragments) {
  if (!exists(file)) return false;
  const body = read(file);
  return fragments.every((f) => body.includes(f));
}

const pkg = JSON.parse(read('package.json'));
check('Frontend package exposes Phase 8C script', pkg.scripts?.['check:phase8c-e2e'] === 'node scripts/phase8c-e2e-check.cjs');
check('Frontend package exposes E2E alias', pkg.scripts?.['test:e2e'] === 'npm run check:phase8c-e2e');

check('Login journey has submit, password and auth API flow', includes('src/pages/Login.jsx', ['Login', 'onSubmit', 'password', 'authApi.login']));
check('Patient journey has create/edit/profile/timeline UI coverage', includes('src/pages/Patients.jsx', ['New Patient', 'onSubmit={addPatient}', 'Profile Information', 'Patient Timeline / EMR']));
check('Appointment journey has booking queue and consultation handoff', includes('src/pages/Appointments.jsx', ['appointment_date', 'appointment_time', 'saveConsultation', 'Reception Queue']));
check('OPD/EMR journey has diagnosis, prescription and lab/billing context', includes('src/pages/EMR.jsx', ['diagnosis', 'prescription', 'billing', 'labs']));
check('Billing journey has invoice, payment and receipt/PDF flow', includes('src/pages/Billing.jsx', ['Invoice Number', 'payment_status', 'billingApi.pdfUrl', 'Paid Amount']));
check('Lab journey has order, result entry and approval flow', includes('src/pages/Labs.jsx', ['Create Lab Order', 'ResultEditor', 'approveLabReport', 'Create Radiology Order']));
check('IPD journey has admit, transfer/nursing and discharge flow', includes('src/pages/IPD.jsx', ['onSubmit={admit}', 'Transfer Bed', 'Nursing Note', 'Discharge']));
check('Pharmacy journey has medicine, stock adjustment and sale flow', includes('src/pages/Pharmacy.jsx', ['Add Medicine', 'adjustStock', 'createSale', 'Patient ID / UHID optional']));
check('Patient portal journey has self-service coverage', includes('src/pages/PatientPortal.jsx', ['Secure self-service view', 'Appointments', 'Prescriptions', 'Documents', 'Timeline']));
check('Doctor portal journey has clinical worklist coverage', includes('src/pages/DoctorPortal.jsx', ['Today', 'Assigned Patients', 'Results', 'Follow-ups']));
check('API client provides auth retry foundation for E2E journeys', includes('src/api/client.js', ['Authorization = `Bearer ${token}`', '/auth/refresh-token']));

const failed = checks.filter((c) => !c.ok);
console.log(`Phase 8C frontend E2E contract checks: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}`);
if (failed.length) process.exit(1);
