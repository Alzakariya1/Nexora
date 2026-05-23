const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const required = [
  ['src/models/index.js', 'EmergencyCase'],
  ['src/models/index.js', 'emergency_cases'],
  ['src/models/index.js', 'EmergencyTriageNote'],
  ['src/models/index.js', 'EmergencyClinicalNote'],
  ['src/models/index.js', 'EmergencyTransfer'],
  ['src/models/index.js', 'emergency_hospital_uid_unique'],
  ['src/routes/emergency.routes.js', "router.get('/emergency/dashboard'"],
  ['src/routes/emergency.routes.js', "router.post('/emergency/cases'"],
  ['src/routes/emergency.routes.js', "router.post('/emergency/cases/:id/triage'"],
  ['src/routes/emergency.routes.js', "router.post('/emergency/cases/:id/clinical-note'"],
  ['src/routes/emergency.routes.js', "router.post('/emergency/cases/:id/transfer'"],
  ['src/routes/emergency.routes.js', "router.post('/emergency/cases/:id/billing-link'"],
  ['src/routes/emergency.routes.js', 'tenantFilter(req'],
  ['src/routes/emergency.routes.js', 'tenantCreateData(req'],
  ['src/routes/emergency.routes.js', 'auditEvent'],
  ['src/server.js', 'emergency.routes'],
];
const failures = [];
for (const [file, needle] of required) {
  const content = read(file);
  if (!content.includes(needle)) failures.push(`${file} missing ${needle}`);
}
if (failures.length) {
  console.error('Phase 6C Emergency/Casualty readiness check failed:');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}
console.log('Phase 6C Emergency/Casualty readiness check passed.');
