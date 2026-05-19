require('dotenv').config();
const fs = require('fs');
const path = require('path');
const app = require('../src/server');

const projectRoot = path.resolve(__dirname, '..', '..');
const frontendPages = path.join(projectRoot, 'frontend', 'src', 'pages');

function walk(stack, prefix = '', out = []) {
  for (const layer of stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).map((x) => x.toUpperCase()).join(',');
      out.push(`${methods} ${prefix}${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle?.stack) {
      const raw = layer.regexp?.source || '';
      const mount = raw
        .replace('^\\/', '/')
        .replace('\\/?(?=\\/|$)', '')
        .replace(/\\\//g, '/')
        .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param')
        .replace(/\$$/, '');
      walk(layer.handle.stack, prefix + (mount === '^\\/?(?=\\/|$)' ? '' : mount), out);
    }
  }
  return out;
}

const routes = walk(app._router.stack);
const requiredRouteFragments = [
  '/api/patients', '/api/doctors', '/api/appointments', '/api/beds',
  '/api/lab/templates', '/api/radiology', '/api/pharmacy/medicines',
  '/api/inventory/suppliers', '/api/billing', '/api/audit',
  '/api/command-center/summary', '/api/legal-security/policies',
  '/api/enterprise-features/:feature/summary', '/api/enterprise-features/:feature/records',
  '/api/health/live', '/api/health/ready',
];

const requiredPages = [
  'Dashboard.jsx', 'CommandCenter.jsx', 'Patients.jsx', 'Doctors.jsx', 'Appointments.jsx',
  'Beds.jsx', 'Labs.jsx', 'Pharmacy.jsx', 'Inventory.jsx', 'Billing.jsx',
  'LegalSecurityCenter.jsx', 'HL7Ready.jsx', 'PACSDicom.jsx', 'Biometric.jsx',
  'ERPTally.jsx', 'ABDMABHA.jsx', 'TwoFactorSecurity.jsx', 'AuditCompliance.jsx',
  'InsuranceTPA.jsx', 'WhatsAppSMS.jsx', 'ProductionOps.jsx', 'SaasControl.jsx',
];

const missingRoutes = requiredRouteFragments.filter((fragment) => !routes.some((r) => r.includes(fragment)));
const missingPages = requiredPages.filter((file) => !fs.existsSync(path.join(frontendPages, file)));

console.log(`V49 module audit: ${routes.length} backend routes loaded.`);
console.log(`V49 module audit: ${requiredPages.length - missingPages.length}/${requiredPages.length} frontend module pages found.`);

if (missingRoutes.length || missingPages.length) {
  if (missingRoutes.length) console.error('Missing backend route fragments:', missingRoutes);
  if (missingPages.length) console.error('Missing frontend pages:', missingPages);
  process.exit(1);
}

console.log('V49 module audit passed: current module surface is present and route-load safe.');
