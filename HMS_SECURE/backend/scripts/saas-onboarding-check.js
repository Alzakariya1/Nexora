const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/tenant.routes.js'), 'utf8');
const models = fs.readFileSync(path.join(root, 'src/models/index.js'), 'utf8');
const required = [
  "router.post('/tenants/onboarding/draft'",
  "router.patch('/tenants/:id/onboarding'",
  "router.post('/tenants/:id/onboarding/complete'",
  'sanitizeBranches',
  'normalizeOnboarding',
  'hospital admin user',
  'auditTenantAction(req, `Completed onboarding'
];
const missing = required.filter((x) => !route.includes(x));
if (!models.includes('branches: { type: [Object]') || !models.includes('onboarding: {')) missing.push('Hospital onboarding schema fields');
if (missing.length) {
  console.error('SaaS onboarding readiness check failed:', missing.join(', '));
  process.exit(1);
}
console.log('SaaS onboarding readiness check passed.');
