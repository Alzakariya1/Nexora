const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(p){ return fs.readFileSync(path.join(root,p),'utf8'); }
const models = read('src/models/index.js');
const server = read('src/server.js');
const routes = read('src/routes/saas-support.routes.js');
const required = [
  ['SupportTicket model', models.includes('const SupportTicket = makeModel')],
  ['SupportTicket export', models.includes('SupportTicket,')],
  ['support route mounted', server.includes('saas-support.routes')],
  ['overview endpoint', routes.includes('/saas/support/overview')],
  ['ticket create endpoint', routes.includes('/saas/support/tickets')],
  ['escalation endpoint', routes.includes('/escalate')],
  ['SLA due tracking', routes.includes('sla_due_at') && routes.includes('sla_breached')],
  ['super admin guard', routes.includes("allowRoles('super_admin')")],
  ['permission guard', routes.includes("requirePermission('hospital.manage')")],
  ['audit logging', routes.includes('support_ticket_created') && routes.includes('support_ticket_escalated')],
];
const failed = required.filter(([,ok])=>!ok);
if (failed.length) { console.error('SaaS support check failed:', failed.map(([n])=>n).join(', ')); process.exit(1); }
console.log('SaaS support desk readiness check passed.');
