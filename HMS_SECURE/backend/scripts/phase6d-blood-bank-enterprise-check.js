const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');
function read(rel) { return fs.readFileSync(path.join(projectRoot, rel), 'utf8'); }
function assertIncludes(file, text, label) {
  const content = read(file);
  if (!content.includes(text)) throw new Error(`${label || text} missing in ${file}`);
}

const route = read('backend/src/routes/blood-bank.routes.js');
const model = read('backend/src/models/index.js');
const server = read('backend/src/server.js');

[
  'BloodDonor', 'BloodUnit', 'BloodRequisition', 'BloodCrossMatch', 'BloodIssueRecord', 'BloodReservation',
  'blood_donors', 'blood_units', 'blood_requisitions', 'blood_cross_matches', 'blood_issue_records', 'blood_reservations',
].forEach((token) => { if (!model.includes(token)) throw new Error(`Model/tenant collection token missing: ${token}`); });
[
  '/blood-bank/dashboard', '/blood-bank/donors', '/blood-bank/units', '/blood-bank/requisitions', '/blood-bank/requisitions/:id/approve',
  '/blood-bank/cross-matches', '/blood-bank/reservations', '/blood-bank/issues', '/blood-bank/reports/stock',
  'isCompatible', 'Duplicate bag number', 'Compatible cross-match is required', 'emergency_reason is required', 'tenantFilter(req', 'tenantCreateData(req', 'auditEvent',
].forEach((token) => { if (!route.includes(token)) throw new Error(`Blood bank hardening token missing: ${token}`); });
if (!server.includes('blood-bank.routes')) throw new Error('Blood bank route not mounted in server');
assertIncludes('frontend/src/pages/BloodBank.jsx', 'Blood Bank', 'Blood Bank UI');
assertIncludes('frontend/src/api/bloodBankApi.js', '/blood-bank/requisitions', 'Blood Bank frontend API');
console.log('Phase 6D Blood Bank enterprise readiness check passed.');
