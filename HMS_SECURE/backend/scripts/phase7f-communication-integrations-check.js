const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function assertIncludes(file, needle, label) {
  const text = read(file);
  if (!text.includes(needle)) throw new Error(`${label} missing in ${file}: ${needle}`);
}

assertIncludes('src/server.js', 'communication.routes', 'Communication route registration');
assertIncludes('src/models/index.js', 'CommunicationTemplate', 'Communication template model');
assertIncludes('src/models/index.js', 'CommunicationRule', 'Communication rule model');
assertIncludes('src/models/index.js', 'provider_status', 'Provider lifecycle fields');
assertIncludes('src/utils/communication.js', 'renderTemplate', 'Template renderer');
assertIncludes('src/utils/communication.js', 'normalizeContact', 'Contact normalization');
assertIncludes('src/routes/communication.routes.js', '/communications/templates', 'Template endpoint');
assertIncludes('src/routes/communication.routes.js', '/communications/rules', 'Reminder rule endpoint');
assertIncludes('src/routes/communication.routes.js', '/communications/payment-due-reminders', 'Payment due reminder endpoint');
assertIncludes('src/routes/communication.routes.js', '/communications/provider-callback', 'Provider callback endpoint');
assertIncludes('src/routes/communication.routes.js', '/communications/:id/retry', 'Retry endpoint');
assertIncludes('../frontend/src/pages/Communications.jsx', 'Template governance', 'Existing Communications page upgraded');
assertIncludes('../frontend/src/pages/Communications.jsx', 'Reminder rules', 'Reminder rules UI');
assertIncludes('../frontend/src/api/communicationApi.js', 'providerCallback', 'Frontend provider callback client');
console.log('Phase 7F Communication Integrations readiness check passed.');
