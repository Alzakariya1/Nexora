const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const routes = fs.readFileSync(path.join(root, 'src/routes/saas-billing.routes.js'), 'utf8');
const models = fs.readFileSync(path.join(root, 'src/models/index.js'), 'utf8');

const checks = [
  ['webhook model exists', models.includes('const SaaSPaymentWebhook')],
  ['webhook unique gateway event index exists', models.includes('saas_webhook_gateway_event_unique')],
  ['webhook idempotency index exists', models.includes('saas_webhook_idempotency_unique')],
  ['payment transaction dedupe index exists', models.includes('saas_payment_transaction_unique')],
  ['payment intent link dedupe index exists', models.includes('saas_payment_intent_link_unique')],
  ['public signed webhook endpoint exists', routes.includes("/saas/payment-webhooks/:gateway")],
  ['signature verification uses HMAC SHA256', routes.includes("crypto.createHmac('sha256'") && routes.includes('timingSafeEqual')],
  ['duplicate webhook handling exists', routes.includes('Duplicate webhook ignored') && routes.includes('code === 11000')],
  ['gateway payment reconciliation helper exists', routes.includes('applyGatewayPayment')],
  ['invoice reconciliation endpoint exists', routes.includes("/saas/invoices/:id/reconcile")],
  ['admin webhook listing endpoint exists', routes.includes("/saas/payment-webhooks")],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('SaaS webhook reconciliation check failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log('SaaS webhook reconciliation check passed.');
