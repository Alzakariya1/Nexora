const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const reportsRoute = fs.readFileSync(path.join(root, 'src/routes/reports.routes.js'), 'utf8');
const reportsPage = fs.readFileSync(path.join(root, '../frontend/src/pages/Reports.jsx'), 'utf8');
const reportApi = fs.readFileSync(path.join(root, '../frontend/src/api/reportApi.js'), 'utf8');

const requiredRouteSignals = [
  "'/reports/pharmacy-lab-ipd'",
  'Medicine.find(tenantFilter(req',
  'PharmacySale.find(tenantFilter(req',
  'LabTest.find(tenantFilter(req',
  'RadiologyTest.find(tenantFilter(req',
  'Bed.find(tenantFilter(req',
  'IpdAdmission.find(tenantFilter(req',
  'low_stock',
  'fast_moving_medicines',
  'average_lab_tat_hours',
  'bed_occupancy_rate',
  'average_length_of_stay_days',
];

const requiredUiSignals = [
  'getPharmacyLabIpdReports',
  'Pharmacy, Lab & IPD',
  'Low Stock Medicines',
  'Fast-moving Medicines',
  'Lab Category Summary',
  'Radiology Modality Summary',
  'Ward Occupancy',
  'Admission / Discharge Trend',
];

const missing = [];
for (const signal of requiredRouteSignals) {
  if (!reportsRoute.includes(signal)) missing.push(`reports route missing ${signal}`);
}
for (const signal of requiredUiSignals) {
  if (!reportsPage.includes(signal) && !reportApi.includes(signal)) missing.push(`reports UI/API missing ${signal}`);
}
if (missing.length) {
  console.error('Phase 5C reports check failed:');
  missing.forEach((m) => console.error(`- ${m}`));
  process.exit(1);
}
console.log('Phase 5C pharmacy/lab/IPD reports check passed.');
