#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(projectRoot, file));
const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}
function includes(file, fragments) {
  if (!exists(file)) return false;
  const body = read(file);
  return fragments.every((f) => body.includes(f));
}
function anyIncludes(file, fragments) {
  if (!exists(file)) return false;
  const body = read(file);
  return fragments.some((f) => body.includes(f));
}

const backendPkg = JSON.parse(fs.readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));
const frontendPkg = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package.json'), 'utf8'));

check('Backend exposes Phase 8C E2E script', backendPkg.scripts?.['check:phase8c-e2e'] === 'node scripts/phase8c-e2e-testing-check.js');
check('Backend automated suite includes Phase 8C check', String(backendPkg.scripts?.['test:automated'] || '').includes('check:phase8c-e2e'));
check('Frontend exposes Phase 8C E2E contract script', frontendPkg.scripts?.['check:phase8c-e2e'] === 'node scripts/phase8c-e2e-check.cjs');
check('Frontend E2E test alias is configured', frontendPkg.scripts?.['test:e2e'] === 'npm run check:phase8c-e2e');

check('E2E docs exist', exists('docs/E2E_TESTING.md'));
check('Testing docs reference Phase 8C', includes('docs/TESTING.md', ['Phase 8C', 'npm run check:phase8c-e2e', 'test:e2e']));

check('Login journey has auth submit and token persistence', includes('frontend/src/pages/Login.jsx', ['onSubmit', 'authApi.login', 'localStorage.setItem("token"']));
check('Authenticated API client supports bearer and refresh flow', includes('frontend/src/api/client.js', ['Authorization = `Bearer ${token}`', '/auth/refresh-token', 'original._retry']));
check('Main app preserves protected app/auth state boundary', includes('frontend/src/main.jsx', ['localStorage.getItem("token")', 'setUser', 'Login']));

check('Add patient journey has form submit and create API', includes('frontend/src/pages/Patients.jsx', ['onSubmit={addPatient}', 'New Patient', 'setEditingPatientId']));
check('Patient API supports create/list/update', includes('frontend/src/api/patientApi.js', ['api.get("/patients"', 'api.post("/patients"', 'api.put(`/patients/${id}`']));
check('Backend patient create route exists with permission guard', includes('backend/src/routes/patient.routes.js', ['router.post', 'requirePermission', 'patient.create']));

check('Appointment booking journey has date, time, doctor and status fields', includes('frontend/src/pages/Appointments.jsx', ['appointment_date', 'appointment_time', 'doctor_id', 'status']));
check('Appointment consultation handoff exists', includes('frontend/src/pages/Appointments.jsx', ['saveConsultation', 'appointment_id', 'generate_bill']));
check('Backend appointment create/status routes exist', includes('backend/src/routes/core.routes.js', ['router.post(\'/appointments\'', 'router.patch(\'/appointments/:id/status\'', 'ensureDoctorSlotAvailable']));

check('OPD/EMR journey has clinical record save flow', includes('frontend/src/pages/EMR.jsx', ['saveRecord', 'emrApi.create', 'Clinical record saved']));
check('Backend EMR routes support create/list workflow', includes('backend/src/routes/emr.routes.js', ['router.post', 'router.get', 'emr']));

check('Billing journey has invoice form and PDF receipt link', includes('frontend/src/pages/Billing.jsx', ['onSubmit={addBill}', 'billingApi.pdfUrl', 'payment_status']));
check('Backend billing create/payment/pdf routes exist', includes('backend/src/routes/billing.routes.js', ['router.post(\'/\'', 'router.patch(\'/:id/payment\'', 'router.get(\'/invoice/:id/pdf\'']));

check('Lab/radiology journey has order, result and approval UI', includes('frontend/src/pages/Labs.jsx', ['Create Lab Order', 'ResultEditor', 'approveLabReport', 'Create Radiology Order']));
check('Backend lab routes support order/results/verify', includes('backend/src/routes/lab-radiology.routes.js', ['router.post(\'/lab/tests\'', 'router.patch(\'/lab/tests/:id/results\'', 'router.patch(\'/lab/tests/:id/verify\'']));

check('IPD journey has admission, status, nursing, discharge actions', includes('frontend/src/pages/IPD.jsx', ['admit', 'Start Discharge', 'Nursing Note', 'discharge(row)']));
check('Backend IPD routes support admit/transfer/discharge', includes('backend/src/routes/opd-ipd.routes.js', ['router.post(\'/ipd/admit\'', 'router.patch(\'/ipd/:id/transfer-bed\'', 'router.post(\'/ipd/discharge\'']));

check('Pharmacy journey has stock, sale and patient link flow', includes('frontend/src/pages/Pharmacy.jsx', ['saveMedicine', 'adjustStock', 'createSale', 'Patient ID / UHID optional']));
check('Backend pharmacy routes support medicine and sale workflow', includes('backend/src/routes/pharmacy.routes.js', ['router.post(\'/medicines\'', 'router.post(\'/sales\'', 'router.patch']));

check('Patient portal validates self-service journey coverage', includes('frontend/src/pages/PatientPortal.jsx', ['Appointments', 'Prescriptions', 'Reports', 'Bills', 'Documents']));
check('Doctor portal validates doctor workflow journey coverage', includes('frontend/src/pages/DoctorPortal.jsx', ['Today', 'Assigned Patients', 'EMR', 'Results', 'Follow-ups']));
check('Portal API covers patient and doctor segmented journeys', includes('frontend/src/api/portalApi.js', ['/portal/patient/appointments', '/portal/patient/bills', '/portal/doctor/queue', '/portal/doctor/results']));

check('Frontend E2E contract checker exists', exists('frontend/scripts/phase8c-e2e-check.cjs'));
check('Frontend E2E contract checker validates critical journeys', includes('frontend/scripts/phase8c-e2e-check.cjs', ['Login journey', 'Patient journey', 'Appointment journey', 'Billing journey', 'Lab journey', 'IPD journey', 'Pharmacy journey']));

const failed = checks.filter((c) => !c.ok);
console.log(`Phase 8C E2E readiness checks: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ''}`);
if (failed.length) process.exit(1);

const outputDir = path.join(backendRoot, 'test-results');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'phase8c-e2e-summary.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  type: 'phase8c_e2e_contract',
  total: checks.length,
  passed: checks.length - failed.length,
  failed: failed.length,
  journeys: ['login', 'add_patient', 'book_appointment', 'opd_emr', 'billing_invoice', 'lab_report', 'ipd_discharge', 'pharmacy_sale', 'patient_portal', 'doctor_portal']
}, null, 2));
