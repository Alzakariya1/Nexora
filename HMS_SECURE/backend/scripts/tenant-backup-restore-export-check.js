const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const routePath = path.join(root, 'src/routes/tenant-database.routes.js');
const modelPath = path.join(root, 'src/models/index.js');
const packagePath = path.join(root, 'package.json');

function read(file) { return fs.readFileSync(file, 'utf8'); }
function assertContains(content, needle, label) {
  if (!content.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

const route = read(routePath);
const models = read(modelPath);
const pkg = JSON.parse(read(packagePath));

[
  'TenantRestoreRequest',
  'TenantDataExport',
  'TenantDisasterRecoveryLog',
  'restore-requests',
  '/tenant-databases/:hospitalId/export',
  '/tenant-databases/exports/:id/download',
  '/tenant-databases/disaster-recovery-logs',
  'sha256File',
  'retention_until',
  'checksum_sha256',
].forEach((needle) => assertContains(route, needle, 'tenant DR/export route guardrail'));

[
  'const TenantRestoreRequest',
  'const TenantDataExport',
  'const TenantDisasterRecoveryLog',
  'restore_test_status',
  'verification_status',
  'retention_until',
  'checksum_sha256',
].forEach((needle) => assertContains(models, needle, 'tenant DR/export model'));

assertContains(JSON.stringify(pkg.scripts || {}), 'check:tenant-backup-restore-export', 'npm script');
console.log('Tenant backup/restore/export hardening check passed.');
