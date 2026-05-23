const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

const requiredScripts = [
  'check-routes',
  'tenant:audit',
  'tenant:safety-check',
  'check:plan-limits',
  'check:saas-onboarding',
  'check:tenant-backup-restore-export',
  'check:tenant-backup-restore-export-continuation',
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

const missingScripts = requiredScripts.filter((script) => !pkg.scripts || !pkg.scripts[script]);
if (missingScripts.length) {
  console.error(`Regression suite cannot run. Missing scripts: ${missingScripts.join(', ')}`);
  process.exit(1);
}

const results = [];
for (const script of requiredScripts) {
  const started = Date.now();
  console.log(`\n=== Running ${script} ===`);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', script], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'test',
      JWT_SECRET: process.env.JWT_SECRET || 'phase8a_regression_secret_value_change_me',
      FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
    }
  });
  results.push({ script, status: result.status, durationMs: Date.now() - started });
  if (result.status !== 0) {
    console.error(`Regression suite failed at ${script}.`);
    process.exit(result.status || 1);
  }
}

const outputDir = path.join(root, 'test-results');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'phase8a-regression-summary.json'), JSON.stringify({
  generated_at: new Date().toISOString(),
  total: results.length,
  passed: results.filter((r) => r.status === 0).length,
  failed: results.filter((r) => r.status !== 0).length,
  results
}, null, 2));

console.log(`\nAutomated regression suite passed: ${results.length}/${results.length} checks.`);
