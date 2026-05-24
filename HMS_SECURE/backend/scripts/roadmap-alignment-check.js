const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const required = [
  'docs/PHASE4L_ROADMAP_REALIGNMENT_AUDIT_REPORT.md',
  'docs/ROADMAP_STATUS_AFTER_PHASE4L.md',
  'docs/LATEST_PHASE_REPORT.md',
  'backend/scripts/tenant-isolation-audit.js',
  'backend/scripts/tenant-safety-check.js',
  'backend/scripts/plan-limit-check.js',
  'backend/scripts/saas-knowledge-base-check.js'
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error('Roadmap alignment check failed. Missing files:');
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const report = fs.readFileSync(path.join(root, 'docs/PHASE4L_ROADMAP_REALIGNMENT_AUDIT_REPORT.md'), 'utf8');
for (const marker of ['Phase 4M', 'Phase 4N', 'Phase 5A']) {
  if (!report.includes(marker)) {
    console.error(`Roadmap alignment check failed. Missing marker: ${marker}`);
    process.exit(1);
  }
}

console.log('Roadmap alignment check passed. Phase 4 pending gaps and Phase 5 start point are documented.');
