const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src', 'routes', 'saas-billing.routes.js'), 'utf8');
const api = fs.readFileSync(path.join(root, '..', 'frontend', 'src', 'api', 'saasApi.js'), 'utf8');
const ui = fs.readFileSync(path.join(root, '..', 'frontend', 'src', 'pages', 'SaasControl.jsx'), 'utf8');

const mustHave = [
  ['subscription analytics endpoint', route.includes("/saas/analytics/subscriptions")],
  ['MRR/ARR analytics metrics', route.includes('at_risk_mrr') && route.includes('projected_arr')],
  ['churn risk signal scoring', route.includes('tenantChurnSignal') && route.includes('risk_score')],
  ['forecast generation', route.includes('monthsAhead') && route.includes('projected_mrr')],
  ['analytics is super admin protected', route.includes("allowRoles('super_admin')") && route.includes("requirePermission('hospital.manage')")],
  ['frontend analytics api', api.includes('subscriptionAnalytics')],
  ['frontend subscription analytics UI', ui.includes('Subscription analytics') && ui.includes('Churn risk signals')],
  ['safe read-only analytics', !route.includes("router.post('/saas/analytics") && !route.includes("router.patch('/saas/analytics")],
];

const failed = mustHave.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('SaaS subscription analytics check failed:');
  for (const [name] of failed) console.error(`- ${name}`);
  process.exit(1);
}
console.log('SaaS subscription analytics, forecasting and churn risk check passed.');
