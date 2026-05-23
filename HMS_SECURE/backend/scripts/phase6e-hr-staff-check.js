const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const assert = (condition, message) => {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`OK: ${message}`);
};

const models = read('src/models/index.js');
const routes = read('src/routes/hr-staff.routes.js');
const server = read('src/server.js');
const pkg = JSON.parse(read('package.json'));
const apiIndex = fs.existsSync(path.join(root, '../frontend/src/api/index.js')) ? fs.readFileSync(path.join(root, '../frontend/src/api/index.js'), 'utf8') : '';
const pageIndex = fs.existsSync(path.join(root, '../frontend/src/pages/index.js')) ? fs.readFileSync(path.join(root, '../frontend/src/pages/index.js'), 'utf8') : '';
const main = fs.existsSync(path.join(root, '../frontend/src/main.jsx')) ? fs.readFileSync(path.join(root, '../frontend/src/main.jsx'), 'utf8') : '';
const page = fs.existsSync(path.join(root, '../frontend/src/pages/HRStaff.jsx')) ? fs.readFileSync(path.join(root, '../frontend/src/pages/HRStaff.jsx'), 'utf8') : '';

[
  'StaffProfile', 'StaffAttendance', 'StaffShiftRoster', 'StaffLeaveRequest', 'StaffPayrollExport',
  'staff_profiles', 'staff_attendance', 'staff_shift_rosters', 'staff_leave_requests', 'staff_payroll_exports'
].forEach((token) => assert(models.includes(token), `model includes ${token}`));

[
  '/hr-staff/dashboard', '/hr-staff/staff', '/hr-staff/attendance', '/hr-staff/rosters', '/hr-staff/leaves', '/hr-staff/payroll-exports',
  'tenantFilter(req', 'tenantCreateData(req', "requirePermission('admin.view')", "requirePermission('admin.manage')", 'auditEvent', 'hr_staff.'
].forEach((token) => assert(routes.includes(token), `route includes ${token}`));

assert(server.includes('hr-staff.routes'), 'server loads HR/staff routes');
assert(pkg.scripts['check:phase6e-hr-staff'] === 'node scripts/phase6e-hr-staff-check.js', 'package exposes Phase 6E readiness check');
assert(apiIndex.includes('hrStaffApi'), 'frontend API index exports HR Staff API');
assert(pageIndex.includes('HRStaff'), 'frontend page index exports HR Staff page');
assert(main.includes('["hrStaff", "HR / Staff"') && main.includes('HRStaff'), 'main navigation includes HR / Staff tab');
assert(page.includes('Staff Profiles') && page.includes('Attendance') && page.includes('Shift Roster') && page.includes('Leave Requests') && page.includes('Payroll Export'), 'HR Staff UI covers roadmap sections');

console.log('Phase 6E HR / Staff readiness check passed.');
