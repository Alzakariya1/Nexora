const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const models = read('src/models/index.js');
const routes = read('src/routes/ot-surgery.routes.js');
const server = read('src/server.js');
const required = ['OTBooking','SurgeryNote','AnaesthesiaNote','PostOpNote','OTInventoryUsage'];
for (const token of required) {
  if (!models.includes(token)) throw new Error(`Missing model ${token}`);
}
for (const collection of ['ot_bookings','surgery_notes','anaesthesia_notes','post_op_notes','ot_inventory_usages']) {
  if (!models.includes(collection)) throw new Error(`Missing tenant collection ${collection}`);
}
for (const endpoint of ['/ot/bookings','/ot/dashboard','/surgery-note','/anaesthesia-note','/post-op-note','/inventory-usage']) {
  if (!routes.includes(endpoint)) throw new Error(`Missing OT endpoint ${endpoint}`);
}
if (!routes.includes('tenantFilter(req') || !routes.includes('tenantCreateData(req')) throw new Error('OT routes must use tenant filter/create helpers');
if (!routes.includes('requirePermission(\'clinical.view\')') || !routes.includes('requirePermission(\'clinical.manage\')')) throw new Error('OT routes must enforce clinical permissions');
if (!routes.includes('auditEvent')) throw new Error('OT routes must audit write actions');
if (!server.includes('ot-surgery.routes')) throw new Error('Server did not mount OT routes');
console.log('Phase 6A OT/Surgery readiness check passed');
