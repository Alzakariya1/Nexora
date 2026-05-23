const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src/routes/saas-customer-success.routes.js'), 'utf8');
const models = fs.readFileSync(path.join(root, 'src/models/index.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

const required = [
  'CustomerSuccessNote',
  'RenewalWorkflow',
  '/saas/customer-success/overview',
  '/saas/customer-success/notes',
  '/saas/renewals',
  "allowRoles('super_admin')",
  "requirePermission('hospital.manage')",
  'customer_success_note_created',
  'renewal_workflow_created',
];

const missing = required.filter((token) => !route.includes(token) && !models.includes(token) && !server.includes(token));
if (missing.length) {
  console.error('Customer success readiness check failed. Missing:', missing.join(', '));
  process.exit(1);
}

console.log('SaaS customer success readiness check passed.');
