const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const frontendRoot = path.join(root, '..', 'frontend');
function read(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function readFrontend(file) { return fs.readFileSync(path.join(frontendRoot, file), 'utf8'); }
function assertContains(content, needle, label) {
  if (!content.includes(needle)) throw new Error(`${label || needle} missing`);
}
const saasApi = readFrontend('src/api/saasApi.js');
assertContains(saasApi, "api.post(`/tenants/${id}/lifecycle/${data.action}`, data)", 'canonical lifecycle POST client');
const subRoutes = read('src/routes/subscription.routes.js');
assertContains(subRoutes, "allowRoles('super_admin')", 'super admin lifecycle guard');
assertContains(subRoutes, 'Default hospital cannot be suspended or cancelled', 'default tenant protection');
const saasPage = readFrontend('src/pages/SaasControl.jsx');
assertContains(saasPage, 'Commercial operations dashboard', 'billing dashboard section');
assertContains(saasPage, 'Collection rate', 'collection rate KPI');
assertContains(saasPage, 'High usage tenants', 'usage risk panel');
const configPage = readFrontend('src/pages/Configuration.jsx');
assertContains(configPage, 'Tenant Usage Dashboard', 'tenant usage dashboard label');
assertContains(configPage, 'guardrails', 'tenant guardrail visibility');
console.log('SaaS UI and billing dashboard safety check passed');
