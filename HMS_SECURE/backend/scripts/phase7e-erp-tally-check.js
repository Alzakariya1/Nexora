const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assertIncludes(file, needle, label) {
  const text = read(file);
  if (!text.includes(needle)) throw new Error(`${label} missing in ${file}: ${needle}`);
}

assertIncludes('src/server.js', 'erp-tally.routes', 'ERP/Tally route registration');
assertIncludes('src/routes/erp-tally.routes.js', "/erp-tally/summary", 'ERP summary endpoint');
assertIncludes('src/routes/erp-tally.routes.js', "/erp-tally/ledger-mapping", 'Ledger mapping endpoint');
assertIncludes('src/routes/erp-tally.routes.js', "/erp-tally/export/preview", 'Export preview endpoint');
assertIncludes('src/routes/erp-tally.routes.js', "/erp-tally/export", 'Export endpoint');
assertIncludes('src/routes/erp-tally.routes.js', 'toTallyXml', 'Tally XML formatter');
assertIncludes('src/routes/erp-tally.routes.js', 'exportHash', 'Checksum manifest');
assertIncludes('src/config/permissions.js', "'erp.view'", 'ERP view permission');
assertIncludes('src/config/permissions.js', "'erp.manage'", 'ERP manage permission');
assertIncludes('../frontend/src/pages/ERPTally.jsx', 'ERP/Tally Integration', 'Existing ERP/Tally page upgrade');
assertIncludes('../frontend/src/pages/ERPTally.jsx', 'Voucher Preview', 'Voucher preview UI');
assertIncludes('../frontend/src/api/erpTallyApi.js', 'previewExport', 'ERP frontend API client');
console.log('Phase 7E ERP/Tally readiness check passed.');
