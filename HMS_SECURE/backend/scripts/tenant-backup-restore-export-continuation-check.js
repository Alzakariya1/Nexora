const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/tenant-database.routes.js'), 'utf8');
const models = fs.readFileSync(path.join(root, 'src/models/index.js'), 'utf8');
const checks = [
  ['export manifest endpoint', route.includes("/tenant-databases/exports/:id/manifest")],
  ['manifest builder', route.includes('function buildManifest')],
  ['restore approval checklist guard', route.includes('Restore approval checklist incomplete')],
  ['restore approval checklist model', models.includes('approval_checklist')],
  ['backup manifest model', models.includes('manifest: { type: Object, default: {} }')],
  ['export checksum model', models.includes('checksum_sha256: String') && models.includes('TenantDataExport')],
];
const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('Phase 4N continuation check failed:', failed.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log('Phase 4N continuation backup/restore/export safety check passed');
