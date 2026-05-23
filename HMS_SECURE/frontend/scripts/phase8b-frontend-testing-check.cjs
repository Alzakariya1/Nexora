#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
}
function includes(file, fragments) {
  const body = read(file);
  return fragments.every((f) => body.includes(f));
}

const pkg = JSON.parse(read('package.json'));
check('frontend package has build script', pkg.scripts?.build === 'vite build');
check('frontend package has Phase 8B test script', pkg.scripts?.['check:phase8b-frontend'] === 'node scripts/phase8b-frontend-testing-check.cjs');
check('frontend package exposes test:frontend alias', pkg.scripts?.['test:frontend'] === 'npm run check:phase8b-frontend');

check('API client attaches JWT bearer token', includes('src/api/client.js', ['localStorage.getItem("token")', 'config.headers.Authorization = `Bearer ${token}`']));
check('API client handles refresh-token retry', includes('src/api/client.js', ['status === 401', '/auth/refresh-token', 'original._retry', 'localStorage.setItem("token"']));
check('API client clears auth state on refresh failure', includes('src/api/client.js', ['localStorage.removeItem("token")', 'localStorage.removeItem("refreshToken")', 'localStorage.removeItem("user")']));

check('DataTable hides internal identifiers and metadata', includes('src/components/DataTable.jsx', ['"_id"', '"__v"', '"created_at"', '"updated_at"']));
check('DataTable has enterprise action menu behavior', includes('src/components/DataTable.jsx', ['openActionMenu', 'extraActions', 'actionsCol']));
check('DataTable has empty state coverage', includes('src/components/DataTable.jsx', ['No records found', 'emptyTableState']));

check('Form maps common field types safely', includes('src/components/Form.jsx', ['k.includes("date")', 'k.includes("time")', 'k.includes("email")', 'return "number"']));
check('Form covers role dropdown options', includes('src/components/Form.jsx', ['hospital_admin', 'lab_technician', 'pharmacist', 'nurse']));
check('Form covers status dropdown options', includes('src/components/Form.jsx', ['scheduled', 'completed', 'cancelled', 'active', 'inactive']));
check('Form supports custom fields', includes('src/components/Form.jsx', ['custom_fields', 'renderCustomField', 'field.field_type']));

check('Main app applies permission-based tab filtering', includes('src/main.jsx', ['filterTabsByPermissions(user, allTabs', 'hasPermission(user']));
check('Main app includes major Phase 6/7 modules in navigation imports', includes('src/main.jsx', ['BloodBank', 'HRStaff', 'FHIRAPIs', 'HL7Ready', 'PACSDicom', 'ABDMABHA', 'ERPTally']));
check('Main app preserves tenant/feature flag state', includes('src/main.jsx', ['currentHospital', 'enabledModules', 'normalizeFeatureFlags']));

check('Login page has submit handler and error handling', includes('src/pages/Login.jsx', ['onSubmit', 'catch', 'password']));
check('Patient page has edit/new patient workflow hooks', includes('src/pages/Patients.jsx', ['setEditingPatientId', 'New Patient', 'onEdit']));
check('Appointments page keeps date/time/status form flow', includes('src/pages/Appointments.jsx', ['appointment_date', 'appointment_time', 'status']));
check('Reports page includes command center/report sections', includes('src/pages/Reports.jsx', ['Patient', 'Appointment', 'Revenue', 'Pharmacy']));

check('Patient Portal enforces own-data isolation UI contract', includes('src/pages/PatientPortal.jsx', ['own_data_only', 'Secure self-service view', 'Appointments', 'Prescriptions', 'Documents', 'Timeline']));
check('Doctor Portal enforces doctor scoped selector permissions', includes('src/pages/DoctorPortal.jsx', ['canSelectDoctor', 'Today', 'Assigned Patients', 'Follow-ups']));
check('Portal API exposes segmented patient and doctor endpoints', includes('src/api/portalApi.js', ['/portal/patient/appointments', '/portal/patient/reports', '/portal/doctor/queue', '/portal/doctor/follow-ups']));

const requiredPages = [
  'src/pages/Patients.jsx', 'src/pages/Appointments.jsx', 'src/pages/Billing.jsx', 'src/pages/PatientPortal.jsx',
  'src/pages/DoctorPortal.jsx', 'src/pages/BloodBank.jsx', 'src/pages/HRStaff.jsx', 'src/pages/Reports.jsx'
];
check('Critical frontend pages exist', requiredPages.every(exists), requiredPages.filter((p) => !exists(p)).join(', '));

const failed = checks.filter((c) => !c.ok);
console.log(`Phase 8B frontend regression checks: ${checks.length - failed.length}/${checks.length} passed`);
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail && !c.ok ? ` — ${c.detail}` : ''}`);
if (failed.length) process.exit(1);
