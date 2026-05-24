const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assertIncludes(file, text, label = text) {
  const body = read(file);
  if (!body.includes(text)) throw new Error(`${file} missing ${label}`);
}

assertIncludes('src/routes/portal.routes.js', "router.get('/portal/patient/profile'", 'patient profile endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/patient/appointments'", 'patient appointments endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/patient/prescriptions'", 'patient prescriptions endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/patient/reports'", 'patient reports endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/patient/bills'", 'patient bills endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/patient/documents'", 'patient documents endpoint');
assertIncludes('src/routes/portal.routes.js', 'Patient portal patient_id override denied', 'own-data spoof protection audit');
assertIncludes('src/routes/portal.routes.js', 'own_data_only', 'own-data isolation metadata');
assertIncludes('src/routes/portal.routes.js', 'documentVault', 'document vault response');
assertIncludes('../frontend/src/api/portalApi.js', 'patientDocuments', 'portal API segmented methods');
assertIncludes('../frontend/src/pages/PatientPortal.jsx', 'Document Vault', 'document vault UI');
assertIncludes('../frontend/src/pages/PatientPortal.jsx', 'Own-data isolation enabled', 'own-data isolation UI notice');
assertIncludes('../frontend/src/pages/PatientPortal.jsx', 'Bills & Receipts', 'bill receipt UI');
assertIncludes('../frontend/src/pages/PatientPortal.jsx', 'Prescriptions', 'prescription UI tab');
assertIncludes('../frontend/src/pages/PatientPortal.jsx', 'portalTabs', 'portal tab UI');

console.log('Phase 6F patient portal upgrade readiness check passed.');
