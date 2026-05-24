const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mustContain = [
  ['src/server.js', 'routes/reports.routes'],
  ['src/routes/reports.routes.js', '/reports/revenue-billing'],
  ['src/routes/reports.routes.js', "requirePermission('analytics.view')"],
  ['src/routes/reports.routes.js', 'tenantFilter(req'],
  ['src/routes/reports.routes.js', 'daily_revenue'],
  ['src/routes/reports.routes.js', 'payment_modes'],
  ['src/routes/reports.routes.js', 'department_wise_revenue'],
  ['src/routes/reports.routes.js', 'doctor_wise_revenue'],
  ['src/routes/reports.routes.js', 'insurance_outstanding'],
  ['src/routes/reports.routes.js', 'lifetime_outstanding'],
  ['src/routes/reports.routes.js', 'discount_rate'],
  ['src/routes/reports.routes.js', 'refund_rate'],
  ['../frontend/src/api/reportApi.js', 'getRevenueBillingReports'],
  ['../frontend/src/pages/Reports.jsx', 'Revenue & Billing'],
  ['../frontend/src/pages/Reports.jsx', 'Payment Mode Report'],
  ['../frontend/src/pages/Reports.jsx', 'Department-wise Revenue'],
];

const missing = [];
for (const [file, needle] of mustContain) {
  const full = path.join(root, file);
  const text = fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  if (!text.includes(needle)) missing.push(`${file} missing ${needle}`);
}

const reportsRoute = fs.readFileSync(path.join(root, 'src/routes/reports.routes.js'), 'utf8');
const revenueEndpointBlock = reportsRoute.slice(reportsRoute.indexOf("/reports/revenue-billing"));
if (!revenueEndpointBlock.includes('Billing.find(activeFilter)')) missing.push('Revenue report must query Billing with active tenant filter');
if (!revenueEndpointBlock.includes('InsuranceClaim.find(tenantFilter')) missing.push('Revenue report must keep insurance outstanding tenant scoped');

if (missing.length) {
  console.error('Phase 5B revenue and billing reports check failed:');
  missing.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log('Phase 5B revenue and billing reports check passed.');
