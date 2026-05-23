const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src', 'routes', 'saas-billing.routes.js'), 'utf8');
const models = fs.readFileSync(path.join(root, 'src', 'models', 'index.js'), 'utf8');
const api = fs.readFileSync(path.join(root, '..', 'frontend', 'src', 'api', 'saasApi.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, '..', 'frontend', 'src', 'pages', 'SaasControl.jsx'), 'utf8');

const mustHave = [
  ['provider adapter metadata endpoint', route.includes("/saas/payment-gateways/providers")],
  ['settlement summary endpoint', route.includes("/saas/settlements/summary")],
  ['settlement reconcile endpoint', route.includes("/saas/settlements/reconcile")],
  ['settlement export endpoint', route.includes("/saas/settlements/export.csv")],
  ['provider payment link builder', route.includes('buildProviderPaymentLink')],
  ['gateway fee calculation', route.includes('calculateGatewayFee')],
  ['SaaS settlement model', models.includes('const SaaSSettlement') && models.includes('saas_settlements')],
  ['payment settlement status fields', models.includes('settlement_status') && models.includes('gateway_fee')],
  ['frontend provider api', api.includes('paymentGateways') && api.includes('settlementSummary')],
  ['frontend settlement UI', ui.includes('Gateway providers & settlements') && ui.includes('Reconcile settlement')],
];

const failed = mustHave.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('SaaS provider settlement check failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log('SaaS provider integration and settlement reporting check passed.');
