const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const required = [
  ['src/routes/pacs-dicom.routes.js', ['router.get(\'/pacs/dashboard\'', 'router.get(\'/pacs/worklist\'', 'router.post(\'/pacs/studies\'', 'router.patch(\'/pacs/studies/:id/link\'', 'router.get(\'/pacs/studies/:id/manifest\'', 'router.post(\'/pacs/verify-connection\'', 'tenantFilter(req']],
  ['src/server.js', ['pacs-dicom.routes']],
  ['../frontend/src/api/pacsApi.js', ['dashboard', 'worklist', 'createStudy', 'linkStudy', 'verifyConnection']],
  ['../frontend/src/pages/PACSDicom.jsx', ['PACS / DICOM Worklist', 'DICOM Imaging Worklist', 'ImagingStudy', 'Save / Verify PACS Config']],
];

const missing = [];
for (const [rel, needles] of required) {
  const file = path.resolve(root, rel);
  if (!fs.existsSync(file)) {
    missing.push(`${rel}: file missing`);
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of needles) {
    if (!text.includes(needle)) missing.push(`${rel}: missing ${needle}`);
  }
}

if (missing.length) {
  console.error('Phase 7C PACS/DICOM readiness check failed:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}
console.log('Phase 7C PACS/DICOM readiness check passed.');
