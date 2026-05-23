const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const routes = read('src/routes/reports.routes.js');
const frontend = fs.readFileSync(path.join(root, '..', 'frontend', 'src', 'pages', 'Reports.jsx'), 'utf8');
const api = fs.readFileSync(path.join(root, '..', 'frontend', 'src', 'api', 'reportApi.js'), 'utf8');
const required = [
  "/reports/executive-command-center",
  "pending_work_alerts",
  "department_performance",
  "executive_flags",
  "tenantFilter(req"
];
const missing = required.filter((x) => !routes.includes(x));
if (missing.length) throw new Error(`Executive command center route missing: ${missing.join(', ')}`);
if (!frontend.includes('Executive Command Center') || !frontend.includes('getExecutiveCommandCenter')) throw new Error('Executive command center UI tab/API usage missing');
if (!api.includes('getExecutiveCommandCenter')) throw new Error('Executive command center API client missing');
console.log('Phase 5D executive command center readiness check passed');
