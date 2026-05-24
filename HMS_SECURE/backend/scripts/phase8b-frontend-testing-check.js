#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const frontendRoot = path.resolve(__dirname, '../../frontend');
const required = [
  'scripts/phase8b-frontend-testing-check.cjs',
  'src/components/Form.jsx',
  'src/components/DataTable.jsx',
  'src/pages/Login.jsx',
  'src/pages/Patients.jsx',
  'src/pages/Appointments.jsx',
  'src/pages/PatientPortal.jsx',
  'src/pages/DoctorPortal.jsx',
  'src/api/client.js'
];
const missing = required.filter((p) => !fs.existsSync(path.join(frontendRoot, p)));
if (missing.length) {
  console.error('Phase 8B frontend testing prerequisites missing:', missing.join(', '));
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(path.join(frontendRoot, 'package.json'), 'utf8'));
if (pkg.scripts?.['test:frontend'] !== 'npm run check:phase8b-frontend') {
  console.error('Frontend test:frontend script is not configured.');
  process.exit(1);
}
console.log('Phase 8B frontend testing integration check passed.');
