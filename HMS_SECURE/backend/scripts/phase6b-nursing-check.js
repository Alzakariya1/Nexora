const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const models = read('src/models/index.js');
const routes = read('src/routes/nursing.routes.js');
const server = read('src/server.js');
const requiredModels = ['NursingVital','MedicationAdministration','NursingHandoverNote','NursingCarePlan','NursingShiftTask'];
for (const token of requiredModels) {
  if (!models.includes(token)) throw new Error(`Missing nursing model ${token}`);
}
for (const collection of ['nursing_vitals','medication_administrations','nursing_handover_notes','nursing_care_plans','nursing_shift_tasks']) {
  if (!models.includes(collection)) throw new Error(`Missing tenant collection ${collection}`);
}
for (const endpoint of ['/nursing/dashboard','/nursing/vitals','/nursing/medications','/nursing/handovers','/nursing/care-plans','/nursing/tasks','/administer']) {
  if (!routes.includes(endpoint)) throw new Error(`Missing nursing endpoint ${endpoint}`);
}
if (!routes.includes('tenantFilter(req') || !routes.includes('tenantCreateData(req')) throw new Error('Nursing routes must use tenant filter/create helpers');
if (!routes.includes("requirePermission('clinical.view')") || !routes.includes("requirePermission('clinical.manage')")) throw new Error('Nursing routes must enforce clinical permissions');
if (!routes.includes('auditEvent')) throw new Error('Nursing routes must audit write actions');
if (!server.includes('nursing.routes')) throw new Error('Server did not mount nursing routes');
console.log('Phase 6B Nursing readiness check passed');
