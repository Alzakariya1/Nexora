const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const routePath = path.join(root, 'src', 'routes', 'hl7.routes.js');
const modelPath = path.join(root, 'src', 'models', 'index.js');
const serverPath = path.join(root, 'src', 'server.js');
const apiPath = path.join(root, '..', 'frontend', 'src', 'api', 'integrationApi.js');
const pagePath = path.join(root, '..', 'frontend', 'src', 'pages', 'HL7Ready.jsx');
for (const p of [routePath, modelPath, serverPath, apiPath, pagePath]) {
  if (!fs.existsSync(p)) {
    console.error('Phase 7B HL7 check failed. Missing file:', p);
    process.exit(1);
  }
}
const route = fs.readFileSync(routePath, 'utf8');
const model = fs.readFileSync(modelPath, 'utf8');
const server = fs.readFileSync(serverPath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');
const requiredRoute = [
  "router.get('/hl7/summary'",
  "router.get('/hl7/messages'",
  "router.post('/hl7/parse'",
  "router.post('/hl7/generate'",
  "router.post('/hl7/messages'",
  "router.post('/hl7/messages/:id/ack'",
  "router.post('/hl7/messages/:id/retry'",
  "router.post('/hl7/adt/from-appointment/:id'",
  "router.post('/hl7/orm/from-appointment/:id'",
  "router.post('/hl7/oru/from-lab/:id'",
  'parseHL7', 'appointmentToADT', 'appointmentToORM', 'labToORU', 'tenantFilter(req)', "system: 'hl7'",
];
const missingRoute = requiredRoute.filter(x => !route.includes(x));
if (missingRoute.length) {
  console.error('Phase 7B HL7 check failed. Missing route markers:', missingRoute.join(', '));
  process.exit(1);
}
const requiredModel = ['HL7Message', 'hl7_messages', 'message_type', 'control_id', 'retry_count', 'ack_code'];
const missingModel = requiredModel.filter(x => !model.includes(x));
if (missingModel.length) {
  console.error('Phase 7B HL7 check failed. Missing model markers:', missingModel.join(', '));
  process.exit(1);
}
if (!server.includes('hl7.routes')) {
  console.error('Phase 7B HL7 check failed. Server route not mounted.');
  process.exit(1);
}
const requiredApi = ['hl7Summary', 'hl7Messages', 'hl7Generate', 'hl7Parse', 'hl7Queue', 'hl7Ack', 'hl7Retry'];
const missingApi = requiredApi.filter(x => !api.includes(x));
if (missingApi.length) {
  console.error('Phase 7B HL7 check failed. Frontend API missing:', missingApi.join(', '));
  process.exit(1);
}
if (!page.includes('HL7 Queue') || !page.includes('Generate HL7 Test Message') || !page.includes('Queue Preview')) {
  console.error('Phase 7B HL7 check failed. HL7 UI not upgraded.');
  process.exit(1);
}
console.log('Phase 7B HL7 interface readiness check passed.');
