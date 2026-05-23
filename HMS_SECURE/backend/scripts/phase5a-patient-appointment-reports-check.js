const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mustContain = [
  ['src/server.js', 'routes/reports.routes'],
  ['src/routes/reports.routes.js', '/reports/patients-appointments'],
  ['src/routes/reports.routes.js', 'tenantFilter(req'],
  ['src/routes/reports.routes.js', "requirePermission('analytics.view')"],
  ['src/routes/reports.routes.js', 'doctor_wise_appointments'],
  ['src/routes/reports.routes.js', 'department_wise_patients'],
  ['src/routes/reports.routes.js', 'average_waiting_minutes'],
  ['src/routes/reports.routes.js', 'no_show_rate'],
];

const missing = [];
for (const [file, needle] of mustContain) {
  const full = path.join(root, file);
  const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  if (!text.includes(needle)) missing.push(`${file} missing ${needle}`);
}

if (missing.length) {
  console.error('Phase 5A reports check failed:');
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Phase 5A patient and appointment reports check passed.');
