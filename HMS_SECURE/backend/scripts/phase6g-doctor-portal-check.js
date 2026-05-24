const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assertIncludes(file, text, label = text) {
  const body = read(file);
  if (!body.includes(text)) throw new Error(`${file} missing ${label}`);
}

assertIncludes('src/routes/portal.routes.js', "router.get('/portal/doctor'", 'doctor portal endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/doctor/queue'", 'doctor queue endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/doctor/patients'", 'assigned patients endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/doctor/emr'", 'doctor EMR endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/doctor/results'", 'doctor results endpoint');
assertIncludes('src/routes/portal.routes.js', "router.get('/portal/doctor/follow-ups'", 'doctor follow-up endpoint');
assertIncludes('src/routes/portal.routes.js', 'Doctor portal doctor_id override denied', 'doctor spoof protection audit');
assertIncludes('src/routes/portal.routes.js', 'own_data_only', 'own-doctor isolation metadata');
assertIncludes('src/routes/portal.routes.js', 'assignedPatients', 'assigned patient aggregation');
assertIncludes('src/routes/portal.routes.js', 'recentResults', 'ready results aggregation');
assertIncludes('../frontend/src/api/portalApi.js', 'doctorQueue', 'doctor portal API segmented methods');
assertIncludes('../frontend/src/pages/DoctorPortal.jsx', 'Own-doctor isolation enabled', 'own-doctor isolation UI notice');
assertIncludes('../frontend/src/pages/DoctorPortal.jsx', 'Assigned Patients', 'assigned patients UI tab');
assertIncludes('../frontend/src/pages/DoctorPortal.jsx', 'Follow-up List', 'follow-up UI');
assertIncludes('../frontend/src/pages/DoctorPortal.jsx', 'Ready Results', 'results UI');
assertIncludes('../frontend/src/pages/DoctorPortal.jsx', 'portalTabs', 'doctor portal tab UI');

console.log('Phase 6G doctor portal upgrade readiness check passed.');
