const express = require('express');
const {
  StaffProfile,
  StaffAttendance,
  StaffShiftRoster,
  StaffLeaveRequest,
  StaffPayrollExport,
  Department,
} = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken, requirePermission } = require('../middleware/auth');
const { attachTenant, tenantFilter, tenantCreateData } = require('../middleware/tenant');
const { auditEvent } = require('../utils/audit');

const router = express.Router();
router.use(verifyToken, attachTenant);

const clean = (value) => (value === undefined || value === null ? '' : String(value).trim());
const toNum = (value) => (value === undefined || value === null || value === '' ? undefined : Number(value));
const toDate = (value) => (value ? new Date(value) : undefined);
const uid = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
const employmentTypes = new Set(['full_time', 'part_time', 'contract', 'consultant', 'intern']);
const staffStatuses = new Set(['active', 'inactive', 'on_leave', 'terminated']);
const attendanceStatuses = new Set(['present', 'absent', 'late', 'half_day', 'leave', 'holiday']);
const rosterStatuses = new Set(['scheduled', 'completed', 'cancelled', 'swapped']);
const leaveStatuses = new Set(['requested', 'approved', 'rejected', 'cancelled']);
const leaveTypes = new Set(['casual', 'sick', 'earned', 'maternity', 'paternity', 'unpaid', 'other']);

const normalize = (value, allowed, fallback) => {
  const v = clean(value).toLowerCase();
  return allowed.has(v) ? v : fallback;
};
async function audit(req, action, entity_type, entity_id, metadata = {}, severity = 'info') {
  await auditEvent({ req, action, module_name: 'hr_staff', entity_type, entity_id, new_value: metadata, metadata, status: 'success', severity });
}
async function findStaff(req, id) {
  if (!id) return null;
  return StaffProfile.findOne(tenantFilter(req, { id: Number(id) })).lean();
}
function daysBetween(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start); const e = new Date(end);
  return Math.max(1, Math.round((Date.UTC(e.getFullYear(), e.getMonth(), e.getDate()) - Date.UTC(s.getFullYear(), s.getMonth(), s.getDate())) / 86400000) + 1);
}
function dateRange(req) {
  const from = toDate(req.query.from) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = toDate(req.query.to) || new Date();
  to.setHours(23, 59, 59, 999);
  return { from, to };
}

router.get('/hr-staff/dashboard', requirePermission('admin.view'), asyncHandler(async (req, res) => {
  const { from, to } = dateRange(req);
  const base = tenantFilter(req, {});
  const [staff, attendance, leaves, rosters, payrollExports] = await Promise.all([
    StaffProfile.find(base).lean(),
    StaffAttendance.find(tenantFilter(req, { attendance_date: { $gte: from, $lte: to } })).lean(),
    StaffLeaveRequest.find(tenantFilter(req, { status: { $in: ['requested', 'approved'] } })).lean(),
    StaffShiftRoster.find(tenantFilter(req, { roster_date: { $gte: from, $lte: to } })).lean(),
    StaffPayrollExport.find(base).sort({ id: -1 }).limit(5).lean(),
  ]);
  const byDepartment = {};
  for (const s of staff) {
    const key = s.department_name || `Department ${s.department_id || 'Unassigned'}`;
    byDepartment[key] ||= { department: key, total: 0, active: 0 };
    byDepartment[key].total += 1;
    if (s.status === 'active') byDepartment[key].active += 1;
  }
  res.json({
    totalStaff: staff.length,
    activeStaff: staff.filter((s) => s.status === 'active').length,
    onLeaveStaff: staff.filter((s) => s.status === 'on_leave').length,
    attendanceMarked: attendance.length,
    presentToday: attendance.filter((a) => a.status === 'present').length,
    lateCount: attendance.filter((a) => a.status === 'late').length,
    pendingLeaves: leaves.filter((l) => l.status === 'requested').length,
    approvedLeaves: leaves.filter((l) => l.status === 'approved').length,
    rosteredShifts: rosters.length,
    payrollExports: payrollExports.length,
    byDepartment: Object.values(byDepartment),
    recentPayrollExports: payrollExports,
  });
}));

router.get('/hr-staff/staff', requirePermission('admin.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.status) where.status = normalize(req.query.status, staffStatuses, 'active');
  if (req.query.department_id) where.department_id = Number(req.query.department_id);
  if (req.query.role) where.role = clean(req.query.role);
  res.json(await StaffProfile.find(tenantFilter(req, where)).sort({ id: -1 }).limit(500).lean());
}));
router.post('/hr-staff/staff', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!clean(body.full_name)) return res.status(400).json({ message: 'full_name is required' });
  let departmentName = clean(body.department_name);
  if (body.department_id && !departmentName) {
    const dept = await Department.findOne(tenantFilter(req, { id: Number(body.department_id) })).lean();
    departmentName = dept?.name || '';
  }
  const staff = await StaffProfile.create(tenantCreateData(req, {
    staff_uid: clean(body.staff_uid) || uid('STF'), full_name: clean(body.full_name), email: clean(body.email), phone: clean(body.phone),
    role: clean(body.role) || 'staff', department_id: toNum(body.department_id), department_name: departmentName,
    designation: clean(body.designation), employment_type: normalize(body.employment_type, employmentTypes, 'full_time'),
    joining_date: toDate(body.joining_date), salary_basic: toNum(body.salary_basic), payroll_code: clean(body.payroll_code),
    emergency_contact_name: clean(body.emergency_contact_name), emergency_contact_phone: clean(body.emergency_contact_phone), address: clean(body.address),
    status: normalize(body.status, staffStatuses, 'active'), created_by: req.user?.id,
  }));
  await audit(req, 'hr_staff.staff.created', 'StaffProfile', staff.id, { role: staff.role, department_id: staff.department_id });
  res.status(201).json(staff);
}));
router.patch('/hr-staff/staff/:id', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.employment_type) updates.employment_type = normalize(updates.employment_type, employmentTypes, 'full_time');
  if (updates.status) updates.status = normalize(updates.status, staffStatuses, 'active');
  if (updates.department_id && !updates.department_name) {
    const dept = await Department.findOne(tenantFilter(req, { id: Number(updates.department_id) })).lean();
    updates.department_name = dept?.name || '';
  }
  const staff = await StaffProfile.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!staff) return res.status(404).json({ message: 'Staff profile not found' });
  await audit(req, 'hr_staff.staff.updated', 'StaffProfile', staff.id, { status: staff.status });
  res.json(staff);
}));

router.get('/hr-staff/attendance', requirePermission('admin.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.staff_id) where.staff_id = Number(req.query.staff_id);
  if (req.query.status) where.status = normalize(req.query.status, attendanceStatuses, 'present');
  if (req.query.from || req.query.to) { const { from, to } = dateRange(req); where.attendance_date = { $gte: from, $lte: to }; }
  res.json(await StaffAttendance.find(tenantFilter(req, where)).sort({ attendance_date: -1, id: -1 }).limit(500).lean());
}));
router.post('/hr-staff/attendance', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const staff = await findStaff(req, body.staff_id);
  if (!staff) return res.status(404).json({ message: 'Staff profile not found for this tenant' });
  const attendance = await StaffAttendance.create(tenantCreateData(req, {
    staff_id: staff.id, staff_name: staff.full_name, attendance_date: toDate(body.attendance_date) || new Date(), shift: clean(body.shift),
    check_in_at: toDate(body.check_in_at), check_out_at: toDate(body.check_out_at), status: normalize(body.status, attendanceStatuses, 'present'),
    late_minutes: toNum(body.late_minutes), overtime_minutes: toNum(body.overtime_minutes), notes: clean(body.notes), marked_by: req.user?.id,
  }));
  await audit(req, 'hr_staff.attendance.marked', 'StaffAttendance', attendance.id, { staff_id: staff.id, status: attendance.status });
  res.status(201).json(attendance);
}));
router.patch('/hr-staff/attendance/:id', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = normalize(updates.status, attendanceStatuses, 'present');
  const attendance = await StaffAttendance.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });
  await audit(req, 'hr_staff.attendance.updated', 'StaffAttendance', attendance.id, { status: attendance.status });
  res.json(attendance);
}));

router.get('/hr-staff/rosters', requirePermission('admin.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.staff_id) where.staff_id = Number(req.query.staff_id);
  if (req.query.department_id) where.department_id = Number(req.query.department_id);
  if (req.query.from || req.query.to) { const { from, to } = dateRange(req); where.roster_date = { $gte: from, $lte: to }; }
  res.json(await StaffShiftRoster.find(tenantFilter(req, where)).sort({ roster_date: 1, id: -1 }).limit(500).lean());
}));
router.post('/hr-staff/rosters', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const staff = await findStaff(req, body.staff_id);
  if (!staff) return res.status(404).json({ message: 'Staff profile not found for this tenant' });
  const roster = await StaffShiftRoster.create(tenantCreateData(req, {
    staff_id: staff.id, staff_name: staff.full_name, department_id: staff.department_id, roster_date: toDate(body.roster_date) || new Date(),
    shift_name: clean(body.shift_name), start_time: clean(body.start_time), end_time: clean(body.end_time), ward_or_location: clean(body.ward_or_location),
    status: normalize(body.status, rosterStatuses, 'scheduled'), assigned_by: req.user?.id, notes: clean(body.notes),
  }));
  await audit(req, 'hr_staff.roster.created', 'StaffShiftRoster', roster.id, { staff_id: staff.id, shift_name: roster.shift_name });
  res.status(201).json(roster);
}));
router.patch('/hr-staff/rosters/:id', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_by: req.user?.id };
  delete updates.hospital_id; delete updates.id; delete updates._id;
  if (updates.status) updates.status = normalize(updates.status, rosterStatuses, 'scheduled');
  const roster = await StaffShiftRoster.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), updates, { new: true });
  if (!roster) return res.status(404).json({ message: 'Shift roster not found' });
  await audit(req, 'hr_staff.roster.updated', 'StaffShiftRoster', roster.id, { status: roster.status });
  res.json(roster);
}));

router.get('/hr-staff/leaves', requirePermission('admin.view'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.staff_id) where.staff_id = Number(req.query.staff_id);
  if (req.query.status) where.status = normalize(req.query.status, leaveStatuses, 'requested');
  res.json(await StaffLeaveRequest.find(tenantFilter(req, where)).sort({ id: -1 }).limit(500).lean());
}));
router.post('/hr-staff/leaves', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const staff = await findStaff(req, body.staff_id);
  if (!staff) return res.status(404).json({ message: 'Staff profile not found for this tenant' });
  const start = toDate(body.start_date); const end = toDate(body.end_date) || start;
  const leave = await StaffLeaveRequest.create(tenantCreateData(req, {
    staff_id: staff.id, staff_name: staff.full_name, leave_type: normalize(body.leave_type, leaveTypes, 'casual'), start_date: start, end_date: end,
    total_days: toNum(body.total_days) || daysBetween(start, end), reason: clean(body.reason), status: normalize(body.status, leaveStatuses, 'requested'), requested_by: req.user?.id,
  }));
  await audit(req, 'hr_staff.leave.requested', 'StaffLeaveRequest', leave.id, { staff_id: staff.id, status: leave.status });
  res.status(201).json(leave);
}));
router.post('/hr-staff/leaves/:id/review', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const status = normalize(req.body?.status, leaveStatuses, 'approved');
  if (!['approved', 'rejected', 'cancelled'].includes(status)) return res.status(400).json({ message: 'status must be approved, rejected or cancelled' });
  const leave = await StaffLeaveRequest.findOneAndUpdate(tenantFilter(req, { id: Number(req.params.id) }), { status, reviewed_by: req.user?.id, reviewed_at: new Date(), review_notes: clean(req.body?.review_notes) }, { new: true });
  if (!leave) return res.status(404).json({ message: 'Leave request not found' });
  if (status === 'approved') await StaffProfile.findOneAndUpdate(tenantFilter(req, { id: leave.staff_id }), { status: 'on_leave' });
  await audit(req, 'hr_staff.leave.reviewed', 'StaffLeaveRequest', leave.id, { status });
  res.json(leave);
}));

router.post('/hr-staff/payroll-exports', requirePermission('admin.manage'), asyncHandler(async (req, res) => {
  const body = req.body || {};
  const period_start = toDate(body.period_start) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const period_end = toDate(body.period_end) || new Date();
  period_end.setHours(23, 59, 59, 999);
  const [staff, attendance, leaves] = await Promise.all([
    StaffProfile.find(tenantFilter(req, { status: { $ne: 'terminated' } })).lean(),
    StaffAttendance.find(tenantFilter(req, { attendance_date: { $gte: period_start, $lte: period_end } })).lean(),
    StaffLeaveRequest.find(tenantFilter(req, { status: 'approved', start_date: { $lte: period_end }, end_date: { $gte: period_start } })).lean(),
  ]);
  const rows = staff.map((s) => {
    const presentDays = attendance.filter((a) => a.staff_id === s.id && ['present', 'late', 'half_day'].includes(a.status)).reduce((sum, a) => sum + (a.status === 'half_day' ? 0.5 : 1), 0);
    const leaveDays = leaves.filter((l) => l.staff_id === s.id).reduce((sum, l) => sum + Number(l.total_days || 0), 0);
    return { staff_id: s.id, staff_uid: s.staff_uid, staff_name: s.full_name, department_name: s.department_name, designation: s.designation, salary_basic: Number(s.salary_basic || 0), present_days: presentDays, approved_leave_days: leaveDays, payroll_code: s.payroll_code || '' };
  });
  const exportDoc = await StaffPayrollExport.create(tenantCreateData(req, {
    period_start, period_end, export_uid: uid('PAY'), status: 'generated', generated_by: req.user?.id, generated_at: new Date(),
    staff_count: rows.length, gross_basic_total: rows.reduce((sum, r) => sum + Number(r.salary_basic || 0), 0), attendance_days_total: rows.reduce((sum, r) => sum + Number(r.present_days || 0), 0), leave_days_total: rows.reduce((sum, r) => sum + Number(r.approved_leave_days || 0), 0), rows, notes: clean(body.notes),
  }));
  await audit(req, 'hr_staff.payroll_export.generated', 'StaffPayrollExport', exportDoc.id, { staff_count: rows.length });
  res.status(201).json(exportDoc);
}));
router.get('/hr-staff/payroll-exports', requirePermission('admin.view'), asyncHandler(async (req, res) => {
  res.json(await StaffPayrollExport.find(tenantFilter(req, {})).sort({ id: -1 }).limit(100).lean());
}));
router.get('/hr-staff/payroll-exports/:id', requirePermission('admin.view'), asyncHandler(async (req, res) => {
  const exportDoc = await StaffPayrollExport.findOne(tenantFilter(req, { id: Number(req.params.id) })).lean();
  if (!exportDoc) return res.status(404).json({ message: 'Payroll export not found' });
  res.json(exportDoc);
}));

module.exports = router;
