const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const projectRoot = path.resolve(root, '..');
function read(rel) {
  return fs.readFileSync(path.join(projectRoot, rel), 'utf8');
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function assertIncludes(file, needle, label) {
  const text = read(file);
  assert(text.includes(needle), `${label} missing in ${file}: ${needle}`);
}
function assertScript(name) {
  const pkg = JSON.parse(read('backend/package.json'));
  assert(pkg.scripts && pkg.scripts[name], `package.json missing script: ${name}`);
}

const coreScripts = [
  'check-routes',
  'test:regression',
  'test:automated',
  'check:phase8a-automated-testing',
  'tenant:audit',
  'tenant:safety-check',
  'check:phase5a-reports',
  'check:phase5b-reports',
  'check:phase5c-reports',
  'check:phase5d-command-center',
  'check:phase6a-ot-surgery',
  'check:phase6b-nursing',
  'check:phase6c-emergency',
  'check:phase6d-blood-bank',
  'check:phase6e-hr-staff',
  'check:phase6f-patient-portal',
  'check:phase6g-doctor-portal',
  'check:phase7a-fhir',
  'check:phase7b-hl7',
  'check:phase7c-pacs-dicom',
  'check:phase7d-abdm-abha',
  'check:phase7e-erp-tally',
  'check:phase7f-communications'
];
coreScripts.forEach(assertScript);

assertIncludes('backend/scripts/run-regression-suite.js', 'phase8a-regression-summary.json', 'Regression summary output');
assertIncludes('backend/scripts/run-regression-suite.js', 'check:phase7f-communications', 'Latest integration check included');
assertIncludes('docs/TESTING.md', 'npm run test:automated', 'Automated testing docs');
assertIncludes('docs/TESTING.md', 'Frontend production build', 'Frontend build requirement docs');
assertIncludes('docs/PROJECT_PHASE_HISTORY.md', 'Phase 8A', 'Project phase history update');
assertIncludes('docs/TESTING.md', 'Phase 8A', 'Phase 8A testing docs retained');

console.log('Phase 8A Automated Testing readiness check passed.');
