const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routePath = path.join(root, 'src', 'routes', 'integration.routes.js');
const apiPath = path.join(root, '..', 'frontend', 'src', 'api', 'integrationApi.js');
const pagePath = path.join(root, '..', 'frontend', 'src', 'pages', 'FHIRAPIs.jsx');

const route = fs.readFileSync(routePath, 'utf8');
const api = fs.readFileSync(apiPath, 'utf8');
const page = fs.readFileSync(pagePath, 'utf8');

const required = [
  "router.get('/fhir/metadata'",
  "router.post('/fhir/validate'",
  "router.get('/fhir/Patient'",
  "router.get('/fhir/Encounter'",
  "router.get('/fhir/Observation'",
  "router.get('/fhir/DiagnosticReport'",
  "router.get('/fhir/Invoice'",
  "router.get('/fhir/MedicationRequest'",
  'tenantFilter(req)',
  "system: 'fhir'",
  'validateFhirResource',
  'CapabilityStatement',
  'FHIR_VERSION',
];
const missing = required.filter((x) => !route.includes(x));
if (missing.length) {
  console.error('Phase 7A FHIR check failed. Missing:', missing.join(', '));
  process.exit(1);
}
if (!api.includes("/fhir/${resource}") && !api.includes('/fhir/')) {
  console.error('Phase 7A FHIR check failed. Frontend API does not call FHIR endpoints.');
  process.exit(1);
}
if (!page.includes('FHIR APIs') || !page.includes('FHIR R4 API Key')) {
  console.error('Phase 7A FHIR check failed. FHIR page is not wired.');
  process.exit(1);
}
console.log('Phase 7A FHIR implementation readiness check passed.');
