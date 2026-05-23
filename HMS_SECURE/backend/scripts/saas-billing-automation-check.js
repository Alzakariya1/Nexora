const fs = require('fs');
const path = require('path');

const routePath = path.join(__dirname, '..', 'src', 'routes', 'saas-billing.routes.js');
const modelPath = path.join(__dirname, '..', 'src', 'models', 'index.js');
const route = fs.readFileSync(routePath, 'utf8');
const model = fs.readFileSync(modelPath, 'utf8');

const requiredRouteMarkers = [
  "router.post('/saas/invoices/generate-due'",
  "router.post('/saas/invoices/dunning-scan'",
  'createSaaSInvoiceForHospital',
  'hasOpenInvoiceForPeriod',
  'dunningStageFor',
  'CommunicationLog.create',
  'subscription.status = \'past_due\'',
  "hospital.status = 'suspended'",
];

const requiredModelMarkers = [
  'auto_generated',
  'generated_run_id',
  'reminder_count',
  'last_reminder_at',
  'next_reminder_at',
  'dunning_stage',
  'saas_invoice_period_guardrail',
  'saas_invoice_dunning_lookup',
];

const missing = [
  ...requiredRouteMarkers.filter((marker) => !route.includes(marker)).map((marker) => `route:${marker}`),
  ...requiredModelMarkers.filter((marker) => !model.includes(marker)).map((marker) => `model:${marker}`),
];

if (missing.length) {
  console.error('SaaS billing automation readiness check failed. Missing markers:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log('SaaS billing automation readiness check passed.');
