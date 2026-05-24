const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
function read(p) { return fs.readFileSync(path.join(root, p), 'utf8'); }
function assertContains(file, text, message) {
  const content = read(file);
  if (!content.includes(text)) throw new Error(`${message} missing in ${file}: ${text}`);
}
const checks = [
  ['src/server.js', 'abdm-abha.routes', 'ABDM route mount'],
  ['src/routes/abdm-abha.routes.js', '/abdm/summary', 'ABDM summary endpoint'],
  ['src/routes/abdm-abha.routes.js', '/abdm/identity/verify', 'ABHA identity verification endpoint'],
  ['src/routes/abdm-abha.routes.js', '/abdm/consents', 'Consent artefact endpoint'],
  ['src/routes/abdm-abha.routes.js', '/abdm/care-contexts', 'Care context endpoint'],
  ['src/routes/abdm-abha.routes.js', '/abdm/gateway/callback', 'Gateway callback endpoint'],
  ['src/routes/abdm-abha.routes.js', 'tenantFilter(req', 'Tenant scoped reads/updates'],
  ['src/routes/abdm-abha.routes.js', 'tenantCreateData(req', 'Tenant scoped creates'],
  ['src/routes/abdm-abha.routes.js', 'auditEvent', 'ABDM audit logging'],
  ['src/models/index.js', 'ABDMConsent', 'ABDM consent model'],
  ['src/models/index.js', 'ABHACareContext', 'ABHA care context model'],
  ['../frontend/src/pages/ABDMABHA.jsx', 'Verify / Link ABHA Identity', 'Existing ABDM page upgraded'],
  ['../frontend/src/pages/ABDMABHA.jsx', 'Consent Artefact Workflow', 'Consent UI'],
  ['../frontend/src/pages/ABDMABHA.jsx', 'Link Care Context', 'Care context UI'],
  ['../frontend/src/api/integrationApi.js', 'abdmSummary', 'ABDM frontend API client'],
];
for (const [file, text, message] of checks) assertContains(file, text, message);
console.log('Phase 7D ABDM/ABHA readiness check passed.');
